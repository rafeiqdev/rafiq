/**
 * FX rate rules — pure, no I/O, so both the cron function and the tests use the
 * exact same logic rather than two drifting copies.
 *
 * Design note on rejection: a value that fails validation is REJECTED, not
 * clamped or accepted-with-a-flag. The previous trusted rate stays live and an
 * alert goes to the admins. A genuinely large real-world move (the lira does
 * move) therefore needs a human to confirm it via the manual override — which
 * is the intended behaviour, not a limitation: an unattended job should never
 * be able to publish a 40% swing on its own.
 */

/** The pairs the ticker shows. `via` is the provider's quote code, base USD. */
export const FX_PAIRS = [
  { pair: 'USD/TRY', code: 'TRY', invert: false },
  { pair: 'EUR/TRY', code: 'EUR', invert: true },
  { pair: 'GBP/TRY', code: 'GBP', invert: true },
  { pair: 'SAR/TRY', code: 'SAR', invert: true },
  { pair: 'AED/TRY', code: 'AED', invert: true },
] as const;

export type FxPair = (typeof FX_PAIRS)[number]['pair'];

/** Crypto pairs, synced by the same job from a separate feed. */
export const CRYPTO_PAIRS = [
  { pair: 'BTC/USD', id: 'bitcoin' },
  { pair: 'ETH/USD', id: 'ethereum' },
] as const;

export interface PairRule {
  /** Wide structural bounds — they catch garbage, not market moves. */
  min: number;
  max: number;
  /** A day-over-day move beyond this needs a human. */
  maxJumpPct: number;
}

/**
 * Per-pair rules.
 *
 * Bounds are deliberately loose: their job is to reject 0, negatives, 1e9 or a
 * string that coerced oddly — NOT to encode today's market, because tight
 * bounds rot and start refusing real data a year later. The jump limit does the
 * actual anomaly detection.
 *
 * The jump limit is per-pair for a reason: 10% is a violent day for a currency
 * but an ordinary one for Bitcoin. A single global threshold would either wave
 * through a broken FX quote or reject legitimate crypto moves every other week.
 */
export const PAIR_RULES: Record<string, PairRule> = {
  'USD/TRY': { min: 1, max: 10_000, maxJumpPct: 10 },
  'EUR/TRY': { min: 1, max: 10_000, maxJumpPct: 10 },
  'GBP/TRY': { min: 1, max: 10_000, maxJumpPct: 10 },
  'SAR/TRY': { min: 0.1, max: 5_000, maxJumpPct: 10 },
  'AED/TRY': { min: 0.1, max: 5_000, maxJumpPct: 10 },
  'BTC/USD': { min: 100, max: 10_000_000, maxJumpPct: 35 },
  'ETH/USD': { min: 1, max: 1_000_000, maxJumpPct: 35 },
};

export const DEFAULT_RULE: PairRule = { min: 0.000001, max: 100_000_000, maxJumpPct: 15 };

export const ruleFor = (pair: string): PairRule => PAIR_RULES[pair] ?? DEFAULT_RULE;

/** Provider data older than this is not "today's rate". */
export const MAX_SOURCE_AGE_HOURS = 48;

export type RejectCode =
  | 'not_a_number'
  | 'not_positive'
  | 'out_of_bounds'
  | 'jump_too_large'
  | 'source_too_old';

export type RateVerdict =
  | { accept: true }
  | { accept: false; code: RejectCode; detail: string };

export interface AssessInput {
  pair: string;
  /** candidate value from the provider */
  value: unknown;
  /** last trusted rate, or null on first ever sync */
  previous: number | null;
  /** when the provider says it priced this, or null if it does not say */
  sourceTime: Date | null;
  now: Date;
}

/**
 * The single decision point: may this provider value replace the stored one?
 * Order matters — cheapest and most fundamental checks first, so the reported
 * reason is the most specific true one.
 */
export function assessRate({ pair, value, previous, sourceTime, now }: AssessInput): RateVerdict {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { accept: false, code: 'not_a_number', detail: `${pair}: ${JSON.stringify(value)} is not a finite number` };
  }
  if (value <= 0) {
    return { accept: false, code: 'not_positive', detail: `${pair}: ${value} is not positive` };
  }

  const rule = ruleFor(pair);
  if (value < rule.min || value > rule.max) {
    return {
      accept: false,
      code: 'out_of_bounds',
      detail: `${pair}: ${value} outside [${rule.min}, ${rule.max}]`,
    };
  }

  if (sourceTime) {
    const ageHours = (now.getTime() - sourceTime.getTime()) / 3_600_000;
    // A future timestamp is as suspect as an ancient one — both mean the feed
    // is not telling the truth about when it priced.
    if (ageHours > MAX_SOURCE_AGE_HOURS || ageHours < -1) {
      return {
        accept: false,
        code: 'source_too_old',
        detail: `${pair}: provider timestamp is ${ageHours.toFixed(1)}h away from now`,
      };
    }
  }

  // First ever value for a pair has nothing to compare against; the bounds
  // check above is the only guard that can apply.
  if (previous !== null && previous > 0) {
    const jump = (Math.abs(value - previous) / previous) * 100;
    if (jump > rule.maxJumpPct) {
      return {
        accept: false,
        code: 'jump_too_large',
        detail: `${pair}: ${previous} → ${value} is ${jump.toFixed(1)}% (limit ${rule.maxJumpPct}%)`,
      };
    }
  }

  return { accept: true };
}

export interface ProviderPayload {
  /** quote code → value, base USD */
  rates?: Record<string, unknown>;
  /** seconds since epoch, as open.er-api.com reports it */
  time_last_update_unix?: unknown;
  result?: unknown;
}

export interface DerivedRate {
  pair: string;
  value: number | null;
}

/**
 * Turn one USD-based provider response into our five TRY pairs.
 *
 * USD/TRY is quoted directly. The rest are cross-rates: the provider gives
 * USD→EUR and USD→TRY, so EUR/TRY is TRY ÷ EUR. A missing or zero divisor
 * yields null rather than Infinity, which assessRate then rejects cleanly.
 */
export function derivePairs(payload: ProviderPayload): DerivedRate[] {
  const raw = payload.rates ?? {};
  const num = (k: string): number | null => {
    const v = raw[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const tryRate = num('TRY');

  return FX_PAIRS.map(({ pair, code, invert }) => {
    if (tryRate === null) return { pair, value: null };
    if (!invert) return { pair, value: tryRate };
    const divisor = num(code);
    if (divisor === null || divisor === 0) return { pair, value: null };
    return { pair, value: tryRate / divisor };
  });
}

/** The provider's own pricing time, or null when it does not report one. */
export function providerTime(payload: ProviderPayload): Date | null {
  const unix = payload.time_last_update_unix;
  if (typeof unix !== 'number' || !Number.isFinite(unix) || unix <= 0) return null;
  const d = new Date(unix * 1000);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type SyncStatus = 'success' | 'partial' | 'failed';

/** success = everything landed · partial = some rejected · failed = nothing landed. */
export function classifyRun(updated: number, rejected: number): SyncStatus {
  if (updated === 0) return 'failed';
  return rejected > 0 ? 'partial' : 'success';
}

/**
 * Istanbul wall-clock, computed from the IANA zone rather than a hardcoded +3.
 *
 * Turkey abolished DST in 2016 and sits on UTC+3 permanently, so this should
 * always read 09:05 for the 06:05 UTC schedule. Recording it per run means that
 * if Turkey ever reinstates DST, the drift is visible in the admin panel
 * instead of the job silently running an hour off.
 */
export function istanbulLocalTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** How stale a displayed rate is, for the ticker's freshness hint. */
export function hoursSince(updatedAt: string | null, now: Date): number | null {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 3_600_000;
}
