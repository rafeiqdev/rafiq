import { matchPath } from 'react-router-dom';
import { langFromPath } from '../i18n';

/**
 * Knows which lazy chunk(s) a URL needs, so they can be fetched BEFORE the
 * route switches (page transition) or before the click even lands (hover /
 * touch prefetch). App.tsx registers the table right next to its <Route>
 * declarations; nothing here imports a page.
 */

interface Loader {
  preload: () => Promise<void>;
}

export interface RoutePreloadEntry {
  /** react-router pattern, e.g. "/services/:id" */
  path: string;
  /** chunks the desktop screen needs */
  desktop?: Loader[];
  /** chunks the phone screen needs (falls back to `desktop`) */
  mobile?: Loader[];
  /** the route only redirects somewhere else — switch to it without a transition */
  redirect?: boolean;
  /** extra guard, e.g. "only when a session is stored" */
  when?: () => boolean;
}

let registry: RoutePreloadEntry[] = [];

export function registerRoutePreloads(entries: RoutePreloadEntry[]): void {
  registry = entries;
}

export function findRoutePreload(pathname: string): RoutePreloadEntry | undefined {
  return registry.find((e) => matchPath({ path: e.path, end: true }, pathname) !== null);
}

/** True for URLs that resolve to a real page (the catch-all "*" does not count). */
export function isKnownRoute(pathname: string): boolean {
  const entry = findRoutePreload(pathname);
  return entry !== undefined && entry.path !== '*';
}

export function isRedirectRoute(pathname: string): boolean {
  return findRoutePreload(pathname)?.redirect === true;
}

/** Resolves once every chunk the page needs is in memory. Never rejects. */
export function preloadRoute(pathname: string, isMobile: boolean): Promise<void> {
  const entry = findRoutePreload(pathname);
  if (!entry || entry.redirect || (entry.when && !entry.when())) return Promise.resolve();
  const loaders = (isMobile ? (entry.mobile ?? entry.desktop) : entry.desktop) ?? [];
  return Promise.all(loaders.map((l) => l.preload())).then(
    () => undefined,
    () => undefined,
  );
}

export interface ResolvedHref {
  /** router (language-relative) path, e.g. "/services/x" */
  path: string;
  /** language segment carried by the href, if any */
  lang: string | null;
  url: URL;
}

/**
 * Maps a full href onto the router's (language-relative) path, or null when
 * the link leaves the site. "/ar/services/x" → "/services/x"; a langless
 * "/admin" is returned as is (main.tsx adds the prefix on load).
 */
export function routePathFromHref(href: string): ResolvedHref | null {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const lang = langFromPath(url.pathname);
  if (!lang) return { path: url.pathname, lang: null, url };
  const rest = url.pathname.slice(lang.length + 1);
  return { path: rest === '' ? '/' : rest, lang, url };
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function connectionAllowsPrefetch(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return !/(^|-)2g$/.test(conn.effectiveType ?? '');
}

/**
 * Hover / touch / focus prefetch: the moment a visitor shows intent on an
 * internal link, its chunk starts downloading — usually done before the click.
 * Dedup is free: lazyPage shares one in-flight request per chunk.
 */
export function installLinkPrefetch(isMobile: () => boolean): () => void {
  if (typeof document === 'undefined') return () => {};
  const onIntent = (e: Event) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const a = target.closest('a[href]');
    if (!(a instanceof HTMLAnchorElement)) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    if (!connectionAllowsPrefetch()) return;
    const resolved = routePathFromHref(a.href);
    if (!resolved) return;
    void preloadRoute(resolved.path, isMobile());
  };
  document.addEventListener('mouseover', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
  return () => {
    document.removeEventListener('mouseover', onIntent);
    document.removeEventListener('touchstart', onIntent);
    document.removeEventListener('focusin', onIntent);
  };
}

/** Warms the most-visited pages once the browser is idle (skipped on slow / data-saver connections). */
export function prefetchWhenIdle(paths: string[], isMobile: () => boolean): () => void {
  if (typeof window === 'undefined' || !connectionAllowsPrefetch()) return () => {};
  const run = () => {
    for (const p of paths) void preloadRoute(p, isMobile());
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const handle = w.requestIdleCallback(run, { timeout: 6000 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(run, 3000);
  return () => window.clearTimeout(timer);
}
