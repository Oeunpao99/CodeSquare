import React from 'react';

// Full-screen loader: the CodeSquare hexagon "C" draws itself — a grey track,
// then a blue → purple → cyan stroke chasing round it. Same drawing as the
// pre-React splash in index.html, so the hand-off is seamless.
export const LOGO_PATH = 'M96 40 L60 18 L24 40 L24 80 L60 102 L96 80';

export default function BrandLoader({ label = 'Loading' }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-cs-dark" role="status" aria-live="polite">
      <div className="flex items-center justify-center gap-3 sm:gap-4 px-5 max-w-full">
        <svg viewBox="0 0 120 120" className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 cs-brand-loader" aria-hidden>
          <defs>
            <linearGradient id="cs-brand-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
            <filter id="cs-brand-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={LOGO_PATH} className="track" />
          <path d={LOGO_PATH} pathLength="100" className="draw" filter="url(#cs-brand-glow)" />
          <path d="M51 52 L43 60 L51 68 M69 52 L77 60 L69 68 M63 49 L57 71" className="mark" />
        </svg>
        <span className="cs-brand-word whitespace-nowrap text-[2rem] sm:text-[3rem] font-bold tracking-tight leading-none">CodeSquare</span>
        <span className="sr-only">{label}…</span>
      </div>
    </div>
  );
}
