import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE TEST THAT WOULD ACTUALLY HAVE CAUGHT IT.
 *
 * The bug lived in the QUERY, not in the rendering: customerRequests.mine()
 * carried `.eq('broadcast', true)`, so a direct request — stored correctly,
 * owned correctly, readable under RLS — never reached the page, and the
 * customer who submitted it was told he had no requests.
 *
 * A component test cannot catch that: it mocks the api module, so it asserts
 * only that the UI renders whatever it is handed. MyRequests.test.tsx does that
 * job and is worth having, but it would have passed on the broken build. This
 * file pins the filter chain itself.
 */

interface Row {
  id: string; service_title: string | null; category: string | null; service_type: string | null;
  area: string | null; message: string | null; status: string; broadcast: boolean | null; created_at: string;
}

const calls: { table: string; op: string; args: unknown[] }[] = [];
let rows: Row[] = [];

function makeBuilder(table: string) {
  const builder = {
    select(cols: string) {
      calls.push({ table, op: 'select', args: [cols] });
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.push({ table, op: 'eq', args: [column, value] });
      return builder;
    },
    order(column: string, opts: unknown) {
      calls.push({ table, op: 'order', args: [column, opts] });
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: 'cac6dcb8-d8f2-4b3b-b163-ddeb89f56b0b' } } } }),
    },
  },
  supabaseEnabled: true,
}));

import { customerRequests } from './api';

const row = (over: Partial<Row>): Row => ({
  id: 'r1', service_title: 'إقامة سياحية', category: 'residency', service_type: 'direct',
  area: null, message: null, status: 'new', broadcast: false, created_at: '2026-07-27T10:00:00Z',
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  rows = [];
});

const eqCalls = () => calls.filter((c) => c.op === 'eq');
const selectCols = () => String(calls.find((c) => c.op === 'select')?.args[0] ?? '');

describe('customerRequests.allMine() query', () => {
  it('filters on ownership and NOTHING else', async () => {
    await customerRequests.allMine();

    expect(eqCalls()).toHaveLength(1);
    expect(eqCalls()[0].args[0]).toBe('customer_id');
  });

  it('never filters on broadcast — the regression itself', async () => {
    await customerRequests.allMine();

    const broadcastFilter = eqCalls().find((c) => c.args[0] === 'broadcast');
    expect(broadcastFilter).toBeUndefined();
  });

  it('reads from service_requests, newest first', async () => {
    await customerRequests.allMine();

    expect(calls.every((c) => c.table === 'service_requests')).toBe(true);
    expect(calls.find((c) => c.op === 'order')?.args).toEqual(['created_at', { ascending: false }]);
  });

  it('selects area, service_type and broadcast', async () => {
    await customerRequests.allMine();

    for (const col of ['area', 'service_type', 'broadcast', 'status', 'message']) {
      expect(selectCols()).toContain(col);
    }
  });

  it('returns a direct request as readily as a broadcast one', async () => {
    rows = [
      row({ id: 'b1', service_title: 'استخراج الرقم الضريبي', service_type: 'partner', broadcast: true }),
      row({ id: 'd1', service_title: 'مراقبة فتح حساب بنكي', service_type: 'direct', broadcast: false }),
    ];

    const out = await customerRequests.allMine();

    expect(out).toHaveLength(2);
    expect(out.map((r) => r.id)).toEqual(['b1', 'd1']);
    expect(out[1].broadcast).toBe(false);
  });

  it('maps a null broadcast column to false rather than undefined', async () => {
    rows = [row({ broadcast: null })];

    const out = await customerRequests.allMine();

    expect(out[0].broadcast).toBe(false);
  });

  it('is not reachable without a session', async () => {
    const { supabase } = await import('./supabase');
    const spy = vi
      .spyOn(supabase!.auth, 'getSession')
      .mockResolvedValueOnce({ data: { session: null } } as never);

    await expect(customerRequests.allMine()).rejects.toMatchObject({ code: 'not_authenticated' });
    spy.mockRestore();
  });
});
