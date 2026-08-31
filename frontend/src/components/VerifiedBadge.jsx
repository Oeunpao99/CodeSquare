import React from 'react';
import { FiCheck } from 'react-icons/fi';

/**
 * Verified badge — shown next to a user's name to indicate their account is
 * verified. Renders a small filled check badge that inherits its tone to fit
 * both the dev-vibe accent and card contexts.
 */
export default function VerifiedBadge({ size = 'h-5 w-5', className = '', title = 'Verified account' }) {
  const dims = size.includes('h-') ? '' : `h-${size} w-${size}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center rounded-full bg-cs-cyan text-cs-dark shrink-0 shadow-[0_0_8px_-2px_rgb(var(--cs-cyan)/0.8)] ${dims || size} ${className}`}
    >
      <FiCheck className="h-[0.7em] w-[0.7em]" strokeWidth={3.5} />
    </span>
  );
}
