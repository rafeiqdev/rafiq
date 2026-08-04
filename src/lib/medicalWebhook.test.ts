import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/payments/medical-webhook';

/**
 * api/payments/medical-webhook.ts is the ONLY path that flips a medical
 * booking-deposit payment to 'verified', which is in turn the only thing
 * that unlocks get_offer_center() for the customer. These tests pin its two
 * load-bearing properties: signature verification, and idempotency under a
 * replayed webhook (a double-send must never double-process or "un-verify"
 * an already-verified payment).
 *
 * The Supabase REST calls are stubbed via global fetch — this test does not
 * touch a real database, it proves the handler's own request-sequencing logic.
 */

const SECRET = 'test-webhook-secret';
const PAYMENT_ID = '11111111-1111-1111-1111-111111111111';

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function req(body: string, signature: string): Request {
  return new Request('https://test.invalid/api/payments/medical-webhook', {
    method: 'POST',
    headers: { 'x-rafiq-signature': signature },
    body,
  });
}

let paymentStatus = 'pending';
let patchCalls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  process.env.SUPABASE_URL = 'https://project.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  paymentStatus = 'pending';
  patchCalls = [];

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'PATCH') {
      patchCalls.push({ url: u, body: init.body ? JSON.parse(String(init.body)) : null });
      // Conditional update semantics: only "succeeds" (returns the row) when the
      // URL's status filter actually matches the current in-memory status —
      // mirrors PostgREST's row-matching PATCH the real handler depends on.
      const matchesPending = u.includes('status=eq.pending');
      const matchesNotVerified = u.includes('status=neq.verified');
      const eligible = matchesPending ? paymentStatus === 'pending' : matchesNotVerified ? paymentStatus !== 'verified' : true;
      if (eligible) {
        const body = JSON.parse(String(init.body));
        if (body.status && u.includes('/medical_payments?')) paymentStatus = body.status;
        return new Response(JSON.stringify([{ id: PAYMENT_ID, status: paymentStatus }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (u.includes('/medical_payments?')) {
      return new Response(JSON.stringify([{
        id: PAYMENT_ID, request_id: 'req1', offer_id: 'offer1', user_id: 'u1', amount: 500, status: paymentStatus,
      }]), { status: 200 });
    }
    if (u.includes('/medical_requests?')) {
      return new Response(JSON.stringify([{ id: 'req1' }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signature verification', () => {
  it('rejects a request with a wrong signature before touching the database', async () => {
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'success' });
    const res = await handler(req(body, 'deadbeef'));
    expect(res.status).toBe(401);
    expect(patchCalls).toHaveLength(0);
  });

  it('rejects when the webhook secret is not configured, rather than accepting unsigned requests', async () => {
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'success' });
    const res = await handler(req(body, 'anything'));
    expect(res.status).toBe(503);
  });
});

describe('idempotency', () => {
  it('flips pending -> verified exactly once, and a replay is a no-op that still reports verified', async () => {
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'success' });
    const signature = await sign(body);

    const first = await handler(req(body, signature));
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson).toMatchObject({ ok: true, status: 'verified' });
    expect(paymentStatus).toBe('verified');

    const patchCallsAfterFirst = patchCalls.length;

    // Replay of the exact same webhook (gateway retry, network duplicate, etc.)
    const second = await handler(req(body, signature));
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson).toMatchObject({ ok: true, status: 'verified', replay: true });

    // The handler short-circuits on the already-verified GET before issuing
    // any write — no second PATCH at all. That is the idempotency guarantee:
    // a replay never re-verifies or re-activates anything.
    expect(patchCalls.length).toBe(patchCallsAfterFirst);
  });

  it('does not resurrect a payment the admin already rejected', async () => {
    paymentStatus = 'rejected';
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'success' });
    const signature = await sign(body);
    const res = await handler(req(body, signature));
    expect(res.status).toBe(409);
    expect(paymentStatus).toBe('rejected');
  });

  it('rejects a payload whose amount does not match the stored row', async () => {
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'success', amount: 999999 });
    const signature = await sign(body);
    const res = await handler(req(body, signature));
    expect(res.status).toBe(400);
    expect(paymentStatus).toBe('pending');
  });
});
