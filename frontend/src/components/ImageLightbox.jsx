import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

// Full-screen photo viewer. Rendered on <body> (a portal) so it sits above the
// app's bars and isn't trapped by page animations. Solid black background,
// swipe left/right on phones, arrow keys / Esc on desktop, tap outside to close.
export default function ImageLightbox({ sources, start = 0, onClose }) {
  const [index, setIndex] = useState(start);
  const [dx, setDx] = useState(0);          // live swipe offset in px
  const touch = useRef(null);
  const many = sources.length > 1;

  useEffect(() => setIndex(start), [start]);

  const prev = () => setIndex((i) => (i > 0 ? i - 1 : sources.length - 1));
  const next = () => setIndex((i) => (i + 1) % sources.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (many && e.key === 'ArrowLeft') prev();
      if (many && e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [sources.length, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchMove = (e) => {
    if (!touch.current) return;
    const x = e.touches[0].clientX - touch.current.x;
    const y = e.touches[0].clientY - touch.current.y;
    if (Math.abs(x) > Math.abs(y)) setDx(x);
    else if (y > 0) setDx(0);
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const x = e.changedTouches[0].clientX - touch.current.x;
    const y = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    setDx(0);
    if (many && Math.abs(x) > 50 && Math.abs(x) > Math.abs(y)) (x < 0 ? next : prev)();
    else if (y > 110 && Math.abs(y) > Math.abs(x)) onClose(); // swipe down to close
  };

  const btn = 'w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur transition-colors';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col animate-route-fade select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <span className="text-sm text-white/70 tabular-nums">{many ? `${index + 1} / ${sources.length}` : ''}</span>
        <button type="button" onClick={onClose} title="Close (Esc)" aria-label="Close" className={btn}>
          <FiX className="text-xl" />
        </button>
      </div>

      {/* image */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2" onClick={onClose}>
        <img
          src={sources[index]}
          alt=""
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full w-auto h-auto object-contain"
          style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform 200ms ease-out' }}
        />
        {many && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} title="Previous (←)" aria-label="Previous image"
              className={`${btn} hidden sm:grid absolute left-4 top-1/2 -translate-y-1/2`}>
              <FiChevronLeft className="text-2xl" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} title="Next (→)" aria-label="Next image"
              className={`${btn} hidden sm:grid absolute right-4 top-1/2 -translate-y-1/2`}>
              <FiChevronRight className="text-2xl" />
            </button>
          </>
        )}
      </div>

      {/* dots */}
      {many && (
        <div className="flex justify-center gap-1.5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {sources.map((_, i) => (
            <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`Image ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/35'}`} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
