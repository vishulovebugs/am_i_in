// src/components/LoadingIndicator.jsx
//
// Spinner with message, for use while the LLM call is in flight.
// Includes a friendly note about network latency.

import styles from './LoadingIndicator.module.css';

export default function LoadingIndicator({ message = 'Analyzing your conversation...' }) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} role="status" aria-label="Loading" />
      <div className={styles.message}>{message}</div>
      <div className={styles.note}>
        This usually takes 5-15 seconds — we&apos;re chatting with the AI for you.
      </div>
    </div>
  );
}
