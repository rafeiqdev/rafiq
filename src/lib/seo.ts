import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lang } from './types';

/**
 * <head> metadata — SEO/Geo only. No component here renders any visible UI.
 *
 * Every page lives under a language segment (/ar /en /ru /fa — see
 * src/i18n/index.ts and App.tsx's basename), so canonical points at THIS
 * language's URL and each hreflang alternate points at a genuinely different
 * one. x-default is the Arabic variant: it is the product's primary audience
 * and the fallback the langless 301s resolve to.
 */

/**
 * This deployment's own origin, baked in at build time from VITE_BASE_URL.
 *
 * There is deliberately NO fallback host here. The previous one was a hardcoded
 * literal that did not match what VITE_BASE_URL was actually set to, so whenever
 * the variable went missing the canonical tag, og:url and every hreflang quietly
 * pointed at the wrong domain — visible to crawlers, invisible to us. A missing
 * value must break loudly instead. (The removed literal is not repeated here:
 * src/lib/hostnameHygiene.test.ts bans this repo's own hostname everywhere,
 * comments included, since a host in a comment is still one to paste back in.)
 *
 * The real gate is vite.config.ts, which validates this via scripts/siteUrl.mjs
 * before a bundle is produced at all; the build cannot succeed without it. The
 * throw below is only a tripwire for a code path that reaches this module
 * without going through that gate (a bare `vitest` run, say — vitest.config.ts
 * supplies its own value for exactly this reason). It is not the enforcement.
 */
const RAW_SITE_URL = import.meta.env.VITE_BASE_URL as string | undefined;
if (!RAW_SITE_URL) {
  throw new Error(
    'VITE_BASE_URL is not set. It has no fallback on purpose — see scripts/siteUrl.mjs. ' +
      'Set it in Vercel (Project → Settings → Environment Variables) or in .env for local dev.',
  );
}
export const SITE_URL: string = RAW_SITE_URL;

export const SEO_LANGS: Lang[] = ['ar', 'en', 'ru', 'fa'];

const OG_LOCALE: Record<Lang, string> = {
  // ar_AR is not a valid locale (AR is Argentina's country code, and Arabic
  // has no "AR" region) — parsers fall back to unknown. ar_SA is.
  ar: 'ar_SA',
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
    // useLocation() is basename-relative, so the language segment must be
    // re-attached here — it is the part that makes each alternate distinct.
    const path = location.pathname === '/' ? '' : location.pathname;
    const lang = (i18n.language as Lang) in OG_LOCALE ? (i18n.language as Lang) : 'ar';
    const url = `${SITE_URL}/${lang}${path}`;

    upsertLink('canonical', url);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:locale', OG_LOCALE[lang]);

    for (const l of SEO_LANGS) upsertLink('alternate', `${SITE_URL}/${l}${path}`, l);
    upsertLink('alternate', `${SITE_URL}/ar${path}`, 'x-default');
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
export function usePageMeta({
  title,
  description,
  image,
  noindex,
}: {
  title: string;
  description: string;
  image?: string;
  /** Set for pages with no real content to show — e.g. an unknown/hidden service id — so a
   *  stale sitemap or inbound link can never get a "not found" page indexed as real content. */
  noindex?: boolean;
}) {
  useEffect(() => {
    claim.current = true;
    const ogImage = image ?? DEFAULT_OG_IMAGE;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow');
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
      upsertMeta('name', 'robots', 'index,follow');
      upsertMeta('property', 'og:title', DEFAULT_TITLE);
      upsertMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
      upsertMeta('name', 'twitter:title', DEFAULT_TITLE);
      upsertMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
      upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
    };
  }, [title, description, image, noindex]);
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
