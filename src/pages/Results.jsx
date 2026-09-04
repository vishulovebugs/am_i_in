// src/pages/Results.jsx
//
// Results screen — calls analyzeConversation and displays the score.
// Route: /results

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { analyzeConversation, AnalysisError } from '../utils/analyzeConversation';
import ScoreGauge from '../components/ScoreGauge';
import SignalBar from '../components/SignalBar';
import DisclaimerBanner from '../components/DisclaimerBanner';
import ShareCard from '../components/ShareCard';
import LoadingIndicator from '../components/LoadingIndicator';
import styles from './Results.module.css';

// Error messages for each error type
const ERROR_MESSAGES = {
  [AnalysisError.NETWORK]: "Couldn't reach the AI service — please check your connection and try again.",
  [AnalysisError.TIMEOUT]: 'The request took too long — try a shorter conversation.',
  [AnalysisError.VALIDATION]: 'Something went wrong analyzing your conversation — try again.',
  [AnalysisError.RATE_LIMIT]: 'Too many requests — please wait a moment and try again.',
  [AnalysisError.SERVER]: 'The AI service encountered an error — please try again.',
  [AnalysisError.UNKNOWN]: 'Something unexpected happened — please try again.',
};

// Signal labels
const SIGNAL_LABELS = {
  replyTime: 'Reply speed',
  emoji: 'Emoji use',
  messageLengthRatio: 'Message length vs. yours',
  questionFrequency: 'Questions they ask',
  initiationRatio: 'Who starts conversations',
  conversationalTone: 'Conversational tone',
};

// Get messages from location state or sessionStorage
function getMessages(locationState) {
  // First try location state (passed via navigation)
  if (locationState?.messages) {
    return locationState.messages;
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
}

export default function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get messages once on mount
  const messages = useMemo(() => getMessages(location.state), [location.state]);

  // Run analysis when messages are loaded
  useEffect(() => {
    if (messages.length === 0) {
      // Use a microtask to avoid synchronous setState
      Promise.resolve().then(() => setIsLoading(false));
      return;
    }

    let cancelled = false;

    async function runAnalysis() {
      setIsLoading(true);
      setError(null);

      const response = await analyzeConversation(messages);

      if (cancelled) return;

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
      }
      setIsLoading(false);
    }

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [messages]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);

    analyzeConversation(messages).then(response => {
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
      }
      setIsLoading(false);
    });
  }, [messages]);

  // Go back to input
  const handleBackToInput = useCallback(() => {
    navigate('/input');
  }, [navigate]);

  // No messages — redirect or show empty state
  if (messages.length === 0 && !isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link to="/input" className={styles.backButton} aria-label="Back to input">
            ←
          </Link>
          <h1 className={styles.title}>Your Results</h1>
        </div>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            No conversation to analyze. Go back and paste a conversation.
          </p>
          <Link to="/input">Go to Input</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/input" className={styles.backButton} aria-label="Back to input">
          ←
        </Link>
        <h1 className={styles.title}>Your Results</h1>
      </div>

      {/* Disclaimer at top */}
      <DisclaimerBanner />

      {/* Loading state */}
      {isLoading && (
        <LoadingIndicator message="Analyzing your conversation..." />
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorMessage}>
            {ERROR_MESSAGES[error.type] || ERROR_MESSAGES[AnalysisError.UNKNOWN]}
          </div>
          <button className={styles.retryButton} onClick={handleRetry}>
            Try Again
          </button>
          <button className={styles.backButtonSmall} onClick={handleBackToInput}>
            Back to Input
          </button>
        </div>
      )}

      {/* Success state */}
      {result && !isLoading && (
        <div className={styles.resultsContent}>
          {/* Score gauge */}
          <ScoreGauge score={result.totalScore} />

          {/* Summary */}
          {result.summary && (
            <div className={styles.summaryCard}>
              <p className={styles.summaryText}>{result.summary}</p>
            </div>
          )}

          {/* Signal breakdown */}
          <div className={styles.signalsSection}>
            <h2 className={styles.signalsTitle}>Signal Breakdown</h2>
            <div className={styles.signalsList}>
              {Object.entries(SIGNAL_LABELS).map(([key, label]) => {
                const signal = result.signals[key];
                return (
                  <SignalBar
                    key={key}
                    label={label}
                    score={signal?.score ?? null}
                    rawValue={signal?.rawValue}
                  />
                );
              })}
            </div>
          </div>

          {/* Share card */}
          <div className={styles.shareSection}>
            <h2 className={styles.shareTitle}>Share Your Score</h2>
            <ShareCard
              score={result.totalScore}
              signals={result.signals}
              summary={result.summary}
            />
          </div>

          {/* Bottom disclaimer */}
          <DisclaimerBanner />

          {/* Action buttons */}
          <div className={styles.actionButtons}>
            <button className={styles.retryButton} onClick={handleRetry}>
              Analyze Again
            </button>
            <Link to="/input" className={styles.backLink}>
              New Conversation
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
