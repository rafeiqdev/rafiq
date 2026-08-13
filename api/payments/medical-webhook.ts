/**
 * Medical-tourism payment gateway webhook — the ONLY path that flips a
 * booking-deposit payment to verified, which is in turn the ONLY thing that
 * unlocks a center's identity for the customer (see get_offer_center() in
 * supabase/migrations/20260806_medical_tourism.sql).
 *
 * Same contract and security properties as api/payments/webhook.ts (the
 * subscription-checkout webhook) — this file is a deliberate near-duplicate
 * rather than a shared abstraction, so the two payment domains never share a
 * failure mode.
 *
 * Wired to Whop (see api/_lib/whop.ts): POST, raw JSON body, signature per
 * the Standard Webhooks spec (webhook-id/webhook-timestamp/webhook-signature
 * headers), keyed with WHOP_MEDICAL_WEBHOOK_SECRET — a secret DIFFERENT from
 * WHOP_SERVICE_WEBHOOK_SECRET (Whop mints one per webhook endpoint).
 *
 * Correlation: `data.checkout_configuration_id` (Whop's own `ch_...` id,
 * reliably present on payment.succeeded/failed) is matched against
 * medical_payments.whop_checkout_id, set by medical-pay.ts when it created
 * the checkout. NOT metadata — Whop's live API silently drops
 * checkout_configuration metadata (verified empirically; comes back `null`
 * despite the docs describing it as persisted), so `data.metadata.paymentId`
 * cannot be trusted. See supabase/migrations/20260813_whop_checkout_correlation.sql.
 *
 * Unlike the subscription webhook, a successful outcome here does NOT run an
 * _activate_sub-style RPC — it only flips medical_payments.status, and
 * admin_set_medical_payment_status (called with service_role privileges,
 * same is_medical_staff()-or-service_role gate as _activate_sub) mirrors the
 * request status to 'paid'. get_offer_center() picks up the verified row on
 * its next read; nothing here reveals the center directly.
 */

import { verifyWhopWebhook } from '../_lib/whop.js';

export const config = { runtime: 'edge' };

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

interface MedicalPaymentRow {
  id: string;
  request_id: string;
  offer_id: string;
  user_id: string;
  amount: number;
  charged_amount: number | null;
  status: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = env('WHOP_MEDICAL_WEBHOOK_SECRET');
  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supaUrl || !serviceKey) return json({ error: 'not_configured' }, 503);

  const rawBody = await req.text();
  const envelope = await verifyWhopWebhook(secret, req, rawBody);
  if (!envelope) return json({ error: 'bad_signature' }, 401);

  let checkoutId: string;
  let outcome: 'success' | 'failure';
  let claimedAmount: number | undefined;

  if (envelope.type === 'payment.succeeded' || envelope.type === 'payment.failed') {
    checkoutId = String((envelope.data as { checkout_configuration_id?: unknown }).checkout_configuration_id ?? '');
    outcome = envelope.type === 'payment.succeeded' ? 'success' : 'failure';
    const total = (envelope.data as { total?: unknown }).total;
    claimedAmount = typeof total === 'number' ? total : undefined;
  } else if (envelope.type === 'refund.created') {
    // A refund reverses money already verified — deciding whether/how that
    // should revoke access needs a real status model (medical_payments has no
    // 'refunded' state yet). Acknowledge so Whop doesn't retry, but don't
    // guess at a status mutation here.
    return json({ ok: true, ignored: 'refund_ack_no_status_change' });
  } else {
    // Unknown/uninteresting event type for this endpoint — ack so Whop stops retrying.
    return json({ ok: true, ignored: envelope.type });
  }

  if (!checkoutId) return json({ error: 'bad_checkout_id' }, 400);

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

  const rowRes = await supa(
    `medical_payments?whop_checkout_id=eq.${encodeURIComponent(checkoutId)}&select=id,request_id,offer_id,user_id,amount,charged_amount,status`,
  );
  if (!rowRes.ok) return json({ error: 'db_error' }, 502);
  const payment = ((await rowRes.json()) as MedicalPaymentRow[])[0];
  if (!payment) return json({ error: 'payment_not_found' }, 404);

  if (claimedAmount != null && payment.charged_amount != null && Math.abs(claimedAmount - payment.charged_amount) > 0.01) {
    return json({ error: 'amount_mismatch' }, 400);
  }

  const paymentId = payment.id;

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
