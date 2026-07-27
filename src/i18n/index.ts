import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';
import ru from './locales/ru.json';
import fa from './locales/fa.json';
import type { Lang } from '../lib/types';

export const SUPPORTED_LANGS: Lang[] = ['ar', 'en', 'ru', 'fa'];

/** Arabic is the product's primary audience, so it is the floor, not English. */
export const DEFAULT_LANG: Lang = 'ar';

export const RTL_LANGS: Lang[] = ['ar', 'fa'];

export function applyDir(lang: string) {
  const dir = RTL_LANGS.includes(lang as Lang) ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

function isSupported(value: string | null | undefined): value is Lang {
  return !!value && (SUPPORTED_LANGS as string[]).includes(value);
}

/** The saved choice, or null when absent/corrupt/unsupported. */
function readStoredLang(): Lang | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const saved = localStorage.getItem('i18nextLng');
    return isSupported(saved) ? saved : null;
  } catch {
    // localStorage throws outright in some privacy modes — fall through.
    return null;
  }
}

/**
 * The browser's own preference, narrowed to a language we ship.
 *
 * Only the primary subtag matters: "ar-SA", "ar-EG" and "ar" are all Arabic to
 * us. Returns null for anything unsupported so the caller can fall back.
 */
export function detectBrowserLang(): Lang | null {
  if (typeof navigator === 'undefined' || !navigator) return null;
  const tag = navigator.languages?.[0] ?? navigator.language;
  if (!tag) return null;
  const primary = tag.split('-')[0]?.toLowerCase();
  return isSupported(primary) ? primary : null;
}

/**
 * Which language to open in, most specific signal first:
 *   1. what the user explicitly chose before (validated — a stale or hand-edited
 *      value must not put i18next into a locale we have no bundle for),
 *   2. what their browser asks for, if we ship it,
 *   3. Arabic.
 *
 * Read-only by design: detecting a language is not the same as choosing one, so
 * this never writes i18nextLng and never touches rafiq_lang_selected. Persisting
 * is setLanguage()'s job, which is what the language picker calls — otherwise a
 * first-time visitor would look like they had already picked, and the selector
 * would stop appearing.
 */
export function resolveInitialLang(): Lang {
  return readStoredLang() ?? detectBrowserLang() ?? DEFAULT_LANG;
}

const initial = resolveInitialLang();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    ru: { translation: ru },
    fa: { translation: fa },
  },
  lng: initial,
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false },
  returnNull: false,
  // An empty string is a MISSING translation, not a valid one.
  //
  // i18next's default is to return "" verbatim, which means fallbackLng never
  // engages and the UI renders nothing at all — strictly worse than showing the
  // Arabic. Ten bestOffer.* keys were blank in ru and fa, so Russian and Farsi
  // customers saw an empty screen at the exact moment their request was
  // submitted. This makes any future blank fall back instead of vanishing.
  returnEmptyString: false,
});

// Before first paint, so <html dir> is already correct and RTL layouts don't
// flash left-to-right on load.
applyDir(initial);

export async function setLanguage(lang: Lang) {
  localStorage.setItem('i18nextLng', lang);
  localStorage.setItem('rafiq_lang_selected', 'true');
  await i18n.changeLanguage(lang);
  applyDir(lang);
}

export default i18n;
