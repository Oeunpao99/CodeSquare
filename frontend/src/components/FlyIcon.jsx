import { useEffect, useRef } from 'react';

// Renders the passed icon at `from` and animates it to `to` (viewport coords),
// fading it out on arrival. Calls onDone when finished.
export default function FlyIcon({ from, to, duration = 750, onDone, children }) {
  const ref = useRef(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition = `transform ${duration}ms cubic-bezier(.22,1,.36,1), opacity ${Math.round(duration * 0.35)}ms ease-in ${Math.round(duration * 0.6)}ms`;
        el.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(.55)`;
        el.style.opacity = '0';
      });
    });
    const t = setTimeout(() => doneRef.current && doneRef.current(), duration + 260);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [from.x, from.y, to.x, to.y, duration]);

  return (
    <>
      <div
        ref={ref}
        className="pointer-events-none fixed z-[95]"
        style={{
          left: from.x - 16,
          top: from.y - 16,
          opacity: 1,
          transform: 'scale(1)',
        }}
      >
        {children}
      </div>
      <div
        className="pointer-events-none fixed z-[95] w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-cs-primary/70"
        style={{
          left: to.x,
          top: to.y,
          opacity: 0,
          animation: `land-ping .45s ease-out ${duration + 70}ms forwards`,
        }}
      />
    </>
  );
}