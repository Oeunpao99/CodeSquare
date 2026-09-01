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
  if (!open) return null;
  const close = onCancel || onClose;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative card w-full max-w-sm p-5 animate-route-fade border-cs-line/15"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-mono text-sm font-semibold text-cs-text">{title}</h3>
        {message && <p className="text-sm text-cs-text-dim mt-2 leading-relaxed">{message}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            Cancel
          </button>
          <button type="button" className={`btn ${confirmClass} btn-sm`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}