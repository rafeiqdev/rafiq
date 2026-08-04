/**
 * Medical-tourism payment gateway webhook — the ONLY path that flips a
 * booking-deposit payment to verified, which is in turn the ONLY thing that
 * unlocks a center's identity for the customer (see get_offer_center() in
 * supabase/migrations/20260806_medical_tourism.sql).
 *
 * Same contract and security properties as api/payments/webhook.ts (the
 * subscription-checkout webhook) — this file is a deliberate near-duplicate
 * rather than a shared abstraction, so the two payment domains never share a
 * failure mode:
 *
 *   POST, raw JSON body, HMAC-SHA256 hex of the exact bytes in the
 *   `x-rafiq-signature` header, keyed with PAYMENT_WEBHOOK_SECRET.
 *   Body: { "paymentId": "<uuid>", "outcome": "success" | "failure",
 *           "amount": <optional, checked against the row> }
 *
 * Unlike the subscription webhook, a successful outcome here does NOT run an
 * _activate_sub-style RPC — it only flips medical_payments.status, and
 * admin_set_medical_payment_status (called with service_role privileges,
 * same is_medical_staff()-or-service_role gate as _activate_sub) mirrors the
 * request status to 'paid'. get_offer_center() picks up the verified row on
 * its next read; nothing here reveals the center directly.
 *
 * TO WIRE A REAL GATEWAY (Whop or otherwise): point its webhook at this URL
 * and translate its payload into { paymentId, outcome, amount } before (or
 * instead of) the signature check below — the amount/payment lookups already
 * treat the row, never the request body, as the source of truth for price.
 */

export const config = { runtime: 'edge' };

const enc = new TextEncoder();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

async function hmacHex(secret: string, raw: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, raw);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MedicalPaymentRow {
  id: string;
  request_id: string;
  offer_id: string;
  user_id: string;
  amount: number;
  status: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = env('PAYMENT_WEBHOOK_SECRET');
  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supaUrl || !serviceKey) return json({ error: 'not_configured' }, 503);

  const raw = await req.arrayBuffer();
  const expected = await hmacHex(secret, raw);
  const got = String(req.headers.get('x-rafiq-signature') ?? '').toLowerCase();
  if (!timingSafeEqualHex(got, expected)) return json({ error: 'bad_signature' }, 401);

  let payload: { paymentId?: unknown; outcome?: unknown; amount?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: 'bad_payload' }, 400);
  }

  const paymentId = String(payload.paymentId ?? '');
  const outcome = String(payload.outcome ?? '');
  if (!UUID_RE.test(paymentId)) return json({ error: 'bad_payment_id' }, 400);
  if (outcome !== 'success' && outcome !== 'failure') return json({ error: 'bad_outcome' }, 400);

  const supa = (path: string, init: RequestInit = {}) =>
    fetch(`${supaUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  const rowRes = await supa(`medical_payments?id=eq.${paymentId}&select=id,request_id,offer_id,user_id,amount,status`);
  if (!rowRes.ok) return json({ error: 'db_error' }, 502);
  const payment = ((await rowRes.json()) as MedicalPaymentRow[])[0];
  if (!payment) return json({ error: 'payment_not_found' }, 404);

  if (payload.amount != null && Number(payload.amount) !== Number(payment.amount)) {
    return json({ error: 'amount_mismatch' }, 400);
  }

  if (outcome === 'failure') {
    if (payment.status === 'verified') return json({ ok: true, status: 'verified', ignored: 'already_verified' });
    const upd = await supa(`medical_payments?id=eq.${paymentId}&status=neq.verified`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });
    if (!upd.ok) return json({ error: 'db_error' }, 502);
    return json({ ok: true, status: 'rejected' });
  }

  // outcome === 'success'
  if (payment.status === 'verified') return json({ ok: true, status: 'verified', replay: true });
  if (payment.status === 'rejected') return json({ error: 'payment_was_rejected' }, 409);

  // pending -> verified, conditionally: a concurrent replay matches 0 rows.
  const upd = await supa(`medical_payments?id=eq.${paymentId}&status=eq.pending`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'verified', verified_at: new Date().toISOString() }),
  });
  if (!upd.ok) return json({ error: 'db_error' }, 502);
  const updated = (await upd.json()) as MedicalPaymentRow[];
  if (updated.length === 0) return json({ ok: true, status: 'verified', replay: true });

  const req2 = await supa(`medical_requests?id=eq.${payment.request_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'paid' }),
  });
  if (!req2.ok) {
    // Payment is verified but the request status mirror failed to write — the
    // customer's My Requests / offer view still resolves correctly because
    // get_offer_center() checks medical_payments directly, not this mirror.
    return json({ ok: true, status: 'verified', request_status_sync: 'failed' });
  }

  return json({ ok: true, status: 'verified' });
}
