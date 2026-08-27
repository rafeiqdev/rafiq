/**
 * Time-period selection shared by every Control Center section.
 *
 * Pure date math, no I/O, so the boundaries are unit-testable (see
 * period.test.ts). `from` is inclusive, `to` is exclusive — half-open ranges
 * compose cleanly and avoid the classic "last day counted twice" bug when two
 * periods sit next to each other.
 *
 * Day/month boundaries are anchored to BUSINESS_TIMEZONE (Europe/Istanbul),
 * NOT the browser's local timezone. Postgres stores every `created_at` in
 * UTC; an admin's browser could be set to any zone. Before this fix, "today"
 * used `Date#setHours(0,0,0,0)`, which resolves in whatever timezone the
 * admin's OS happens to be in — two admins in different timezones would see
 * two different sets of rows for the same "today". Pinning to one fixed zone
 * makes the boundary a fact about the business, not about who is looking.
 */
import { BUSINESS_TIMEZONE, businessAddDays, businessDateParts, businessStartOfDayForYMD, businessStartOfDayUTC } from '../lib/metrics/timezone';

export type PeriodId = 'today' | 'yesterday' | '7d' | '30d' | 'thisMonth' | 'lastMonth';

export const PERIODS: PeriodId[] = ['today', 'yesterday', '7d', '30d', 'thisMonth', 'lastMonth'];
export const DEFAULT_PERIOD: PeriodId = '30d';

export interface Range {
  from: Date;
  to: Date;
}

const startOfDay = (d: Date): Date => businessStartOfDayUTC(d, BUSINESS_TIMEZONE);
const addDays = (d: Date, n: number): Date => businessAddDays(d, n, BUSINESS_TIMEZONE);

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
    case 'thisMonth': {
      const { year, month } = businessDateParts(now, BUSINESS_TIMEZONE);
      return { from: businessStartOfDayForYMD(year, month, 1, BUSINESS_TIMEZONE), to: addDays(today, 1) };
    }
    case 'lastMonth': {
      const { year, month } = businessDateParts(now, BUSINESS_TIMEZONE);
      // Calendar arithmetic on the Y-M triple; Date.UTC rolls the year on underflow.
      const prevMonthAnchor = new Date(Date.UTC(year, month - 1 - 1, 1));
      return {
        from: businessStartOfDayForYMD(prevMonthAnchor.getUTCFullYear(), prevMonthAnchor.getUTCMonth() + 1, 1, BUSINESS_TIMEZONE),
        to: businessStartOfDayForYMD(year, month, 1, BUSINESS_TIMEZONE),
      };
    }
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
