import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { THEMES, THEME_KEYS, DEFAULT_THEME, STORAGE_KEY, applyTheme } from '../theme/themes';

const ThemeContext = createContext(null);

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEME_KEYS.includes(saved)) return saved;
  } catch {
    /* localStorage unavailable (private mode, etc.) */
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);

  // Apply on mount and whenever it changes.
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((key) => {
    if (THEME_KEYS.includes(key)) setThemeState(key);
  }, []);

  // Light/dark switch: remembers the last theme picked in each mode so the
  // header toggle flips between e.g. Dracula <-> One Light, not to a fixed pair.
  const mode = THEMES[theme]?.mode || 'dark';
  useEffect(() => {
    try { localStorage.setItem(`${STORAGE_KEY}-last-${mode}`, theme); } catch { /* ignore */ }
  }, [theme, mode]);

  const toggleMode = useCallback(() => {
    const target = mode === 'dark' ? 'light' : 'dark';
    let next = null;
    try { next = localStorage.getItem(`${STORAGE_KEY}-last-${target}`); } catch { /* ignore */ }
    if (!next || THEMES[next]?.mode !== target) {
      next = target === 'light'
        ? (THEMES.light ? 'light' : THEME_KEYS.find((k) => THEMES[k].mode === 'light'))
        : (THEMES[DEFAULT_THEME]?.mode === 'dark' ? DEFAULT_THEME : THEME_KEYS.find((k) => THEMES[k].mode === 'dark'));
    }
    if (next) setThemeState(next);
  }, [mode]);

  const value = {
    theme,
    setTheme,
    mode,
    toggleMode,
    themes: THEMES,
    themeKeys: THEME_KEYS,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
