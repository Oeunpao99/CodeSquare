import React from 'react';
import { FiTrash2, FiX, FiAlertTriangle } from 'react-icons/fi';

// Dev-vibe confirmation modal — replaces window.confirm so the app never relies
// on the native browser dialog.
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-cs-dark/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card-dev max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                danger ? 'bg-cs-red/15 text-cs-red' : 'bg-cs-primary/15 text-cs-primary'
              }`}
            >
              {danger ? <FiTrash2 /> : <FiAlertTriangle />}
            </span>
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <button onClick={onClose} className="text-cs-text-muted hover:text-cs-text"><FiX /></button>
        </div>

        <p className="text-sm text-cs-text-dim whitespace-pre-wrap mb-6">{message}</p>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost font-mono">cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`btn font-mono ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
