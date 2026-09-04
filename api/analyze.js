// api/analyze.js
//
// Vercel serverless function that accepts a POST body with a messages array,
// calls the OpenAI API with the system prompt from SCORING_SPEC.md, and
// returns a validated InterestScore response.
//
// Endpoint: POST /api/analyze
// Request body: { messages: [...] }
// Response: JSON matching InterestScore schema

// ============================================
// Guardrails (from Phase 0 / SCORING_SPEC.md §5.2)
// ============================================

const MAX_MESSAGES = 500;
const MAX_TOTAL_CHARS = 50000;
const REQUEST_TIMEOUT_MS = 20000; // 20 seconds

// ============================================
// Rate limiter (in-memory, resets on cold start)
// ============================================

const RATE_LIMIT_MAX = 10; // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfter: RATE_LIMIT_WINDOW_MS - (now - record.windowStart) };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// ============================================
// System prompt (from SCORING_SPEC.md §2)
// ============================================

const SYSTEM_PROMPT = `You are a lighthearted, playful conversation analyst — NOT a relationship expert, therapist, or
fortune teller. Your job is to read a transcript of a pasted chat conversation and produce a fun,
heuristic "interest score" describing how interested the other person ("them") appears to be in
the person who pasted it ("user").

RULES:
1. Base your analysis ONLY on the messages provided. Make no assumptions about the people involved,
   their history, their culture, their relationship status, or anything outside the text.
2. You are assessing THEM — the participant labelled "sender: them". The user's own messages serve
   as context and reference frame (reply targets, length baseline) but are never scored directly.
3. Be specific and grounded. Reference actual message content in your rawValue explanations.
   Do not hallucinate messages that are not in the array.
4. Keep your tone casual and fun. This is for entertainment, not diagnosis.
5. Output ONLY valid JSON matching the schema provided in the user message. No prose, no markdown
   fences, no commentary before or after the JSON.

SCORING SIGNALS — evaluate each of these six signals:

• replyTime
  How quickly "them" replies to "user"'s messages. Look at the timestamps. If timestamps are
  missing or insufficient to assess (fewer than 2 clear reply pairs), return score: null with
  a brief reason. Otherwise assign a score from 0-100 where 100 = replies within seconds/minutes
  consistently, 0 = extremely slow or never clearly replying.

• emoji
  How often and how "flirty" their emoji usage is. Neutral emoji (😂 👍 💀) are different from
  flirty ones (😍 💕 😘 😏 😉 ❤️). Count frequency and weighted intensity. Score 0-100 where
  100 = frequent, clearly flirty emoji; 0 = no emoji at all.

• messageLengthRatio
  How their average message length compares to the user's. Longer relative messages suggest
  more engagement and effort. If the user has no countable messages, return score: null. Otherwise
  score 0-100 where 100 = they consistently write much longer messages than the user,
  50 = roughly equal, 0 = they send one-word replies while the user writes paragraphs.

• questionFrequency
  What percentage of their messages are questions (look at isQuestion). Questions show genuine
  interest in the other person. Score 0-100 where 100 = nearly all their messages are questions,
  0 = they never ask anything.

• initiationRatio
  How often they are the one starting new conversation threads or reaching out first. Score 0-100
  where 100 = they initiate nearly all threads, 50 = mutual, 0 = the user always starts things.
  If you can only detect one continuous thread (no timestamps to split sessions), assess who sent
  the first message and how the conversation flows.

• conversationalTone
  The overall warmth, flirtiness, and engagement of their actual words and phrasing. This is NOT
  keyword matching — use your understanding of context, tone, humor, teasing, compliments,
  vulnerability, and emotional openness. Score 0-100 where 100 = unmistakably flirtatious and
  emotionally engaged, 50 = warm and friendly, 0 = cold, disinterested, or purely transactional.

For each signal, return:
  - score: 0-100 integer, or null if you cannot assess it.
  - rawValue: a short plain-language explanation (1 sentence) of what you observed in their messages
    that led to that score. If score is null, explain what was missing (e.g. "No timestamps available
    to assess reply timing").
  - label: the human-readable name for the signal (e.g. "Reply speed", "Emoji use").

Return totalScore as the weighted average of the six signals. If all signals are null, return
totalScore: null and summary: "Not enough data to score."

Include a summary field: 1-2 plain-language sentences recapping the overall assessment in a fun,
non-clinical tone.

Always include the disclaimer exactly as provided in the schema. Do not paraphrase it.`;

// ============================================
// JSON Schema (from SCORING_SPEC.md §3)
// ============================================

const RESPONSE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'InterestScore',
  description: 'Heuristic interest score for a chat conversation, generated by LLM analysis.',
  type: 'object',
  required: ['totalScore', 'signals', 'summary', 'disclaimer'],
  additionalProperties: false,
  properties: {
    totalScore: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100,
      description: '0-100 interest score, or null if too little data to assess.',
    },
    signals: {
      type: 'object',
      required: [
        'replyTime',
        'emoji',
        'messageLengthRatio',
        'questionFrequency',
        'initiationRatio',
        'conversationalTone',
      ],
      additionalProperties: false,
      properties: {
        replyTime: { $ref: '#/$defs/signal' },
        emoji: { $ref: '#/$defs/signal' },
        messageLengthRatio: { $ref: '#/$defs/signal' },
        questionFrequency: { $ref: '#/$defs/signal' },
        initiationRatio: { $ref: '#/$defs/signal' },
        conversationalTone: { $ref: '#/$defs/signal' },
      },
    },
    summary: {
      type: 'string',
      description: '1-2 plain-language sentences recapping the overall assessment.',
      maxLength: 300,
    },
    disclaimer: {
      type: 'string',
      const: 'For entertainment purposes only — not a scientifically validated measure of interest.',
    },
  },
  $defs: {
    signal: {
      type: 'object',
      required: ['score', 'rawValue', 'label'],
      additionalProperties: false,
      properties: {
        score: {
          type: ['number', 'null'],
          minimum: 0,
          maximum: 100,
          description: '0-100 sub-score for this signal, or null if not assessable.',
        },
        rawValue: {
          type: 'string',
          description: '1-sentence explanation of what was observed. If score is null, explain what was missing.',
          maxLength: 200,
        },
        label: {
          type: 'string',
          description: "Human-readable signal name (e.g. 'Reply speed').",
          maxLength: 50,
        },
      },
    },
  },
};

// ============================================
// Validation helpers
// ============================================

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: 'Messages array is required and must not be empty.' };
  }

  if (messages.length > MAX_MESSAGES) {
    return {
      valid: false,
      error: `Conversation too long (${messages.length} messages). Maximum is ${MAX_MESSAGES}.`,
    };
  }

  const totalChars = messages.reduce((sum, msg) => sum + (msg.text?.length || 0), 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return {
      valid: false,
      error: `Conversation too long (${totalChars.toLocaleString()} characters). Maximum is ${MAX_TOTAL_CHARS.toLocaleString()}.`,
    };
  }

  return { valid: true };
}

function validateResponse(data) {
  // Check required top-level fields
  if (!data || typeof data !== 'object') return false;
  if (!('totalScore' in data) || !('signals' in data) || !('summary' in data) || !('disclaimer' in data)) {
    return false;
  }

  // Check disclaimer matches exactly
  if (data.disclaimer !== 'For entertainment purposes only — not a scientifically validated measure of interest.') {
    return false;
  }

  // Check signals object has all six keys
  const requiredSignals = [
    'replyTime', 'emoji', 'messageLengthRatio',
    'questionFrequency', 'initiationRatio', 'conversationalTone',
  ];
  for (const signal of requiredSignals) {
    if (!(signal in data.signals)) return false;
    const s = data.signals[signal];
    if (!('score' in s) || !('rawValue' in s) || !('label' in s)) return false;
    if (s.score !== null && (typeof s.score !== 'number' || s.score < 0 || s.score > 100)) return false;
  }

  // Clamp scores to 0-100 as safety net
  for (const signal of requiredSignals) {
    if (data.signals[signal].score !== null) {
      data.signals[signal].score = Math.max(0, Math.min(100, Math.round(data.signals[signal].score)));
    }
  }

  // Clamp totalScore
  if (data.totalScore !== null) {
    data.totalScore = Math.max(0, Math.min(100, Math.round(data.totalScore)));
  }

  return true;
}

// ============================================
// LLM call with timeout
// ============================================

async function callLLM(messages, apiKey, retry = false) {
  const userMessage = JSON.stringify(messages);

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: 800,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'InterestScore',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  };

  // If retrying, add a stricter reminder
  if (retry) {
    body.messages.push({
      role: 'system',
      content: 'IMPORTANT: You MUST return valid JSON matching the schema exactly. No markdown, no prose, no extra text.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Handle rate limit
    if (response.status === 429) {
      throw { type: 'rate_limit', message: 'Too many requests — wait a moment and try again.' };
    }

    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        type: 'api_error',
        message: `OpenAI API error: ${response.status}`,
        details: errorData,
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw { type: 'empty_response', message: 'No content returned from LLM.' };
    }

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw { type: 'invalid_json', message: 'Failed to parse LLM response as JSON.' };
    }

    // Validate against schema
    if (!validateResponse(parsed)) {
      throw { type: 'validation_error', message: 'LLM response does not match expected schema.' };
    }

    return parsed;
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      throw { type: 'timeout', message: 'Request timed out — try a shorter conversation.' };
    }

    throw err;
  }
}

// ============================================
// Handler
// ============================================

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Too many requests — wait a moment and try again.',
      retryAfter: Math.ceil(rateLimit.retryAfter / 1000),
    });
  }

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured.' });
  }

  try {
    const { messages } = req.body;

    // Validate input
    const validation = validateMessages(messages);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Log for debugging (no full conversation contents)
    console.log(`[analyze] Processing ${messages.length} messages from IP ${ip}`);

    // Call LLM with retry
    let result;
    try {
      result = await callLLM(messages, apiKey, false);
    } catch (err) {
      // Retry once on validation or JSON errors
      if (err.type === 'validation_error' || err.type === 'invalid_json') {
        console.warn(`[analyze] First attempt failed (${err.type}), retrying...`);
        try {
          result = await callLLM(messages, apiKey, true);
        } catch (retryErr) {
          console.error(`[analyze] Retry failed:`, retryErr.type);
          return res.status(500).json({
            error: 'Analysis failed — please try again.',
            details: retryErr.message,
          });
        }
      } else {
        // Other errors — return structured error
        const status = err.type === 'timeout' ? 504
          : err.type === 'rate_limit' ? 429
          : 500;

        return res.status(status).json({
          error: err.message || 'Analysis failed.',
          type: err.type,
        });
      }
    }

    // Re-inject disclaimer as safety net
    result.disclaimer = 'For entertainment purposes only — not a scientifically validated measure of interest.';

    return res.status(200).json(result);
  } catch (error) {
    console.error('[analyze] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
