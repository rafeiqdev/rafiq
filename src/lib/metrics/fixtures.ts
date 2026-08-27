/**
 * Shared fixture dataset for cross-surface metric parity tests.
 *
 * The same rows are used to exercise: the badge/needs-action status filter
 * (serviceRequestsUnhandled), the Control Center Operations "open" status
 * filter (operationsOpen), and the Istanbul business-day boundary — so a test
 * failure here means two surfaces genuinely disagree on the same data, not
 * that two independent fixtures drifted apart.
 *
 * Timestamps are chosen deliberately around the Istanbul midnight boundary
 * (2026-08-16T21:00:00.000Z = 2026-08-17T00:00:00 Istanbul) so timezone tests
 * can assert which side of "today" each row falls on.
 */

export interface FixtureRow {
  id: string;
  status: string;
  createdAt: string;
}

/** "Now" for every test that uses this fixture: 2026-08-17 14:30 Istanbul time. */
export const FIXTURE_NOW = new Date('2026-08-17T11:30:00.000Z');

export const FIXTURE_SERVICE_REQUESTS: FixtureRow[] = [
  { id: 'sr-1', status: 'new', createdAt: '2026-08-17T09:00:00.000Z' }, // today (Istanbul), unhandled
  { id: 'sr-2', status: 'pending', createdAt: '2026-08-16T20:59:59.999Z' }, // 1ms before Istanbul midnight -> Aug 16
  { id: 'sr-3', status: 'contacted', createdAt: '2026-08-16T21:00:00.000Z' }, // exactly Istanbul midnight -> Aug 17, open-only (not unhandled)
  { id: 'sr-4', status: 'accepted', createdAt: '2026-08-10T00:00:00.000Z' }, // handled, within 30d
  { id: 'sr-5', status: 'pending', createdAt: '2026-06-01T00:00:00.000Z' }, // unhandled but OUTSIDE the 30d operations window
  { id: 'sr-6', status: 'rejected', createdAt: '2026-08-15T00:00:00.000Z' }, // handled
];

export const FIXTURE_BOOKINGS: FixtureRow[] = [
  { id: 'bk-1', status: 'new', createdAt: '2026-08-16T10:00:00.000Z' },
  { id: 'bk-2', status: 'in_progress', createdAt: '2026-08-14T10:00:00.000Z' },
  { id: 'bk-3', status: 'done', createdAt: '2026-08-01T10:00:00.000Z' },
];

export const FIXTURE_LEADS: FixtureRow[] = [
  { id: 'ld-1', status: 'new', createdAt: '2026-08-17T08:00:00.000Z' },
  { id: 'ld-2', status: 'open', createdAt: '2026-08-13T08:00:00.000Z' },
  { id: 'ld-3', status: 'won', createdAt: '2026-07-20T08:00:00.000Z' },
];

export const FIXTURE_MEDICAL_REQUESTS: FixtureRow[] = [
  { id: 'md-1', status: 'pending_review', createdAt: '2026-08-17T07:00:00.000Z' },
  { id: 'md-2', status: 'pending_review', createdAt: '2026-06-01T07:00:00.000Z' }, // all-time queue still counts this
  { id: 'md-3', status: 'offer_sent', createdAt: '2026-08-16T07:00:00.000Z' },
];

export const FIXTURE_PAYMENTS: FixtureRow[] = [
  { id: 'pay-1', status: 'pending', createdAt: '2026-08-17T06:00:00.000Z' },
  { id: 'pay-2', status: 'verified', createdAt: '2026-08-16T06:00:00.000Z' },
  { id: 'pay-3', status: 'pending', createdAt: '2026-06-01T06:00:00.000Z' }, // all-time queue still counts this
];
