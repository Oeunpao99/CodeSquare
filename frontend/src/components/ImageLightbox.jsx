import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

export default function ImageLightbox({ sources, start = 0, onClose }) {
  const [index, setIndex] = useState(start);
  useEffect(() => setIndex(start), [start]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i > 0 ? i - 1 : sources.length - 1));
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % sources.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sources.length, onClose]);

  const prev = () => setIndex((i) => (i > 0 ? i - 1 : sources.length - 1));
  const next = () => setIndex((i) => (i + 1) % sources.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-route-fade"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        className="absolute top-4 right-4 p-2 rounded-full bg-cs-overlay/60 text-cs-text-dim hover:text-white transition-colors"
      >
        <FiX className="text-lg" />
      </button>

      {sources.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            title="Previous (←)"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-cs-overlay/60 text-cs-text-dim hover:text-white transition-colors"
          >
            <FiChevronLeft className="text-xl" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            title="Next (→)"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-cs-overlay/60 text-cs-text-dim hover:text-white transition-colors"
          >
            <FiChevronRight className="text-xl" />
          </button>
        </>
      )}

      <img
        src={sources[index]}
        alt=""
        className="max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain rounded-md"
        onClick={(e) => e.stopPropagation()}
      />
      {sources.length > 1 && (
        <p className="absolute bottom-4 font-mono text-xs text-cs-text-muted">
          {index + 1} / {sources.length}
        </p>
      )}
    </div>
  );
}