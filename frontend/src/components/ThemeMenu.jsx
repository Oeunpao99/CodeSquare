import React, { useEffect, useRef, useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

// Compact theme switcher for page headers. The big previewed picker lives on
// the Profile page (ThemePicker); this is the always-visible shortcut.
function ThemeMenu({ className = '' }) {
  const { theme, setTheme, themes, themeKeys } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const dots = ['cs-primary', 'cs-violet', 'cs-blue', 'cs-green', 'cs-orange'];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cs-line/10 hover:border-cs-primary/50 transition-colors"
        title="Editor theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex -space-x-1">
          {dots.map((t) => (
            <span
              key={t}
              className="w-2.5 h-2.5 rounded-full ring-1 ring-cs-dark"
              style={{ background: `rgb(var(--${t}))` }}
            />
          ))}
        </span>
        <span className="hidden sm:inline font-mono text-xs text-cs-text-dim">
          {themes[theme]?.label}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 p-1.5 rounded-xl border border-cs-line/10 bg-cs-darkest shadow-2xl z-50"
        >
          {['dark', 'light'].map((mode) => (
            <div key={mode}>
              <p className="px-3 pt-2 pb-1 mono-label text-cs-text-muted">// {mode}</p>
              {themeKeys
                .filter((key) => themes[key].mode === mode)
                .map((key) => {
                  const active = key === theme;
                  return (
                    <button
                      key={key}
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setTheme(key);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        active ? 'bg-cs-primary/10' : 'hover:bg-cs-overlay/5'
                      }`}
                    >
                      <span className="flex -space-x-1 shrink-0">
                        {dots.map((t) => (
                          <span
                            key={t}
                            className="w-3 h-3 rounded-full ring-1 ring-cs-darkest"
                            style={{ background: `rgb(${themes[key].colors[t]})` }}
                          />
                        ))}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{themes[key].label}</span>
                      </span>
                      {active && <FiCheck className="text-cs-primary shrink-0" />}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeMenu;
