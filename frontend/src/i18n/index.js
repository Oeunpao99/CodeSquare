import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import km from '../locales/km.json';

const STORAGE_KEY = 'cs-lang';

function readStoredLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['en', 'km'].includes(saved)) return saved;
  } catch { /* ignore */ }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    km: { translation: km },
  },
  lng: readStoredLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
