import { describe, expect, it } from 'vitest';
import { buildDaily, buildVisitorSessions } from './analytics';
import { rangeFor } from '../period';

/**
 * The two rollups behind "who visited the site" — pure functions over the raw
 * event log, so they can be pinned down without a database.
 *
 * What is actually being protected here:
 *  - a visit is replayed in the order it happened (PostgREST hands rows back
 *    newest-first, so a naive rollup reports the LAST page as the landing page
 *    and prints the journey backwards);
 *  - a visitor who signs in mid-visit is identified for the WHOLE visit;
 *  - a day with no traffic is a real zero on the trend, not a missing column
 *    that lets the line coast over a dead week.
 */

type Row = Parameters<typeof buildVisitorSessions>[0][number];

function ev(over: Partial<Row> & { session_id: string; created_at: string }): Row {
  return {
    event_type: 'page_view',
    path: '/',
    target: null,
    locale: 'ar',
    device: 'mobile',
    referrer: null,
    user_id: null,
    ...over,
  };
}

/** Newest-first, exactly as the query returns them. */
function asReturnedByPostgrest(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

describe('buildVisitorSessions', () => {
  it('replays a visit forwards: landing page first, journey in order', () => {
    const rows = asReturnedByPostgrest([
      ev({ session_id: 's1', created_at: '2026-09-01T10:00:00.000Z', path: '/' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:01:00.000Z', path: '/services' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:02:00.000Z', path: '/services/residency' }),
    ]);

    const [visit] = buildVisitorSessions(rows);

    expect(visit.landingPath).toBe('/');
    expect(visit.paths).toEqual(['/', '/services', '/services/residency']);
    expect(visit.pageViews).toBe(3);
    expect(visit.firstAt).toBe('2026-09-01T10:00:00.000Z');
    expect(visit.lastAt).toBe('2026-09-01T10:02:00.000Z');
  });

  it('collapses a repeated page but keeps a genuine return to it', () => {
    const rows = asReturnedByPostgrest([
      ev({ session_id: 's1', created_at: '2026-09-01T10:00:00.000Z', path: '/services' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:00:30.000Z', path: '/services' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:01:00.000Z', path: '/news' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:02:00.000Z', path: '/services' }),
    ]);

    expect(buildVisitorSessions(rows)[0].paths).toEqual(['/services', '/news', '/services']);
  });

  it('identifies the whole visit when the visitor signs in partway through', () => {
    const rows = asReturnedByPostgrest([
      ev({ session_id: 's1', created_at: '2026-09-01T10:00:00.000Z', path: '/' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:05:00.000Z', event_type: 'login', user_id: 'u1' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:06:00.000Z', path: '/profile', user_id: 'u1' }),
    ]);

    const [visit] = buildVisitorSessions(rows);
    expect(visit.userId).toBe('u1');
    expect(visit.actions).toEqual(['login']);
    expect(visit.events).toBe(3);
  });

  it('keeps a visit with no sign-in anonymous rather than borrowing an id', () => {
    const rows = [
      ev({ session_id: 's1', created_at: '2026-09-01T10:00:00.000Z', user_id: 'u1' }),
      ev({ session_id: 's2', created_at: '2026-09-01T11:00:00.000Z' }),
    ];
    const byId = Object.fromEntries(buildVisitorSessions(rows).map((v) => [v.sessionId, v]));

    expect(byId.s1.userId).toBe('u1');
    expect(byId.s2.userId).toBeNull();
  });

  it('takes the country from whichever event in the visit carried one', () => {
    // The first events of a visit are often flushed before the edge lookup
    // answers, so the country arrives partway through — it still describes the
    // whole visit.
    const rows = asReturnedByPostgrest([
      ev({ session_id: 's1', created_at: '2026-09-01T10:00:00.000Z', country: null }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:01:00.000Z', country: 'TR' }),
      ev({ session_id: 's1', created_at: '2026-09-01T10:02:00.000Z', country: 'TR' }),
    ]);

    expect(buildVisitorSessions(rows)[0].country).toBe('TR');
  });

  it('leaves the country null when nothing in the visit recorded one', () => {
    // Every event from before the country migration looks like this. "Unknown"
    // must stay unknown rather than borrowing another visit's country.
    const rows = [ev({ session_id: 's1', created_at: '2026-09-01T10:00:00.000Z' })];
    expect(buildVisitorSessions(rows)[0].country).toBeNull();
  });

  it('lists the most recent visit first', () => {
    const rows = [
      ev({ session_id: 'older', created_at: '2026-09-01T10:00:00.000Z' }),
      ev({ session_id: 'newer', created_at: '2026-09-03T10:00:00.000Z' }),
    ];

    expect(buildVisitorSessions(rows).map((v) => v.sessionId)).toEqual(['newer', 'older']);
  });
});

describe('buildDaily', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');

  it('covers every day of the range, including the ones with no traffic', () => {
    const range = rangeFor('7d', now);
    const points = buildDaily([], range);

    // 7d is the last 7 days plus today.
    expect(points).toHaveLength(8);
    expect(points.every((p) => p.sessions === 0 && p.pageViews === 0)).toBe(true);
    expect([...points].sort((a, b) => a.day.localeCompare(b.day)).map((p) => p.day)).toEqual(points.map((p) => p.day));
  });

  it('counts distinct visits per day, not raw events', () => {
    const range = rangeFor('7d', now);
    const rows = [
      ev({ session_id: 's1', created_at: '2026-09-08T09:00:00.000Z' }),
      ev({ session_id: 's1', created_at: '2026-09-08T09:05:00.000Z' }),
      ev({ session_id: 's2', created_at: '2026-09-08T18:00:00.000Z' }),
    ];

    const day = buildDaily(rows, range).find((p) => p.day === '2026-09-08');
    expect(day).toBeDefined();
    expect(day?.sessions).toBe(2);
    expect(day?.pageViews).toBe(3);
  });

  it('does not count a non-page-view event as a page view', () => {
    const range = rangeFor('7d', now);
    const rows = [
      ev({ session_id: 's1', created_at: '2026-09-08T09:00:00.000Z', event_type: 'whatsapp_clicked' }),
    ];

    const day = buildDaily(rows, range).find((p) => p.day === '2026-09-08');
    expect(day?.sessions).toBe(1);
    expect(day?.pageViews).toBe(0);
  });
});
