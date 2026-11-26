import React, { useRef, useState } from 'react';
import { FiUploadCloud, FiFile, FiX } from 'react-icons/fi';

const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);

/**
 * Drop zone: drag a file onto it, or click to browse. Shows the chosen file
 * with a remove button. `maxMb` rejects files over the server limit up front.
 */
export default function FileDrop({ file, onFile, hint = 'Any file', maxMb = 50, disabled = false }) {
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const depth = useRef(0); // dragenter/leave fire for children too

  const pick = (f) => {
    if (!f) return;
    if (f.size > maxMb * 1024 * 1024) {
      setError(`${f.name} is ${fmtSize(f.size)}. The limit is ${maxMb} MB.`);
      return;
    }
    setError('');
    onFile(f);
  };

  const handlers = disabled ? {} : {
    onDragEnter: (e) => { e.preventDefault(); depth.current += 1; setOver(true); },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; },
    onDragLeave: (e) => { e.preventDefault(); depth.current -= 1; if (depth.current <= 0) setOver(false); },
    onDrop: (e) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      pick(e.dataTransfer.files?.[0]);
    },
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-cs-line/15 bg-cs-overlay/[0.04] p-4">
        <span className="w-10 h-10 rounded-lg bg-cs-primary/10 text-cs-primary grid place-items-center shrink-0"><FiFile /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-cs-text-dim">{fmtSize(file.size)}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onFile(null)} className="p-1.5 rounded-lg text-cs-text-dim hover:text-cs-red" aria-label="Remove file">
            <FiX />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        {...handlers}
        className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          over ? 'border-cs-primary bg-cs-primary/10' : 'border-cs-line/20 hover:border-cs-primary/50 hover:bg-cs-overlay/[0.03]'
        }`}
      >
        <FiUploadCloud className={`text-3xl ${over ? 'text-cs-primary' : 'text-cs-text-dim'}`} />
        <span className="text-sm font-medium">
          {over ? 'Drop the file here' : <>Drag & drop a file here, or <span className="text-cs-primary">browse</span></>}
        </span>
        <span className="text-xs text-cs-text-dim">{hint} · up to {maxMb} MB</span>
      </button>
      <input ref={inputRef} type="file" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p className="text-xs text-cs-red mt-2">{error}</p>}
    </div>
  );
}
