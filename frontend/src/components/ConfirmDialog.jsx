import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Centred confirm box. Rendered in a portal on <body> so a parent's transform
// (page fade-in animations) can't pull it off-centre. It closes itself once the
// action finishes, and blocks double clicks while it runs.
export default function ConfirmDialog({
  open = true,
  title,
  message,
  confirmLabel = 'Delete',
  confirmClass = 'btn-danger',
  onConfirm,
  onCancel,
  onClose,
}) {
  const [busy, setBusy] = useState(false);
  const close = onCancel || onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) close?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, close]);

  if (!open) return null;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
      close?.();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={() => !busy && close?.()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative card w-full max-w-sm p-5 animate-route-fade border-cs-line/15"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="text-[0.9375rem] font-semibold text-cs-text">{title}</h3>
        {message && <p className="text-sm text-cs-text-dim mt-2 leading-relaxed">{message}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn ${confirmClass} btn-sm disabled:opacity-60`} onClick={confirm} disabled={busy} autoFocus>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
