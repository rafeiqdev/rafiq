/**
 * Daily FX sync — the ONLY thing that writes provider rates.
 *
 * Scheduled by vercel.json at 06:05 UTC ("5 6 * * *"). Turkey is permanently UTC+3 (DST
 * abolished 2016), so that is 09:05 Istanbul; Vercel cron expressions are UTC
 * only and have no timezone field, which is why the offset is applied here
 * rather than declared. Each run records the actual Istanbul wall-clock so a
 * future DST change surfaces as visible drift instead of a silent hour shift.
 *
 * Security:
 *   - Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations.
 *     Without a matching secret this endpoint refuses, so it cannot be triggered
 *     by anyone who finds the URL.
 *   - Writes use the Supabase service-role key, which never leaves the server.
 *     The browser has read-only access to fx_rates through RLS.
 *
 * Failure behaviour: rejected values are NOT written. The previously stored
 * rate stays live, the run is logged as partial/failed, and an alert fires.
 */

import {
  assessRate,
  classifyRun,
  CRYPTO_PAIRS,
  derivePairs,
  istanbulLocalTime,
  providerTime,
  type DerivedRate,
  type ProviderPayload,
  type RejectCode,
} from '../../src/lib/fxRates';

export const config = { runtime: 'edge' };

const DEFAULT_PROVIDER = 'https://open.er-api.com/v6/latest/USD';
const DEFAULT_CRYPTO_PROVIDER =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';
const FETCH_TIMEOUT_MS = 8000;

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

interface Supa {
  url: string;
  key: string;
}

async function supaFetch(s: Supa, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${s.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: s.key,
      Authorization: `Bearer ${s.key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Current stored rates, keyed by pair — the baseline every jump check needs. */
async function loadCurrent(s: Supa): Promise<Map<string, { rate: number; source: string }>> {
  const res = await supaFetch(s, 'fx_rates?select=pair,rate,source');
  if (!res.ok) return new Map();
  const rows = (await res.json()) as { pair: string; rate: string | number; source: string }[];
  return new Map(rows.map((r) => [r.pair, { rate: Number(r.rate), source: r.source }]));
}

/** Best-effort alert. Never throws — a broken webhook must not fail the sync. */
async function alertAdmins(summary: Record<string, unknown>): Promise<void> {
  const hook = env('FX_ALERT_WEBHOOK_URL');
  if (!hook) return;
  try {
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'rafiq-fx-sync', ...summary }),
    });
  } catch {
    /* the fx_sync_runs row is the durable alert; the webhook is a convenience */
  }
}

export default async function handler(req: Request): Promise<Response> {
  const startedAt = new Date();

  // ---- authorisation ------------------------------------------------------
  const secret = env('CRON_SECRET');
  const auth = req.headers.get('authorization');
  if (!secret) return json({ error: 'cron_secret_not_configured' }, 500);
  if (auth !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401);

  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supaKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supaUrl || !supaKey) return json({ error: 'supabase_not_configured' }, 500);
  const s: Supa = { url: supaUrl.replace(/\/$/, ''), key: supaKey };

  const providerUrl = env('FX_PROVIDER_URL') ?? DEFAULT_PROVIDER;
  const providerName = new URL(providerUrl).host;
  const localTime = istanbulLocalTime(startedAt);

  /** Records the attempt and alerts. Called on every exit path. */
  const finish = async (
    status: 'success' | 'partial' | 'failed',
    updated: number,
    rejected: number,
    error?: string,
  ) => {
    await supaFetch(s, 'fx_sync_runs', {
      method: 'POST',
      body: JSON.stringify({
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        status,
        provider_name: providerName,
        pairs_updated: updated,
        pairs_rejected: rejected,
        error: error ?? null,
        local_time: localTime,
      }),
    }).catch(() => {});
    if (status !== 'success') {
      await alertAdmins({ status, provider: providerName, updated, rejected, error, localTime });
    }
    return json({ status, updated, rejected, provider: providerName, localTime, error });
  };

  // ---- fetch the provider -------------------------------------------------
  let payload: ProviderPayload;
  try {
    const key = env('FX_PROVIDER_KEY');
    const res = await fetch(providerUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
    if (!res.ok) {
      // Source failure → keep every stored rate exactly as it is.
      return await finish('failed', 0, 0, `provider responded ${res.status}`);
    }
    payload = (await res.json()) as ProviderPayload;
  } catch (e) {
    return await finish('failed', 0, 0, `provider unreachable: ${String(e).slice(0, 200)}`);
  }

  // ---- crypto (separate feed, same validation + write path) ----------------
  // Fails soft on purpose: BTC/ETH are a nice-to-have on the ticker and must
  // never turn a healthy FX sync into a failed run.
  const cryptoDerived: DerivedRate[] = [];
  try {
    const res = await fetch(env('CRYPTO_PROVIDER_URL') ?? DEFAULT_CRYPTO_PROVIDER, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const j = (await res.json()) as Record<string, { usd?: unknown }>;
      for (const { pair, id } of CRYPTO_PAIRS) {
        const v = j?.[id]?.usd;
        cryptoDerived.push({ pair, value: typeof v === 'number' ? v : null });
      }
    }
  } catch {
    /* leave cryptoDerived empty — the previous values stay live */
  }

  // ---- validate ------------------------------------------------------------
  const current = await loadCurrent(s);
  const sourceTime = providerTime(payload);
  const derived = [...derivePairs(payload), ...cryptoDerived.filter((c) => c.value !== null)];

  const accepted: { pair: string; value: number }[] = [];
  const rejected: { pair: string; code: RejectCode; detail: string }[] = [];

  for (const { pair, value } of derived) {
    const prev = current.get(pair);
    // A manual override is authoritative until an admin releases it — the feed
    // must not quietly overwrite a rate a human deliberately set.
    if (prev?.source === 'manual') continue;

    const verdict = assessRate({
      pair,
      value,
      previous: prev?.rate ?? null,
      // Only the FX feed reports a pricing time; the crypto feed does not, so
      // claiming the FX timestamp for it would be a small lie in the audit row.
      sourceTime: CRYPTO_PAIRS.some((c) => c.pair === pair) ? null : sourceTime,
      now: startedAt,
    });
    if (verdict.accept) accepted.push({ pair, value: value as number });
    else rejected.push({ pair, code: verdict.code, detail: verdict.detail });
  }

  if (accepted.length === 0) {
    return await finish('failed', 0, rejected.length, rejected.map((r) => r.detail).join(' | ').slice(0, 500));
  }

  // ---- write ---------------------------------------------------------------
  const nowIso = new Date().toISOString();
  const upsert = await supaFetch(s, 'fx_rates?on_conflict=pair', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(
      accepted.map((a) => ({
        pair: a.pair,
        rate: a.value,
        source: 'provider',
        provider_name: providerName,
        validation_status: 'ok',
        fetched_at: (sourceTime ?? startedAt).toISOString(),
        updated_at: nowIso,
        override_reason: null,
        override_by: null,
      })),
    ),
  });
  if (!upsert.ok) {
    return await finish('failed', 0, rejected.length, `write failed: ${(await upsert.text()).slice(0, 200)}`);
  }

  // Audit every accepted change and every rejection, so the admin log explains
  // both what moved and what was refused.
  await supaFetch(s, 'fx_rate_audit', {
    method: 'POST',
    body: JSON.stringify([
      ...accepted.map((a) => ({
        pair: a.pair,
        old_rate: current.get(a.pair)?.rate ?? null,
        new_rate: a.value,
        source: 'provider',
        validation_status: 'ok',
        reason: `daily sync via ${providerName}`,
        actor: null,
      })),
      ...rejected.map((r) => ({
        pair: r.pair,
        old_rate: current.get(r.pair)?.rate ?? null,
        new_rate: null,
        source: 'provider',
        validation_status: 'suspect',
        reason: `rejected (${r.code}): ${r.detail}`,
        actor: null,
      })),
    ]),
  }).catch(() => {});

  return await finish(classifyRun(accepted.length, rejected.length), accepted.length, rejected.length,
    rejected.length ? rejected.map((r) => r.detail).join(' | ').slice(0, 500) : undefined);
}
