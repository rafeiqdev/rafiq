import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The metrics service is the single implementation behind every all-time
 * badge count (bookings/leads/service-requests/medical). Pinning the exact
 * query shape here means api.ts's newCount() wrappers can delegate without
 * re-testing the query themselves.
 */

interface QueryResult {
  count?: number | null;
  error?: { message: string } | null;
}

const calls: { table: string; op: string; args: unknown[] }[] = [];
let result: QueryResult = { count: 0, error: null };

function makeBuilder(table: string) {
  const builder = {
    select(..._args: unknown[]) {
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.push({ table, op: 'eq', args: [column, value] });
      return Promise.resolve(result);
    },
    in(column: string, values: unknown[]) {
      calls.push({ table, op: 'in', args: [column, values] });
      return Promise.resolve(result);
    },
  };
  return builder;
}

vi.mock('../supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
  supabaseEnabled: true,
}));

import { METRICS } from './definitions';
import { readAllTimeMetrics, readMetric } from './service';

beforeEach(() => {
  calls.length = 0;
  result = { count: 0, error: null };
});

describe('readMetric — single status', () => {
  it('bookingsNew queries bookings.status = new', async () => {
    result = { count: 5, error: null };

    const reading = await readMetric('bookingsNew');

    expect(reading.value).toBe(5);
    expect(reading.definition).toBe(METRICS.bookingsNew);
    expect(calls).toEqual([{ table: 'bookings', op: 'eq', args: ['status', 'new'] }]);
  });

  it('leadsNew queries leads.status = new', async () => {
    result = { count: 3, error: null };

    const reading = await readMetric('leadsNew');

    expect(reading.value).toBe(3);
    expect(calls).toEqual([{ table: 'leads', op: 'eq', args: ['status', 'new'] }]);
  });

  it('medicalPendingReview queries medical_requests.status = pending_review', async () => {
    result = { count: 2, error: null };

    const reading = await readMetric('medicalPendingReview');

    expect(reading.value).toBe(2);
    expect(calls).toEqual([{ table: 'medical_requests', op: 'eq', args: ['status', 'pending_review'] }]);
  });

  it('paymentsPending queries payments.status = pending', async () => {
    result = { count: 1, error: null };

    const reading = await readMetric('paymentsPending');

    expect(reading.value).toBe(1);
    expect(calls).toEqual([{ table: 'payments', op: 'eq', args: ['status', 'pending'] }]);
  });
});

describe('readMetric — multi-status', () => {
  it('serviceRequestsUnhandled queries service_requests.status IN (new, pending)', async () => {
    result = { count: 7, error: null };

    const reading = await readMetric('serviceRequestsUnhandled');

    expect(reading.value).toBe(7);
    expect(calls).toEqual([{ table: 'service_requests', op: 'in', args: ['status', ['new', 'pending']] }]);
  });
});

describe('readMetric — honesty contract', () => {
  it('reports null, never 0, when the query errors', async () => {
    result = { count: null, error: { message: 'permission denied' } };

    const reading = await readMetric('leadsNew');

    expect(reading.value).toBeNull();
  });

  it('reports 0 when the driver returns a null count with no error', async () => {
    result = { count: null, error: null };

    const reading = await readMetric('leadsNew');

    expect(reading.value).toBe(0);
  });

  it('stamps computedAt as a valid ISO timestamp taken at read time', async () => {
    const before = Date.now();
    const reading = await readMetric('leadsNew');
    const after = Date.now();

    const stamped = new Date(reading.computedAt).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });
});

describe('readAllTimeMetrics', () => {
  it('reads exactly the five all-time single-table metrics, nothing period-scoped', async () => {
    const readings = await readAllTimeMetrics();

    const keys = readings.map((r) => r.key).sort();
    expect(keys).toEqual(
      ['bookingsNew', 'leadsNew', 'medicalPendingReview', 'paymentsPending', 'serviceRequestsUnhandled'].sort(),
    );
    expect(readings.every((r) => r.definition.scope === 'all-time')).toBe(true);
  });
});
