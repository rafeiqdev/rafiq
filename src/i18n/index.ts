import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';
import ru from './locales/ru.json';
import fa from './locales/fa.json';
import type { Lang } from '../lib/types';

export const RTL_LANGS: Lang[] = ['ar', 'fa'];

export function applyDir(lang: string) {
  const dir = RTL_LANGS.includes(lang as Lang) ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

const stored = localStorage.getItem('i18nextLng') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    ru: { translation: ru },
    fa: { translation: fa },
  },
  lng: stored,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDir(stored);

export async function setLanguage(lang: Lang) {
  localStorage.setItem('i18nextLng', lang);
  localStorage.setItem('rafiq_lang_selected', 'true');
  await i18n.changeLanguage(lang);
  applyDir(lang);
}

export default i18n;
