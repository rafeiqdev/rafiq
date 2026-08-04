import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Security-property tests for the medical-tourism API layer.
 *
 * Mirrors ownerScopedReads.test.ts's approach: emulate PostgREST/RPC well
 * enough to prove the CLIENT never has a path to leak center identity or
 * forge a payment amount, rather than re-testing Supabase itself. The real
 * enforcement is server-side (RLS + the table split + SECURITY DEFINER RPCs
 * in supabase/migrations/20260806_medical_tourism.sql) — these tests pin
 * that the client code that talks to it stays honest.
 */

let hasSession = true;
const rpcCalls: { fn: string; args: unknown }[] = [];
let rpcResponse: { data: unknown; error: unknown } = { data: [], error: null };

function makeBuilder(table: string, capturedSelects: string[]) {
  const builder: Record<string, unknown> = {
    select: (cols?: string) => {
      if (cols) capturedSelects.push(`${table}:${cols}`);
      return builder;
    },
    eq: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
    insert: () => builder,
    single: () => Promise.resolve({ data: { id: 'row1' }, error: null }),
    upload: () => Promise.resolve({ error: null }),
  };
  return builder;
}

const capturedSelects: string[] = [];

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table, capturedSelects),
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
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://example.test/signed' } }),
      }),
    },
  },
  supabaseEnabled: true,
}));

import { ApiError, medicalOffers, medicalPayments, medicalRequests } from './api';

beforeEach(() => {
  hasSession = true;
  rpcCalls.length = 0;
  capturedSelects.length = 0;
  rpcResponse = { data: [], error: null };
});

describe('medicalRequests.mine() ownership', () => {
  it('rejects instead of resolving to [] when no session is present', async () => {
    hasSession = false;
    await expect(medicalRequests.mine()).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});

describe('medical file upload — client-side validation mirrors the server-side gate', () => {
  it('rejects an unsupported MIME type before any network call', async () => {
    const file = new File(['x'], 'scan.txt', { type: 'text/plain' });
    await expect(medicalRequests.uploadFile('req1', file)).rejects.toMatchObject({ code: 'unsupported_file_type' });
  });

  it('rejects a file over 10MB before any network call', async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'scan.pdf', { type: 'application/pdf' });
    await expect(medicalRequests.uploadFile('req1', big)).rejects.toMatchObject({ code: 'file_too_large' });
  });
});

describe('medicalOffers.listForRequest() — structural non-leakage of center identity', () => {
  it('never requests a center column from medical_offers', async () => {
    await medicalOffers.listForRequest('req1');
    const offersSelect = capturedSelects.find((s) => s.startsWith('medical_offers:'));
    expect(offersSelect).toBeTruthy();
    for (const forbidden of ['center_name', 'doctor_name', 'address', 'phone', 'website', 'map_url', 'appointment_details']) {
      expect(offersSelect).not.toContain(forbidden);
    }
  });
});

describe('medicalOffers.getCenter() — only reachable via the server-gated RPC', () => {
  it('calls get_offer_center with only the offer id, and returns null on an empty result (not-yet-paid case)', async () => {
    rpcResponse = { data: [], error: null };
    const result = await medicalOffers.getCenter('offer1');
    expect(result).toBeNull();
    expect(rpcCalls).toEqual([{ fn: 'get_offer_center', args: { p_offer_id: 'offer1' } }]);
  });

  it('maps a verified-payment result without any client-side gating logic of its own', async () => {
    rpcResponse = {
      data: [{
        center_name: 'Acme Clinic', doctor_name: 'Dr. X', address: 'Istanbul', phone: '+90...',
        website: '', map_url: '', image_paths: [], appointment_details: 'Mon 10:00',
      }],
      error: null,
    };
    const result = await medicalOffers.getCenter('offer1');
    expect(result?.centerName).toBe('Acme Clinic');
  });
});

describe('medicalPayments.createSession() — server computes the amount, client cannot supply one', () => {
  it('calls create_medical_payment_session with only the offer id — no amount/price/percentage in the request', async () => {
    rpcResponse = { data: [{ payment_id: 'pay1', amount: 500, currency: 'USD', gateway_session_id: 'sess1' }], error: null };
    const res = await medicalPayments.createSession('offer1');
    expect(res).toMatchObject({ paymentId: 'pay1', amount: 500, currency: 'USD' });
    // The checkout redirect is keyed on the opaque session token only — the
    // client never learns a "verified" state from this call, only a URL.
    expect(res.payUrl).toContain('session=sess1');
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toEqual({ fn: 'create_medical_payment_session', args: { p_offer_id: 'offer1' } });
    // The whole point: nothing resembling a client-supplied price ever leaves this call.
    expect(JSON.stringify(rpcCalls[0].args)).not.toMatch(/amount|price|percentage/i);
  });

  it('surfaces a server error (e.g. duplicate payment) as an ApiError rather than swallowing it', async () => {
    rpcResponse = { data: null, error: { message: 'payment_already_exists' } };
    await expect(medicalPayments.createSession('offer1')).rejects.toBeInstanceOf(ApiError);
  });
});
