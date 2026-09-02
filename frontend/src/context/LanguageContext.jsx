import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'cs-lang';

function readStoredLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['en', 'km'].includes(saved)) return saved;
  } catch { /* ignore */ }
  return 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang);

  useEffect(() => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch { /* ignore */ }
    // Update <html lang="..."> for browser accessibility
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((code) => {
    if (['en', 'km'].includes(code)) setLangState(code);
  }, []);

  const languages = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'km', label: 'Khmer', native: 'ភាសាខ្មែរ', flag: '🇰🇭' },
  ];

  const value = { lang, setLang, languages };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
