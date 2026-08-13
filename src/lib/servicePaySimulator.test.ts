import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import payHandler from '../../api/payments/service-pay';

/**
 * api/payments/service-pay.ts: sibling of medicalPaySimulator.test.ts — looks
 * the payment up server-side by its opaque session token, converts its TL
 * amount to USD using the fx_rates table (the Whop account only settles USD
 * today), creates a real Whop one-time checkout (metadata.paymentId = OUR
 * internal service_payments.id), and 303-redirects to Whop's hosted
 * purchase_url.
 */

const SESSION = 'session-svc-abc123';
const PAYMENT_ID = '44444444-4444-4444-4444-444444444444';
const USD_TRY_RATE = 47; // TRY per 1 USD

let paymentStatus = 'pending';
let fxRow: { rate: number; validation_status: string; updated_at: string } | null;
let whopCheckoutCalls: { url: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  process.env.WHOP_API_KEY = 'whop-test-key';
  process.env.WHOP_COMPANY_ID = 'biz_test123';
  process.env.SUPABASE_URL = 'https://project.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  paymentStatus = 'pending';
  fxRow = { rate: USD_TRY_RATE, validation_status: 'ok', updated_at: new Date().toISOString() };
  whopCheckoutCalls = [];

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);

    if (u.includes('/service_payments?gateway_session_id=eq.')) {
      return new Response(JSON.stringify([{ id: PAYMENT_ID, amount: 1500, currency: 'TL', status: paymentStatus }]), { status: 200 });
    }
    if (u.includes('/fx_rates?pair=eq.USD')) {
      return new Response(JSON.stringify(fxRow ? [fxRow] : []), { status: 200 });
    }
    if (u.startsWith('https://api.whop.com/api/v1/checkout_configurations')) {
      whopCheckoutCalls.push({ url: u, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ id: 'ch_test456', purchase_url: '/checkout/plan_test456?session=sess_test' }), { status: 201 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function payReq() {
  return new Request(`https://test.invalid/api/payments/service-pay?session=${SESSION}&return=%2Fen%2Frequests`, { method: 'GET' });
}

describe('service-pay redirect (GET)', () => {
  it('converts the TL amount to USD via fx_rates before creating the Whop checkout', async () => {
    const res = await payHandler(payReq());
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://whop.com/checkout/plan_test456?session=sess_test');

    expect(whopCheckoutCalls).toHaveLength(1);
    const body = whopCheckoutCalls[0].body;
    const metadata = body.metadata as Record<string, unknown>;
    const plan = body.plan as Record<string, unknown>;
    expect(metadata.paymentId).toBe(PAYMENT_ID);
    // 1500 TL / 47 TRY-per-USD, rounded to cents.
    expect(plan.initial_price).toBeCloseTo(31.91, 2);
    expect(plan.currency).toBe('usd');
    expect(metadata.chargedAmount).toBe('31.91');
    expect(metadata.chargedCurrency).toBe('usd');
    expect(body.redirect_url).toBe('https://test.invalid/en/requests');
  });

  it('refuses to charge rather than guess when the FX rate is unavailable', async () => {
    fxRow = null;
    const res = await payHandler(payReq());
    expect(res.status).toBe(503);
    expect(whopCheckoutCalls).toHaveLength(0);
  });

  it('refuses to charge on a suspect (rejected) FX rate', async () => {
    fxRow = { rate: USD_TRY_RATE, validation_status: 'suspect', updated_at: new Date().toISOString() };
    const res = await payHandler(payReq());
    expect(res.status).toBe(503);
    expect(whopCheckoutCalls).toHaveLength(0);
  });

  it('refuses to charge on a stale FX rate (>48h old)', async () => {
    fxRow = { rate: USD_TRY_RATE, validation_status: 'ok', updated_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString() };
    const res = await payHandler(payReq());
    expect(res.status).toBe(503);
    expect(whopCheckoutCalls).toHaveLength(0);
  });

  it('404s on an unknown session rather than revealing anything', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    const res = await payHandler(payReq());
    expect(res.status).toBe(404);
  });

  it('shows "already X" instead of creating a second checkout for a non-pending payment', async () => {
    paymentStatus = 'rejected';
    const res = await payHandler(payReq());
    const body = await res.text();
    expect(body).toContain('already rejected');
    expect(whopCheckoutCalls).toHaveLength(0);
  });

  it('is unavailable without Whop config', async () => {
    delete process.env.WHOP_COMPANY_ID;
    const res = await payHandler(payReq());
    expect(res.status).toBe(503);
  });

  it('rejects a non-GET method', async () => {
    const res = await payHandler(new Request(`https://test.invalid/api/payments/service-pay?session=${SESSION}`, { method: 'POST' }));
    expect(res.status).toBe(405);
  });
});
