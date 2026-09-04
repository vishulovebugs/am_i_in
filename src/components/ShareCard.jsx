// src/components/ShareCard.jsx
//
// Shareable card showing app name, total score, top signal highlights,
// and disclaimer. Exportable as PNG via html-to-image.

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import styles from './ShareCard.module.css';

const DISCLAIMER = 'For entertainment purposes only — not a scientifically validated measure of interest.';

function getScoreColor(score) {
  if (score === null) return '#d1d5db';
  if (score < 30) return '#ef4444';
  if (score < 50) return '#f97316';
  if (score < 70) return '#eab308';
  return '#22c55e';
}

export default function ShareCard({ score, signals, summary }) {
  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get top 3 signals by score (excluding null)
  const topSignals = Object.entries(signals || {})
    .filter(([, data]) => data.score !== null)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `am-i-in-score-${Math.round(score || 0)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className={styles.container}>
      {/* Share card (rendered as image) */}
      <div ref={cardRef} className={styles.shareCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.appName}>Am I In?</h2>
        </div>

        {/* Score */}
        <div className={styles.cardScore}>
          <div className={styles.scoreValue} style={{ color: scoreColor }}>
            {score !== null ? Math.round(score) : '—'}
          </div>
          <div className={styles.scoreLabel}>
            {score !== null ? 'out of 100' : 'Insufficient data'}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: '1rem 0' }}>
            {summary}
          </p>
        )}

        {/* Top signals */}
        {topSignals.length > 0 && (
          <div className={styles.cardSignals}>
            {topSignals.map(([key, data]) => (
              <div key={key} className={styles.signalItem}>
                <span className={styles.signalName}>{data.label}</span>
                <span className={styles.signalScore}>
                  {Math.round(data.score)}/100
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className={styles.cardDisclaimer}>
          {DISCLAIMER}
        </div>
      </div>

      {/* Download button */}
      <button
        className={styles.downloadButton}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? 'Generating...' : '📥 Download shareable image'}
      </button>
    </div>
  );
}
