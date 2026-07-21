import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lang } from './types';

/**
 * <head> metadata — SEO/Geo only. No component here renders any visible UI.
 *
 * The site has no per-language URLs (language is a client-only preference in
 * localStorage — see src/i18n/index.ts), so every hreflang/canonical/og:url
 * value below is necessarily self-referencing: all four language variants
 * point at the SAME url. This still satisfies the letter of hreflang (each
 * variant lists itself + its siblings) and is harmless, but it carries none of
 * the usual crawl-budget benefit hreflang provides on sites with distinct
 * per-language URLs. Real benefit would require URL-based language routing,
 * which is a routing/architecture change out of scope here.
 */

const FALLBACK_SITE_URL = 'https://rafiq-istanbul.vercel.app';
export const SITE_URL = (import.meta.env.VITE_BASE_URL as string | undefined)?.replace(/\/+$/, '') || FALLBACK_SITE_URL;

export const SEO_LANGS: Lang[] = ['ar', 'en', 'ru', 'fa'];

const OG_LOCALE: Record<Lang, string> = {
  ar: 'ar_AR',
  en: 'en_US',
  ru: 'ru_RU',
  fa: 'fa_IR',
};

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.png`;

// Mirrors the static defaults already shipped in index.html — used to restore
// <head> to sane, generic content when a page-specific usePageMeta() unmounts
// (e.g. navigating from a covered page to one that sets nothing of its own).
const DEFAULT_TITLE = 'Rafiq Istanbul';
const DEFAULT_DESCRIPTION =
  'Residency, banking, housing, health and daily life in Istanbul — guided step by step in your language.';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Site-wide, path-derived <head> tags: canonical, og:url, og:locale, and the
 * hreflang alternates (ar/en/ru/fa + x-default). Called once from Layout.tsx
 * so every public route gets these automatically — no per-page wiring needed.
 * Re-runs on every route change and every language change.
 */
export function useSiteWideSeo() {
  const { i18n } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    const url = `${SITE_URL}${location.pathname}`;
    const lang = (i18n.language as Lang) in OG_LOCALE ? (i18n.language as Lang) : 'en';

    upsertLink('canonical', url);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:locale', OG_LOCALE[lang]);

    for (const l of SEO_LANGS) upsertLink('alternate', url, l);
    upsertLink('alternate', url, 'x-default');
  }, [location.pathname, i18n.language]);
}

// React fires effect cleanup/setup bottom-up: a page's own effect runs before
// Layout's on the same commit — including on a fresh/direct load, exactly how
// a crawler hits a URL. `claim` lets Layout's generic fallback (below) know a
// page already set something more specific, so it steps aside instead of
// clobbering it back to the generic copy right after.
const claim = { current: false };

/**
 * Per-page overrides for content that genuinely differs by page: title,
 * description, og:title/description/image, twitter:title/description/image.
 * Restores site-wide defaults on unmount so leaving a covered page doesn't
 * leave another page's copy behind.
 */
export function usePageMeta({ title, description, image }: { title: string; description: string; image?: string }) {
  useEffect(() => {
    claim.current = true;
    const ogImage = image ?? DEFAULT_OG_IMAGE;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', ogImage);

    return () => {
      claim.current = false;
      document.title = DEFAULT_TITLE;
      upsertMeta('name', 'description', DEFAULT_DESCRIPTION);
      upsertMeta('property', 'og:title', DEFAULT_TITLE);
      upsertMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
      upsertMeta('name', 'twitter:title', DEFAULT_TITLE);
      upsertMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
      upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
    };
  }, [title, description, image]);
}

/**
 * Generic, translated title/description for every route that doesn't call
 * usePageMeta() itself (or one of the pre-existing per-page effects in
 * Journey.tsx/MapPage.tsx/Onboarding.tsx/UserHome.tsx). Called from Layout.tsx.
 * Steps aside via `claim` when a page already set something more specific —
 * otherwise, on a fresh load, this being the parent effect would run AFTER
 * the page's own effect and clobber it straight back to the generic copy.
 */
export function useFallbackMeta(title: string, description: string) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (claim.current) return;
    document.title = title;
    upsertMeta('name', 'description', description);
  }, [title, description, pathname]);
}
