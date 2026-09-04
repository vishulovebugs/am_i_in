// src/components/Button.jsx
//
// Reusable button component with primary/secondary variants and disabled state.

import { Link } from 'react-router-dom';
import styles from './Button.module.css';

export default function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  to,
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const className = [
    styles.button,
    styles[variant],
    fullWidth && styles.fullWidth,
  ]
    .filter(Boolean)
    .join(' ');

  // If `to` is provided, render as a React Router Link
  if (to) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
