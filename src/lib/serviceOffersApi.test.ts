import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Security-property tests for the regular-service-request offer/payment API
 * layer (serviceOffers / servicePayments / adminServiceOffers), mirroring
 * medicalApi.test.ts's approach: emulate PostgREST/RPC well enough to prove
 * the CLIENT never has a path to forge a payment amount or write price/status
 * directly, rather than re-testing Supabase itself. The real enforcement is
 * server-side (RLS + SECURITY DEFINER RPCs in
 * supabase/migrations/20260812_service_offers.sql) — these tests pin that the
 * client code that talks to it stays honest.
 */

let hasSession = true;
const rpcCalls: { fn: string; args: unknown }[] = [];
let rpcResponse: { data: unknown; error: unknown } = { data: [], error: null };
const capturedSelects: string[] = [];
const capturedInserts: { table: string; row: unknown }[] = [];

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {
    select: (cols?: string) => {
      if (cols) capturedSelects.push(`${table}:${cols}`);
      return builder;
    },
    eq: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
    insert: (row: unknown) => {
      capturedInserts.push({ table, row });
      return builder;
    },
    single: () => Promise.resolve({ data: { id: 'offer1' }, error: null }),
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    auth: {
      getSession: () => Promise.resolve({ data: { session: hasSession ? { user: { id: 'u1' } } : null } }),
    },
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResponse);
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/service-offer-media/pic.jpg' } }),
      }),
    },
  },
  supabaseEnabled: true,
}));

import { ApiError, adminServiceOffers, serviceOffers, servicePayments } from './api';

beforeEach(() => {
  hasSession = true;
  rpcCalls.length = 0;
  capturedSelects.length = 0;
  capturedInserts.length = 0;
  rpcResponse = { data: [], error: null };
});

describe('servicePayments.createSession() — server computes the amount, client cannot supply one', () => {
  it('calls create_service_payment_session with only the offer id — no amount/price in the request', async () => {
    rpcResponse = { data: [{ payment_id: 'pay1', amount: 1500, currency: 'TL', gateway_session_id: 'sess1' }], error: null };
    const res = await servicePayments.createSession('offer1');
    expect(res).toMatchObject({ paymentId: 'pay1', amount: 1500, currency: 'TL' });
    expect(res.payUrl).toContain('session=sess1');
    expect(rpcCalls).toEqual([{ fn: 'create_service_payment_session', args: { p_offer_id: 'offer1' } }]);
    expect(JSON.stringify(rpcCalls[0].args)).not.toMatch(/amount|price/i);
  });

  it('surfaces a server error (e.g. duplicate payment) as an ApiError rather than swallowing it', async () => {
    rpcResponse = { data: null, error: { message: 'payment_already_exists' } };
    await expect(servicePayments.createSession('offer1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('servicePayments.resumeUrl() — only ever resumes an existing pending session', () => {
  it('returns null for a verified payment (no resume possible, nothing to pay)', () => {
    const url = servicePayments.resumeUrl(
      { id: 'p1', requestId: 'r1', offerId: 'o1', amount: 1500, currency: 'TL', status: 'verified', createdAt: '', verifiedAt: null, gatewaySessionId: 'sess1' },
      '/requests',
    );
    expect(url).toBeNull();
  });

  it('rebuilds the checkout URL from the stored session id for a pending payment', () => {
    const url = servicePayments.resumeUrl(
      { id: 'p1', requestId: 'r1', offerId: 'o1', amount: 1500, currency: 'TL', status: 'pending', createdAt: '', verifiedAt: null, gatewaySessionId: 'sess1' },
      '/requests',
    );
    expect(url).toContain('session=sess1');
    expect(url).toContain('return=%2Frequests');
  });
});

describe('serviceOffers.reject() — goes through the RPC, never a direct status write', () => {
  it('calls customer_reject_service_offer with only the offer id', async () => {
    rpcResponse = { data: null, error: null };
    await serviceOffers.reject('offer1');
    expect(rpcCalls).toEqual([{ fn: 'customer_reject_service_offer', args: { p_offer_id: 'offer1' } }]);
  });

  it('surfaces a server rejection (e.g. payment already in progress) as an ApiError', async () => {
    rpcResponse = { data: null, error: { message: 'payment_in_progress' } };
    await expect(serviceOffers.reject('offer1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('adminServiceOffers.resolvePayment() — the only staff write path, and only for rejected', () => {
  it('calls admin_set_service_payment_status, never a direct table write', async () => {
    rpcResponse = { data: null, error: null };
    await adminServiceOffers.resolvePayment('pay1');
    expect(rpcCalls).toEqual([{ fn: 'admin_set_service_payment_status', args: { p_id: 'pay1', p_status: 'rejected' } }]);
  });
});

describe('adminServiceOffers.createOffer() — requires an authenticated admin session', () => {
  it('rejects instead of inserting when no session is present', async () => {
    hasSession = false;
    await expect(
      adminServiceOffers.createOffer('req1', { price: 1500, currency: 'TL', details: '', imagePaths: [] }),
    ).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(capturedInserts).toHaveLength(0);
  });

  it('inserts the exact admin-supplied price — the client trusts itself here, RLS gates who may call it at all', async () => {
    await adminServiceOffers.createOffer('req1', { price: 2500, currency: 'TL', details: 'note', imagePaths: ['a.jpg'] });
    expect(capturedInserts).toHaveLength(1);
    expect(capturedInserts[0].table).toBe('service_offers');
    expect(capturedInserts[0].row).toMatchObject({ request_id: 'req1', price: 2500, status: 'sent', created_by: 'u1' });
  });
});
