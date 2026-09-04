// src/components/Card.jsx
//
// Generic container component with padding and shadow.

import styles from './Card.module.css';

export default function Card({
  children,
  compact = false,
  spacious = false,
  noShadow = false,
  className = '',
  ...props
}) {
  const classNames = [
    styles.card,
    compact && styles.compact,
    spacious && styles.spacious,
    noShadow && styles.noShadow,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}
