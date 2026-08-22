import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * serviceRequests.adminList() stored customer_id but never selected it, and
 * adminUsers.detail() never read service_requests. So the link between a
 * customer and what they asked for existed in NEITHER direction: two requests
 * from one signed-in account were two unrelated strangers in the dashboard,
 * and opening that account showed no sign the requests existed.
 *
 * Joined client-side (two queries, no PostgREST embed) so it does not depend on
 * the FK being introspectable, exactly like the users-overview rebuild.
 */

interface Rec { table: string; op: string; args: unknown[] }
const calls: Rec[] = [];
let requestRows: Record<string, unknown>[] = [];
let profileRows: Record<string, unknown>[] = [];
let profilesFail = false;

function makeBuilder(table: string) {
  const result = () =>
    table === 'profiles'
      ? { data: profilesFail ? null : profileRows, error: profilesFail ? { message: 'rls' } : null }
      : { data: requestRows, error: null };
  const builder: Record<string, unknown> = {
    select: (cols: string) => {
      calls.push({ table, op: 'select', args: [cols] });
      return builder;
    },
    eq: (c: string, v: unknown) => {
      calls.push({ table, op: 'eq', args: [c, v] });
      return builder;
    },
    in: (c: string, v: unknown) => {
      calls.push({ table, op: 'in', args: [c, v] });
      return Promise.resolve(result());
    },
    order: (c: string, o: unknown) => {
      calls.push({ table, op: 'order', args: [c, o] });
      return Promise.resolve(result());
    },
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'admin' } } } }) },
  },
  supabaseEnabled: true,
}));

import { serviceRequests, adminUsers } from './api';

const OWNED_A = { id: 'b1', name: 'Jawad Karajeh', phone: '+90', message: null, service_title: 'استخراج الرقم الضريبي', category: 'tax', service_type: 'partner', status: 'new', customer_id: 'cac6dcb8', created_at: '2026-07-27T18:52:16Z' };
const OWNED_B = { id: 'd1', name: 'Gassan Abu sham', phone: '+90', message: null, service_title: 'مراقبة فتح حساب بنكي', category: 'banking', service_type: 'direct', status: 'new', customer_id: 'cac6dcb8', created_at: '2026-07-27T10:50:31Z' };
const ANON = { id: 'a1', name: 'كتب اسمه فقط', phone: '+90', message: null, service_title: 'إقامة', category: 'residency', service_type: 'direct', status: 'new', customer_id: null, created_at: '2026-07-20T10:00:00Z' };

beforeEach(() => {
  calls.length = 0;
  requestRows = [];
  profileRows = [];
  profilesFail = false;
});

describe('adminList attaches the owning account', () => {
  it('selects customer_id', async () => {
    await serviceRequests.adminList();

    expect(String(calls.find((c) => c.op === 'select')?.args[0])).toContain('customer_id');
  });

  it('selects service_id', async () => {
    await serviceRequests.adminList();

    expect(String(calls.find((c) => c.op === 'select')?.args[0])).toContain('service_id');
  });

  it('carries serviceId through to the row', async () => {
    requestRows = [{ ...OWNED_A, service_id: 'res-tax' }];
    profileRows = [{ id: 'cac6dcb8', name: 'محمد', email: 'm@example.com' }];

    const out = await serviceRequests.adminList();

    expect(out[0].serviceId).toBe('res-tax');
  });

  it('leaves serviceId null when the column is absent (pre-migration rows)', async () => {
    requestRows = [{ ...OWNED_A, service_id: null }];
    profileRows = [{ id: 'cac6dcb8', name: 'محمد', email: 'm@example.com' }];

    const out = await serviceRequests.adminList();

    expect(out[0].serviceId).toBeNull();
  });

  it('resolves two requests from one account to the SAME owner', async () => {
    requestRows = [OWNED_A, OWNED_B];
    profileRows = [{ id: 'cac6dcb8', name: 'محمد', email: 'm@example.com' }];

    const out = await serviceRequests.adminList();

    expect(out.map((r) => r.customerId)).toEqual(['cac6dcb8', 'cac6dcb8']);
    expect(out.every((r) => r.ownerName === 'محمد')).toBe(true);
    expect(out.every((r) => r.ownerEmail === 'm@example.com')).toBe(true);
  });

  it('looks profiles up in ONE batched query, not one per row', async () => {
    requestRows = [OWNED_A, OWNED_B];
    profileRows = [{ id: 'cac6dcb8', name: 'محمد', email: 'm@example.com' }];

    await serviceRequests.adminList();

    const profileQueries = calls.filter((c) => c.table === 'profiles' && c.op === 'in');
    expect(profileQueries).toHaveLength(1);
    // de-duplicated: one id, not one per request
    expect(profileQueries[0].args[1]).toEqual(['cac6dcb8']);
  });

  it('leaves an anonymous submission with only its typed name', async () => {
    requestRows = [ANON];

    const out = await serviceRequests.adminList();

    expect(out[0].customerId).toBeNull();
    expect(out[0].ownerName).toBeNull();
    expect(out[0].name).toBe('كتب اسمه فقط');
    // No profile lookup is attempted when nothing is owned.
    expect(calls.some((c) => c.table === 'profiles')).toBe(false);
  });

  it('still returns the queue when the profile lookup fails', async () => {
    requestRows = [OWNED_A];
    profilesFail = true;

    const out = await serviceRequests.adminList();

    // A queue that will not load is worse than a queue without account links.
    expect(out).toHaveLength(1);
    expect(out[0].ownerName).toBeNull();
    expect(out[0].name).toBe('Jawad Karajeh');
  });
});

describe('the per-user detail panel reads their requests', () => {
  it('fetches service_requests scoped to that customer', async () => {
    requestRows = [OWNED_A, OWNED_B];

    const detail = await adminUsers.detail('cac6dcb8');

    expect(detail.requests.map((r) => r.serviceTitle)).toEqual([
      'استخراج الرقم الضريبي',
      'مراقبة فتح حساب بنكي',
    ]);
    expect(
      calls.some((c) => c.table === 'service_requests' && c.op === 'eq' && c.args[0] === 'customer_id' && c.args[1] === 'cac6dcb8'),
    ).toBe(true);
  });

  it('carries each request status so the admin sees where it stands', async () => {
    requestRows = [{ ...OWNED_A, status: 'accepted' }];

    const detail = await adminUsers.detail('cac6dcb8');

    expect(detail.requests[0].status).toBe('accepted');
  });
});
