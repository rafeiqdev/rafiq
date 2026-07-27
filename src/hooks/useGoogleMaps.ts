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
 *
 * WHY THERE ARE TWO KINDS OF FAILURE
 * ----------------------------------------------------------------------------
 * A rejected key does NOT make the script fail to load. The bundle downloads and
 * `importLibrary()` resolves perfectly happily; the rejection only surfaces when
 * a Map is actually constructed, at which point Google paints ITS OWN error card
 * — "This page didn't load Google Maps correctly" — directly into our container.
 * So `error` (the script never arrived) and `blocked` (the script arrived and
 * then refused to work) are genuinely different states, and the second one is
 * the one that was reaching visitors.
 *
 * `window.gm_authFailure` is Google's documented hook for the second case. It is
 * registered at module load, BEFORE any SDK load is started, because Google
 * calls whatever is on `window` at the moment authentication fails.
 */

export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export type MapsStatus =
  /** SDK still downloading. */
  | 'loading'
  /** SDK loaded AND authenticated — safe to construct a Map. */
  | 'ready'
  /** VITE_GOOGLE_MAPS_API_KEY was never configured. */
  | 'no-key'
  /** The script itself failed to arrive (offline, blocked, CDN failure). */
  | 'error'
  /** The script arrived and Google then refused it — see gm_authFailure below. */
  | 'blocked';

/** Every status that must show the visitor-facing fallback instead of a map. */
export const MAP_FAILURE_STATUSES: MapsStatus[] = ['no-key', 'error', 'blocked'];

export function isMapUnavailable(status: MapsStatus): boolean {
  return MAP_FAILURE_STATUSES.includes(status);
}

let loadPromise: Promise<void> | null = null;

// Module-level so a component that mounts AFTER the failure still learns about
// it — gm_authFailure fires exactly once per page, not once per subscriber.
let authFailed = false;
const authListeners = new Set<() => void>();

/**
 * Google calls this on an authentication failure. It carries NO argument: the
 * specific reason (RefererNotAllowedMapError, BillingNotEnabledMapError, …) is
 * written to the browser console by the SDK and is not exposed programmatically,
 * so this cannot tell those cases apart — see the note in devDiagnose().
 */
function handleAuthFailure() {
  authFailed = true;
  devDiagnose(
    'blocked',
    'Google rejected the Maps key for this page. The SDK writes the specific code ' +
      '(RefererNotAllowedMapError / BillingNotEnabledMapError / ApiNotActivatedMapError / ' +
      'InvalidKeyMapError / ExpiredKeyMapError) to this console — read it directly above or ' +
      'below this line; it is not available to application code.',
  );
  authListeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = handleAuthFailure;
}

/**
 * Dev-only diagnostics. Visitors must never see any of this — the whole point of
 * the fallback is that the failure is invisible to them — but the owner still
 * needs to be able to tell a blocked key from an offline browser.
 */
export function devDiagnose(status: MapsStatus, detail: string, cause?: unknown) {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.warn(`[rafiq:maps] status=${status} — ${detail}`, cause ?? '');
}

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
 * `status` drives which of the setup-failure states the caller must render.
 * Anything in MAP_FAILURE_STATUSES means: show the fallback, never a map frame.
 */
export function useGoogleMaps(): { status: MapsStatus } {
  const [status, setStatus] = useState<MapsStatus>(() => {
    if (!MAPS_API_KEY) return 'no-key';
    // A failure that happened before this component mounted still counts.
    return authFailed ? 'blocked' : 'loading';
  });

  useEffect(() => {
    if (!MAPS_API_KEY) {
      devDiagnose('no-key', 'VITE_GOOGLE_MAPS_API_KEY is not set, so the SDK was never loaded.');
      return;
    }

    let alive = true;

    // Subscribe first: authentication can fail while the libraries are still
    // resolving, and that failure must win over a later `ready`.
    const onAuthFail = () => alive && setStatus('blocked');
    authListeners.add(onAuthFail);
    if (authFailed) setStatus('blocked');

    loadOnce(MAPS_API_KEY).then(
      () => {
        if (!alive) return;
        // Do not overwrite a rejection that already arrived.
        setStatus(authFailed ? 'blocked' : 'ready');
      },
      (e: unknown) => {
        if (!alive) return;
        devDiagnose('error', 'The Maps SDK script failed to load (network, offline, or blocked request).', e);
        setStatus('error');
      },
    );

    return () => {
      alive = false;
      authListeners.delete(onAuthFail);
    };
  }, []);

  return { status };
}

/** Test-only: clears the module-level auth latch between cases. */
export function __resetMapsAuthForTests() {
  authFailed = false;
  authListeners.clear();
  loadPromise = null;
}
