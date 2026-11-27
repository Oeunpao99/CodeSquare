import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { motion, useReducedMotion } from 'framer-motion';

// Centred modal rendered in a portal (so page transforms can't offset it).
export default function Dialog({ title, onClose, children, footer, wide = false, side = false }) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className={`fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm ${side ? 'flex justify-end' : 'grid place-items-center p-4'}`} onMouseDown={onClose}>
      <motion.div
        role="dialog" aria-modal="true" aria-label={title}
        initial={side && !reducedMotion ? { x: '100%' } : false}
        animate={side ? { x: 0 } : undefined}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`flex w-full flex-col bg-cs-dark shadow-2xl ${side
          ? 'h-dvh border-l border-cs-line/10 sm:w-80 lg:w-[30vw]'
          : `${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[90vh] rounded-2xl border border-cs-line/10`}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-cs-line/10">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-cs-text-dim hover:text-cs-text" aria-label="Close"><FiX /></button>
        </div>
        <div className={`overflow-y-auto px-6 py-5 ${side ? 'min-h-0 flex-1' : ''}`}>{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 py-4 border-t border-cs-line/10">{footer}</div>}
      </motion.div>
    </div>,
    document.body,
  );
}
