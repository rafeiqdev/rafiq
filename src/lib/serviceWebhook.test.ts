import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/payments/service-webhook';

/**
 * api/payments/service-webhook.ts is the ONLY path that flips a
 * service_payments row to 'verified'. Sibling of medicalWebhook.test.ts —
 * same properties pinned: Whop's Standard Webhooks signature verification,
 * checkout_configuration_id-based correlation to the internal payment row
 * (NOT metadata — Whop's live API silently drops checkout_configuration
 * metadata), and idempotency under a replayed webhook.
 *
 * The Supabase REST calls are stubbed via global fetch — this test does not
 * touch a real database, it proves the handler's own request-sequencing logic.
 */

const SECRET = 'test-webhook-secret';
const PAYMENT_ID = '33333333-3333-3333-3333-333333333333';
const CHECKOUT_ID = 'ch_test_svc456';

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  let binary = '';
  for (const b of new Uint8Array(sig)) binary += String.fromCharCode(b);
  return btoa(binary);
}

function envelope(type: string, data: Record<string, unknown>) {
  return JSON.stringify({ id: 'msg_test2', timestamp: Math.floor(Date.now() / 1000).toString(), type, company_id: 'biz_test', data });
}

async function req(body: string, opts: { id?: string; timestamp?: string; badSig?: boolean } = {}): Promise<Request> {
  const parsed = JSON.parse(body) as { id: string; timestamp: string };
  const id = opts.id ?? parsed.id;
  const timestamp = opts.timestamp ?? parsed.timestamp;
  const sig = opts.badSig ? 'deadbeef' : await hmacBase64(SECRET, `${id}.${timestamp}.${body}`);
  return new Request('https://test.invalid/api/payments/service-webhook', {
    method: 'POST',
    headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${sig}` },
    body,
  });
}

let paymentStatus = 'pending';
let patchCalls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  process.env.WHOP_SERVICE_WEBHOOK_SECRET = SECRET;
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
    if (u.includes('/service_payments?whop_checkout_id=eq.')) {
      if (!u.includes(encodeURIComponent(CHECKOUT_ID))) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([{
        id: PAYMENT_ID, request_id: 'req1', offer_id: 'offer1', user_id: 'u1', amount: 1500, charged_amount: 31.91, status: paymentStatus,
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
    const body = envelope('payment.succeeded', { total: 31.91, checkout_configuration_id: CHECKOUT_ID });
    const res = await handler(await req(body, { badSig: true }));
    expect(res.status).toBe(401);
    expect(patchCalls).toHaveLength(0);
  });

  it('rejects when the webhook secret is not configured, rather than accepting unsigned requests', async () => {
    delete process.env.WHOP_SERVICE_WEBHOOK_SECRET;
    const body = envelope('payment.succeeded', { total: 31.91, checkout_configuration_id: CHECKOUT_ID });
    const res = await handler(await req(body));
    expect(res.status).toBe(503);
  });

  it('rejects a payload missing checkout_configuration_id', async () => {
    const body = envelope('payment.succeeded', { total: 31.91 });
    const res = await handler(await req(body));
    expect(res.status).toBe(400);
    expect(paymentStatus).toBe('pending');
  });
});

describe('correlation and idempotency', () => {
  it('404s when no row matches the checkout_configuration_id', async () => {
    const body = envelope('payment.succeeded', { total: 31.91, checkout_configuration_id: 'ch_unknown' });
    const res = await handler(await req(body));
    expect(res.status).toBe(404);
  });

  it('flips pending -> verified exactly once, and a replay is a no-op that still reports verified', async () => {
    const body = envelope('payment.succeeded', { total: 31.91, checkout_configuration_id: CHECKOUT_ID });

    const first = await handler(await req(body));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, status: 'verified' });
    expect(paymentStatus).toBe('verified');

    const patchCallsAfterFirst = patchCalls.length;

    const second = await handler(await req(body));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, status: 'verified', replay: true });
    expect(patchCalls.length).toBe(patchCallsAfterFirst);
  });

  it('does not resurrect a payment that was already rejected', async () => {
    paymentStatus = 'rejected';
    const body = envelope('payment.succeeded', { total: 31.91, checkout_configuration_id: CHECKOUT_ID });
    const res = await handler(await req(body));
    expect(res.status).toBe(409);
    expect(paymentStatus).toBe('rejected');
  });

  it('rejects a payload whose amount does not match what we told Whop to charge', async () => {
    const body = envelope('payment.succeeded', { total: 999999, checkout_configuration_id: CHECKOUT_ID });
    const res = await handler(await req(body));
    expect(res.status).toBe(400);
    expect(paymentStatus).toBe('pending');
  });

  it('a failed-payment event rejects a pending payment without ever verifying it', async () => {
    const body = envelope('payment.failed', { total: 31.91, checkout_configuration_id: CHECKOUT_ID });
    const res = await handler(await req(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: 'rejected' });
    expect(paymentStatus).toBe('rejected');
  });

  it('acknowledges a refund event without mutating status (no refunded state modeled yet)', async () => {
    const body = envelope('refund.created', { payment: { checkout_configuration_id: CHECKOUT_ID } });
    const res = await handler(await req(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe('refund_ack_no_status_change');
    expect(paymentStatus).toBe('pending');
  });
});
