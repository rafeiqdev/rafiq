/**
 * Dev/staging payment-gateway simulator for medical booking deposits.
 *
 * This stands in for a real hosted checkout page (Whop or otherwise) — see
 * server/index.mjs's `/api/pay/:session` + `/complete` for the identical
 * pattern already used by the subscription-checkout flow. It exists so the
 * full flow is testable end-to-end WITHOUT a manual admin "mark as paid"
 * shortcut:
 *
 *   client redirects here (opaque session token, no price/status in the URL)
 *     -> GET renders a plain confirm/cancel page
 *     -> POST looks the payment up server-side, builds the SAME payload a
 *        real gateway's webhook would send, signs it with the real
 *        PAYMENT_WEBHOOK_SECRET, and hands it to the actual webhook handler
 *        (api/payments/medical-webhook.ts) in-process — full HMAC
 *        verification and the idempotent conditional UPDATE run for real.
 *     -> the browser is redirected back into the app; it never sees a
 *        "verified" status from this page, only from a later read of
 *        medical_payments (or get_offer_center()) after the webhook wrote it.
 *
 * TO REPLACE WITH REAL WHOP: delete this file and the `payUrl` this app
 * builds; create the checkout session via the Whop SDK/API instead and point
 * Whop's webhook configuration at api/payments/medical-webhook.ts. That
 * webhook's signature contract would need to switch from this app's HMAC
 * scheme to Whop's own signing scheme — everything downstream (the
 * conditional UPDATE, the request-status mirror) stays the same.
 */

import medicalWebhookHandler from './medical-webhook';

export const config = { runtime: 'edge' };

const enc = new TextEncoder();

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

async function hmacHex(secret: string, raw: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

async function lookupBySession(supaUrl: string, serviceKey: string, session: string): Promise<PaymentRow | null> {
  const res = await fetch(
    `${supaUrl}/rest/v1/medical_payments?gateway_session_id=eq.${encodeURIComponent(session)}&select=id,amount,currency,status`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as PaymentRow[];
  return rows[0] ?? null;
}

function page(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rafiq — Secure online payment</title>
<style>body{font-family:system-ui,sans-serif;background:#0f2a52;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;color:#0f2a52;border-radius:16px;padding:32px;max-width:380px;text-align:center}
button{height:44px;border-radius:12px;border:0;font-weight:600;width:100%;margin-top:10px;cursor:pointer;font-size:15px}
.ok{background:#0f2a52;color:#fff}.no{background:#eee;color:#555}
.badge{font-size:11px;color:#888;margin-top:14px;line-height:1.5}</style></head>
<body><div class="card">${inner}</div></body></html>`;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const session = url.searchParams.get('session') ?? '';
  const returnTo = url.searchParams.get('return') ?? '/';

  const secret = env('PAYMENT_WEBHOOK_SECRET');
  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supaUrl || !serviceKey || !session) {
    return html(page('<h2>Payment simulator unavailable</h2><p>Missing configuration.</p>'), 503);
  }

  const payment = await lookupBySession(supaUrl, serviceKey, session);
  if (!payment) return html(page('<h2>Unknown session</h2>'), 404);

  if (req.method === 'GET') {
    if (payment.status !== 'pending') {
      return html(page(`<h2>This payment is already ${payment.status}</h2><p>No further action is available here.</p>`));
    }
    return html(page(`
      <h2>Secure online payment</h2>
      <p style="font-size:22px;font-weight:800" dir="ltr">${payment.amount.toLocaleString()} ${payment.currency}</p>
      <form method="post"><input type="hidden" name="outcome" value="success">
        <button class="ok" type="submit">Pay ${payment.amount.toLocaleString()} ${payment.currency}</button></form>
      <form method="post"><input type="hidden" name="outcome" value="failure">
        <button class="no" type="submit">Cancel</button></form>
      <p class="badge">Processed via a signed payment confirmation. Booking details are released only after this payment is verified.</p>
    `));
  }

  if (req.method === 'POST') {
    if (payment.status !== 'pending') {
      return html(page(`<h2>This payment is already ${payment.status}</h2>`));
    }
    let outcome = 'failure';
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = new URLSearchParams(await req.text());
      outcome = form.get('outcome') === 'success' ? 'success' : 'failure';
    } else {
      try {
        const body = (await req.json()) as { outcome?: string };
        outcome = body.outcome === 'success' ? 'success' : 'failure';
      } catch {
        outcome = 'failure';
      }
    }

    // Build and sign the exact payload a real gateway's webhook would send,
    // then hand it to the real handler — no shortcut, no direct status write.
    const payload = JSON.stringify({ paymentId: payment.id, outcome });
    const signature = await hmacHex(secret, payload);
    const webhookReq = new Request('https://internal.invalid/api/payments/medical-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rafiq-signature': signature },
      body: payload,
    });
    const webhookRes = await medicalWebhookHandler(webhookReq);
    const webhookOk = webhookRes.status >= 200 && webhookRes.status < 300;

    const dest = new URL(returnTo, url.origin);
    dest.searchParams.set('medicalPayment', webhookOk && outcome === 'success' ? 'success' : 'failed');
    return new Response(null, { status: 303, headers: { Location: dest.toString() } });
  }

  return html(page('<h2>Method not allowed</h2>'), 405);
}
