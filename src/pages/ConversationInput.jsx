// src/pages/ConversationInput.jsx
//
// Conversation input screen with tabs for paste textarea and screenshot upload.
// Route: /input

import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseChatText, GUARDRAILS } from '../utils/parseChat';
import MessageEditor from '../components/MessageEditor';
import OCRUploader from '../components/OCRUploader';
import styles from './ConversationInput.module.css';

export default function ConversationInput() {
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' or 'upload'
  const [rawText, setRawText] = useState('');
  const [parseMode, setParseMode] = useState('alternating');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [hasParsed, setHasParsed] = useState(false);

  // Validation: need at least one message from each sender
  const validation = useMemo(() => {
    if (messages.length === 0) {
      return { valid: false, reason: 'Add at least one message to continue.' };
    }

    const hasUser = messages.some(m => m.sender === 'user');
    const hasThem = messages.some(m => m.sender === 'them');

    if (!hasUser || !hasThem) {
      return {
        valid: false,
        reason: 'Need at least one message from "You" and one from "Them".',
      };
    }

    // Check guardrails
    const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0);
    if (messages.length > GUARDRAILS.MAX_MESSAGES) {
      return {
        valid: false,
        reason: `Too many messages (${messages.length}). Maximum is ${GUARDRAILS.MAX_MESSAGES}.`,
      };
    }
    if (totalChars > GUARDRAILS.MAX_TOTAL_CHARS) {
      return {
        valid: false,
        reason: `Conversation too long (${totalChars.toLocaleString()} chars). Maximum is ${GUARDRAILS.MAX_TOTAL_CHARS.toLocaleString()}.`,
      };
    }

    return { valid: true, reason: null };
  }, [messages]);

  // Handle parse from textarea
  const handleParse = useCallback(() => {
    setError(null);
    const result = parseChatText(rawText, { mode: parseMode });

    if (result.error) {
      setError(result.error);
      setMessages([]);
    } else {
      setMessages(result.messages);
    }
    setHasParsed(true);
  }, [rawText, parseMode]);

  // Handle text extracted from OCR
  const handleOCRTextExtracted = useCallback((extractedText) => {
    setError(null);
    const result = parseChatText(extractedText, { mode: parseMode });

    if (result.error) {
      setError(result.error);
      setMessages([]);
    } else {
      setMessages(result.messages);
    }
    setHasParsed(true);
  }, [parseMode]);

  // Handle continue to scoring
  const handleContinue = useCallback(() => {
    if (!validation.valid) return;

    // Store messages in sessionStorage for handoff to results page
    sessionStorage.setItem('chatMessages', JSON.stringify(messages));
    navigate('/results');
  }, [validation.valid, messages, navigate]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/" className={styles.backButton} aria-label="Back to home">
          ←
        </Link>
        <h1 className={styles.title}>Paste Your Chat</h1>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'paste' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('paste')}
        >
          📝 Paste Text
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'upload' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📸 Upload Screenshot
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {/* Paste text tab */}
        {activeTab === 'paste' && (
          <>
            <div className={styles.textareaSection}>
              <label className={styles.textareaLabel} htmlFor="chat-input">
                Paste your conversation below:
              </label>
              <textarea
                id="chat-input"
                className={styles.chatTextarea}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Paste your chat here...\n\nSupported formats:\n- Alternating messages (one per line)\n- Marked messages with "Me:" or "Them:" prefix`}
              />
            </div>

            {/* Controls */}
            <div className={styles.controlsRow}>
              {/* Parse mode toggle */}
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeButton} ${
                    parseMode === 'alternating' ? styles.modeButtonActive : ''
                  }`}
                  onClick={() => setParseMode('alternating')}
                >
                  Alternating
                </button>
                <button
                  className={`${styles.modeButton} ${
                    parseMode === 'marked' ? styles.modeButtonActive : ''
                  }`}
                  onClick={() => setParseMode('marked')}
                >
                  Marked (Me:/Them:)
                </button>
              </div>

              {/* Parse button */}
              <button
                className={styles.parseButton}
                onClick={handleParse}
                disabled={rawText.trim().length === 0}
              >
                Parse Conversation
              </button>
            </div>
          </>
        )}

        {/* Upload screenshot tab */}
        {activeTab === 'upload' && (
          <OCRUploader onTextExtracted={handleOCRTextExtracted} />
        )}

        {/* Error message */}
        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* Editor section (shown after parsing or OCR) */}
        {(hasParsed || messages.length > 0) && (
          <div className={styles.editorSection}>
            <MessageEditor messages={messages} onChange={setMessages} />

            {/* Validation info */}
            <div
              className={`${styles.validationInfo} ${
                validation.valid
                  ? styles.validationInfoValid
                  : styles.validationInfoInvalid
              }`}
            >
              {validation.reason || `${messages.length} messages ready for scoring.`}
            </div>

            {/* Continue button */}
            <div className={styles.continueSection}>
              <button
                className={styles.continueButton}
                onClick={handleContinue}
                disabled={!validation.valid}
              >
                Continue to Scoring
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
