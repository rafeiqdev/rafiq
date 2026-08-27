import { describe, expect, it } from 'vitest';
import { METRICS } from './definitions';
import {
  FIXTURE_BOOKINGS,
  FIXTURE_LEADS,
  FIXTURE_MEDICAL_REQUESTS,
  FIXTURE_NOW,
  FIXTURE_SERVICE_REQUESTS,
  type FixtureRow,
} from './fixtures';
import { rangeFor } from '../../admin-control-center/period';
import { summarizeOperations, type OpsRow } from '../../admin-control-center/api/operations';

/**
 * Every surface that shows a "how many are unhandled/open" number is run
 * against the SAME fixture dataset here, so a mismatch means two surfaces
 * genuinely disagree on identical data — not that their test fixtures drifted
 * apart. This also verifies the Istanbul business-day boundary is applied
 * consistently to the period-scoped surfaces.
 */

const countByStatus = (rows: FixtureRow[], statuses: readonly string[]) =>
  rows.filter((r) => statuses.includes(r.status)).length;

const inRange = (iso: string, from: Date, to: Date) => {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
};

describe('serviceRequestsUnhandled — badge + AdminNewRequests', () => {
  it('counts new+pending, all-time, ignoring the 30d operations window', () => {
    const count = countByStatus(FIXTURE_SERVICE_REQUESTS, METRICS.serviceRequestsUnhandled.statusFilter);
    // sr-1 (new, today), sr-2 (pending, yesterday), sr-5 (pending, outside 30d) — all count.
    expect(count).toBe(3);
  });
});

describe('operationsOpen — Control Center Operations KPI', () => {
  it('is broader in status but narrower in time than serviceRequestsUnhandled, on the SAME rows', () => {
    const range = rangeFor('30d', FIXTURE_NOW);

    const rows: OpsRow[] = [
      ...FIXTURE_SERVICE_REQUESTS.map((r): OpsRow => ({
        kind: 'request', id: r.id, title: '—', who: null, status: r.status, createdAt: r.createdAt, href: '',
      })),
      ...FIXTURE_BOOKINGS.map((r): OpsRow => ({
        kind: 'booking', id: r.id, title: '—', who: null, status: r.status, createdAt: r.createdAt, href: '',
      })),
      ...FIXTURE_LEADS.map((r): OpsRow => ({
        kind: 'lead', id: r.id, title: '—', who: null, status: r.status, createdAt: r.createdAt, href: '',
      })),
    ].filter((r) => inRange(r.createdAt, range.from, range.to));

    const summary = summarizeOperations(rows, FIXTURE_NOW);

    // sr-3 ('contacted') is open under operationsOpen's broader status set but
    // would NOT count under serviceRequestsUnhandled (new/pending only).
    const contactedIncluded = rows.some((r) => r.id === 'sr-3');
    expect(contactedIncluded).toBe(true);
    expect(summary.byStatus.find(([status]) => status === 'contacted')).toBeTruthy();

    // sr-5 is status=pending (would count toward serviceRequestsUnhandled) but
    // sits outside the 30-day window, so operationsOpen must NOT include it.
    const staleRowIncluded = rows.some((r) => r.id === 'sr-5');
    expect(staleRowIncluded).toBe(false);

    // The two metrics therefore disagree on this fixture by design.
    const unhandledCount = countByStatus(FIXTURE_SERVICE_REQUESTS, METRICS.serviceRequestsUnhandled.statusFilter);
    expect(summary.open).not.toBe(unhandledCount);
  });
});

describe('medicalPendingReview — Medical Tourism queue badge', () => {
  it('is all-time, unlike every Control Center period-scoped KPI', () => {
    const count = countByStatus(FIXTURE_MEDICAL_REQUESTS, METRICS.medicalPendingReview.statusFilter);
    // md-1 (today) AND md-2 (over two months old) both count — no date filter exists for this metric.
    expect(count).toBe(2);

    const range = rangeFor('30d', FIXTURE_NOW);
    const withinDefaultPeriod = FIXTURE_MEDICAL_REQUESTS.filter(
      (r) => countByStatus([r], METRICS.medicalPendingReview.statusFilter) === 1 && inRange(r.createdAt, range.from, range.to),
    ).length;
    // If this queue were ever period-bounded like Operations, it would show 1 fewer — proof the two scopes differ.
    expect(withinDefaultPeriod).toBe(1);
    expect(withinDefaultPeriod).toBeLessThan(count);
  });
});

describe('timezone boundary — same fixture, bucketed by Istanbul midnight', () => {
  it('a row 1ms before Istanbul midnight falls in "yesterday", not "today"', () => {
    const today = rangeFor('today', FIXTURE_NOW);
    const yesterday = rangeFor('yesterday', FIXTURE_NOW);

    const row = FIXTURE_SERVICE_REQUESTS.find((r) => r.id === 'sr-2')!;
    expect(inRange(row.createdAt, today.from, today.to)).toBe(false);
    expect(inRange(row.createdAt, yesterday.from, yesterday.to)).toBe(true);
  });

  it('a row exactly at Istanbul midnight falls in "today"', () => {
    const today = rangeFor('today', FIXTURE_NOW);
    const row = FIXTURE_SERVICE_REQUESTS.find((r) => r.id === 'sr-3')!;
    expect(inRange(row.createdAt, today.from, today.to)).toBe(true);
  });
});
