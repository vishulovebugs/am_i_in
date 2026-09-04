// src/components/SignalBar.jsx
//
// Horizontal bar displaying a signal's label, score, and explanation.
// Shows "insufficient data" treatment for null scores.

import { useEffect, useState } from 'react';
import styles from './SignalBar.module.css';

function getBarColor(score) {
  if (score === null) return 'var(--gray-300)';
  if (score < 30) return '#ef4444';
  if (score < 50) return '#f97316';
  if (score < 70) return '#eab308';
  return '#22c55e';
}

export default function SignalBar({ label, score, rawValue }) {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(score !== null ? score : 0);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const barColor = getBarColor(score);
  const isNull = score === null;

  return (
    <div className={`${styles.container} ${isNull ? styles.nullState : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.score} style={isNull ? {} : { color: barColor }}>
          {isNull ? 'N/A' : `${Math.round(score)}/100`}
        </span>
      </div>

      <div className={styles.bar}>
        <div
          className={styles.fill}
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      {rawValue && (
        <div className={styles.rawValue}>{rawValue}</div>
      )}
    </div>
  );
}
