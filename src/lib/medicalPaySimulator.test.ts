import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import payHandler from '../../api/payments/medical-pay';

/**
 * api/payments/medical-pay.ts: looks the payment up server-side by its opaque
 * session token, creates a real Whop one-time checkout, stores the checkout's
 * own id (whop_checkout_id) and the USD amount charged (charged_amount) on
 * OUR internal medical_payments row — NOT metadata, which Whop's live API
 * silently drops — and 303-redirects to Whop's hosted purchase_url. The
 * browser never sees a "verified" status from this page — only
 * api/payments/medical-webhook.ts (Whop's signed webhook) ever flips
 * medical_payments.status.
 */

const SESSION = 'session-abc123';
const PAYMENT_ID = '22222222-2222-2222-2222-222222222222';

let paymentStatus = 'pending';
let whopCheckoutCalls: { url: string; body: Record<string, unknown> }[] = [];
let patchCalls: { url: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  process.env.WHOP_API_KEY = 'whop-test-key';
  process.env.WHOP_COMPANY_ID = 'biz_test123';
  process.env.SUPABASE_URL = 'https://project.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  paymentStatus = 'pending';
  whopCheckoutCalls = [];
  patchCalls = [];

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);

    if (u.includes('/medical_payments?gateway_session_id=eq.')) {
      return new Response(JSON.stringify([{ id: PAYMENT_ID, amount: 750, currency: 'USD', status: paymentStatus }]), { status: 200 });
    }
    if (u.startsWith('https://api.whop.com/api/v1/checkout_configurations')) {
      whopCheckoutCalls.push({ url: u, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ id: 'ch_test123', purchase_url: '/checkout/plan_test123?session=sess_test' }), { status: 201 });
    }
    if (init?.method === 'PATCH' && u.includes('/medical_payments?id=eq.')) {
      patchCalls.push({ url: u, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify([{ id: PAYMENT_ID }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function payReq() {
  return new Request(`https://test.invalid/api/payments/medical-pay?session=${SESSION}&return=%2Fen%2Frequests`, { method: 'GET' });
}

describe('medical-pay redirect (GET)', () => {
  it('creates a Whop checkout and stores whop_checkout_id/charged_amount on the row before redirecting', async () => {
    const res = await payHandler(payReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://whop.com/checkout/plan_test123?session=sess_test');

    expect(whopCheckoutCalls).toHaveLength(1);
    const body = whopCheckoutCalls[0].body;
    expect((body.metadata as Record<string, unknown>).paymentId).toBe(PAYMENT_ID);
    expect((body.plan as Record<string, unknown>).initial_price).toBe(750);
    expect((body.plan as Record<string, unknown>).currency).toBe('usd');
    expect((body.plan as Record<string, unknown>).company_id).toBe('biz_test123');
    expect((body.plan as Record<string, unknown>).title).toHaveLength(21); // 'Rafiq medical deposit' <= Whop's 30-char cap
    expect(body.redirect_url).toBe('https://test.invalid/en/requests');

    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].url).toContain(`/medical_payments?id=eq.${PAYMENT_ID}`);
    expect(patchCalls[0].body).toEqual({ whop_checkout_id: 'ch_test123', charged_amount: 750 });
  });

  it('404s on an unknown session rather than revealing anything', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    const res = await payHandler(payReq());
    expect(res.status).toBe(404);
  });

  it('shows "already X" instead of creating a second checkout for a non-pending payment', async () => {
    paymentStatus = 'verified';
    const res = await payHandler(payReq());
    const body = await res.text();
    expect(body).toContain('already verified');
    expect(whopCheckoutCalls).toHaveLength(0);
  });

  it('is unavailable without Whop config, and never falls back to a shortcut', async () => {
    delete process.env.WHOP_API_KEY;
    const res = await payHandler(payReq());
    expect(res.status).toBe(503);
  });

  it('surfaces a Whop API failure as an error page, not a silent pass-through', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/medical_payments?gateway_session_id=eq.')) {
        return new Response(JSON.stringify([{ id: PAYMENT_ID, amount: 750, currency: 'USD', status: 'pending' }]), { status: 200 });
      }
      if (u.startsWith('https://api.whop.com/api/v1/checkout_configurations')) {
        return new Response('nope', { status: 500 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const res = await payHandler(payReq());
    expect(res.status).toBe(502);
  });

  it('never redirects if storing the whop_checkout_id fails — a lost correlation key must not proceed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/medical_payments?gateway_session_id=eq.')) {
        return new Response(JSON.stringify([{ id: PAYMENT_ID, amount: 750, currency: 'USD', status: 'pending' }]), { status: 200 });
      }
      if (u.startsWith('https://api.whop.com/api/v1/checkout_configurations')) {
        return new Response(JSON.stringify({ id: 'ch_test123', purchase_url: '/checkout/plan_test123?session=sess_test' }), { status: 201 });
      }
      if (init?.method === 'PATCH') {
        return new Response('db down', { status: 500 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const res = await payHandler(payReq());
    expect(res.status).toBe(502);
  });

  it('rejects a non-GET method', async () => {
    const res = await payHandler(new Request(`https://test.invalid/api/payments/medical-pay?session=${SESSION}`, { method: 'POST' }));
    expect(res.status).toBe(405);
  });
});
