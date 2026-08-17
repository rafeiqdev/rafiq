import { describe, expect, it } from 'vitest';
import { pctChange, previousRange, rangeFor } from './period';

/**
 * Period boundaries decide every number in the Control Center, so they are
 * pinned here rather than trusted. All ranges are half-open [from, to) so two
 * adjacent periods can never both count the same row.
 */
const NOW = new Date(2026, 7, 17, 14, 30); // 17 Aug 2026, local time

describe('rangeFor', () => {
  it('today starts at midnight and ends at tomorrow midnight', () => {
    const r = rangeFor('today', NOW);
    expect(r.from.getDate()).toBe(17);
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getDate()).toBe(18);
  });

  it('yesterday is the full previous day and excludes today', () => {
    const r = rangeFor('yesterday', NOW);
    expect(r.from.getDate()).toBe(16);
    expect(r.to.getDate()).toBe(17);
    expect(r.to.getHours()).toBe(0);
  });

  it('last month covers the whole previous calendar month', () => {
    const r = rangeFor('lastMonth', NOW);
    expect(r.from.getMonth()).toBe(6); // July
    expect(r.from.getDate()).toBe(1);
    expect(r.to.getMonth()).toBe(7); // exclusive: 1 Aug
    expect(r.to.getDate()).toBe(1);
  });

  it('this month starts on the 1st', () => {
    const r = rangeFor('thisMonth', NOW);
    expect(r.from.getMonth()).toBe(7);
    expect(r.from.getDate()).toBe(1);
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
