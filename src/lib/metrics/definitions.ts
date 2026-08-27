/**
 * The admin metrics dictionary.
 *
 * Every counter shown anywhere in Admin or the Control Center (header badges,
 * the classic Admin overview tiles, the Medical Tourism queue badge, every
 * Control Center KPI) is either backed by one of these definitions or is
 * DELIBERATELY a different definition — and this file is where that
 * difference gets written down instead of silently drifting apart in two
 * unrelated source files.
 *
 * A definition is metadata only: table(s), which statuses count, whether the
 * count is all-time or bounded to a selected period, and which timezone that
 * period boundary is measured in. The actual query execution lives in
 * ./service.ts (for the single-table all-time counts) or stays in the
 * existing multi-table readers (admin-control-center/api/operations.ts,
 * finance.ts) — those now import their status sets FROM here rather than
 * declaring their own, so "which statuses mean open/pending/waiting" has
 * exactly one source of truth even where the surrounding query logic must
 * stay separate (different tables, different join shape).
 */

export type MetricScope = 'all-time' | 'selected-period';

export interface MetricDefinition {
  readonly key: string;
  readonly label: string;
  /** Table(s) this metric reads. Single-table metrics can be executed by service.ts directly. */
  readonly tables: readonly string[];
  /** Status values that count toward this metric. Empty = no status filter (every row counts). */
  readonly statusFilter: readonly string[];
  readonly scope: MetricScope;
  /**
   * IANA zone the metric's date boundary is measured in. 'n/a' for all-time
   * metrics, which have no date boundary to place in a zone.
   */
  readonly timezone: string;
  /** Where this number is shown, and why it differs from any similarly-named metric. */
  readonly notes: string;
}

const N_A = 'n/a';

export const METRICS = {
  bookingsNew: {
    key: 'bookingsNew',
    label: 'New bookings',
    tables: ['bookings'],
    statusFilter: ['new'],
    scope: 'all-time',
    timezone: N_A,
    notes: 'Admin header badge. All-time, unfiltered by date — a booking made a year ago and still "new" still counts.',
  },
  serviceRequestsUnhandled: {
    key: 'serviceRequestsUnhandled',
    label: 'Unhandled service requests',
    tables: ['service_requests'],
    statusFilter: ['new', 'pending'],
    scope: 'all-time',
    timezone: N_A,
    notes:
      'Admin header badge AND the classic Admin "needs action" block (AdminNewRequests). Both read this exact ' +
      'definition, all-time. NOT the same as operationsOpen: that one is broader (adds open/in_progress/contacted) ' +
      'and bounded to the selected Control Center period.',
  },
  leadsNew: {
    key: 'leadsNew',
    label: 'New leads',
    tables: ['leads'],
    statusFilter: ['new'],
    scope: 'all-time',
    timezone: N_A,
    notes:
      'Admin header badge. All-time, status=new only. NOT the same as the classic-Admin/Overview "total leads" tile ' +
      '(all statuses, all-time, summed per-user) or the Control Center CRM "leads" total (all statuses, selected period).',
  },
  medicalPendingReview: {
    key: 'medicalPendingReview',
    label: 'Medical requests pending review',
    tables: ['medical_requests'],
    statusFilter: ['pending_review'],
    scope: 'all-time',
    timezone: N_A,
    notes:
      'Medical Tourism queue badge (/admin/medical) and the Control Center Overview "needs action" card. All-time. ' +
      'Until this refactor the Control Center had no counterpart to the Medical Tourism queue at all.',
  },
  paymentsPending: {
    key: 'paymentsPending',
    label: 'Pending subscription payments',
    tables: ['payments'],
    statusFilter: ['pending'],
    scope: 'all-time',
    timezone: N_A,
    notes:
      'Classic Admin Payments tab default filter AND Control Center Overview "pending payments" KPI / "needs action" ' +
      'card — both call adminPayments.list({status:"pending"}), same table, exact status match, all-time. NOT the ' +
      'same as financeWaiting below: that one spans 4 payment tables, uses a 3-value status set, and is period-bounded.',
  },
  operationsOpen: {
    key: 'operationsOpen',
    label: 'Open operations (requests + bookings + leads)',
    tables: ['service_requests', 'bookings', 'leads'],
    statusFilter: ['new', 'pending', 'open', 'in_progress', 'contacted'],
    scope: 'selected-period',
    timezone: N_A, // see note — set by the consumer via admin-control-center/period.ts
    notes:
      'Control Center Operations "open" KPI. Deliberately broader status vocabulary than serviceRequestsUnhandled ' +
      '(adds open/in_progress/contacted) AND bounded to the selected period (default 30 days) rather than all-time. ' +
      'A request created 40 days ago and still pending shows in the header badge but NOT here at the default period ' +
      '— that is by design, not a bug, but it means the two numbers should never be presented as interchangeable. ' +
      'The period boundary comes from admin-control-center/period.ts, which uses BUSINESS_TIMEZONE (Europe/Istanbul).',
  },
  financeWaiting: {
    key: 'financeWaiting',
    label: 'Payments waiting across all sources',
    tables: ['payments', 'service_payments', 'medical_payments', 'company_payments'],
    statusFilter: ['pending', 'under_review', 'processing'],
    scope: 'selected-period',
    timezone: N_A, // see note — set by the consumer via admin-control-center/period.ts
    notes:
      'Control Center Finance "waiting" total. Spans 4 tables (not just payments), uses a 3-value status set (not ' +
      'just "pending"), and is bounded to the selected period. NOT the same as paymentsPending above, which is one ' +
      'table, one status, all-time. The period boundary comes from admin-control-center/period.ts (BUSINESS_TIMEZONE).',
  },
  financeSettled: {
    key: 'financeSettled',
    label: 'Payments settled across all sources',
    tables: ['payments', 'service_payments', 'medical_payments', 'company_payments'],
    statusFilter: ['verified', 'confirmed', 'paid'],
    scope: 'selected-period',
    timezone: N_A,
    notes: 'Control Center Finance "settled" total. Same 4-table scope as financeWaiting, opposite status meaning.',
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricKey = keyof typeof METRICS;

/** Metrics service.ts can execute directly: exactly one table. */
export type SingleTableMetricKey = {
  [K in MetricKey]: (typeof METRICS)[K]['tables']['length'] extends 1 ? K : never;
}[MetricKey];

export const SINGLE_TABLE_METRIC_KEYS = (Object.keys(METRICS) as MetricKey[]).filter(
  (k) => METRICS[k].tables.length === 1,
) as SingleTableMetricKey[];
