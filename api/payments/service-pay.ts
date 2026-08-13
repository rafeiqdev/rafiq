/**
 * Real Whop checkout redirect for regular-service-request offer payments.
 * Sibling of api/payments/medical-pay.ts — same pattern, same reasoning (see
 * that file's header, including the whop_checkout_id correlation note).
 *
 * Service offers are quoted in TL, but the Whop account only settles USD
 * today (TRY pending Whop's own verification) — so a TL payment is converted
 * to USD here using the fx_rates table's daily-synced USD/TRY rate (see
 * api/_lib/fx.ts) before the checkout is created. The converted amount is
 * stored as `charged_amount` on the row (see
 * supabase/migrations/20260813_whop_checkout_correlation.sql) so
 * service-webhook.ts verifies Whop's payload against what we actually told
 * Whop to charge — not the TL amount stored on the row, and not metadata
 * (Whop's live API silently drops checkout_configuration metadata).
 */

import { createWhopCheckout } from '../_lib/whop.js';
import { getUsdTryRate, tryToUsd } from '../_lib/fx.js';

export const config = { runtime: 'edge' };

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
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
    `${supaUrl}/rest/v1/service_payments?gateway_session_id=eq.${encodeURIComponent(session)}&select=id,amount,currency,status`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as PaymentRow[];
  return rows[0] ?? null;
}

function page(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rafiq — Secure online payment</title>
<style>body{font-family:system-ui,sans-serif;background:#0f2a52;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;color:#0f2a52;border-radius:16px;padding:32px;max-width:380px;text-align:center}</style></head>
<body><div class="card">${inner}</div></body></html>`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return html(page('<h2>Method not allowed</h2>'), 405);

  const url = new URL(req.url);
  const session = url.searchParams.get('session') ?? '';
  const returnTo = url.searchParams.get('return') ?? '/';

  const apiKey = env('WHOP_API_KEY');
  const companyId = env('WHOP_COMPANY_ID');
  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !companyId || !supaUrl || !serviceKey || !session) {
    return html(page('<h2>Payment unavailable</h2><p>Missing configuration.</p>'), 503);
  }

  const payment = await lookupBySession(supaUrl, serviceKey, session);
  if (!payment) return html(page('<h2>Unknown session</h2>'), 404);
  if (payment.status !== 'pending') {
    return html(page(`<h2>This payment is already ${payment.status}</h2><p>No further action is available here.</p>`));
  }

  const redirectUrl = new URL(returnTo, url.origin).toString();

  let chargeAmount = payment.amount;
  const isTry = payment.currency.trim().toUpperCase() === 'TL' || payment.currency.trim().toUpperCase() === 'TRY';
  if (isTry) {
    const rate = await getUsdTryRate(supaUrl, serviceKey);
    if (rate == null) {
      // Refuse rather than guess — charging the wrong amount is worse than a delay.
      return html(page('<h2>Payment unavailable</h2><p>Exchange rate temporarily unavailable — please try again shortly.</p>'), 503);
    }
    chargeAmount = tryToUsd(payment.amount, rate);
  }

  try {
    const checkout = await createWhopCheckout({
      apiKey,
      companyId,
      amount: chargeAmount,
      currency: 'USD',
      // Whop's dynamic-plan title is capped at 30 characters.
      title: 'Rafiq service payment',
      metadata: { paymentId: payment.id },
      redirectUrl,
    });

    // Store the correlation key BEFORE redirecting — if this write fails, the
    // webhook would never be able to find this row, so treat it as a hard failure.
    const upd = await fetch(`${supaUrl}/rest/v1/service_payments?id=eq.${payment.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ whop_checkout_id: checkout.id, charged_amount: chargeAmount }),
    });
    if (!upd.ok) throw new Error('failed_to_store_checkout_id');

    return new Response(null, { status: 303, headers: { Location: checkout.purchaseUrl } });
  } catch {
    return html(page('<h2>Payment unavailable</h2><p>Could not start checkout — please try again shortly.</p>'), 502);
  }
}
