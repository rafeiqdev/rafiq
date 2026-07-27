import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * B2 — the admin badge counts.
 *
 * These feed the only "you have work waiting" signal in the product: there is
 * no email, push or webhook behind any of the three inbound queues. A count
 * that throws would take the whole header down with it, and a count that is
 * wrong means a request sits unseen, so both are pinned here.
 */

interface QueryResult {
  count?: number | null;
  error?: { message: string } | null;
}

/** Records the query that was built, then resolves with the canned result. */
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

vi.mock('./supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
  supabaseEnabled: true,
}));

import { leads, serviceRequests } from './api';

beforeEach(() => {
  calls.length = 0;
  result = { count: 0, error: null };
});

describe('serviceRequests.newCount', () => {
  it('counts both unhandled statuses, not just "new"', async () => {
    // Rows created before the 20260719 status workflow use 'new'; rows created
    // after use 'pending'. Counting only one silently hides half the queue.
    result = { count: 7, error: null };

    await expect(serviceRequests.newCount()).resolves.toBe(7);
    expect(calls).toEqual([{ table: 'service_requests', op: 'in', args: ['status', ['new', 'pending']] }]);
  });

  it('returns 0 rather than throwing when the query fails', async () => {
    // RLS denial, network loss, missing table — the header must still render.
    result = { count: null, error: { message: 'permission denied' } };

    await expect(serviceRequests.newCount()).resolves.toBe(0);
  });

  it('returns 0 when the driver reports a null count', async () => {
    result = { count: null, error: null };

    await expect(serviceRequests.newCount()).resolves.toBe(0);
  });
});

describe('leads.newCount', () => {
  it('counts only leads nobody has picked up', async () => {
    result = { count: 3, error: null };

    await expect(leads.newCount()).resolves.toBe(3);
    expect(calls).toEqual([{ table: 'leads', op: 'eq', args: ['status', 'new'] }]);
  });

  it('returns 0 rather than throwing when the query fails', async () => {
    result = { count: null, error: { message: 'permission denied' } };

    await expect(leads.newCount()).resolves.toBe(0);
  });
});
