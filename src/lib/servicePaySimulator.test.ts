import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import payHandler from '../../api/payments/service-pay';

/**
 * Full simulator -> signed webhook -> verified-payment integration test.
 * Sibling of medicalPaySimulator.test.ts. Exercises api/payments/service-pay.ts
 * (GET renders a confirm page, POST signs a payload and hands it to the REAL
 * webhook handler in-process) end-to-end against a mocked Supabase REST
 * layer — proving there is no admin/client shortcut anywhere in the path.
 */

const SECRET = 'sim-test-secret';
const SESSION = 'session-svc-abc123';
const PAYMENT_ID = '44444444-4444-4444-4444-444444444444';

let paymentStatus = 'pending';

beforeEach(() => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  process.env.SUPABASE_URL = 'https://project.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  paymentStatus = 'pending';

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);

    if (u.includes('/service_payments?gateway_session_id=eq.')) {
      return new Response(JSON.stringify([{ id: PAYMENT_ID, amount: 1500, currency: 'TL', status: paymentStatus }]), { status: 200 });
    }
    if (init?.method === 'PATCH' && u.includes('/service_payments?')) {
      const eligible = u.includes('status=eq.pending') ? paymentStatus === 'pending' : paymentStatus !== 'verified';
      if (!eligible) return new Response(JSON.stringify([]), { status: 200 });
      const body = JSON.parse(String(init.body));
      if (body.status) paymentStatus = body.status;
      return new Response(JSON.stringify([{ id: PAYMENT_ID, status: paymentStatus }]), { status: 200 });
    }
    if (u.includes('/service_payments?id=eq.')) {
      return new Response(JSON.stringify([{ id: PAYMENT_ID, request_id: 'req1', offer_id: 'offer1', user_id: 'u1', amount: 1500, status: paymentStatus }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function payReq(method: string, body?: string, contentType = 'application/x-www-form-urlencoded') {
  return new Request(`https://test.invalid/api/payments/service-pay?session=${SESSION}&return=%2Fen%2Frequests`, {
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
    expect(body).toContain('1,500');
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
    expect(location).toContain('servicePayment=success');
    expect(location).toContain('/en/requests');
  });

  it('a cancelled checkout rejects the payment and never verifies it', async () => {
    const res = await payHandler(payReq('POST', 'outcome=failure'));
    expect(res.status).toBe(303);
    expect(paymentStatus).toBe('rejected');
    expect(res.headers.get('Location')).toContain('servicePayment=failed');
  });

  it('replaying the completion after it is already verified does not re-process', async () => {
    await payHandler(payReq('POST', 'outcome=success'));
    expect(paymentStatus).toBe('verified');

    const replay = await payHandler(payReq('POST', 'outcome=success'));
    const body = await replay.text();
    expect(body).toContain('already verified');
    expect(paymentStatus).toBe('verified');
  });
});
