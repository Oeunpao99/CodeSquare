import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * App-styled replacements for window.confirm / window.prompt.
 *
 *   if (!(await confirmDialog({ title: 'Delete week?', message: '…' }))) return;
 *   const reason = await promptDialog({ title: 'Reject', label: 'Reason' }); // null = cancelled
 *
 * Each call mounts a centred modal (blurred backdrop) on <body> and resolves
 * when the user chooses; Esc / clicking outside counts as Cancel.
 */
function Modal({ title, message, confirmLabel, danger, input, placeholder, onDone }) {
  const [value, setValue] = useState('');
  const okRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    (input ? inputRef : okRef).current?.focus();
    const onKey = (e) => e.key === 'Escape' && onDone(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [input, onDone]);

  const ok = () => onDone(input ? value : true);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={() => onDone(null)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl border border-cs-line/10 bg-cs-dark shadow-2xl animate-route-fade"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-lg font-bold text-cs-text">{title}</h2>
          {message && <p className="text-sm text-cs-text-dim mt-2 leading-relaxed">{message}</p>}
          {input && (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ok()}
              placeholder={placeholder}
              className="input w-full mt-4"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-cs-line/10">
          <button type="button" onClick={() => onDone(null)} className="btn btn-ghost">Cancel</button>
          <button
            ref={okRef}
            type="button"
            onClick={ok}
            className={`btn ${danger ? 'bg-cs-red text-white border border-cs-red hover:opacity-90' : 'btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function open(props) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const done = (result) => {
      document.body.style.overflow = prevOverflow;
      root.unmount();
      host.remove();
      resolve(result);
    };
    root.render(<Modal {...props} onDone={done} />);
  });
}

export async function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
  return (await open({ title, message, confirmLabel, danger })) === true;
}

export function promptDialog({ title, message, confirmLabel = 'OK', danger = false, placeholder = '' }) {
  return open({ title, message, confirmLabel, danger, placeholder, input: true });
}
