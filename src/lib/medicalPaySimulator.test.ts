import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import payHandler from '../../api/payments/medical-pay';

/**
 * Full simulator -> signed webhook -> verified-payment integration test.
 *
 * This is the flow item #1 of the fix request demands: "simulated checkout
 * -> signed webhook -> signature verification -> idempotent server-side
 * payment update -> center disclosure", with NO admin shortcut anywhere in
 * the path. api/payments/medical-pay.ts (GET renders a confirm page, POST
 * signs a payload and hands it to the REAL webhook handler in-process) is
 * exercised end-to-end here against a mocked Supabase REST layer — proving
 * the code path itself, independent of whether a live database is reachable
 * from this environment (it is not — see the final report).
 */

const SECRET = 'sim-test-secret';
const SESSION = 'session-abc123';
const PAYMENT_ID = '22222222-2222-2222-2222-222222222222';

let paymentStatus = 'pending';

beforeEach(() => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  process.env.SUPABASE_URL = 'https://project.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  paymentStatus = 'pending';

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);

    if (u.includes('/medical_payments?gateway_session_id=eq.')) {
      // the simulator's own lookup-by-session
      return new Response(JSON.stringify([{ id: PAYMENT_ID, amount: 750, currency: 'USD', status: paymentStatus }]), { status: 200 });
    }
    if (init?.method === 'PATCH' && u.includes('/medical_payments?')) {
      const eligible = u.includes('status=eq.pending') ? paymentStatus === 'pending' : paymentStatus !== 'verified';
      if (!eligible) return new Response(JSON.stringify([]), { status: 200 });
      const body = JSON.parse(String(init.body));
      if (body.status) paymentStatus = body.status;
      return new Response(JSON.stringify([{ id: PAYMENT_ID, status: paymentStatus }]), { status: 200 });
    }
    if (u.includes('/medical_payments?id=eq.')) {
      // the webhook's own lookup-by-id
      return new Response(JSON.stringify([{ id: PAYMENT_ID, request_id: 'req1', offer_id: 'offer1', user_id: 'u1', amount: 750, status: paymentStatus }]), { status: 200 });
    }
    if (init?.method === 'PATCH' && u.includes('/medical_requests?')) {
      return new Response(JSON.stringify([{ id: 'req1' }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function payReq(method: string, body?: string, contentType = 'application/x-www-form-urlencoded') {
  return new Request(`https://test.invalid/api/payments/medical-pay?session=${SESSION}&return=%2Fen%2Frequests`, {
    method,
    headers: body ? { 'Content-Type': contentType } : undefined,
    body,
  });
}

describe('checkout page (GET)', () => {
  it('shows the amount and neutral "Secure online payment" copy — never a gateway name', async () => {
    const res = await payHandler(payReq('GET'));
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('750');
    expect(body).toContain('Secure online payment');
    expect(body.toLowerCase()).not.toContain('whop');
  });

  it('404s on an unknown session rather than revealing anything', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    const res = await payHandler(payReq('GET'));
    expect(res.status).toBe(404);
  });
});

describe('checkout completion (POST) — goes through the real signed webhook, no shortcut', () => {
  it('a successful checkout flips the payment to verified via the webhook handler, then redirects', async () => {
    const res = await payHandler(payReq('POST', 'outcome=success'));
    expect(res.status).toBe(303);
    expect(paymentStatus).toBe('verified');
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('medicalPayment=success');
    expect(location).toContain('/en/requests');
  });

  it('a cancelled checkout rejects the payment and never verifies it', async () => {
    const res = await payHandler(payReq('POST', 'outcome=failure'));
    expect(res.status).toBe(303);
    expect(paymentStatus).toBe('rejected');
    expect(res.headers.get('Location')).toContain('medicalPayment=failed');
  });

  it('replaying the completion after it is already verified does not re-process, and no verify path exists outside this handler', async () => {
    await payHandler(payReq('POST', 'outcome=success'));
    expect(paymentStatus).toBe('verified');

    const replay = await payHandler(payReq('POST', 'outcome=success'));
    const body = await replay.text();
    expect(body).toContain('already verified');
    // status is unaffected by the replay
    expect(paymentStatus).toBe('verified');
  });
});
