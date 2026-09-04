// src/__tests__/ocrToParseHandoff.test.jsx
//
// Tests for OCRUploader → parseChatText handoff:
// - Mock tesseract.js to avoid real OCR
// - Assert extracted text flows into parseChatText via callback
// - Assert MessageEditor receives the parsed messages
// - Assert low-confidence flagging works

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OCRUploader from '../components/OCRUploader';
import ConversationInput from '../pages/ConversationInput';
import * as parseChatModule from '../utils/parseChat';

// ============================================
// Mock tesseract.js
// ============================================

const mockRecognize = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() =>
    Promise.resolve({
      recognize: mockRecognize,
      terminate: vi.fn(),
    })
  ),
}));

// ============================================
// Test data
// ============================================

const FAKE_OCR_TEXT = `Me: hey you around tonight?
Them: for you? always 😍
Me: ok movie at 8?`;

const FAKE_OCR_RESULT = {
  data: {
    text: FAKE_OCR_TEXT,
    confidence: 85.5,
    words: [
      { text: 'hey', confidence: 95 },
      { text: 'you', confidence: 92 },
      { text: 'around', confidence: 88 },
      { text: 'tonight?', confidence: 82 },
      { text: 'for', confidence: 90 },
      { text: 'you?', confidence: 87 },
      { text: 'always', confidence: 85 },
      { text: 'ok', confidence: 78 },
      { text: 'movie', confidence: 75 },
      { text: 'at', confidence: 70 },
      { text: '8?', confidence: 65 },
    ],
  },
};

const LOW_CONFIDENCE_OCR_RESULT = {
  data: {
    text: `Me: h3ll0 w0rld
Them: wh4t's up?`,
    confidence: 55.2,
    words: [
      { text: 'h3ll0', confidence: 45 },
      { text: 'w0rld', confidence: 42 },
      { text: "wh4t's", confidence: 48 },
      { text: 'up?', confidence: 62 },
    ],
  },
};

// ============================================
// Helper to trigger file upload
// ============================================

function triggerFileUpload(container) {
  const fileInput = container.querySelector('input[type="file"]');
  const file = new Blob(['fake image data'], { type: 'image/png' });
  const testFile = new File([file], 'screenshot.png', { type: 'image/png' });

  Object.defineProperty(fileInput, 'files', {
    value: [testFile],
    writable: false,
  });

  fireEvent.change(fileInput);
  return testFile;
}

// ============================================
// Tests
// ============================================

describe('OCRUploader → parseChatText handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognize.mockResolvedValue(FAKE_OCR_RESULT);
  });

  it('mocks tesseract.js recognize to return fake text + confidence', () => {
    const onTextExtracted = vi.fn();
    const { container } = render(<OCRUploader onTextExtracted={onTextExtracted} />);

    // Verify mock is set up and file input exists
    expect(mockRecognize).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('passes extracted text to onTextExtracted callback when accepting OCR result', async () => {
    const user = userEvent.setup();
    const onTextExtracted = vi.fn();

    const { container } = render(<OCRUploader onTextExtracted={onTextExtracted} />);

    // Upload file
    triggerFileUpload(container);

    // Wait for file preview to appear
    await waitFor(() => {
      expect(screen.getByAltText('Uploaded screenshot')).toBeInTheDocument();
    });

    // Click "Extract Text (OCR)" button
    const extractButton = screen.getByRole('button', { name: /extract text/i });
    await user.click(extractButton);

    // Wait for OCR to complete
    await waitFor(() => {
      expect(screen.getByText('Extracted Text:')).toBeInTheDocument();
    });

    // Verify tesseract was called
    expect(mockRecognize).toHaveBeenCalled();

    // Click "Use This Text" button
    const useButton = screen.getByRole('button', { name: /use this text/i });
    await user.click(useButton);

    // Verify onTextExtracted was called with the extracted text
    expect(onTextExtracted).toHaveBeenCalledWith(FAKE_OCR_TEXT);

    // Verify the text contains expected content
    const calledWith = onTextExtracted.mock.calls[0][0];
    expect(calledWith).toContain('hey you around tonight?');
    expect(calledWith).toContain('for you? always');
  });

  it('shows OCR confidence badge after extraction', async () => {
    const user = userEvent.setup();
    const onTextExtracted = vi.fn();

    const { container } = render(<OCRUploader onTextExtracted={onTextExtracted} />);

    // Upload file
    triggerFileUpload(container);

    await waitFor(() => {
      expect(screen.getByAltText('Uploaded screenshot')).toBeInTheDocument();
    });

    // Run OCR
    const extractButton = screen.getByRole('button', { name: /extract text/i });
    await user.click(extractButton);

    await waitFor(() => {
      expect(screen.getByText('Extracted Text:')).toBeInTheDocument();
    });

    // Verify confidence badge shows (rounded to nearest integer)
    expect(screen.getByText(/OCR Confidence: 86%/)).toBeInTheDocument();
  });

  it('flags low-confidence words when confidence is below threshold', async () => {
    const user = userEvent.setup();
    const onTextExtracted = vi.fn();

    // Mock with low confidence result
    mockRecognize.mockResolvedValue(LOW_CONFIDENCE_OCR_RESULT);

    const { container } = render(<OCRUploader onTextExtracted={onTextExtracted} />);

    // Upload file
    triggerFileUpload(container);

    await waitFor(() => {
      expect(screen.getByAltText('Uploaded screenshot')).toBeInTheDocument();
    });

    // Run OCR
    const extractButton = screen.getByRole('button', { name: /extract text/i });
    await user.click(extractButton);

    await waitFor(() => {
      expect(screen.getByText('Extracted Text:')).toBeInTheDocument();
    });

    // Verify low-confidence warning appears
    expect(screen.getByText(/low OCR confidence/i)).toBeInTheDocument();

    // Verify low-confidence words are shown (using getAllByText since they appear multiple times)
    const h3ll0Elements = screen.getAllByText(/h3ll0/);
    expect(h3ll0Elements.length).toBeGreaterThanOrEqual(1);

    const w0rldElements = screen.getAllByText(/w0rld/);
    expect(w0rldElements.length).toBeGreaterThanOrEqual(1);
  });

  it('integrates with ConversationInput and uses MessageEditor', async () => {
    const user = userEvent.setup();

    // Spy on parseChatText
    const parseChatSpy = vi.spyOn(parseChatModule, 'parseChatText');

    const { container } = render(
      <MemoryRouter initialEntries={['/input']}>
        <ConversationInput />
      </MemoryRouter>
    );

    // Switch to Upload tab
    const uploadTab = screen.getByRole('tab', { name: /upload screenshot/i });
    await user.click(uploadTab);

    // Verify OCRUploader is rendered
    expect(screen.getByText(/click to upload/i)).toBeInTheDocument();

    // Upload file
    triggerFileUpload(container);

    await waitFor(() => {
      expect(screen.getByAltText('Uploaded screenshot')).toBeInTheDocument();
    });

    // Run OCR
    const extractButton = screen.getByRole('button', { name: /extract text/i });
    await user.click(extractButton);

    await waitFor(() => {
      expect(screen.getByText('Extracted Text:')).toBeInTheDocument();
    });

    // Accept the text
    const useButton = screen.getByRole('button', { name: /use this text/i });
    await user.click(useButton);

    // Wait for messages to be parsed and displayed
    await waitFor(() => {
      expect(screen.getByText(/review messages/i)).toBeInTheDocument();
    });

    // Verify parseChatText was called (in ConversationInput)
    expect(parseChatSpy).toHaveBeenCalled();

    // Verify MessageEditor shows parsed messages (using getAllByText since it appears in multiple places)
    const messageCountElements = screen.getAllByText(/3 messages/i);
    expect(messageCountElements.length).toBeGreaterThanOrEqual(1);

    parseChatSpy.mockRestore();
  });
});
