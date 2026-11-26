// One colour language for skill levels and progress, shared by Progress, Career
// (Job Readiness) and Roadmap, so the same level always looks the same. Every
// colour is a theme token at full strength: no hard-coded hex, no faded tints.

// Bar / dot colours (CSS colour values).
export const LEVEL_COLOR = {
  Novice: 'rgb(var(--cs-text-muted))',
  Learning: 'rgb(var(--cs-orange))',
  Proficient: 'rgb(var(--cs-cyan))',
  Strong: 'rgb(var(--cs-green))',
};

// Solid pill classes for the level label (same style as Roadmap status pills).
export const LEVEL_PILL = {
  Novice: 'bg-cs-overlay/10 text-cs-text-dim',
  Learning: 'bg-cs-orange text-white',
  Proficient: 'bg-cs-cyan text-white',
  Strong: 'bg-cs-green text-white',
};

export const PILL_BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold shrink-0';

// Progress bars: blue while in progress, green once complete.
export const progressColor = (done) => (done ? 'rgb(var(--cs-green))' : 'rgb(var(--cs-primary))');
