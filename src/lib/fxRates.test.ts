import { describe, expect, it } from 'vitest';
import {
  assessRate,
  classifyRun,
  derivePairs,
  FX_PAIRS,
  hoursSince,
  istanbulLocalTime,
  MANUAL_ONLY_PAIRS,
  providerTime,
  ruleFor,
} from './fxRates';

const FX_JUMP = ruleFor('USD/TRY').maxJumpPct;

const NOW = new Date('2026-07-20T06:05:00Z');
const FRESH = new Date('2026-07-20T00:00:00Z');

function assess(over: Partial<Parameters<typeof assessRate>[0]> = {}) {
  return assessRate({
    pair: 'USD/TRY',
    value: 47.2,
    previous: 47.0,
    sourceTime: FRESH,
    now: NOW,
    ...over,
  });
}

describe('assessRate — invalid data is rejected, never published', () => {
  it('accepts a plausible move', () => {
    expect(assess()).toEqual({ accept: true });
  });

  it.each([
    ['a string', '47.2'],
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['an object', {}],
  ])('rejects %s', (_label, value) => {
    const v = assess({ value });
    expect(v.accept).toBe(false);
    expect(v.accept === false && v.code).toBe('not_a_number');
  });

  it.each([0, -1, -47.2])('rejects non-positive value %s', (value) => {
    const v = assess({ value });
    expect(v.accept === false && v.code).toBe('not_positive');
  });

  it('rejects a value far outside structural bounds', () => {
    // Previous is null so the jump guard cannot fire — bounds must catch this
    // on their own, which is the first-sync case.
    const v = assess({ value: 1e9, previous: null });
    expect(v.accept === false && v.code).toBe('out_of_bounds');
  });

  it('rejects a value below the floor', () => {
    const v = assess({ value: 0.0001, previous: null });
    expect(v.accept === false && v.code).toBe('out_of_bounds');
  });
});

describe('assessRate — implausible jumps need a human', () => {
  it(`rejects a currency move larger than ${FX_JUMP}%`, () => {
    const v = assess({ previous: 47, value: 60 });
    expect(v.accept === false && v.code).toBe('jump_too_large');
    expect(v.accept === false && v.detail).toContain('%');
  });

  it('rejects a large drop as well as a large rise', () => {
    const v = assess({ previous: 47, value: 30 });
    expect(v.accept === false && v.code).toBe('jump_too_large');
  });

  it('accepts a move just under the limit', () => {
    // 47 → 51.6 is 9.79%
    expect(assess({ previous: 47, value: 51.6 })).toEqual({ accept: true });
  });

  it('skips the jump check on the very first sync', () => {
    expect(assess({ previous: null, value: 47.2 })).toEqual({ accept: true });
  });

  it('skips the jump check when the stored rate is unusable', () => {
    expect(assess({ previous: 0, value: 47.2 })).toEqual({ accept: true });
  });

  // Per-pair limits exist because one global threshold cannot serve both:
  // 20% is a broken FX quote but an ordinary week for Bitcoin.
  it('rejects a 20% move on a currency pair', () => {
    const v = assess({ pair: 'EUR/TRY', previous: 50, value: 60 });
    expect(v.accept === false && v.code).toBe('jump_too_large');
  });

  it('accepts the same 20% move on a crypto pair', () => {
    const v = assess({ pair: 'BTC/USD', previous: 50_000, value: 60_000, sourceTime: null });
    expect(v).toEqual({ accept: true });
  });

  it('still rejects an absurd crypto move', () => {
    const v = assess({ pair: 'BTC/USD', previous: 50_000, value: 500_000, sourceTime: null });
    expect(v.accept === false && v.code).toBe('jump_too_large');
  });

  it('applies a default rule to an unknown pair rather than skipping checks', () => {
    const v = assess({ pair: 'XAU/TRY', previous: 100, value: 200, sourceTime: null });
    expect(v.accept === false && v.code).toBe('jump_too_large');
  });
});

describe('assessRate — the source must be recent', () => {
  it('rejects data the provider priced days ago', () => {
    const v = assess({ sourceTime: new Date('2026-07-01T00:00:00Z') });
    expect(v.accept === false && v.code).toBe('source_too_old');
  });

  it('rejects a timestamp from the future', () => {
    // A clock-skewed or fabricated timestamp is as untrustworthy as a stale one.
    const v = assess({ sourceTime: new Date('2026-07-25T00:00:00Z') });
    expect(v.accept === false && v.code).toBe('source_too_old');
  });

  it('tolerates a provider that reports no timestamp', () => {
    expect(assess({ sourceTime: null })).toEqual({ accept: true });
  });

  it('tolerates small clock skew', () => {
    expect(assess({ sourceTime: new Date('2026-07-20T06:35:00Z') })).toEqual({ accept: true });
  });
});

describe('derivePairs — cross rates from a USD-based feed', () => {
  const payload = {
    result: 'success',
    time_last_update_unix: Math.floor(FRESH.getTime() / 1000),
    rates: { TRY: 47.0, EUR: 0.92, GBP: 0.79, SAR: 3.75, AED: 3.67, USD: 1 },
  };

  it('produces every configured pair', () => {
    const out = derivePairs(payload);
    expect(out.map((r) => r.pair)).toEqual(FX_PAIRS.map((p) => p.pair));
  });

  it('quotes USD/TRY directly', () => {
    expect(derivePairs(payload).find((r) => r.pair === 'USD/TRY')?.value).toBe(47.0);
  });

  it('derives EUR/TRY as TRY ÷ EUR', () => {
    const eur = derivePairs(payload).find((r) => r.pair === 'EUR/TRY')?.value;
    expect(eur).toBeCloseTo(47.0 / 0.92, 6);
  });

  it('derives SAR/TRY as TRY ÷ SAR', () => {
    const sar = derivePairs(payload).find((r) => r.pair === 'SAR/TRY')?.value;
    expect(sar).toBeCloseTo(47.0 / 3.75, 6);
  });

  it('yields null — not Infinity — when a divisor is zero', () => {
    const out = derivePairs({ ...payload, rates: { ...payload.rates, EUR: 0 } });
    expect(out.find((r) => r.pair === 'EUR/TRY')?.value).toBeNull();
  });

  it('yields null for every pair when TRY is missing', () => {
    const out = derivePairs({ ...payload, rates: { EUR: 0.92 } });
    expect(out.every((r) => r.value === null)).toBe(true);
  });

  it('survives a completely empty payload', () => {
    expect(derivePairs({}).every((r) => r.value === null)).toBe(true);
  });

  it('feeds a null straight into a rejection rather than crashing', () => {
    const bad = derivePairs({}).find((r) => r.pair === 'USD/TRY')!;
    const v = assessRate({ pair: bad.pair, value: bad.value, previous: 47, sourceTime: null, now: NOW });
    expect(v.accept).toBe(false);
  });
});

describe('providerTime', () => {
  it('reads a unix seconds timestamp', () => {
    expect(providerTime({ time_last_update_unix: 1784527200 })?.toISOString()).toBe('2026-07-20T06:00:00.000Z');
  });

  it.each([[undefined], [0], [-5], ['nope'], [null]])('returns null for %s', (unix) => {
    expect(providerTime({ time_last_update_unix: unix })).toBeNull();
  });
});

describe('classifyRun — drives the fallback and alerting behaviour', () => {
  it('is success when every pair landed', () => {
    expect(classifyRun(5, 0)).toBe('success');
  });

  it('is partial when some pairs were rejected', () => {
    expect(classifyRun(3, 2)).toBe('partial');
  });

  it('is failed when nothing landed, so the last trusted rates stay live', () => {
    expect(classifyRun(0, 5)).toBe('failed');
  });

  it('is failed when the source itself was unreachable (nothing attempted)', () => {
    expect(classifyRun(0, 0)).toBe('failed');
  });
});

describe('istanbulLocalTime', () => {
  it('maps the 06:05 UTC schedule to 09:05 Istanbul', () => {
    expect(istanbulLocalTime(new Date('2026-07-20T06:05:00Z'))).toBe('09:05');
  });

  it('gives the same offset in January — Turkey has no DST since 2016', () => {
    // If this ever fails, Turkey reinstated DST and the cron needs revisiting.
    expect(istanbulLocalTime(new Date('2026-01-20T06:05:00Z'))).toBe('09:05');
  });
});

describe('hoursSince', () => {
  it('measures staleness of a stored rate', () => {
    expect(hoursSince('2026-07-20T00:05:00Z', NOW)).toBeCloseTo(6, 5);
  });

  it('returns null when never updated', () => {
    expect(hoursSince(null, NOW)).toBeNull();
  });

  it('returns null for an unparseable timestamp', () => {
    expect(hoursSince('not a date', NOW)).toBeNull();
  });
});

describe('MANUAL_ONLY_PAIRS', () => {
  it('lists USD/SYP, distinct from every synced pair', () => {
    expect(MANUAL_ONLY_PAIRS.map((p) => p.pair)).toEqual(['USD/SYP']);
    expect(FX_PAIRS.map((p) => p.pair)).not.toContain('USD/SYP');
  });
});
