/**
 * Payment gateway webhook — the ONLY path that activates a card subscription.
 *
 * Contract (same shape server/index.mjs defined and its tests pin):
 *   POST, raw JSON body, HMAC-SHA256 hex of the exact bytes in the
 *   `x-rafiq-signature` header, keyed with PAYMENT_WEBHOOK_SECRET.
 *   Body: { "paymentId": "<uuid>", "outcome": "success" | "failure",
 *           "amount": <optional TL integer, checked against the row> }
 *
 * Security properties:
 *   - The signature is verified over the raw bytes BEFORE any parsing, with a
 *     constant-time comparison. No secret, no activation.
 *   - Writes use the Supabase service-role key (never shipped to a browser).
 *     public._activate_sub refuses non-service_role callers since the
 *     20260728_lock_internal_rpcs migration, so this function and the admin
 *     RPC are the only activation paths.
 *   - Idempotent: verification flips status pending->verified with a
 *     conditional UPDATE; a replayed webhook matches zero rows and returns ok
 *     without extending or duplicating the subscription.
 *   - A payment the admin already REJECTED is not silently resurrected — that
 *     disagreement returns 409 for a human to look at.
 *
 * Referral commission is deliberately NOT credited here yet: the live
 * _credit_referrer body exists only in the production database and its
 * argument contract is unverified. Until it is confirmed (see
 * SUPABASE-SETUP.md), commissions for gateway payments are granted by the
 * admin flow like bank/crypto ones.
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

/** Constant-time string comparison (both sides are lowercase hex). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PaymentRow {
  id: string;
  user_id: string;
  tier: string;
  billing: string;
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
  // Explicit allow-list: an unrecognised outcome must never default to a
  // rejection (that is exactly the silent-default bug this replaces).
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

  const rowRes = await supa(`payments?id=eq.${paymentId}&select=id,user_id,tier,billing,amount,status`);
  if (!rowRes.ok) return json({ error: 'db_error' }, 502);
  const payment = ((await rowRes.json()) as PaymentRow[])[0];
  if (!payment) return json({ error: 'payment_not_found' }, 404);

  if (payload.amount != null && Number(payload.amount) !== Number(payment.amount)) {
    return json({ error: 'amount_mismatch' }, 400);
  }

  if (outcome === 'failure') {
    if (payment.status === 'verified') return json({ ok: true, status: 'verified', ignored: 'already_verified' });
    const upd = await supa(`payments?id=eq.${paymentId}&status=neq.verified`, {
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
  const upd = await supa(`payments?id=eq.${paymentId}&status=eq.pending`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'verified' }),
  });
  if (!upd.ok) return json({ error: 'db_error' }, 502);
  const updated = (await upd.json()) as PaymentRow[];
  if (updated.length === 0) return json({ ok: true, status: 'verified', replay: true });

  const days = payment.billing === 'annual' ? 365 : 30;
  const act = await supa('rpc/_activate_sub', {
    method: 'POST',
    body: JSON.stringify({ p_uid: payment.user_id, p_tier: payment.tier, p_billing: payment.billing, p_days: days }),
  });
  if (!act.ok) {
    // The payment row says verified but activation failed — surface loudly so
    // the admin dashboard (or the gateway's retry) can reconcile.
    return json({ error: 'activation_failed', status: 'verified_unactivated' }, 502);
  }

  return json({ ok: true, status: 'verified' });
}
