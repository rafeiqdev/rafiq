import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '../lib/types';
import { track } from '../lib/analytics';

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
 * The language segment of a URL path (/ar/services -> 'ar'), or null when the
 * path carries none. The URL is the language's source of truth since the
 * per-language-URL migration: crawlers index /ar/… /en/… /ru/… /fa/… as
 * distinct pages, so what renders there must not depend on localStorage.
 */
export function langFromPath(pathname: string): Lang | null {
  const m = /^\/(ar|en|ru|fa)(?=\/|$)/.exec(pathname);
  return m ? (m[1] as Lang) : null;
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

// The URL's language segment outranks every stored preference: /ru/services
// must render Russian for whoever opens it, or the four per-language URLs
// would all show the visitor's own language and hreflang would be a lie.
const initial =
  (typeof window !== 'undefined' ? langFromPath(window.location.pathname) : null) ?? resolveInitialLang();

/**
 * Locale bundles are ~100 KB of JSON each. Bundling all four into the entry
 * chunk shipped ~390 KB of raw JSON to every visitor, three quarters of it in
 * languages they will never switch to. Each locale is its own async chunk;
 * only the initial language (plus the Arabic fallback) loads before first
 * paint — main.tsx awaits `i18nReady` — and switching loads the target first.
 */
const LOCALE_LOADERS: Record<Lang, () => Promise<{ default: object }>> = {
  ar: () => import('./locales/ar.json'),
  en: () => import('./locales/en.json'),
  ru: () => import('./locales/ru.json'),
  fa: () => import('./locales/fa.json'),
};

export async function loadLocale(lang: Lang): Promise<void> {
  if (i18n.hasResourceBundle(lang, 'translation')) return;
  const mod = await LOCALE_LOADERS[lang]();
  i18n.addResourceBundle(lang, 'translation', mod.default, true, false);
}

i18n.use(initReactI18next).init({
  resources: {},
  partialBundledLanguages: true,
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

/**
 * REMEMBER the language the URL is actually showing.
 *
 * Some journeys leave the site and come back on a URL with NO language
 * segment — Google sign-in (Supabase returns to the bare origin), the
 * signup-confirmation and password-reset emails, any link shared without a
 * prefix. main.tsx rewrites those through resolveInitialLang(), which reads
 * this key; with nothing stored it fell through to the phone's own browser
 * language. So a visitor reading the site in Arabic tapped "تسجيل الدخول",
 * signed in with Google, and came back to an English site — English profile,
 * English onboarding questions — without having changed anything.
 *
 * Only i18nextLng is written, never rafiq_lang_selected: being routed into a
 * language is not the same as choosing one, so the first-visit language
 * picker still appears for someone who has never picked. And this runs only
 * when the URL carried a segment, so a langless entry reads the stored value
 * instead of overwriting it.
 */
if (typeof window !== 'undefined') {
  const fromPath = langFromPath(window.location.pathname);
  if (fromPath) {
    try {
      localStorage.setItem('i18nextLng', fromPath);
    } catch {
      // localStorage throws outright in some privacy modes — nothing to do.
    }
  }
}

/**
 * Resolves once the initial language and the Arabic fallback are loaded.
 * A failed chunk fetch (flaky network mid-deploy) must not blank the app —
 * the UI degrades to raw keys instead of never rendering.
 */
export const i18nReady: Promise<void> = Promise.all(
  [...new Set([initial, DEFAULT_LANG])].map((lang) => loadLocale(lang)),
).then(
  () => undefined,
  () => undefined,
);

export async function setLanguage(lang: Lang) {
  const from = i18n.language;
  localStorage.setItem('i18nextLng', lang);
  localStorage.setItem('rafiq_lang_selected', 'true');
  if (from !== lang) track('lang_changed', { target: lang, meta: { from } });

  // When the URL carries a language segment, switching means navigating to
  // the same page under the other prefix: the router is mounted with
  // basename=/<lang>, so this is a real navigation, not a re-render. The
  // reload is cheap (locales are per-language chunks) and keeps the URL —
  // the thing crawlers and shares see — as the single source of truth.
  if (typeof window !== 'undefined') {
    const current = langFromPath(window.location.pathname);
    if (current && current !== lang) {
      const rest = window.location.pathname.slice(current.length + 1);
      window.location.assign(`/${lang}${rest}${window.location.search}${window.location.hash}`);
      return;
    }
  }

  // No language segment (tests, non-routed contexts): switch in place.
  await loadLocale(lang);
  await i18n.changeLanguage(lang);
  applyDir(lang);
}

export default i18n;
