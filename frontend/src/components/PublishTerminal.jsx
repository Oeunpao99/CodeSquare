import { useEffect, useState } from 'react';

function Loader() {
  return (
    <span className="inline-block w-3 h-3 mr-1.5 align-middle rounded-full border-2 border-cs-text-muted/30 border-t-cs-primary animate-spin" />
  );
}

// Terminal chip that pops over the publish button, walks through a fake
// "build → publish" log with a 0→100% progress bar, closes, then calls
// onDone so the icon can fly away.
export default function PublishTerminal({ anchor, onDone, verb = 'publish', noun = 'post' }) {
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [closing, setClosing] = useState(false);

  // Sit to the LEFT of the button (it's right-aligned in the composer) and
  // clamp inside the viewport; the tail still points down at the button.
  const CHIP_W = 268;
  const GAP = 16;
  const maxLeft = Math.max(12, window.innerWidth - CHIP_W - 12);
  const left = Math.min(Math.max(12, anchor.x - CHIP_W - GAP), maxLeft);
  const chipRight = left + CHIP_W;
  const tailRight = chipRight - anchor.x + 6;

  useEffect(() => {
    const DURATION = 3000;
    const started = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(100, Math.round(((Date.now() - started) / DURATION) * 100));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 1900);
    const t3 = setTimeout(() => setClosing(true), 2900);
    const t4 = setTimeout(onDone, 3060);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [onDone]);

  return (
    <div
      className="pointer-events-none fixed z-[96] select-none"
      style={{
        left,
        top: anchor.y,
        transform: `translateY(-106%)`,
        opacity: closing ? 0 : 1,
        transition: closing
          ? 'opacity 0.18s ease, transform 0.18s ease'
          : 'none',
      }}
    >
      <div
        className="w-[268px] rounded-xl border border-cs-line/25 bg-cs-darker/95 backdrop-blur shadow-[0_12px_40px_rgba(0,0,0,.45)] overflow-hidden transition-transform"
        style={{ transform: closing ? 'scale(0.96) translateY(-4px)' : 'scale(1)' }}
      >
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-cs-line/10">
          <span className="w-2.5 h-2.5 rounded-full bg-cs-red/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-cs-orange/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-cs-green/80" />
          <span className="ml-auto font-mono text-[10px] text-cs-text-muted tabular-nums">{verb} · {Math.round(pct)}%</span>
        </div>
        <div className="h-1 w-full bg-cs-line/10">
          <div
            className="h-full bg-cs-primary shadow-[0_0_8px_rgba(45,212,191,.6)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="px-3 py-2.5 font-mono text-[11px] leading-relaxed space-y-1">
          <p className="text-cs-text-dim">
            <span className="text-cs-primary">$</span> {verb} {noun}
          </p>
          <p className="text-cs-text-dim">
            {step === 0 ? <Loader /> : <span className="text-cs-green">✓ </span>}
            preparing your {noun}…
          </p>
          {step >= 1 && <p className="text-cs-green">✓ build succeeded</p>}
          {step >= 2 && <p className="text-cs-primary">✓ 201 Created · sending to feed</p>}
        </div>
      </div>
      <div
        className="absolute w-2.5 h-2.5 rotate-45 bg-cs-darker border-b border-r border-cs-line/25 transition-opacity"
        style={{ right: tailRight, bottom: -5, opacity: closing ? 0 : 1 }}
      />
    </div>
  );
}