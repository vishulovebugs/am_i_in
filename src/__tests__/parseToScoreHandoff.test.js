// src/__tests__/parseToScoreHandoff.test.js
//
// Integration test: takes a raw pasted conversation string, runs it
// through parseChatText (Phase 3), then through mocked analyzeConversation
// (Phase 4) with zero manual reshaping, and asserts the final shape
// matches SCORING_SPEC.md exactly.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseChatText } from '../utils/parseChat';
import { analyzeConversation } from '../utils/analyzeConversation';

// ============================================
// Mock fetch
// ============================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================
// Raw pasted conversation (as a user would paste)
// ============================================

const RAW_PASTED_TEXT = `Me: hey you around tonight?
Them: for you? always 😍
Me: ok movie at 8?
Them: absolutely! what time should I pick you up?
Me: 7:30 works?
Them: perfect, see you then! 💕`;

// ============================================
// Expected parsed messages (output of parseChatText)
// ============================================

const EXPECTED_SIGNALS = [
  'replyTime',
  'emoji',
  'messageLengthRatio',
  'questionFrequency',
  'initiationRatio',
  'conversationalTone',
];

const MOCK_LLM_RESULT = {
  totalScore: 82,
  signals: {
    replyTime: { score: 90, rawValue: 'Replies within minutes consistently.', label: 'Reply speed' },
    emoji: { score: 75, rawValue: 'Flirty emoji used frequently (hearts, smiles).', label: 'Emoji use' },
    messageLengthRatio: { score: 80, rawValue: 'Their messages are slightly longer, showing engagement.', label: 'Message length vs. yours' },
    questionFrequency: { score: 60, rawValue: 'About 1 in 3 messages are questions.', label: 'Questions they ask' },
    initiationRatio: { score: 70, rawValue: 'They initiated several exchanges.', label: 'Who starts conversations' },
    conversationalTone: { score: 85, rawValue: 'Warm, playful, and definitely flirtatious.', label: 'Conversational tone' },
  },
  summary: "They're clearly interested — fast replies, flirty emoji, and making plans. This looks great!",
  disclaimer: 'For entertainment purposes only — not a scientifically validated measure of interest.',
};

// ============================================
// Tests
// ============================================

describe('parseToScoreHandoff integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('takes raw pasted text → parseChatText → analyzeConversation → valid shape', async () => {
    // Step 1: Parse the raw pasted text (Phase 3)
    const parsed = parseChatText(RAW_PASTED_TEXT, { mode: 'marked' });

    expect(parsed.error).toBeUndefined();
    expect(parsed.messages.length).toBe(6);

    // Verify parsed messages have the expected shape
    for (const msg of parsed.messages) {
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('sender');
      expect(msg).toHaveProperty('text');
      expect(msg).toHaveProperty('timestamp');
      expect(msg).toHaveProperty('hasEmoji');
      expect(msg).toHaveProperty('emojiList');
      expect(msg).toHaveProperty('isQuestion');
    }

    // Step 2: Mock the API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_LLM_RESULT,
    });

    // Step 3: Send parsed messages directly to analyzeConversation (Phase 4)
    // Zero manual reshaping — this is the key assertion
    const result = await analyzeConversation(parsed.messages);

    // Step 4: Assert the result matches SCORING_SPEC.md shape
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const score = result.data;

    // Top-level fields
    expect(score).toHaveProperty('totalScore');
    expect(score).toHaveProperty('signals');
    expect(score).toHaveProperty('summary');
    expect(score).toHaveProperty('disclaimer');

    // totalScore is number or null
    expect(
      typeof score.totalScore === 'number' || score.totalScore === null
    ).toBe(true);

    // If totalScore is a number, it's 0-100
    if (typeof score.totalScore === 'number') {
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(100);
    }

    // Signals object has all 6 required keys
    for (const signal of EXPECTED_SIGNALS) {
      expect(score.signals).toHaveProperty(signal);
      expect(score.signals[signal]).toHaveProperty('score');
      expect(score.signals[signal]).toHaveProperty('rawValue');
      expect(score.signals[signal]).toHaveProperty('label');

      // Score is number 0-100 or null
      const s = score.signals[signal].score;
      expect(typeof s === 'number' || s === null).toBe(true);
      if (typeof s === 'number') {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }

    // Summary is a non-empty string
    expect(typeof score.summary).toBe('string');
    expect(score.summary.length).toBeGreaterThan(0);

    // Disclaimer matches exactly
    expect(score.disclaimer).toBe(
      'For entertainment purposes only — not a scientifically validated measure of interest.'
    );
  });

  it('passes parsed messages array directly without reshaping', async () => {
    // Parse raw text
    const parsed = parseChatText(RAW_PASTED_TEXT, { mode: 'marked' });

    // Capture the exact body sent to /api/analyze
    let capturedBody;
    mockFetch.mockImplementationOnce(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => MOCK_LLM_RESULT,
      };
    });

    // Send directly — no mapping, no filtering, no reshaping
    await analyzeConversation(parsed.messages);

    // Assert the body.messages is EXACTLY parsed.messages
    expect(capturedBody.messages).toEqual(parsed.messages);
    expect(capturedBody.messages.length).toBe(parsed.messages.length);

    // Verify each message in the body has the full ChatMessage shape
    for (const msg of capturedBody.messages) {
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('sender');
      expect(msg).toHaveProperty('text');
      expect(msg).toHaveProperty('hasEmoji');
      expect(msg).toHaveProperty('emojiList');
      expect(msg).toHaveProperty('isQuestion');
    }
  });

  it('mocked LLM response includes correct disclaimer', async () => {
    const parsed = parseChatText(RAW_PASTED_TEXT, { mode: 'marked' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_LLM_RESULT,
    });

    const result = await analyzeConversation(parsed.messages);

    expect(result.data.disclaimer).toBe(
      'For entertainment purposes only — not a scientifically validated measure of interest.'
    );
  });
});
