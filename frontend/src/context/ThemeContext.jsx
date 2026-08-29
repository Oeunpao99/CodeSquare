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

  const value = {
    theme,
    setTheme,
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
