// src/components/ScoreGauge.jsx
//
// Circular gauge displaying a 0-100 score. Shows "insufficient data"
// state when score is null.

import styles from './ScoreGauge.module.css';

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreGauge({ score = null, label = 'Interest Score' }) {
  // Calculate stroke offset based on score
  const offset = score !== null ? CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE : CIRCUMFERENCE;

  return (
    <div className={styles.container}>
      <div className={styles.gauge}>
        <svg viewBox="0 0 180 180" width="180" height="180">
          {/* Background circle */}
          <circle
            className={styles.gaugeCircle}
            cx="90"
            cy="90"
            r={RADIUS}
          />
          {/* Progress arc */}
          <circle
            className={styles.gaugeProgress}
            cx="90"
            cy="90"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>

        {/* Center text */}
        <div className={styles.gaugeText}>
          {score !== null ? (
            <>
              <div className={styles.gaugeScore}>{Math.round(score)}</div>
              <div className={styles.gaugeLabel}>out of 100</div>
            </>
          ) : (
            <div className={styles.gaugeNull}>
              Insufficient
              <br />
              data
            </div>
          )}
        </div>
      </div>

      {/* Label below gauge */}
      <div className={styles.gaugeLabel}>{label}</div>
    </div>
  );
}
