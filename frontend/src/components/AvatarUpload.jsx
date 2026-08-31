import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiUpload, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import { toast } from '../utils/toast';

const VIEW = 200;      // on-screen crop viewport, px
const OUT = 256;       // exported square, px
const MAX_ZOOM = 3;

// Center-crop + zoom/pan avatar picker. Bakes the result to a 256px square
// WebP (JPEG fallback) data URI and hands it up via onChange. Pass "" up to
// clear. `value` is the currently-saved avatar (data URI or remote URL).
function AvatarUpload({ value, name = '', onChange }) {
  const [editSrc, setEditSrc] = useState(null);   // object URL while cropping
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => () => { if (editSrc) URL.revokeObjectURL(editSrc); }, [editSrc]);

  const baseScale = nat.w && nat.h ? Math.max(VIEW / nat.w, VIEW / nat.h) : 1;

  const clamp = useCallback((o, z) => {
    const dispW = nat.w * baseScale * z;
    const dispH = nat.h * baseScale * z;
    const mx = Math.max(0, (dispW - VIEW) / 2);
    const my = Math.max(0, (dispH - VIEW) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  }, [nat, baseScale]);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      toast.error('Pick a PNG, JPEG, WebP or GIF image.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error('That image is over 12 MB — try a smaller one.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setEditSrc(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error("Couldn't read that image."); };
    img.src = url;
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ...offset };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const next = {
      x: drag.current.x + (e.clientX - drag.current.px),
      y: drag.current.y + (e.clientY - drag.current.py),
    };
    setOffset(clamp(next, zoom));
  };
  const onPointerUp = () => { drag.current = null; };

  const changeZoom = (z) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(nz);
    setOffset((o) => clamp(o, nz));
  };

  const apply = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const r = OUT / VIEW;
      const scale = baseScale * zoom * r;
      const dispW = nat.w * scale;
      const dispH = nat.h * scale;
      const dx = (OUT - dispW) / 2 + offset.x * r;
      const dy = (OUT - dispH) / 2 + offset.y * r;
      ctx.fillStyle = '#0b0b0f';
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, dx, dy, dispW, dispH);
      let out = canvas.toDataURL('image/webp', 0.85);
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.85);
      onChange(out);
      setEditSrc(null);
    };
    img.src = editSrc;
  };

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  // --- cropping UI ---
  if (editSrc) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative rounded-full overflow-hidden border-2 border-cs-primary/40 bg-cs-darkest cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={editSrc}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            style={{
              width: nat.w * baseScale * zoom,
              height: nat.h * baseScale * zoom,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
          <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10 pointer-events-none" />
        </div>

        <input
          type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom}
          onChange={(e) => changeZoom(parseFloat(e.target.value))}
          className="w-48 accent-cs-primary"
          aria-label="Zoom"
        />

        <div className="flex gap-2">
          <button type="button" onClick={apply} className="btn btn-primary btn-sm">
            <FiCheck /> Use photo
          </button>
          <button type="button" onClick={() => setEditSrc(null)} className="btn btn-ghost btn-sm">
            <FiX /> Cancel
          </button>
        </div>
        <p className="font-mono text-[11px] text-cs-text-muted">drag to reposition · scroll the slider to zoom</p>
      </div>
    );
  }

  // --- resting state ---
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-main border-2 border-cs-primary/40 shadow-[0_0_24px_-6px_rgb(var(--cs-primary)/0.5)] flex items-center justify-center text-2xl font-bold shrink-0">
        {value ? (
          <img src={value} alt="Your avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-cs-dark">{initial}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickFile} className="hidden" />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-secondary btn-sm">
          <FiUpload /> {value ? 'Change photo' : 'Upload photo'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="btn btn-ghost btn-sm text-cs-red">
            <FiTrash2 /> Remove
          </button>
        )}
        <span className="font-mono text-[11px] text-cs-text-muted">PNG, JPEG, WebP or GIF · cropped to a square</span>
      </div>
    </div>
  );
}

export default AvatarUpload;
