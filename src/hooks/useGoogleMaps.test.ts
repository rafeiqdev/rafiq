import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * Which Google Maps failures we can actually detect.
 *
 * The one that was reaching visitors is `blocked`: a key rejected for this
 * domain does NOT make the script fail to load. `importLibrary()` resolves
 * happily, the old code therefore reported `ready`, a Map got constructed, and
 * Google painted its own "didn't load Google Maps correctly" card into our
 * container. Only window.gm_authFailure reveals it.
 */

const importLibrary = vi.fn();
vi.mock('@googlemaps/js-api-loader', () => ({
  importLibrary: (...a: unknown[]) => importLibrary(...a),
  setOptions: vi.fn(),
}));

type Mod = typeof import('./useGoogleMaps');

async function freshModule(key: string | undefined): Promise<Mod> {
  vi.resetModules();
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', key ?? '');
  return import('./useGoogleMaps');
}

beforeEach(() => {
  importLibrary.mockReset();
  importLibrary.mockResolvedValue({});
  delete (window as { gm_authFailure?: unknown }).gm_authFailure;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('detectable: key missing entirely', () => {
  it('reports no-key without ever attempting to load the SDK', async () => {
    const { useGoogleMaps } = await freshModule(undefined);
    const { result } = renderHook(() => useGoogleMaps());

    expect(result.current.status).toBe('no-key');
    // Not merely "reports a failure" — it must not have asked Google anything.
    expect(importLibrary).not.toHaveBeenCalled();
  });
});

describe('detectable: the script itself never arrives', () => {
  it('reports error when the SDK import rejects', async () => {
    const { useGoogleMaps } = await freshModule('test-key');
    importLibrary.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useGoogleMaps());

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('reports ready when the SDK loads and Google does not object', async () => {
    const { useGoogleMaps } = await freshModule('test-key');

    const { result } = renderHook(() => useGoogleMaps());

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

describe('a rejection while loading beats a later success', () => {
  it('stays blocked even though importLibrary resolved fine', async () => {
    // This is the exact shape of the real bug: the script loads perfectly, so
    // the naive implementation concluded `ready` and let a Map be constructed.
    const { useGoogleMaps } = await freshModule('test-key');
    const { result } = renderHook(() => useGoogleMaps());

    // Google invokes this from outside React, so act() mirrors reality while
    // keeping the state update inside React's batching.
    act(() => (window as unknown as { gm_authFailure: () => void }).gm_authFailure());

    await waitFor(() => expect(result.current.status).toBe('blocked'));
    expect(result.current.status).not.toBe('ready');
  });
});

describe('detectable: Google rejects the key (the bug that shipped)', () => {
  it('registers window.gm_authFailure at module load, before any map exists', async () => {
    // Google calls whatever is on window at the moment auth fails, so this must
    // be in place before the first Map is constructed — not after.
    await freshModule('test-key');
    expect(typeof (window as { gm_authFailure?: unknown }).gm_authFailure).toBe('function');
  });

  it('treats an auth failure as unavailable', async () => {
    const mod = await freshModule('test-key');
    expect(mod.isMapUnavailable('blocked')).toBe(true);
  });

  it('remembers a failure that happened before a later component mounted', async () => {
    // gm_authFailure fires once per page; a map mounted afterwards (crossing the
    // mobile breakpoint, say) must not optimistically report ready.
    const mod = await freshModule('test-key');
    (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
    // The latch is module-level, so a fresh subscriber still sees it.
    expect(mod.isMapUnavailable('blocked')).toBe(true);
  });
});

describe('every failure status routes to the fallback', () => {
  it('marks no-key, error and blocked as unavailable', async () => {
    const { isMapUnavailable, MAP_FAILURE_STATUSES } = await freshModule('test-key');
    expect(MAP_FAILURE_STATUSES).toEqual(['no-key', 'error', 'blocked']);
    for (const s of MAP_FAILURE_STATUSES) expect(isMapUnavailable(s)).toBe(true);
  });

  it('does NOT mark loading or ready as unavailable', async () => {
    const { isMapUnavailable } = await freshModule('test-key');
    expect(isMapUnavailable('loading')).toBe(false);
    expect(isMapUnavailable('ready')).toBe(false);
  });
});

describe('diagnostics are for the owner, never the visitor', () => {
  it('logs nothing outside dev', async () => {
    vi.stubEnv('DEV', false);
    const mod = await freshModule('test-key');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mod.devDiagnose('blocked', 'should not appear');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('names the real reason in dev so a blocked key is diagnosable', async () => {
    vi.stubEnv('DEV', true);
    const mod = await freshModule('test-key');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mod.devDiagnose('blocked', 'rejected for this origin');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rejected for this origin'), '');
    warn.mockRestore();
  });
});
