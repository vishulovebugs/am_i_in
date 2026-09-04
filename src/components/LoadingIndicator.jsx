// src/components/LoadingIndicator.jsx
//
// Spinner with message, for use while the LLM call is in flight.

import styles from './LoadingIndicator.module.css';

export default function LoadingIndicator({ message = 'Analyzing conversation...' }) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} role="status" aria-label="Loading" />
      <div className={styles.message}>{message}</div>
    </div>
  );
}
