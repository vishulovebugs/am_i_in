// src/__tests__/api.analyze.test.js
//
// Server-side tests for /api/analyze:
// - Mocks OpenAI fetch, never hits real API
// - Asserts oversized messages are rejected before LLM call
// - Asserts valid LLM response is returned as-is
// - Asserts malformed JSON triggers retry, then structured error

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../api/analyze.js';

// ============================================
// Mock fetch
// ============================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================
// Test data
// ============================================

const VALID_MESSAGES = [
  { id: 'm1', sender: 'user', text: 'hey', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
  { id: 'm2', sender: 'them', text: 'what\'s up?', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: true },
];

const VALID_LLM_RESPONSE = {
  totalScore: 72,
  signals: {
    replyTime: { score: 80, rawValue: 'Fast replies', label: 'Reply speed' },
    emoji: { score: 60, rawValue: 'Some emoji', label: 'Emoji use' },
    messageLengthRatio: { score: 70, rawValue: 'Similar lengths', label: 'Message length' },
    questionFrequency: { score: 65, rawValue: 'Some questions', label: 'Questions' },
    initiationRatio: { score: 55, rawValue: 'Mutual', label: 'Initiation' },
    conversationalTone: { score: 80, rawValue: 'Warm tone', label: 'Tone' },
  },
  summary: 'They seem interested!',
  disclaimer: 'For entertainment purposes only — not a scientifically validated measure of interest.',
};

function createOversizedMessages(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    sender: i % 2 === 0 ? 'user' : 'them',
    text: 'hey',
    timestamp: null,
    hasEmoji: false,
    emojiList: [],
    isQuestion: false,
  }));
}

function createMockRequest(body, method = 'POST') {
  return {
    method,
    headers: { 'x-forwarded-for': '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    body,
  };
}

function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

// ============================================
// Tests
// ============================================

describe('/api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('rejects oversized messages array before attempting LLM call', async () => {
    const oversized = createOversizedMessages(501); // Over 500 limit
    const req = createMockRequest({ messages: oversized });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('too long') })
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns valid LLM response as-is', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(VALID_LLM_RESPONSE) } }],
      }),
    });

    const req = createMockRequest({ messages: VALID_MESSAGES });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.totalScore).toBe(72);
    expect(response.signals).toHaveProperty('replyTime');
    expect(response.signals).toHaveProperty('conversationalTone');
    expect(response.disclaimer).toContain('entertainment purposes');
  });

  it('retries once on malformed JSON, then returns structured error', async () => {
    // First call returns malformed JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'This is not JSON at all' } }],
      }),
    });

    // Second call (retry) also returns malformed JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Still not JSON' } }],
      }),
    });

    const req = createMockRequest({ messages: VALID_MESSAGES });
    const res = createMockResponse();

    await handler(req, res);

    // Should have made 2 calls (original + retry)
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Should return 500 with structured error
    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0];
    expect(response.error).toContain('Analysis failed');
    // The retry failure type is 'invalid_json' but the final error is generic
    expect(response.error).toContain('please try again');
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockRequest({}, 'GET');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 500 if API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const req = createMockRequest({ messages: VALID_MESSAGES });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('not configured') })
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
