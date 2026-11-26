import React from 'react';
import { FiHeart, FiMessageCircle, FiCode, FiZap } from 'react-icons/fi';

// Mini "posts" that scroll up on the right of the banner, like a live feed.
const MINI = [
  [FiHeart, 'w-16'],
  [FiCode, 'w-24'],
  [FiMessageCircle, 'w-20'],
  [FiZap, 'w-14'],
];

function MiniFeed() {
  const cards = [...MINI, ...MINI]; // doubled so the loop is seamless
  return (
    <div
      className="absolute right-5 md:right-8 top-2 h-[4.75rem] w-52 overflow-hidden pointer-events-none hidden md:block"
      style={{ maskImage: 'linear-gradient(transparent, #000 25%, #000 75%, transparent)', WebkitMaskImage: 'linear-gradient(transparent, #000 25%, #000 75%, transparent)' }}
      aria-hidden
    >
      <div className="banner-feed flex flex-col gap-1.5">
        {cards.map(([Icon, w], i) => (
          <div key={i} className="h-8 shrink-0 rounded-lg flex items-center gap-2 px-2.5" style={{ background: 'rgb(255 255 255 / 0.14)' }}>
            <span className="w-4 h-4 rounded-full shrink-0" style={{ background: 'rgb(255 255 255 / 0.45)' }} />
            <span className={`h-1.5 rounded-full ${w}`} style={{ background: 'rgb(255 255 255 / 0.45)' }} />
            <Icon className="ml-auto text-xs text-white/80" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Solid-colour community banner. `children` render as a bottom bar inside it
 * (the feed's tabs). Motion stops for people who prefer reduced motion.
 */
export default function CommunityBanner({ title, subtitle, action = null, children = null, className = '' }) {
  return (
    <section className={`relative overflow-hidden rounded-xl bg-cs-primary text-white ${className}`}>
      <div className="relative px-6 md:px-8 py-4 min-h-[5.25rem] flex flex-wrap items-center gap-4">
        <MiniFeed />
        <div className="relative min-w-0 flex-1 md:pr-56">
          <h1 className="text-xl md:text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-white/85 text-sm mt-1">{subtitle}</p>}
        </div>
        {action && <div className="relative md:mr-56">{action}</div>}
      </div>

      {children && <div className="relative px-6 md:px-8 border-t border-white/15">{children}</div>}
    </section>
  );
}
