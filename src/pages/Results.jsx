// src/pages/Results.jsx
//
// Results screen — displays the parsed message array for now.
// In Phase 5, this will call the LLM and show the score.
// Route: /results

import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Results.module.css';

export default function Results() {
  const location = useLocation();
  const [showJson, setShowJson] = useState(false);

  // Get messages from location state or sessionStorage
  const messages = useMemo(() => {
    // First try location state (passed via navigation)
    if (location.state?.messages) {
      return location.state.messages;
    }

    // Fall back to sessionStorage
    const stored = sessionStorage.getItem('chatMessages');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        console.error('Failed to parse stored messages');
        return [];
      }
    }

    return [];
  }, [location.state]);

  // Format timestamp for display
  const formatTimestamp = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/input" className={styles.backButton} aria-label="Back to input">
          ←
        </Link>
        <h1 className={styles.title}>Your Results</h1>
      </div>

      {messages.length > 0 ? (
        <>
          {/* Message preview */}
          <div className={styles.messagePreview}>
            <h2 className={styles.previewHeader}>Conversation Preview</h2>
            <div className={styles.messageList}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.messageBubble} ${
                    msg.sender === 'user'
                      ? styles.messageBubbleUser
                      : styles.messageBubbleThem
                  }`}
                >
                  <div className={styles.messageText}>{msg.text}</div>
                  <div className={styles.messageMeta}>
                    {msg.sender === 'user' ? 'You' : 'Them'}
                    {msg.hasEmoji && ` · ${msg.emojiList.length} emoji`}
                    {msg.isQuestion && ' · ?'}
                    {msg.timestamp && ` · ${formatTimestamp(msg.timestamp)}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* JSON preview toggle */}
          <div className={styles.jsonPreview}>
            <button onClick={() => setShowJson(!showJson)}>
              {showJson ? 'Hide' : 'Show'} Raw JSON
            </button>
            {showJson && (
              <pre className={styles.jsonContent}>
                {JSON.stringify(messages, null, 2)}
              </pre>
            )}
          </div>

          {/* Placeholder for LLM scoring */}
          <div className={styles.placeholder}>
            <h3 className={styles.placeholderTitle}>LLM Scoring Coming Soon</h3>
            <p className={styles.placeholderText}>
              In Phase 5, this page will call the AI to analyze your conversation
              and display your interest score with signal breakdowns.
            </p>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            No messages to display. Go back and paste a conversation.
          </p>
          <Link to="/input">Go to Input</Link>
        </div>
      )}
    </div>
  );
}
