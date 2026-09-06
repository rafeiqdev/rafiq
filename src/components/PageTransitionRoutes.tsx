import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Location, NavigateFunction } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { langFromPath } from '../i18n';
import {
  installLinkPrefetch,
  isKnownRoute,
  isRedirectRoute,
  prefetchWhenIdle,
  preloadRoute,
  routePathFromHref,
} from '../lib/routePreload';
import { hardScrollToTop } from './ScrollToTop';
import { NavProgress } from './NavProgress';

/**
 * Smooth page-to-page navigation for the whole site.
 *
 * What a visitor sees: the header and tab bar stay exactly where they are,
 * the old page content fades and drifts away, the new page settles in — one
 * continuous motion, no white flash and no full-screen spinner in between.
 * Going back reverses the direction.
 *
 * How: the URL changes instantly (router), but the rendered route lags a
 * moment behind it —
 *   1. the next page's code is fetched first (preloadRoute) so the swap goes
 *      straight from the old page to the new one; a thin progress bar shows
 *      only if that takes longer than a blink;
 *   2. the swap itself runs inside document.startViewTransition(): the browser
 *      animates SNAPSHOTS in its own top layer, never the live DOM. That is the
 *      whole reason for this approach — the site is full of position:fixed
 *      bars inside page content (mobile tab bar, pay bars, sticky CTAs), and any
 *      transform on a live wrapper would become their containing block and pin
 *      them mid-page. Snapshots cannot do that. The animation itself lives in
 *      src/index.css (::view-transition-* rules).
 * Browsers without the API (and reduced-motion users) get an instant swap plus
 * the old opacity-only .route-fade entrance.
 *
 * Also owns two small perf wins that make the motion feel instant: chunks are
 * prefetched on hover/touch of any internal link, and the busiest pages are
 * warmed once the browser is idle.
 */
export const supportsViewTransitions =
  typeof document !== 'undefined' && typeof document.startViewTransition === 'function';

if (supportsViewTransitions) document.documentElement.classList.add('vt');

/** Show the progress bar only when the chunk is genuinely slow. */
const PROGRESS_DELAY_MS = 150;
/** Never hold the old page longer than this — fall through to the in-place loader. */
const PRELOAD_CAP_MS = 4000;
/** Warmed once the browser is idle: the pages almost every visit reaches. */
const HOT_ROUTES = ['/services', '/services/_', '/premium', '/help', '/auth'];

function historyIndex(): number {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Same page, only the query/hash/state changed — swap silently, no motion. */
function sameView(a: Location, b: Location): boolean {
  return a.pathname === b.pathname;
}

/**
 * Plain <a href> links to our own pages (the ported homepage hero/footer, a few
 * admin shortcuts) used to trigger a full document reload — a white flash and
 * everything re-downloaded. This routes them through the SPA instead, so they
 * get the same transition as every <Link>. Leaves alone: links react-router
 * already handled (defaultPrevented), modified clicks (new tab), other
 * languages (the router is mounted per language — that reload is on purpose),
 * static files and unknown URLs, and same-page #anchors.
 */
function installInternalLinkRouting(navigate: NavigateFunction, currentLang: string | null): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const a = target.closest('a[href]');
    if (!(a instanceof HTMLAnchorElement)) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-native')) return;
    if (/\bexternal\b/.test(a.rel)) return;
    const resolved = routePathFromHref(a.href);
    if (!resolved) return;
    if (resolved.lang && currentLang && resolved.lang !== currentLang) return;
    if (!isKnownRoute(resolved.path)) return;
    const { url } = resolved;
    if (url.pathname === window.location.pathname && url.hash) return;
    e.preventDefault();
    navigate(resolved.path + url.search + url.hash);
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}

export function PageTransitionRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [displayed, setDisplayed] = useState(location);
  const [pending, setPending] = useState(false);
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const lastIndex = useRef(typeof window !== 'undefined' ? historyIndex() : 0);

  useEffect(() => {
    const getMobile = () => isMobileRef.current;
    const currentLang = langFromPath(window.location.pathname);
    const stopPrefetch = installLinkPrefetch(getMobile);
    const stopIdle = prefetchWhenIdle(HOT_ROUTES, getMobile);
    const stopRouting = installInternalLinkRouting(navigate, currentLang);
    return () => {
      stopPrefetch();
      stopIdle();
      stopRouting();
    };
  }, [navigate]);

  useEffect(() => {
    if (location === displayed) return;
    if (sameView(location, displayed)) {
      setDisplayed(location);
      return;
    }

    let cancelled = false;
    const index = historyIndex();
    const direction = index < lastIndex.current ? 'back' : 'forward';
    lastIndex.current = index;

    const progressTimer = window.setTimeout(() => {
      if (!cancelled) setPending(true);
    }, PROGRESS_DELAY_MS);
    const cap = new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_CAP_MS));

    Promise.race([preloadRoute(location.pathname, isMobileRef.current), cap]).then(() => {
      if (cancelled) return;
      window.clearTimeout(progressTimer);
      setPending(false);

      const animate =
        supportsViewTransitions &&
        !isRedirectRoute(location.pathname) &&
        !prefersReducedMotion() &&
        !document.hidden;
      if (!animate) {
        setDisplayed(location);
        return;
      }

      const root = document.documentElement;
      root.dataset.navDirection = direction;
      const clear = () => {
        if (root.dataset.navDirection === direction) delete root.dataset.navDirection;
      };
      try {
        const transition = document.startViewTransition(() => {
          flushSync(() => setDisplayed(location));
          if (!location.hash) hardScrollToTop();
        });
        transition.finished.then(clear, clear);
        // A transition the browser skips (tab hidden, or a second navigation
        // arriving mid-animation) rejects `ready` — expected, not an error.
        transition.ready.catch(() => {});
      } catch {
        clear();
        setDisplayed(location);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(progressTimer);
    };
    // `displayed` is this effect's output, not an input: re-running on it would
    // start a second transition for the same navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <>
      <NavProgress active={pending} />
      <Routes location={displayed}>{children}</Routes>
    </>
  );
}
