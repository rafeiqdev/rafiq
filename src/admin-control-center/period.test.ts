import { afterEach, describe, expect, it } from 'vitest';
import { pctChange, previousRange, rangeFor } from './period';

/**
 * Period boundaries decide every number in the Control Center, so they are
 * pinned here rather than trusted. All ranges are half-open [from, to) so two
 * adjacent periods can never both count the same row.
 *
 * Boundaries are asserted as exact UTC ISO instants, not via local Date
 * getters (`.getDate()`/`.getHours()`) — those read the TEST RUNNER's own
 * timezone, which is exactly the bug this module fixes (see period.ts). The
 * `process.env.TZ` flip in the last block proves the result is independent of
 * whatever machine runs the test.
 */
const NOW = new Date('2026-08-17T11:30:00.000Z'); // 2026-08-17 14:30 Istanbul time (UTC+3)

describe('rangeFor', () => {
  it('today is Istanbul midnight to the next Istanbul midnight', () => {
    const r = rangeFor('today', NOW);
    expect(r.from.toISOString()).toBe('2026-08-16T21:00:00.000Z'); // 2026-08-17 00:00 Istanbul
    expect(r.to.toISOString()).toBe('2026-08-17T21:00:00.000Z'); // 2026-08-18 00:00 Istanbul
  });

  it('yesterday is the full previous Istanbul day and excludes today', () => {
    const r = rangeFor('yesterday', NOW);
    expect(r.from.toISOString()).toBe('2026-08-15T21:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-08-16T21:00:00.000Z');
  });

  it('7d spans the 7 preceding Istanbul days plus today', () => {
    const r = rangeFor('7d', NOW);
    expect(r.from.toISOString()).toBe('2026-08-09T21:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-08-17T21:00:00.000Z');
  });

  it('this month starts on the 1st at Istanbul midnight', () => {
    const r = rangeFor('thisMonth', NOW);
    expect(r.from.toISOString()).toBe('2026-07-31T21:00:00.000Z'); // 2026-08-01 00:00 Istanbul
    expect(r.to.toISOString()).toBe('2026-08-17T21:00:00.000Z');
  });

  it('last month covers the whole previous calendar month (Istanbul)', () => {
    const r = rangeFor('lastMonth', NOW);
    expect(r.from.toISOString()).toBe('2026-06-30T21:00:00.000Z'); // 2026-07-01 00:00 Istanbul
    expect(r.to.toISOString()).toBe('2026-07-31T21:00:00.000Z'); // 2026-08-01 00:00 Istanbul, exclusive
  });

  it('last month rolls the year back correctly in January', () => {
    const jan = new Date('2026-01-15T09:00:00.000Z');
    const r = rangeFor('lastMonth', jan);
    expect(r.from.toISOString()).toBe('2025-11-30T21:00:00.000Z'); // 2025-12-01 00:00 Istanbul
    expect(r.to.toISOString()).toBe('2025-12-31T21:00:00.000Z'); // 2026-01-01 00:00 Istanbul
  });

  it('a row exactly at the Istanbul midnight boundary lands in the new day, not the old one', () => {
    // 2026-08-16T21:00:00.000Z IS Istanbul midnight for Aug 17 — "today"'s from-bound.
    const r = rangeFor('today', NOW);
    const boundary = new Date('2026-08-16T21:00:00.000Z').getTime();
    const oneMsBefore = boundary - 1;
    expect(boundary >= r.from.getTime() && boundary < r.to.getTime()).toBe(true);
    expect(oneMsBefore >= r.from.getTime() && oneMsBefore < r.to.getTime()).toBe(false);
  });
});

describe('rangeFor — independent of the machine timezone', () => {
  const ORIGINAL_TZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('produces the same boundaries regardless of process.env.TZ', () => {
    const seen = new Set<string>();
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Istanbul']) {
      process.env.TZ = tz;
      const r = rangeFor('today', NOW);
      seen.add(`${r.from.toISOString()}|${r.to.toISOString()}`);
    }
    expect(seen.size).toBe(1);
  });
});

describe('previousRange', () => {
  it('is the same length and sits immediately before', () => {
    const r = rangeFor('7d', NOW);
    const p = previousRange(r);
    expect(p.to.getTime()).toBe(r.from.getTime());
    expect(r.to.getTime() - r.from.getTime()).toBe(p.to.getTime() - p.from.getTime());
  });
});

describe('pctChange', () => {
  it('computes a normal increase and decrease', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });

  it('returns null when the baseline is zero — a % of nothing is not a fact', () => {
    expect(pctChange(10, 0)).toBeNull();
  });
});
