// src/components/DisclaimerBanner.jsx
//
// Persistent disclaimer banner displayed on the Landing page and in the
// app layout so it's visible on every screen.

import styles from './DisclaimerBanner.module.css';

const DISCLAIMER_TEXT =
  'For entertainment purposes only — not a scientifically validated measure of interest.';

export default function DisclaimerBanner({ standalone = false }) {
  return (
    <div
      className={`${styles.banner} ${standalone ? styles.standalone : ''}`}
      role="note"
    >
      {DISCLAIMER_TEXT}
    </div>
  );
}
