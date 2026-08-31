import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import AITutor from './AITutor';
import AiIcon from './AiIcon';

const TUTOR_MIN = 320;
const readWidth = () => {
  const v = parseInt(localStorage.getItem('cs-tutor-width') || '', 10);
  return Number.isFinite(v) ? Math.min(Math.max(v, TUTOR_MIN), 900) : 420;
};

// "Ask the AI while you read." A persistent right-edge handle that opens the
// CodeSquareAgent:
//   • desktop (lg+): a resizable right column — the page reflows left so both
//     stay visible, same split as the lesson / practice screens.
//   • mobile: a slide-in drawer over the page.
// Drop it on any scrolling page and pass the current `context`.
function TutorDock({ context, language, label = 'AI Tutor' }) {
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  const [width, setWidth] = useState(readWidth);
  const [resizing, setResizing] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Reserve room for the fixed panel so the page reflows left (desktop only).
  useEffect(() => {
    const on = open && desktop;
    // Animate the open/close shift, but follow the drag 1:1 while resizing.
    document.body.style.transition = resizing ? '' : 'padding-right .25s ease';
    document.body.style.paddingRight = on ? `${width}px` : '';
    return () => {
      document.body.style.paddingRight = '';
      document.body.style.transition = '';
    };
  }, [open, desktop, width, resizing]);

  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let latest = startW;
    setResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMove = (ev) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const max = Math.min(900, window.innerWidth - 380);
        latest = Math.min(Math.max(startW + (startX - ev.clientX), TUTOR_MIN), max);
        setWidth(latest);
      });
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('cs-tutor-width', String(Math.round(latest))); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const panel = (
    <div className="flex flex-col h-full bg-cs-darker">
      {/* Header strip — height + background matched to the lesson's sticky
          breadcrumb bar (h-12) so the two divider lines read as one line. */}
      <div className="flex items-center justify-between gap-3 h-12 px-4 border-b border-cs-line/10 bg-cs-dark/85 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-main flex items-center justify-center shrink-0">
            <AiIcon className="text-cs-dark text-base" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-semibold text-[13px] truncate">CodeSquareAgent</div>
            <div className="text-[11px] text-cs-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-cs-green rounded-full animate-pulse" />
              Online
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 text-cs-text-dim hover:text-cs-primary hover:bg-cs-overlay/10 rounded-lg transition-all shrink-0"
          title="Close panel"
        >
          <FiX />
        </button>
      </div>
      <div className="flex-grow min-h-0">
        <AITutor context={context} language={language} embedded />
      </div>
    </div>
  );

  return (
    <>
      {/* edge handle */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask the CodeSquareAgent"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 px-2 py-4 rounded-l-xl bg-gradient-main text-cs-dark shadow-lg hover:pr-3 transition-all"
        >
          <AiIcon className="text-xl" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
            {label}
          </span>
        </button>
      )}

      {/* desktop: resizable right column, page reflows via body padding */}
      <AnimatePresence>
        {open && desktop && (
          <motion.aside
            key="tutor-split"
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ duration: resizing ? 0 : 0.25, ease: 'easeOut' }}
            style={{ width }}
            className="fixed top-0 right-0 bottom-0 z-40 border-l border-cs-line/10 overflow-hidden"
          >
            <div
              onMouseDown={startResize}
              title="Drag to resize"
              className={`absolute left-0 top-0 bottom-0 w-1.5 z-20 cursor-col-resize transition-colors ${
                resizing ? 'bg-cs-primary/60' : 'hover:bg-cs-primary/40'
              }`}
            />
            {panel}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* mobile: slide-in drawer over the page */}
      <AnimatePresence>
        {open && !desktop && (
          <motion.div
            key="tutor-drawer"
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-cs-dark/60" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ x: 440 }}
              animate={{ x: 0 }}
              exit={{ x: 440 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute top-0 right-0 h-full w-full sm:w-[400px] shadow-2xl"
            >
              {panel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default TutorDock;
