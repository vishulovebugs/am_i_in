// src/__tests__/e2eFlow.test.jsx
//
// End-to-end-style test suite (component-level, @testing-library/react + MemoryRouter).
// Mocks analyzeConversation's network call — never hits the real LLM API.
//
// Test scenarios:
// 1. Landing → Input flow with disclaimer check
// 2. Input flow: paste → parse → edit → confirm → Results
// 3. Results with mocked analyzeConversation response
// 4. Results with no messages (empty state)
// 5. One-sided conversation flow
// 6. Timeout and 429 error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Landing from '../pages/Landing';
import ConversationInput from '../pages/ConversationInput';
import Results from '../pages/Results';

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

import { analyzeConversation } from '../utils/analyzeConversation';

// ============================================
// Mock html-to-image
// ============================================

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,fakedata'),
}));

// ============================================
// Test data
// ============================================

const DISCLAIMER_TEXT =
  'For entertainment purposes only — not a scientifically validated measure of interest.';

// Use "marked" mode format (Me:/Them: prefixes)
const SAMPLE_CONVERSATION_MARKED = `Me: hey you around tonight?
Them: for you? always 😍
Me: ok movie at 8?
Them: sounds perfect!
Me: great see you there`;

const ONE_SIDED_CONVERSATION_MARKED = `Me: hey
Me: you there?
Me: hello?
Me: guess you're busy`;

const MOCK_SUCCESS_RESULT = {
  totalScore: 78,
  signals: {
    replyTime: { score: 85, rawValue: 'Fast replies consistently.', label: 'Reply speed' },
    emoji: { score: 70, rawValue: 'Some flirty emoji used.', label: 'Emoji use' },
    messageLengthRatio: { score: 75, rawValue: 'Similar message lengths.', label: 'Message length vs. yours' },
    questionFrequency: { score: 60, rawValue: 'About 1 in 3 are questions.', label: 'Questions they ask' },
    initiationRatio: { score: 80, rawValue: 'They initiated most conversations.', label: 'Who starts conversations' },
    conversationalTone: { score: 90, rawValue: 'Warm and playful tone.', label: 'Conversational tone' },
  },
  summary: 'They seem genuinely interested in you!',
  disclaimer: DISCLAIMER_TEXT,
};

const MOCK_NULL_SCORE_RESULT = {
  totalScore: null,
  signals: {
    replyTime: { score: null, rawValue: 'No timestamps available.', label: 'Reply speed' },
    emoji: { score: 40, rawValue: 'Some emoji used.', label: 'Emoji use' },
    messageLengthRatio: { score: null, rawValue: 'All messages from one sender.', label: 'Message length vs. yours' },
    questionFrequency: { score: 30, rawValue: 'Few questions.', label: 'Questions they ask' },
    initiationRatio: { score: null, rawValue: 'Cannot determine.', label: 'Who starts conversations' },
    conversationalTone: { score: 50, rawValue: 'Neutral tone.', label: 'Conversational tone' },
  },
  summary: 'Not enough data for a complete analysis.',
  disclaimer: DISCLAIMER_TEXT,
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
// Helper: render full app with routes
// ============================================

function renderFullApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/input" element={<ConversationInput />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </MemoryRouter>
  );
}

// ============================================
// Tests
// ============================================

describe('End-to-end flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  // ------------------------------------------
  // Test 1: Landing → Input with disclaimer
  // ------------------------------------------

  it('starts at Landing, confirms disclaimer, clicks through to Input', async () => {
    const user = userEvent.setup();

    renderFullApp(['/']);

    // Confirm disclaimer is visible on Landing (global banner)
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();

    // Confirm app name and tagline
    expect(screen.getByRole('heading', { name: /am i in/i })).toBeInTheDocument();
    expect(screen.getByText(/paste your chat, get a fun interest score/i)).toBeInTheDocument();

    // Click "Get Started"
    const getStartedButton = screen.getByRole('link', { name: /get started/i });
    await user.click(getStartedButton);

    // Wait for navigation to /input
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /paste your chat/i })).toBeInTheDocument();
    });

    // Confirm tabs are present (Paste Text / Upload Screenshot)
    expect(screen.getByRole('tab', { name: /paste text/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upload screenshot/i })).toBeInTheDocument();
  });

  // ------------------------------------------
  // Test 2: Input flow → Results
  // ------------------------------------------

  it('parses conversation, edits a message, and continues to Results', async () => {
    const user = userEvent.setup();

    // Mock analyzeConversation for when we reach Results
    analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_SUCCESS_RESULT,
    });

    renderFullApp(['/input']);

    // Wait for the input page to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /paste your chat/i })).toBeInTheDocument();
    });

    // Switch to Marked mode (Me:/Them: prefixes)
    const markedButton = screen.getByRole('radio', { name: /marked/i });
    await user.click(markedButton);

    // Paste conversation into textarea
    const textarea = screen.getByLabelText(/paste your conversation below/i);
    await user.clear(textarea);
    await user.type(textarea, SAMPLE_CONVERSATION_MARKED, { delay: 0 });

    // Click "Parse Conversation"
    const parseButton = screen.getByRole('button', { name: /parse conversation/i });
    await user.click(parseButton);

    // Wait for messages to appear in MessageEditor
    await waitFor(() => {
      expect(screen.getByText(/5 messages ready/i)).toBeInTheDocument();
    });

    // Verify parsed messages are shown (text without Me:/Them: prefix since marked mode strips it)
    expect(screen.getByDisplayValue('hey you around tonight?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('for you? always 😍')).toBeInTheDocument();

    // Edit the first message (change "hey" to "hey!")
    const firstTextarea = screen.getByDisplayValue('hey you around tonight?');
    await user.clear(firstTextarea);
    await user.type(firstTextarea, 'hey! you around tonight?', { delay: 0 });

    // Verify the edit took effect
    expect(screen.getByDisplayValue('hey! you around tonight?')).toBeInTheDocument();

    // Click "Continue to Scoring"
    const continueButton = screen.getByRole('button', { name: /continue to scoring/i });
    await user.click(continueButton);

    // Wait for navigation to /results and analysis to complete
    await waitFor(() => {
      expect(screen.getByText('Signal Breakdown')).toBeInTheDocument();
    });

    // Verify Results shows the exact totalScore
    const scoreElements = screen.getAllByText('78');
    expect(scoreElements.length).toBeGreaterThanOrEqual(1);

    // Verify all 6 signal bars are present
    for (const label of SIGNAL_LABELS) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    // Verify summary (appears in Results + ShareCard)
    const summaryElements = screen.getAllByText(MOCK_SUCCESS_RESULT.summary);
    expect(summaryElements.length).toBe(2);

    // Verify disclaimer (global banner + bottom)
    expect(screen.getAllByText(DISCLAIMER_TEXT).length).toBeGreaterThanOrEqual(2);

    // Verify download button exists
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  // ------------------------------------------
  // Test 3: Results with mocked response
  // ------------------------------------------

  it('shows exact score, signals, summary, disclaimer, and download on Results', async () => {
    // Set messages in sessionStorage
    const messages = [
      { id: 'm1', sender: 'user', text: 'hey', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
      { id: 'm2', sender: 'them', text: 'hello! 😊', timestamp: null, hasEmoji: true, emojiList: ['😊'], isQuestion: false },
    ];
    sessionStorage.setItem('chatMessages', JSON.stringify(messages));

    // Mock successful analysis
    analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_SUCCESS_RESULT,
    });

    renderFullApp(['/results']);

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getByText('Signal Breakdown')).toBeInTheDocument();
    });

    // Verify totalScore (appears in ScoreGauge and ShareCard)
    const scoreElements = screen.getAllByText('78');
    expect(scoreElements.length).toBe(2);

    // Verify all 6 signal labels
    for (const label of SIGNAL_LABELS) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    // Verify summary (appears in Results + ShareCard)
    const summaryElements = screen.getAllByText(MOCK_SUCCESS_RESULT.summary);
    expect(summaryElements.length).toBe(2);

    // Verify disclaimer (global banner + in ShareCard + bottom)
    const disclaimerCount = screen.getAllByText(DISCLAIMER_TEXT).length;
    expect(disclaimerCount).toBeGreaterThanOrEqual(2);

    // Verify download button
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  // ------------------------------------------
  // Test 4: Results with NO messages (empty state)
  // ------------------------------------------

  it('shows "go back to input" empty state when mounted with no messages', async () => {
    // Don't set anything in sessionStorage
    sessionStorage.clear();

    renderFullApp(['/results']);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText(/no conversation to analyze/i)).toBeInTheDocument();
    });

    // Verify empty state text
    expect(screen.getByText(/go back and paste a conversation/i)).toBeInTheDocument();

    // Verify link back to input
    expect(screen.getByRole('link', { name: /go to input/i })).toBeInTheDocument();

    // Verify back button in header
    expect(screen.getByRole('link', { name: /back to input/i })).toBeInTheDocument();

    // Should NOT show ScoreGauge or SignalBars
    expect(screen.queryByText('Signal Breakdown')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
  });

  // ------------------------------------------
  // Test 5: One-sided conversation
  // ------------------------------------------

  it('handles one-sided conversation with graceful insufficient-data state', async () => {
    const user = userEvent.setup();

    // Mock analyzeConversation for one-sided conversation
    analyzeConversation.mockResolvedValueOnce({
      success: true,
      data: MOCK_NULL_SCORE_RESULT,
    });

    renderFullApp(['/input']);

    // Wait for input page
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /paste your chat/i })).toBeInTheDocument();
    });

    // Switch to Marked mode
    const markedButton = screen.getByRole('radio', { name: /marked/i });
    await user.click(markedButton);

    // Paste one-sided conversation
    const textarea = screen.getByLabelText(/paste your conversation below/i);
    await user.clear(textarea);
    await user.type(textarea, ONE_SIDED_CONVERSATION_MARKED, { delay: 0 });

    // Parse
    const parseButton = screen.getByRole('button', { name: /parse conversation/i });
    await user.click(parseButton);

    // Wait for messages to appear
    await waitFor(() => {
      expect(screen.getByText(/4 messages/i)).toBeInTheDocument();
    });

    // Validation should fail (only one sender)
    expect(screen.getByText(/Need at least one message from/i)).toBeInTheDocument();

    // Manually add a "them" message to make it valid
    const manualInput = screen.getByPlaceholderText(/type a message/i);
    await user.type(manualInput, 'hey back!', { delay: 0 });

    // Change sender to "Them"
    const senderSelect = screen.getByDisplayValue('You');
    await user.selectOptions(senderSelect, 'Them');

    // Click Add
    const addButton = screen.getByRole('button', { name: /^add$/i });
    await user.click(addButton);

    // Now validation should pass
    await waitFor(() => {
      expect(screen.getByText(/5 messages ready/i)).toBeInTheDocument();
    });

    // Continue to scoring
    const continueButton = screen.getByRole('button', { name: /continue to scoring/i });
    await user.click(continueButton);

    // Wait for Results
    await waitFor(() => {
      expect(screen.getByText('Signal Breakdown')).toBeInTheDocument();
    });

    // Verify insufficient data state (totalScore is null)
    const insufficientElements = screen.getAllByText(/insufficient/i);
    expect(insufficientElements.length).toBeGreaterThanOrEqual(1);

    // Verify null signals show N/A
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(3); // replyTime, messageLengthRatio, initiationRatio

    // Verify disclaimer still present
    expect(screen.getAllByText(DISCLAIMER_TEXT).length).toBeGreaterThanOrEqual(2);
  });

  // ------------------------------------------
  // Test 6a: Timeout error
  // ------------------------------------------

  it('shows timeout error with distinct message and retry button', async () => {
    // Set messages in sessionStorage so Results has something to analyze
    const messages = [
      { id: 'm1', sender: 'user', text: 'hey', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
      { id: 'm2', sender: 'them', text: 'hello!', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
    ];
    sessionStorage.setItem('chatMessages', JSON.stringify(messages));

    // Mock timeout error
    analyzeConversation.mockResolvedValueOnce({
      success: false,
      error: { type: 'timeout', message: 'The request took too long — try a shorter conversation.' },
    });

    renderFullApp(['/results']);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/request took too long/i)).toBeInTheDocument();
    });

    // Verify retry button
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Verify back button
    expect(screen.getByRole('button', { name: /back to input/i })).toBeInTheDocument();

    // Verify disclaimer still visible
    expect(screen.getAllByText(DISCLAIMER_TEXT).length).toBeGreaterThanOrEqual(1);
  });

  // ------------------------------------------
  // Test 6b: 429 Rate Limit error
  // ------------------------------------------

  it('shows rate-limit error with distinct message and retry button', async () => {
    // Set messages in sessionStorage so Results has something to analyze
    const messages = [
      { id: 'm1', sender: 'user', text: 'hey', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
      { id: 'm2', sender: 'them', text: 'hello!', timestamp: null, hasEmoji: false, emojiList: [], isQuestion: false },
    ];
    sessionStorage.setItem('chatMessages', JSON.stringify(messages));

    // Mock 429 error
    analyzeConversation.mockResolvedValueOnce({
      success: false,
      error: { type: 'rate_limit', message: 'Too many requests — please wait a moment and try again.' },
    });

    renderFullApp(['/results']);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    });

    // Verify retry button
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Verify back button
    expect(screen.getByRole('button', { name: /back to input/i })).toBeInTheDocument();

    // Verify disclaimer still visible
    expect(screen.getAllByText(DISCLAIMER_TEXT).length).toBeGreaterThanOrEqual(1);
  });
});
