/**
 * Shared Whop gateway helpers for api/payments/medical-{pay,webhook}.ts and
 * service-{pay,webhook}.ts: create a one-time hosted checkout, and verify an
 * inbound webhook's signature.
 *
 * Reference: https://docs.whop.com/developer/guides/webhooks and
 * https://docs.whop.com/api-reference/checkout-configurations/create-a-checkout-configuration
 * (fetched 2026-08-13 — Whop's OpenAPI spec at
 * https://docs.whop.com/openapi/api-v1-stable.json is the source of truth if
 * the request/response shape ever needs re-checking).
 */

const WHOP_API_BASE = 'https://api.whop.com/api/v1';

/** Whop's lowercase currency codes. Falls back to lowercasing whatever's given. */
export function toWhopCurrency(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === 'TL' || c === 'TRY') return 'try';
  return code.trim().toLowerCase();
}

export interface CreateWhopCheckoutParams {
  apiKey: string;
  companyId: string;
  /** Decimal amount in major currency units (e.g. 500.00), matching the DB's `numeric` column. */
  amount: number;
  /** DB currency code (e.g. 'USD', 'TL') — converted via toWhopCurrency(). */
  currency: string;
  title: string;
  /** Echoed back verbatim on payment.succeeded/payment.failed/refund.created webhooks. */
  metadata: Record<string, string>;
  redirectUrl?: string;
}

export interface WhopCheckout {
  id: string;
  purchaseUrl: string;
}

/** Creates a single-use, one-time-payment checkout configuration. Throws on a non-2xx response. */
export async function createWhopCheckout(p: CreateWhopCheckoutParams): Promise<WhopCheckout> {
  const currency = toWhopCurrency(p.currency);
  const res = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'payment',
      metadata: p.metadata,
      redirect_url: p.redirectUrl ?? null,
      plan: {
        company_id: p.companyId,
        currency,
        plan_type: 'one_time',
        initial_price: p.amount,
        title: p.title,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`whop_checkout_failed:${res.status}:${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string; purchase_url: string };
  return { id: data.id, purchaseUrl: new URL(data.purchase_url, 'https://whop.com').toString() };
}

export interface WhopWebhookEnvelope {
  id: string;
  timestamp: string;
  type: string;
  company_id: string;
  data: Record<string, unknown>;
}

const enc = new TextEncoder();

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  let binary = '';
  for (const b of new Uint8Array(sig)) binary += String.fromCharCode(b);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Standard Webhooks recommends rejecting stale timestamps to block replay of a captured request.
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Verifies a Whop webhook per the Standard Webhooks spec (webhook-id /
 * webhook-timestamp / webhook-signature headers; signed_content =
 * `{id}.{timestamp}.{rawBody}`; HMAC-SHA256 keyed with the raw secret bytes —
 * Whop's own examples base64-encode the secret only so their SDK can
 * base64-decode it back to these same bytes before hashing).
 *
 * Returns the parsed envelope on success, or null on any signature/format failure.
 */
export async function verifyWhopWebhook(secret: string, req: Request, rawBody: string): Promise<WhopWebhookEnvelope | null> {
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const sigHeader = req.headers.get('webhook-signature');
  if (!id || !timestamp || !sigHeader) return null;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_CLOCK_SKEW_SECONDS) return null;

  const expected = await hmacBase64(secret, `${id}.${timestamp}.${rawBody}`);
  const candidates = sigHeader.split(' ').map((s) => s.trim()).filter(Boolean);
  const verified = candidates.some((c) => {
    const [version, sig] = c.split(',');
    return version === 'v1' && !!sig && timingSafeEqual(sig, expected);
  });
  if (!verified) return null;

  try {
    return JSON.parse(rawBody) as WhopWebhookEnvelope;
  } catch {
    return null;
  }
}
