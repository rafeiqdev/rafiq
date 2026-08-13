import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/payments/service-webhook';

/**
 * api/payments/service-webhook.ts is the ONLY path that flips a
 * service_payments row to 'verified'. Sibling of medicalWebhook.test.ts —
 * same properties pinned: signature verification, and idempotency under a
 * replayed webhook (a double-send must never double-process or "un-verify"
 * an already-verified payment).
 *
 * The Supabase REST calls are stubbed via global fetch — this test does not
 * touch a real database, it proves the handler's own request-sequencing logic.
 */

const SECRET = 'test-webhook-secret';
const PAYMENT_ID = '33333333-3333-3333-3333-333333333333';

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function req(body: string, signature: string): Request {
  return new Request('https://test.invalid/api/payments/service-webhook', {
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
      const matchesPending = u.includes('status=eq.pending');
      const matchesNotVerified = u.includes('status=neq.verified');
      const eligible = matchesPending ? paymentStatus === 'pending' : matchesNotVerified ? paymentStatus !== 'verified' : true;
      if (eligible) {
        const body = JSON.parse(String(init.body));
        if (body.status && u.includes('/service_payments?')) paymentStatus = body.status;
        return new Response(JSON.stringify([{ id: PAYMENT_ID, status: paymentStatus }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (u.includes('/service_payments?')) {
      return new Response(JSON.stringify([{
        id: PAYMENT_ID, request_id: 'req1', offer_id: 'offer1', user_id: 'u1', amount: 1500, status: paymentStatus,
      }]), { status: 200 });
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

  it('rejects an unrecognised outcome rather than silently defaulting to failure', async () => {
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'refunded' });
    const signature = await sign(body);
    const res = await handler(req(body, signature));
    expect(res.status).toBe(400);
    expect(paymentStatus).toBe('pending');
  });
});

describe('idempotency', () => {
  it('flips pending -> verified exactly once, and a replay is a no-op that still reports verified', async () => {
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'success' });
    const signature = await sign(body);

    const first = await handler(req(body, signature));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, status: 'verified' });
    expect(paymentStatus).toBe('verified');

    const patchCallsAfterFirst = patchCalls.length;

    const second = await handler(req(body, signature));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, status: 'verified', replay: true });
    expect(patchCalls.length).toBe(patchCallsAfterFirst);
  });

  it('does not resurrect a payment that was already rejected', async () => {
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

  it('a failure outcome rejects a pending payment without ever verifying it', async () => {
    const body = JSON.stringify({ paymentId: PAYMENT_ID, outcome: 'failure' });
    const signature = await sign(body);
    const res = await handler(req(body, signature));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: 'rejected' });
    expect(paymentStatus).toBe('rejected');
  });
});
