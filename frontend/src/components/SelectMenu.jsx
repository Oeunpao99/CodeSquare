import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

/**
 * A styled replacement for <select>: a button that opens a menu.
 * options: [{ value, label, dot?: css colour, hint?: string }]
 */
export default function SelectMenu({
  value, onChange, options, disabled = false, align = 'left',
  className = '', buttonClassName = '', menuClassName = '', prefix = null, ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const ref = useRef(null);
  const current = options.find((o) => String(o.value) === String(value)) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    setHi(Math.max(0, options.findIndex((o) => String(o.value) === String(value))));
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (o) => { setOpen(false); if (String(o.value) !== String(value)) onChange(o.value); };

  const onKey = (e) => {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[hi]) pick(options[hi]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={ref} className={`relative inline-block ${className}`} onKeyDown={onKey}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-2 rounded-lg border border-cs-line/15 hover:border-cs-line/30 transition-colors disabled:opacity-50 ${
          open ? 'border-cs-primary/60' : ''
        } ${buttonClassName || 'h-8 px-2.5 text-sm'}`}
      >
        {prefix && <span className="text-cs-text-muted">{prefix}</span>}
        {current?.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: current.dot }} />}
        <span className="truncate font-medium">{current?.label}</span>
        <FiChevronDown className={`ml-auto shrink-0 text-cs-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute z-50 mt-1.5 min-w-full w-max max-w-xs max-h-72 overflow-auto p-1 rounded-xl border border-cs-line/10 bg-cs-darkest shadow-2xl animate-tab-in ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          {options.map((o, i) => {
            const active = String(o.value) === String(value);
            return (
              <li key={String(o.value)} role="option" aria-selected={active}>
                <button
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(o)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    i === hi ? 'bg-cs-overlay/[0.06]' : ''
                  } ${active ? 'text-cs-primary font-medium' : 'text-cs-text'}`}
                >
                  {o.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: o.dot }} />}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-cs-text-muted tabular-nums">{o.hint}</span>}
                  <FiCheck className={`shrink-0 ${active ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
