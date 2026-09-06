import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * lazy() with stale-deploy recovery and a preload() handle.
 *
 * Every deployment renames the hashed JS chunks. A tab opened before a deploy
 * still holds the OLD manifest, so navigating to a not-yet-visited page
 * requests a chunk that no longer exists — "تعذّر تحميل الصفحة" on every
 * navigation until the user thinks to refresh. With several deploys a day this
 * hit users constantly.
 *
 * Recovery: reload the page ONCE (fetching the new manifest). The
 * sessionStorage guard stops a reload loop when the failure is real (offline);
 * a successful load clears it so the next deploy gets its own single retry.
 *
 * preload(): fetches the chunk ahead of render so the page transition
 * (src/components/PageTransitionRoutes.tsx) can wait for the code and swap
 * straight from the old page to the new one — instead of old page → spinner →
 * new page. It never rejects: a failed fetch is left for render-time lazy() to
 * handle with the reload logic above, and a concurrent preload/render share one
 * in-flight request.
 */
const CHUNK_RELOAD_KEY = 'rafiq_chunk_reloaded';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own constraint
export type PreloadableLazy<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own constraint
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): PreloadableLazy<T> {
  let inflight: Promise<{ default: T }> | null = null;
  const load = () => {
    if (!inflight) {
      inflight = factory().then(
        (m) => {
          sessionStorage.removeItem(CHUNK_RELOAD_KEY);
          return m;
        },
        (e: unknown) => {
          // forget the failure so the next attempt (render or preload) retries
          inflight = null;
          throw e;
        },
      );
    }
    return inflight;
  };

  const Component = lazy(() =>
    load().catch((e: unknown) => {
      if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        // never resolves — the reload replaces the document
        return new Promise<{ default: T }>(() => {});
      }
      throw e;
    }),
  );

  return Object.assign(Component, {
    preload: () =>
      load().then(
        () => undefined,
        () => undefined,
      ),
  });
}
