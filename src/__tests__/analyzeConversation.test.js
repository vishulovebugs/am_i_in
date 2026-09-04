// src/__tests__/analyzeConversation.test.js
//
// Tests for the analyzeConversation frontend wrapper:
// - Mocks fetch and asserts correct POST to /api/analyze
// - Asserts successful response is returned unchanged
// - Asserts distinct error types for network, timeout, and 429

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeConversation, AnalysisError } from '../utils/analyzeConversation';

// ============================================
// Mock data
// ============================================

const FAKE_MESSAGES = [
  { id: 'm1', sender: 'user', text: 'hey', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
  { id: 'm2', sender: 'them', text: 'what\'s up?', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: true },
];

const FAKE_RESPONSE = {
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

// ============================================
// Tests
// ============================================

describe('analyzeConversation', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs to /api/analyze with the exact messages array', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => FAKE_RESPONSE,
    });

    await analyzeConversation(FAKE_MESSAGES);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: FAKE_MESSAGES }),
    });
  });

  it('returns successful response unchanged to the caller', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => FAKE_RESPONSE,
    });

    const result = await analyzeConversation(FAKE_MESSAGES);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(FAKE_RESPONSE);
    expect(result.error).toBeUndefined();
  });

  it('returns distinct error for network failure', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await analyzeConversation(FAKE_MESSAGES);

    expect(result.success).toBe(false);
    expect(result.error.type).toBe(AnalysisError.NETWORK);
    expect(result.error.message).toContain("Couldn't reach the AI service");
  });

  it('returns distinct error for timeout', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    fetchSpy.mockRejectedValueOnce(abortError);

    const result = await analyzeConversation(FAKE_MESSAGES);

    expect(result.success).toBe(false);
    expect(result.error.type).toBe(AnalysisError.TIMEOUT);
    expect(result.error.message).toContain('too long');
  });

  it('returns distinct error for 429 rate limit', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' }),
    });

    const result = await analyzeConversation(FAKE_MESSAGES);

    expect(result.success).toBe(false);
    expect(result.error.type).toBe(AnalysisError.RATE_LIMIT);
    expect(result.error.message).toContain('Too many requests');
  });

  it('returns validation error for empty messages', async () => {
    const result = await analyzeConversation([]);

    expect(result.success).toBe(false);
    expect(result.error.type).toBe(AnalysisError.VALIDATION);
    expect(result.error.message).toContain('No messages');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns server error for non-200 responses', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    const result = await analyzeConversation(FAKE_MESSAGES);

    expect(result.success).toBe(false);
    expect(result.error.type).toBe(AnalysisError.SERVER);
    expect(result.error.message).toContain('Internal server error');
  });
});
