// src/components/SignalBar.jsx
//
// Horizontal bar displaying a signal's label, score, and explanation.

import styles from './SignalBar.module.css';

export default function SignalBar({ label, score, rawValue }) {
  const barWidth = score !== null ? `${score}%` : '0%';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.score}>
          {score !== null ? `${Math.round(score)}/100` : 'N/A'}
        </span>
      </div>

      <div className={styles.bar}>
        <div
          className={`${styles.fill} ${score === null ? styles.fillNull : ''}`}
          style={{ width: barWidth }}
        />
      </div>

      {rawValue && <div className={styles.rawValue}>{rawValue}</div>}
    </div>
  );
}
