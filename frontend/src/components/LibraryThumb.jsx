import React, { useState } from 'react';

/**
 * AI-generated Library thumbnail (see backend/scripts/gen_library_thumbnails.py).
 * `path` is "<collection>" for a shelf or "<collection>/<topic>" for a topic.
 * Renders nothing if the image doesn't exist, so cards fall back to their
 * normal look for items that haven't been generated yet.
 */
export default function LibraryThumb({ path, className = '', alt = '' }) {
  const [failed, setFailed] = useState(false);
  if (!path || failed) return null;
  return (
    <img
      src={`/thumbnails/library/${path}.webp`}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      // Only default to full width when the caller doesn't set its own width
      // (cards bleed the image past their padding with w-[calc(100%+3rem)]).
      className={`block object-cover bg-cs-overlay/5 ${/(^|\s)w-/.test(className) ? '' : 'w-full'} ${className}`}
    />
  );
}
