/**
 * Time-period selection shared by every Control Center section.
 *
 * Pure date math, no I/O, so the boundaries are unit-testable (see
 * period.test.ts). `from` is inclusive, `to` is exclusive — half-open ranges
 * compose cleanly and avoid the classic "last day counted twice" bug when two
 * periods sit next to each other.
 */
export type PeriodId = 'today' | 'yesterday' | '7d' | '30d' | 'thisMonth' | 'lastMonth';

export const PERIODS: PeriodId[] = ['today', 'yesterday', '7d', '30d', 'thisMonth', 'lastMonth'];
export const DEFAULT_PERIOD: PeriodId = '30d';

export interface Range {
  from: Date;
  to: Date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** The selected window. `now` is injectable so tests don't depend on the clock. */
export function rangeFor(period: PeriodId, now: Date = new Date()): Range {
  const today = startOfDay(now);
  switch (period) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case '7d':
      return { from: addDays(today, -7), to: addDays(today, 1) };
    case '30d':
      return { from: addDays(today, -30), to: addDays(today, 1) };
    case 'thisMonth':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
    case 'lastMonth':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 1),
      };
  }
}

/**
 * The immediately-preceding window of the same length, for "vs previous period"
 * comparisons. Same length and adjacency are what make the comparison fair.
 */
export function previousRange(r: Range): Range {
  const span = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - span), to: new Date(r.from.getTime()) };
}

/** Percentage change, or null when the baseline is 0 (a % of nothing is not a fact). */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const iso = (d: Date): string => d.toISOString();
