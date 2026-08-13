import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/payments/medical-webhook';

/**
 * api/payments/medical-webhook.ts is the ONLY path that flips a medical
 * booking-deposit payment to 'verified', which is in turn the only thing
 * that unlocks get_offer_center() for the customer. These tests pin its
 * load-bearing properties: Whop's Standard Webhooks signature verification,
 * metadata-based correlation to the internal payment row, and idempotency
 * under a replayed webhook (a double-send must never double-process or
 * "un-verify" an already-verified payment).
 *
 * The Supabase REST calls are stubbed via global fetch — this test does not
 * touch a real database, it proves the handler's own request-sequencing logic.
 */

const SECRET = 'test-webhook-secret';
const PAYMENT_ID = '11111111-1111-1111-1111-111111111111';

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  let binary = '';
  for (const b of new Uint8Array(sig)) binary += String.fromCharCode(b);
  return btoa(binary);
}

function envelope(type: string, data: Record<string, unknown>) {
  return JSON.stringify({ id: 'msg_test1', timestamp: Math.floor(Date.now() / 1000).toString(), type, company_id: 'biz_test', data });
}

async function req(body: string, opts: { id?: string; timestamp?: string; badSig?: boolean } = {}): Promise<Request> {
  const parsed = JSON.parse(body) as { id: string; timestamp: string };
  const id = opts.id ?? parsed.id;
  const timestamp = opts.timestamp ?? parsed.timestamp;
  const sig = opts.badSig ? 'deadbeef' : await hmacBase64(SECRET, `${id}.${timestamp}.${body}`);
  return new Request('https://test.invalid/api/payments/medical-webhook', {
    method: 'POST',
    headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${sig}` },
    body,
  });
}

let paymentStatus = 'pending';
let patchCalls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  process.env.WHOP_MEDICAL_WEBHOOK_SECRET = SECRET;
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
    const body = envelope('payment.succeeded', { total: 500, metadata: { paymentId: PAYMENT_ID } });
    const res = await handler(await req(body, { badSig: true }));
    expect(res.status).toBe(401);
    expect(patchCalls).toHaveLength(0);
  });

  it('rejects a stale timestamp outside the replay window', async () => {
    const body = envelope('payment.succeeded', { total: 500, metadata: { paymentId: PAYMENT_ID } });
    const res = await handler(await req(body, { timestamp: String(Math.floor(Date.now() / 1000) - 3600) }));
    expect(res.status).toBe(401);
  });

  it('rejects when the webhook secret is not configured, rather than accepting unsigned requests', async () => {
    delete process.env.WHOP_MEDICAL_WEBHOOK_SECRET;
    const body = envelope('payment.succeeded', { total: 500, metadata: { paymentId: PAYMENT_ID, chargedAmount: '500' } });
    const res = await handler(await req(body));
    expect(res.status).toBe(503);
  });
});

describe('idempotency', () => {
  it('flips pending -> verified exactly once, and a replay is a no-op that still reports verified', async () => {
    const body = envelope('payment.succeeded', { total: 500, metadata: { paymentId: PAYMENT_ID, chargedAmount: '500' } });

    const first = await handler(await req(body));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, status: 'verified' });
    expect(paymentStatus).toBe('verified');

    const patchCallsAfterFirst = patchCalls.length;

    // Replay of the exact same webhook (gateway retry, network duplicate, etc.)
    const second = await handler(await req(body));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, status: 'verified', replay: true });

    // The handler short-circuits on the already-verified GET before issuing
    // any write — no second PATCH at all. That is the idempotency guarantee:
    // a replay never re-verifies or re-activates anything.
    expect(patchCalls.length).toBe(patchCallsAfterFirst);
  });

  it('does not resurrect a payment the admin already rejected', async () => {
    paymentStatus = 'rejected';
    const body = envelope('payment.succeeded', { total: 500, metadata: { paymentId: PAYMENT_ID, chargedAmount: '500' } });
    const res = await handler(await req(body));
    expect(res.status).toBe(409);
    expect(paymentStatus).toBe('rejected');
  });

  it('rejects a payload whose amount does not match what we told Whop to charge', async () => {
    const body = envelope('payment.succeeded', { total: 999999, metadata: { paymentId: PAYMENT_ID, chargedAmount: '500' } });
    const res = await handler(await req(body));
    expect(res.status).toBe(400);
    expect(paymentStatus).toBe('pending');
  });

  it('a failed-payment event rejects a pending payment without ever verifying it', async () => {
    const body = envelope('payment.failed', { total: 500, metadata: { paymentId: PAYMENT_ID, chargedAmount: '500' } });
    const res = await handler(await req(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: 'rejected' });
    expect(paymentStatus).toBe('rejected');
  });

  it('acknowledges a refund event without mutating status (no refunded state modeled yet)', async () => {
    const body = envelope('refund.created', { payment: { metadata: { paymentId: PAYMENT_ID } } });
    const res = await handler(await req(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe('refund_ack_no_status_change');
    expect(paymentStatus).toBe('pending');
  });

  it('acknowledges an unrelated event type rather than erroring', async () => {
    const body = envelope('membership.activated', {});
    const res = await handler(await req(body));
    expect(res.status).toBe(200);
    expect(patchCalls).toHaveLength(0);
  });
});
