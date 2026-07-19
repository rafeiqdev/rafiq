import { useEffect, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

/**
 * Loads the Maps JavaScript SDK once per page, not once per component.
 *
 * The promise is a module-level singleton because the SDK injects a global
 * <script>: mounting the map twice (e.g. crossing the mobile breakpoint) must
 * reuse the same load rather than race a second one.
 *
 * Uses the loader's functional API (`setOptions` + `importLibrary`) — the
 * `Loader` class is deprecated in @googlemaps/js-api-loader v2.
 */

export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export type MapsStatus = 'loading' | 'ready' | 'no-key' | 'error';

let loadPromise: Promise<void> | null = null;

function loadOnce(key: string): Promise<void> {
  if (loadPromise) return loadPromise;
  setOptions({ key, v: 'weekly' });
  // `places` powers Autocomplete, `marker` the AdvancedMarkerElement pins.
  // Awaiting all three here means callers never import mid-render.
  loadPromise = Promise.all([importLibrary('maps'), importLibrary('places'), importLibrary('marker')])
    .then(() => undefined)
    .catch((e: unknown) => {
      // Reset so a transient network failure can be retried by a remount,
      // rather than caching the rejection for the life of the page.
      loadPromise = null;
      throw e;
    });
  return loadPromise;
}

/**
 * `status` drives the two setup-failure states the map must render:
 *   no-key → VITE_GOOGLE_MAPS_API_KEY was never configured
 *   error  → the SDK failed to load; in practice almost always a key whose
 *            HTTP-referrer restriction rejects this origin
 */
export function useGoogleMaps(): { status: MapsStatus } {
  const [status, setStatus] = useState<MapsStatus>(() => (MAPS_API_KEY ? 'loading' : 'no-key'));

  useEffect(() => {
    if (!MAPS_API_KEY) return;
    let alive = true;
    loadOnce(MAPS_API_KEY).then(
      () => alive && setStatus('ready'),
      () => alive && setStatus('error'),
    );
    return () => {
      alive = false;
    };
  }, []);

  return { status };
}
