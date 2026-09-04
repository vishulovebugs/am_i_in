// src/pages/Landing.jsx
//
// Landing screen with app name, pitch, and disclaimer banner.

import Button from '../components/Button';
import DisclaimerBanner from '../components/DisclaimerBanner';
import styles from './Landing.module.css';

export default function Landing() {
  return (
    <div className={styles.container}>
      {/* App name */}
      <h1 className={styles.logo}>Am I In?</h1>

      {/* One-line pitch */}
      <p className={styles.tagline}>
        Paste your chat, get a fun interest score. No judgment, just vibes.
      </p>

      {/* CTA button */}
      <div className={styles.buttonGroup}>
        <Button to="/input" fullWidth>
          Get Started
        </Button>
      </div>

      {/* Persistent disclaimer */}
      <div className={styles.disclaimer}>
        <DisclaimerBanner standalone />
      </div>
    </div>
  );
}
