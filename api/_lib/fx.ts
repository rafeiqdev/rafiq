/**
 * TRY -> USD conversion for checkout, reusing the fx_rates table the daily
 * cron (api/cron/rates-sync.ts) already maintains — no second rate source,
 * no guessing. Needed because the Whop account currently only settles USD
 * (TRY settlement is pending Whop's own verification), while service-offer
 * prices are quoted in TL.
 */

// One missed daily sync (06:05 UTC) shouldn't hard-fail checkout, but a rate
// that's days old is more dangerous than refusing the payment outright.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/** `USD/TRY` rate = TRY per 1 USD. Returns null if missing, stale, or not provider-trusted. */
export async function getUsdTryRate(supaUrl: string, serviceKey: string): Promise<number | null> {
  const res = await fetch(`${supaUrl}/rest/v1/fx_rates?pair=eq.USD%2FTRY&select=rate,validation_status,updated_at`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { rate: string | number; validation_status: string; updated_at: string }[];
  const row = rows[0];
  if (!row || row.validation_status !== 'ok') return null;
  if (Date.now() - new Date(row.updated_at).getTime() > STALE_AFTER_MS) return null;
  const rate = Number(row.rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Rounds to cents. `usdTryRate` is TRY per 1 USD (fx_rates' `USD/TRY` pair). */
export function tryToUsd(amountTry: number, usdTryRate: number): number {
  return Math.round((amountTry / usdTryRate) * 100) / 100;
}
