import React, { useEffect, useRef } from 'react';

const CLEAN = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Verification-code style input: one box per character, auto-advance,
 * Backspace goes back, arrows move, paste fills every box.
 * `value` is the plain code string; `onComplete` fires when all boxes are full.
 */
// status: 'idle' | 'verifying' (boxes spin in a wave) | 'error' (red + shake) | 'success' (green pop)
export default function CodeInput({
  length = 6, value, onChange, onComplete, autoFocus = false, disabled = false, status = 'idle',
}) {
  const refs = useRef([]);
  const chars = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  // After a wrong code the boxes are cleared: put the cursor back in the first box.
  useEffect(() => {
    if (status === 'idle' && !value) refs.current[0]?.focus();
  }, [status, value]);

  // The code is kept as one contiguous string (no gaps between boxes).
  const setAt = (start, text) => {
    const add = CLEAN(text);
    if (!add) return;
    const from = Math.min(start, value.length);
    const code = (value.slice(0, from) + add + value.slice(from + add.length)).slice(0, length);
    onChange(code);
    refs.current[Math.min(code.length, length - 1)]?.focus();
    if (code.length === length) onComplete?.(code);
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (chars[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    } else if (e.key === 'Enter' && value.length === length) {
      onComplete?.(value);
    }
  };

  return (
    <div
      className={`flex justify-center gap-2 sm:gap-3 [perspective:600px] ${status === 'error' ? 'code-shake' : ''}`}
      role="group"
      aria-label="Class code"
      aria-busy={status === 'verifying'}
    >
      {chars.map((ch, i) => (
        <input
          // re-key on the character so each new letter "pops" in
          key={`${i}-${ch}-${status === 'success' ? 's' : ''}`}
          ref={(el) => { refs.current[i] = el; }}
          value={ch}
          disabled={disabled || status === 'verifying' || status === 'success'}
          style={
            status === 'verifying' ? { animationDelay: `${i * 90}ms` }
              : status === 'success' ? { animationDelay: `${i * 50}ms` } : undefined
          }
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={length}
          aria-label={`Character ${i + 1}`}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => onKeyDown(i, e)}
          onChange={(e) => setAt(i, e.target.value.slice(-1) || '')}
          onPaste={(e) => { e.preventDefault(); setAt(0, e.clipboardData.getData('text')); }}
          className={`w-11 h-14 sm:w-12 sm:h-14 rounded-xl border-2 text-center text-2xl font-bold uppercase outline-none transition-colors [backface-visibility:visible]
            ${status === 'verifying' ? 'code-spin border-cs-primary bg-cs-primary/10 text-cs-primary'
              : status === 'success' ? 'code-success border-cs-green bg-cs-green text-white'
              : status === 'error' ? 'border-cs-red bg-cs-red/10 text-cs-red'
              : ch ? 'code-pop border-cs-primary/60 bg-cs-darker text-cs-text'
              : 'border-cs-line/15 bg-cs-darker text-cs-text'}
            focus:border-cs-primary focus:ring-4 focus:ring-cs-primary/15`}
        />
      ))}
    </div>
  );
}
