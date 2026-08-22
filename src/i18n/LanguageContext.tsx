import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SupportedLanguage, TextDirection, Translations, LanguageInfo } from './types';
import { LANGUAGES } from './types';
import { arTranslations } from './translations/ar';
import { enTranslations } from './translations/en';
import { faTranslations } from './translations/fa';
import { ruTranslations } from './translations/ru';
import { setLanguage as switchSiteLanguage, RTL_LANGS } from './index';

const TRANSLATION_MAP: Record<SupportedLanguage, Translations> = {
  ar: arTranslations,
  en: enTranslations,
  fa: faTranslations,
  ru: ruTranslations,
};

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  dir: TextDirection;
  isRtl: boolean;
  t: Translations;
  languages: Record<SupportedLanguage, LanguageInfo>;
  currentLangInfo: LanguageInfo;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Bridges the ported homepage-v2 design to the site's REAL language system
 * instead of the standalone mockup's own localStorage/query-param state.
 *
 * The site resolves language from the URL segment (`/ar/...`, `/en/...`) and
 * that segment is the router's `basename` — it is the single source of truth
 * for hreflang/canonical SEO tags built last week. A second, independent
 * language store here would let this page show Arabic on an `/en/` URL. So
 * `language` reads straight off i18next's current language (already resolved
 * from the URL before this ever mounts), and `setLanguage` calls the site's
 * real `setLanguage()` (src/i18n/index.ts), which navigates to the other
 * `/<lang>` prefix — the same thing the header's own LangSwitcher does.
 */
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const language: SupportedLanguage = (i18n.language in LANGUAGES ? i18n.language : 'ar') as SupportedLanguage;

  const dir: TextDirection = RTL_LANGS.includes(language as never) ? 'rtl' : 'ltr';
  const isRtl = dir === 'rtl';
  const currentLangInfo = LANGUAGES[language];
  const t = useMemo(() => TRANSLATION_MAP[language], [language]);

  const setLanguage = (newLang: SupportedLanguage) => {
    if (!LANGUAGES[newLang] || newLang === language) return;
    void switchSiteLanguage(newLang);
  };

  const contextValue = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, dir, isRtl, t, languages: LANGUAGES, currentLangInfo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setLanguage is stable (closes only over `language`, already a dep)
    [language, dir, isRtl, t, currentLangInfo],
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a <LanguageProvider>');
  }
  return context;
}
