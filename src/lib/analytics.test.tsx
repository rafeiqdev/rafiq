import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Event-tracking client — the properties that matter most:
 *  - nothing is collected before consent, and nothing at all under DNT
 *  - a batch is never sent with an email/phone/free-text payload
 *  - the session id survives a login (and the user_id only appears on events
 *    tracked AFTER setAnalyticsUser() is called)
 *  - the unload path uses sendBeacon when it can, and never leaks a
 *    signed-in user's id through it (see the WHY comment in analytics.ts)
 */

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));

async function freshAnalytics() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
  return import('./analytics');
}

function fetchCalls() {
  return (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
}

/**
 * Only the calls that POST events.
 *
 * track() also asks /api/geo once per visit for the country code, and that is
 * a fetch too — so a bare `expect(fetch).toHaveBeenCalledTimes(n)` would now
 * be counting two different things and drift with every unrelated change. The
 * assertions below are about the EVENT SINK, so they filter to it. (The
 * consent tests deliberately keep asserting on `fetch` itself: before consent
 * NOTHING may go out, the country lookup included.)
 */
function sinkCalls() {
  return fetchCalls().filter((c) => String(c[0]).includes('/rest/v1/events'));
}

function lastBody(): Array<Record<string, unknown>> {
  const calls = sinkCalls();
  const init = calls[calls.length - 1][1] as RequestInit;
  return JSON.parse(init.body as string);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true }) as unknown as Promise<Response>));
  // jsdom does not implement sendBeacon by default — tests that need it define it explicitly.
  delete (navigator as { sendBeacon?: unknown }).sendBeacon;
  delete (navigator as { doNotTrack?: unknown }).doNotTrack;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('consent gating', () => {
  it('collects nothing before a consent decision — not even page_view', async () => {
    const { track, FLUSH_INTERVAL_MS } = await freshAnalytics();
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('collects nothing once consent is declined', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('declined');
    vi.useFakeTimers();

    track('service_click', { target: 'residency' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('starts collecting once consent is granted', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('service_click', { target: 'residency' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(1);
    expect(lastBody()[0]).toMatchObject({ event_type: 'service_click', target: 'residency' });
  });
});

describe('do not track', () => {
  it('skips collection entirely when navigator.doNotTrack is "1"', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('batching', () => {
  it('does not flush immediately — waits for the interval', async () => {
    const { track, setConsent } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');

    // The country lookup may already have gone out; the EVENT SINK must not have.
    expect(sinkCalls()).toHaveLength(0);
  });

  it('batches multiple events into one request on the interval', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('service_click', { target: 'a' });
    track('service_click', { target: 'b' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(1);
    const body = lastBody();
    expect(body).toHaveLength(2);
    // same page load -> same session
    expect(body[0].session_id).toBe(body[1].session_id);
  });

  it('flushes immediately once the batch cap is reached, without waiting for the interval', async () => {
    const { track, setConsent } = await freshAnalytics();
    setConsent('granted');
    // Real timers here: the assertion depends on microtask flushing inside
    // flush(), not on the interval timer at all.
    for (let i = 0; i < 20; i++) track('page_view');

    await vi.waitFor(() => expect(sinkCalls()).toHaveLength(1));
    expect(lastBody()).toHaveLength(20);
  });
});

describe('PII rejection — the hard rule', () => {
  it('drops an event whose target looks like an email', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('request_submitted', { target: 'someone@example.com' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an event whose meta contains an email', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('service_click', { target: 'residency', meta: { note: 'contact me at a@b.com' } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an event whose meta contains a phone-shaped string', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('service_click', { target: 'residency', meta: { phone: '+90 555 123 45 67' } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an event whose target itself is phone-shaped', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('search_performed', { target: '05551234567' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an event whose meta holds a nested object (not a flat identifier/enum)', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    // @ts-expect-error deliberately violating the flat-meta contract
    track('service_click', { target: 'residency', meta: { nested: { a: 1 } } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('still allows ordinary numeric/boolean/enum meta through', async () => {
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('search_performed', { meta: { query_len: 12, result_count: 4, broadcast: true, tier: 'pro' } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(1);
    expect(lastBody()[0].meta).toEqual({ query_len: 12, result_count: 4, broadcast: true, tier: 'pro' });
  });
});

describe('normalizeSearchQuery', () => {
  it('trims, collapses whitespace, and lowercases', async () => {
    const { normalizeSearchQuery } = await freshAnalytics();
    expect(normalizeSearchQuery('  Residency   Permit  ')).toBe('residency permit');
  });

  it('caps length at 100 characters', async () => {
    const { normalizeSearchQuery } = await freshAnalytics();
    expect(normalizeSearchQuery('a'.repeat(500))).toHaveLength(100);
  });
});

describe('search_performed carries real query text (the one documented meta exception)', () => {
  it('sends the normalized query through when it is ordinary search text', async () => {
    const { track, setConsent, normalizeSearchQuery, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('search_performed', { meta: { query: normalizeSearchQuery('  Residency Permit  '), result_count: 3 } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(1);
    expect(lastBody()[0].meta).toEqual({ query: 'residency permit', result_count: 3 });
  });

  it('still drops the whole event when the normalized query is phone-shaped', async () => {
    const { track, setConsent, normalizeSearchQuery, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('search_performed', { meta: { query: normalizeSearchQuery('+90 555 123 45 67'), result_count: 0 } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('still drops the whole event when the query contains an email', async () => {
    const { track, setConsent, normalizeSearchQuery, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('search_performed', { meta: { query: normalizeSearchQuery('contact a@b.com please'), result_count: 0 } });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('session id', () => {
  it('is generated once, persisted in sessionStorage, and survives a login', async () => {
    const { track, setConsent, setAnalyticsUser, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view'); // anonymous
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    const anonEvent = lastBody()[0];
    expect(anonEvent.user_id).toBeNull();
    expect(sessionStorage.getItem('rafiq_analytics_sid')).toBe(anonEvent.session_id);

    setAnalyticsUser('user-42');
    track('page_view'); // post-login
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    const loggedInEvent = lastBody()[0];

    expect(loggedInEvent.user_id).toBe('user-42');
    expect(loggedInEvent.session_id).toBe(anonEvent.session_id);
  });
});

describe('flush on hide (pagehide / visibilitychange)', () => {
  it('registers a pagehide listener and a visibilitychange listener on import', async () => {
    const windowSpy = vi.spyOn(window, 'addEventListener');
    const docSpy = vi.spyOn(document, 'addEventListener');

    await freshAnalytics();

    expect(windowSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
    expect(docSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('uses sendBeacon when available, and strips user_id from that final batch', async () => {
    // jsdom's Blob polyfill implements neither .text() nor .arrayBuffer(), so
    // the JSON is captured straight from the Blob constructor's arguments
    // instead of reading it back off a real Blob instance.
    let capturedParts: BlobPart[] | undefined;
    class CapturingBlob {
      constructor(parts: BlobPart[]) {
        capturedParts = parts;
      }
    }
    vi.stubGlobal('Blob', CapturingBlob as unknown as typeof Blob);

    const { track, setConsent, setAnalyticsUser, flush } = await freshAnalytics();
    setConsent('granted');
    setAnalyticsUser('user-7');
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    track('page_view');
    await flush('unload');

    expect(beacon).toHaveBeenCalledTimes(1);
    // sendBeacon carried the batch — nothing was posted to the sink with fetch.
    expect(sinkCalls()).toHaveLength(0);
    const [url] = beacon.mock.calls[0];
    expect(url).toContain('apikey=anon-test-key');
    const rows = JSON.parse(capturedParts![0] as string);
    expect(rows[0].user_id).toBeNull();
  });

  it('falls back to fetch(keepalive) when sendBeacon is unavailable', async () => {
    const { track, setConsent, setAnalyticsUser, flush } = await freshAnalytics();
    setConsent('granted');
    setAnalyticsUser('user-7');

    track('page_view');
    await flush('unload');

    expect(sinkCalls()).toHaveLength(1);
    const init = sinkCalls()[0][1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)[0].user_id).toBe('user-7');
  });
});

describe('page_view auto-capture on route change', () => {
  it('tracks the current path once consent is granted', async () => {
    const { setConsent, useTrackPageViews, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    // safePath() reads window.location (matching a real BrowserRouter, which
    // keeps window.location in sync via the History API) rather than the
    // react-router location object directly — pushState here mirrors that.
    window.history.pushState({}, '', '/services');
    vi.useFakeTimers();

    const wrapper = ({ children }: { children: ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;
    renderHook(() => useTrackPageViews(), { wrapper });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(1);
    expect(lastBody()[0]).toMatchObject({ event_type: 'page_view', path: '/services' });
  });
});

describe('AI referral attribution', () => {
  it('sends a fixed ChatGPT source without forwarding the query string', async () => {
    const { setConsent, track, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    const gtag = vi.fn();
    window.gtag = gtag;
    window.history.pushState({}, '', '/ar?utm_source=chatgpt.com&utm_medium=referral&query=private-text');
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(gtag).toHaveBeenCalledWith('event', 'ai_referral', {
      source: 'chatgpt.com',
      landing_page: '/ar',
    });
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({ page_path: '/ar', ai_referral_source: 'chatgpt.com' }),
    );
    expect(gtag.mock.calls.flat().join(' ')).not.toContain('private-text');
    window.history.replaceState({}, '', '/');
  });
});

/**
 * public.events was never created in the live database. Every batch since the
 * collection layer shipped was POSTed and discarded by the catch at the end of
 * flush() — a consenting visitor firing a doomed request roughly every 10
 * seconds of activity plus one on page-hide, invisibly, for zero stored rows.
 *
 * PostgREST answers 404 for an unknown relation, so that answer is treated as
 * "there is nowhere to put this" and collection stops for the page load. It is
 * NOT persisted: the next page load tries again, so creating the table brings
 * collection back with no redeploy.
 */
describe('missing events table', () => {
  const missing = () =>
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 }) as unknown as Promise<Response>));

  it('stops sending after the sink answers 404', async () => {
    missing();
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(sinkCalls()).toHaveLength(1);

    // Everything after the 404 is dropped before it reaches the network.
    for (let i = 0; i < 30; i++) track('service_click', { target: 'x' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 5);

    expect(sinkCalls()).toHaveLength(1);
  });

  it('does NOT give up on 401/403 — those are RLS or key faults, not a missing table', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 }) as unknown as Promise<Response>));
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(2);
  });

  it('resets on the next page load, so creating the table needs no redeploy', async () => {
    missing();
    const first = await freshAnalytics();
    first.setConsent('granted');
    vi.useFakeTimers();
    first.track('page_view');
    await vi.advanceTimersByTimeAsync(first.FLUSH_INTERVAL_MS);
    expect(sinkCalls()).toHaveLength(1);

    // A fresh module instance is what a new page load looks like.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 201 }) as unknown as Promise<Response>));
    const second = await freshAnalytics();
    second.setConsent('granted');
    second.track('page_view');
    await vi.advanceTimersByTimeAsync(second.FLUSH_INTERVAL_MS);

    expect(sinkCalls()).toHaveLength(1);
  });
});

/**
 * Visitor country.
 *
 * The column it lands in is added by a migration the owner pastes into the SQL
 * Editor by hand, so a deploy that sends `country` can and will run against a
 * database that does not have the column yet. The rule these tests hold: that
 * gap costs a country code, never a visit.
 */
describe('visitor country', () => {
  type SinkReply = { ok: boolean; status: number; text?: string };
  type SinkStub = (rows: Array<Record<string, unknown>>) => SinkReply;

  /** Answers /api/geo with `country`, and the event sink with `sink(rows)`. */
  function stubFetch(opts: {
    country?: string | null;
    /** Called per sink POST with the parsed rows; defaults to accepting them. */
    sink?: SinkStub;
  }) {
    const sink: SinkStub = opts.sink ?? (() => ({ ok: true, status: 201 }));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (String(url).includes('/api/geo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ country: opts.country ?? null }),
          } as unknown as Response);
        }
        const rows = JSON.parse((init?.body as string) ?? '[]');
        const r = sink(rows);
        return Promise.resolve({
          ok: r.ok,
          status: r.status,
          text: () => Promise.resolve(r.text ?? ''),
        } as unknown as Response);
      }),
    );
  }

  it('stamps the country the edge resolved onto every row in the batch', async () => {
    stubFetch({ country: 'TR' });
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    track('service_click', { target: 'residency' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    const rows = lastBody();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.country === 'TR')).toBe(true);
  });

  it('asks the edge once per visit, not once per event', async () => {
    stubFetch({ country: 'DE' });
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    track('page_view');
    track('service_click', { target: 'residency' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    expect(fetchCalls().filter((c) => String(c[0]).includes('/api/geo'))).toHaveLength(1);
  });

  it('records the visit with no country when the edge cannot resolve one', async () => {
    stubFetch({ country: null });
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    // The visit is still recorded; the field is simply absent, never guessed.
    expect(sinkCalls()).toHaveLength(1);
    expect(lastBody()[0]).not.toHaveProperty('country');
  });

  it('re-sends the batch without country when the column does not exist yet', async () => {
    const seen: Array<Array<Record<string, unknown>>> = [];
    stubFetch({
      country: 'TR',
      sink: (rows) => {
        seen.push(rows);
        return 'country' in rows[0]
          ? { ok: false, status: 400, text: `{"code":"PGRST204","message":"Could not find the 'country' column of 'events' in the schema cache"}` }
          : { ok: true, status: 201 };
      },
    });
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    // Rejected once with the column, accepted immediately without it — the
    // visit is NOT lost while the migration is still un-applied.
    expect(seen).toHaveLength(2);
    expect(seen[0][0]).toHaveProperty('country', 'TR');
    expect(seen[1][0]).not.toHaveProperty('country');

    // ...and it stops trying for the rest of the page load, so every later
    // batch costs one request rather than two.
    seen.length = 0;
    track('service_click', { target: 'residency' });
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(seen).toHaveLength(1);
    expect(seen[0][0]).not.toHaveProperty('country');
  });

  it('does not mistake an unrelated rejection for a missing column', async () => {
    const seen: Array<Array<Record<string, unknown>>> = [];
    stubFetch({
      country: 'TR',
      sink: (rows) => {
        seen.push(rows);
        return { ok: false, status: 400, text: `{"code":"P0001","message":"events_rate_limit"}` };
      },
    });
    const { track, setConsent, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    vi.useFakeTimers();

    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

    // One attempt, no retry, and country stays switched on for the next batch.
    expect(seen).toHaveLength(1);
    seen.length = 0;
    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(seen[0][0]).toHaveProperty('country', 'TR');
  });

  it('keeps country off the unload beacon until a normal flush has proven the column exists', async () => {
    let capturedParts: BlobPart[] | undefined;
    class CapturingBlob {
      constructor(parts: BlobPart[]) {
        capturedParts = parts;
      }
    }
    vi.stubGlobal('Blob', CapturingBlob as unknown as typeof Blob);
    stubFetch({ country: 'TR' });

    const { track, setConsent, flush, FLUSH_INTERVAL_MS } = await freshAnalytics();
    setConsent('granted');
    Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true });
    vi.useFakeTimers();

    // A beacon fired before any successful insert: no country, because a
    // beacon's response can never be read and a rejection would lose the
    // whole batch with no retry.
    track('page_view');
    await flush('unload');
    expect(JSON.parse(capturedParts![0] as string)[0]).not.toHaveProperty('country');

    // A normal flush proves the column is there...
    track('page_view');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(lastBody()[0]).toHaveProperty('country', 'TR');

    // ...so from then on the final batch of the visit carries it too.
    track('page_view');
    await flush('unload');
    expect(JSON.parse(capturedParts![0] as string)[0]).toHaveProperty('country', 'TR');
  });
});
