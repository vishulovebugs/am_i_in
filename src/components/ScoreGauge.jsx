// src/components/ScoreGauge.jsx
//
// Circular gauge displaying a 0-100 score with animated SVG.
// Shows "insufficient data" state when score is null.

import { useEffect, useState } from 'react';
import styles from './ScoreGauge.module.css';

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STROKE_WIDTH = 12;

// Gradient colors based on score range
function getScoreColor(score) {
  if (score === null) return '#d1d5db'; // gray for null
  if (score < 30) return '#ef4444';     // red
  if (score < 50) return '#f97316';     // orange
  if (score < 70) return '#eab308';     // yellow
  return '#22c55e';                      // green
}

function getScoreLabel(score) {
  if (score === null) return 'Insufficient data';
  if (score < 30) return 'Not interested';
  if (score < 50) return 'Maybe interested';
  if (score < 70) return 'Somewhat interested';
  if (score < 90) return 'Interested';
  return 'Very interested';
}

export default function ScoreGauge({ score = null, label = 'Interest Score' }) {
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE);

  // Animate on mount and when score changes
  useEffect(() => {
    // Small delay to trigger CSS transition
    const timer = setTimeout(() => {
      if (score !== null) {
        const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
        setAnimatedOffset(offset);
      } else {
        setAnimatedOffset(CIRCUMFERENCE);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const color = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  // Accessibility: aria-label for screen readers
  const ariaLabel = score !== null
    ? `${label}: ${Math.round(score)} out of 100. ${scoreLabel}.`
    : `${label}: Insufficient data.`;

  return (
    <div className={styles.container}>
      <div
        className={styles.gauge}
        role="img"
        aria-label={ariaLabel}
      >
        <svg viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
          {/* Background circle */}
          <circle
            className={styles.gaugeCircle}
            cx="90"
            cy="90"
            r={RADIUS}
            strokeWidth={STROKE_WIDTH}
          />
          {/* Progress arc */}
          <circle
            className={styles.gaugeProgress}
            cx="90"
            cy="90"
            r={RADIUS}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animatedOffset}
            style={{ stroke: color }}
          />
        </svg>

        {/* Center text */}
        <div className={styles.gaugeText}>
          {score !== null ? (
            <>
              <div className={styles.gaugeScore} style={{ color }}>
                {Math.round(score)}
              </div>
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

      {/* Score description */}
      <div className={styles.scoreDescription} style={{ color }}>
        {scoreLabel}
      </div>
    </div>
  );
}
