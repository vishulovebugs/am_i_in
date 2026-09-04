// src/__tests__/resultsVisualization.test.jsx
//
// Tests for Results screen visualization:
// - Mocks analyzeConversation to return known results
// - Asserts ScoreGauge, SignalBar, disclaimer, summary render correctly
// - Tests ShareCard download functionality
// - Tests insufficient data states for null scores
// - Tests error states with distinct messages

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Results from '../pages/Results';
import ConversationInput from '../pages/ConversationInput';
import * as analyzeModule from '../utils/analyzeConversation';

// ============================================
// Mock analyzeConversation
// ============================================

vi.mock('../utils/analyzeConversation', () => ({
  analyzeConversation: vi.fn(),
  AnalysisError: {
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    VALIDATION: 'validation',
    RATE_LIMIT: 'rate_limit',
    SERVER: 'server',
    UNKNOWN: 'unknown',
  },
}));

// ============================================
// Mock html-to-image
// ============================================

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,fakedata'),
}));

// ============================================
// Test data
// ============================================

const MOCK_MESSAGES = [
  { id: 'm1', sender: 'user', text: 'hey', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
  { id: 'm2', sender: 'them', text: 'what\'s up? 😍', timestamp: null, hasEmoji: true, emojiList: ['😍'], isQuestion: true },
];

const MOCK_SUCCESS_RESULT = {
  totalScore: 72,
  signals: {
    replyTime: { score: 85, rawValue: 'Fast replies consistently.', label: 'Reply speed' },
    emoji: { score: 60, rawValue: 'Some flirty emoji used.', label: 'Emoji use' },
    messageLengthRatio: { score: 70, rawValue: 'Similar message lengths.', label: 'Message length vs. yours' },
    questionFrequency: { score: 65, rawValue: 'About 1 in 3 are questions.', label: 'Questions they ask' },
    initiationRatio: { score: 55, rawValue: 'Mutual initiation.', label: 'Who starts conversations' },
    conversationalTone: { score: 80, rawValue: 'Warm and playful tone.', label: 'Conversational tone' },
  },
  summary: 'They seem genuinely interested!',
  disclaimer: 'For entertainment purposes only — not a scientifically validated measure of interest.',
};

const MOCK_NULL_SCORE_RESULT = {
  totalScore: null,
  signals: {
    replyTime: { score: null, rawValue: 'No timestamps available.', label: 'Reply speed' },
    emoji: { score: 60, rawValue: 'Some emoji used.', label: 'Emoji use' },
    messageLengthRatio: { score: null, rawValue: 'Insufficient data.', label: 'Message length vs. yours' },
    questionFrequency: { score: 45, rawValue: 'Some questions.', label: 'Questions they ask' },
    initiationRatio: { score: null, rawValue: 'Cannot determine.', label: 'Who starts conversations' },
    conversationalTone: { score: 70, rawValue: 'Friendly tone.', label: 'Conversational tone' },
  },
  summary: 'Not enough data for a complete analysis.',
  disclaimer: 'For entertainment purposes only — not a scientifically validated measure of interest.',
};

const SIGNAL_LABELS = [
  'Reply speed',
  'Emoji use',
  'Message length vs. yours',
  'Questions they ask',
  'Who starts conversations',
  'Conversational tone',
];

// ============================================
// Helper to render Results with messages in sessionStorage
// ============================================

function renderResults(messages = MOCK_MESSAGES) {
  // Set messages in sessionStorage before rendering
  sessionStorage.setItem('chatMessages', JSON.stringify(messages));

  return render(
    <MemoryRouter initialEntries={['/results']}>
      <Routes>
        <Route path="/results" element={<Results />} />
        <Route path="/input" element={<ConversationInput />} />
      </Routes>
    </MemoryRouter>
  );
}

// ============================================
// Tests
// ============================================

describe('Results visualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders ScoreGauge with mocked totalScore (not hardcoded)', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_SUCCESS_RESULT,
    });

    renderResults();

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getAllByText('72').length).toBeGreaterThanOrEqual(1);
    });

    // Verify the score is displayed (appears in both ScoreGauge and ShareCard)
    const scoreElements = screen.getAllByText('72');
    expect(scoreElements.length).toBe(2); // ScoreGauge + ShareCard
  });

  it('renders all 6 SignalBar labels', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_SUCCESS_RESULT,
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getByText('Signal Breakdown')).toBeInTheDocument();
    });

    // Assert all 6 signal labels appear (each appears twice: SignalBar + ShareCard)
    for (const label of SIGNAL_LABELS) {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders disclaimer text and summary string', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_SUCCESS_RESULT,
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getAllByText(MOCK_SUCCESS_RESULT.summary).length).toBeGreaterThanOrEqual(1);
    });

    // Disclaimer should appear (at top, in ShareCard, and at bottom)
    const disclaimerElements = screen.getAllByText(
      /For entertainment purposes only/i
    );
    expect(disclaimerElements.length).toBeGreaterThanOrEqual(2);

    // Summary should be present (appears in Results and ShareCard)
    const summaryElements = screen.getAllByText(MOCK_SUCCESS_RESULT.summary);
    expect(summaryElements.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Download calls html-to-image with disclaimer and score', async () => {
    const { toPng } = await import('html-to-image');
    const user = userEvent.setup();

    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_SUCCESS_RESULT,
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getAllByText('72').length).toBeGreaterThanOrEqual(1);
    });

    // Click the download button
    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    // Wait for the download to complete
    await waitFor(() => {
      expect(toPng).toHaveBeenCalled();
    });

    // Verify the DOM node passed to toPng contains the disclaimer and score
    const domNode = toPng.mock.calls[0][0];
    expect(domNode).toBeTruthy();
    expect(domNode.textContent).toContain('entertainment purposes');
    expect(domNode.textContent).toContain('72');
  });

  it('shows insufficient data states when totalScore is null', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_NULL_SCORE_RESULT,
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getByText('Signal Breakdown')).toBeInTheDocument();
    });

    // ScoreGauge should show insufficient data
    const insufficientElements = screen.getAllByText(/insufficient/i);
    expect(insufficientElements.length).toBeGreaterThanOrEqual(1);

    // SignalBars with null scores should show N/A
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBe(3); // replyTime, messageLengthRatio, initiationRatio

    // Non-null signals should show their scores (each in SignalBar + ShareCard)
    const score60Elements = screen.getAllByText('60/100');
    expect(score60Elements.length).toBeGreaterThanOrEqual(1);

    const score45Elements = screen.getAllByText('45/100');
    expect(score45Elements.length).toBeGreaterThanOrEqual(1);

    const score70Elements = screen.getAllByText('70/100');
    expect(score70Elements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows network error with retry button', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: false,
      error: { type: 'network', message: "Couldn't reach the AI service" },
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getByText(/couldn't reach the ai service/i)).toBeInTheDocument();
    });

    // Retry button should be present
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows timeout error with retry button', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: false,
      error: { type: 'timeout', message: 'The request took too long' },
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getByText(/request took too long/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows validation error with retry button', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: false,
      error: { type: 'validation', message: 'Invalid response' },
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows rate-limit error with retry button', async () => {
    analyzeModule.analyzeConversation.mockResolvedValueOnce({
      success: false,
      error: { type: 'rate_limit', message: 'Too many requests' },
    });

    renderResults();

    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
