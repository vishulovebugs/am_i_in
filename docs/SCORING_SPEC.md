# Am I In? — LLM Interest Scoring Spec

**Project:** Am I In? — a web app that produces a heuristic "interest score" for a chat conversation.
**File:** `docs/SCORING_SPEC.md`
**Phase:** Design documentation and constants only. No implementation code.

---

## 1. Message Data Model

The app parses the user's pasted transcript into an ordered list of messages. This is the model
sent to the LLM as input.

```typescript
/**
 * A single chat message parsed from the pasted transcript.
 * @typedef {Object} ChatMessage
 * @property {string} id          - Stable unique id in transcript order, e.g. "m1", "m2", …
 * @property {'user' | 'them'} sender - 'user' = the paste owner; 'them' = the person being scored
 * @property {string} text        - Raw message text (whitespace preserved)
 * @property {string | null} timestamp - ISO 8601 string (e.g. "2026-09-01T21:04:00-07:00"), or null if unknown
 * @property {boolean} hasEmoji   - true iff the message contains ≥ 1 emoji (=== emojiList.length > 0)
 * @property {string[]} emojiList - Every emoji occurrence in text order; duplicates allowed
 * @property {boolean} isQuestion - Parser heuristic: true if text contains '?' or starts with a question word
 */
```

**Invariants:**
- `id` is unique and stable for traceability.
- `emojiList` is an occurrence list (duplicates allowed) so frequency can be counted.
- `timestamp` is normalized to ISO 8601 or null before scoring; the scorer never sees raw time formats.
- `isQuestion` is pre-computed by the parser using simple heuristics (contains `?` or starts with a question-starter word like *are, is, do, does, will, can, what, why, how, who, when, where*).

**Example:**
```json
[
  { "id": "m1", "sender": "user", "text": "hey you around tonight?", "timestamp": "2026-09-01T20:02:00-07:00", "hasEmoji": false, "emojiList": [], "isQuestion": true },
  { "id": "m2", "sender": "them", "text": "for you? always 😍", "timestamp": "2026-09-01T20:04:00-07:00", "hasEmoji": true, "emojiList": ["😍"], "isQuestion": false },
  { "id": "m3", "sender": "user", "text": "ok movie at 8?", "timestamp": null, "hasEmoji": false, "emojiList": [], "isQuestion": true }
]
```

---

## 2. LLM System Prompt

This is the exact text sent to the model as the system message. The user message contains the
JSON-serialized array of ChatMessage objects plus the JSON response schema.

```
You are a lighthearted, playful conversation analyst — NOT a relationship expert, therapist, or
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

Always include the disclaimer exactly as provided in the schema. Do not paraphrase it.
```

---

## 3. JSON Response Schema

This is the JSON Schema object used with OpenAI's `response_format: { type: "json_schema", schema }` parameter. The model is constrained to return output matching this schema exactly.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "InterestScore",
  "description": "Heuristic interest score for a chat conversation, generated by LLM analysis.",
  "type": "object",
  "required": ["totalScore", "signals", "summary", "disclaimer"],
  "additionalProperties": false,
  "properties": {
    "totalScore": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 100,
      "description": "0-100 interest score, or null if too little data to assess."
    },
    "signals": {
      "type": "object",
      "required": [
        "replyTime",
        "emoji",
        "messageLengthRatio",
        "questionFrequency",
        "initiationRatio",
        "conversationalTone"
      ],
      "additionalProperties": false,
      "properties": {
        "replyTime": { "$ref": "#/$defs/signal" },
        "emoji": { "$ref": "#/$defs/signal" },
        "messageLengthRatio": { "$ref": "#/$defs/signal" },
        "questionFrequency": { "$ref": "#/$defs/signal" },
        "initiationRatio": { "$ref": "#/$defs/signal" },
        "conversationalTone": { "$ref": "#/$defs/signal" }
      }
    },
    "summary": {
      "type": "string",
      "description": "1-2 plain-language sentences recapping the overall assessment.",
      "maxLength": 300
    },
    "disclaimer": {
      "type": "string",
      "const": "For entertainment purposes only — not a scientifically validated measure of interest."
    }
  },
  "$defs": {
    "signal": {
      "type": "object",
      "required": ["score", "rawValue", "label"],
      "additionalProperties": false,
      "properties": {
        "score": {
          "type": ["number", "null"],
          "minimum": 0,
          "maximum": 100,
          "description": "0-100 sub-score for this signal, or null if not assessable."
        },
        "rawValue": {
          "type": "string",
          "description": "1-sentence explanation of what was observed. If score is null, explain what was missing.",
          "maxLength": 200
        },
        "label": {
          "type": "string",
          "description": "Human-readable signal name (e.g. 'Reply speed').",
          "maxLength": 50
        }
      }
    }
  }
}
```

---

## 4. Provider Configuration

Source of truth: **`/src/data/providerConfig.js`**

```js
// src/data/providerConfig.js
//
// LLM provider configuration for the interest-score generation call.
// The provider is swappable by changing this object — the rest of the
// app should not reference a provider directly.

export const PROVIDER_CONFIG = {
  provider: 'openai',       // 'openai' | 'anthropic' | 'other'
  model: 'gpt-4o-mini',     // fast, cheap, and good at structured JSON output
  temperature: 0.4,         // low-ish for consistent scoring; some creativity for summary tone
  maxOutputTokens: 800,     // enough for full JSON response without waste
};
```

**Notes:**
- `gpt-4o-mini` chosen for its strong `response_format: json_schema` support, low latency, and cost-effectiveness for this use case (small payloads, short responses).
- `temperature: 0.4` balances deterministic scoring with natural-sounding summaries.
- `maxOutputTokens: 800` caps the response size — the JSON output (6 signals × ~3 fields + total + summary + disclaimer) fits comfortably within ~500 tokens; the 800 cap prevents runaway responses.
- To switch to Anthropic or another provider, update only this file and the adapter layer that calls the API; the system prompt and schema remain provider-agnostic.

---

## 5. Failure & Cost Guardrails

### 5.1 API Call Failures

| Failure mode | Handling |
|---|---|
| **Network error / provider down** | Catch the error; display a user-facing message: "Couldn't reach the AI service — please try again." Do not retry automatically (prevents accidental cost spikes). |
| **Timeout** (recommended: 30s) | Abort the request. Display: "The request took too long — try a shorter conversation." Log the timeout for monitoring. |
| **Rate limit (429)** | Display: "Too many requests — wait a moment and try again." Optionally implement client-side exponential backoff (1 retry, 2s base delay) but do not queue multiple requests. |
| **Invalid JSON returned** | If the model returns prose, markdown fences, or malformed JSON despite schema enforcement: display "Something went wrong generating your score — try again." Log the raw response for debugging. |
| **Schema validation failure** | If the returned JSON parses but fails the JSON Schema (e.g. `totalScore` is a string, missing `disclaimer`): same as invalid JSON handling. Treat as a failed response, not a partial result. |

### 5.2 Input Limits (Cost & Payload Control)

To control API cost (priced per token) and payload size, input is capped before it reaches the API:

| Limit | Value | Reason |
|---|---|---|
| **Max messages** | 500 | Ensures the input array is within context-window comfort for `gpt-4o-mini` (128k tokens) and keeps cost per call low. |
| **Max total characters** (sum of all `text` fields) | 50,000 | Prevents extremely long monologues from dominating the payload. |
| **Max per-message characters** | 2,000 | Individual messages longer than this are truncated to 2,000 characters with `…` appended, so a single long rant doesn't skew token counts. |

**When input exceeds limits:**

- **Exceeds max messages (500):** Keep the first 400 messages and the last 100 (recency bias — the most recent messages are more predictive of current interest). Display a note: "Showing the most relevant portion of your conversation (truncated for analysis)."
- **Exceeds max total characters (50,000):** Truncate individual messages proportionally (reduce longest messages first) until the total fits. Same user note.
- **Exceeds per-message limit (2,000 chars):** Silently truncate that message. The user is unlikely to notice a mid-rant cutoff in a scoring context.

These limits are tunable constants (documented here, extracted to a config file in the implementation phase).

### 5.3 Output Guardrails

| Scenario | Handling |
|---|---|
| **All 6 signals are null** | `totalScore` is also null. Display: "Not enough data to generate a score — your conversation may be too short or missing timestamps." |
| **Model returns a score outside 0-100** | Clamp to the valid range before display (defensive — the schema should prevent this, but clamp as a safety net). |
| **`disclaimer` field is wrong or missing** | Re-inject the correct disclaimer string client-side before displaying. The disclaimer is non-negotiable. |
| **Summary is empty or missing** | Fall back to a generic summary: "The AI analyzed your conversation but didn't produce a summary." |

### 5.4 Cost Estimation

For a typical 50-message conversation:
- **Input tokens:** ~800–1,200 (system prompt + messages + schema)
- **Output tokens:** ~400–600 (JSON response)
- **Cost per call (gpt-4o-mini):** ~$0.0002–0.0005 (well under a tenth of a cent)

The 500-message cap and 50,000-character cap ensure worst-case cost per call stays under ~$0.005, making the feature effectively free for individual use.

---

## 6. Known Design Decisions & Future Work

- **`conversationalTone` replaces keyword matching:** The original rubric used a static `FLIRTY_KEYWORDS` list. The LLM can judge flirtiness, warmth, humor, and tone in context — far more nuanced than substring matching. This is the core reason for moving to an LLM-based approach.
- **No weights in the schema:** The previous formula-based design had a `SCORING_WEIGHTS` constant summing to 1.0. The LLM computes `totalScore` as its own weighted average based on the system prompt instructions. If deterministic weighting is later needed, compute it client-side from the signal scores.
- **Provider-agnostic design:** The system prompt and schema are not provider-specific. Swapping from OpenAI to Anthropic only requires changing `providerConfig.js` and the API adapter.
- **No conversation history is stored:** The pasted text is sent to the API and immediately discarded. No logs, no database, no persistence beyond the browser session.
- **Schema enforcement:** OpenAI's `response_format: json_schema` (or equivalent) is used to constrain output. This is not optional — it prevents the most common failure mode (prose instead of JSON).
