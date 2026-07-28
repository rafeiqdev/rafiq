import { describe, expect, it } from 'vitest';
import {
  FREE_TOPICS_PER_DAY,
  QUOTA_WINDOW_MS,
  activeStarts,
  formatCountdown,
  quotaFrom,
} from './aiQuota';

const NOW = 1_800_000_000_000; // fixed clock
const HOUR = 60 * 60 * 1000;

describe('free topic quota', () => {
  it('allows exactly 3 topics per rolling 24h', () => {
    expect(FREE_TOPICS_PER_DAY).toBe(3);
    const two = quotaFrom([NOW - HOUR, NOW - 2 * HOUR], NOW);
    expect(two.used).toBe(2);
    expect(two.remaining).toBe(1);
    expect(two.limitReached).toBe(false);

    const three = quotaFrom([NOW - HOUR, NOW - 2 * HOUR, NOW - 3 * HOUR], NOW);
    expect(three.used).toBe(3);
    expect(three.remaining).toBe(0);
    expect(three.limitReached).toBe(true);
  });

  it('never reports negative remaining even if extra topics slipped in', () => {
    const q = quotaFrom([NOW, NOW, NOW, NOW, NOW], NOW);
    expect(q.remaining).toBe(0);
    expect(q.limitReached).toBe(true);
  });

  it('frees a slot once the oldest topic leaves the 24h window', () => {
    const expired = NOW - QUOTA_WINDOW_MS - 1000; // older than 24h
    const q = quotaFrom([expired, NOW - HOUR, NOW - 2 * HOUR], NOW);
    expect(q.used).toBe(2); // the expired one no longer counts
    expect(q.limitReached).toBe(false);
  });

  it('counts down to 24h after the OLDEST topic in the window', () => {
    const oldest = NOW - 10 * HOUR;
    const q = quotaFrom([oldest, NOW - HOUR, NOW - 2 * HOUR], NOW);
    expect(q.limitReached).toBe(true);
    expect(q.resetAt).toBe(oldest + QUOTA_WINDOW_MS);
    expect(q.msUntilReset).toBe(14 * HOUR); // 24h - 10h
  });

  it('reports no countdown while under the limit', () => {
    const q = quotaFrom([NOW - HOUR], NOW);
    expect(q.resetAt).toBeNull();
    expect(q.msUntilReset).toBe(0);
  });

  it('an empty history is a full allowance (never NaN)', () => {
    const q = quotaFrom([], NOW);
    expect(q).toMatchObject({ used: 0, remaining: 3, limitReached: false, msUntilReset: 0 });
    expect(Number.isNaN(q.remaining)).toBe(false);
  });
});

describe('stored history parsing', () => {
  it('drops expired entries and non-numeric junk', () => {
    const raw = [NOW - HOUR, 'oops', null, NOW - QUOTA_WINDOW_MS - 1, NaN, NOW - 2 * HOUR];
    expect(activeStarts(raw, NOW)).toEqual([NOW - 2 * HOUR, NOW - HOUR]);
  });

  it('tolerates a corrupted value instead of throwing', () => {
    expect(activeStarts(null, NOW)).toEqual([]);
    expect(activeStarts('not-an-array', NOW)).toEqual([]);
    expect(activeStarts({}, NOW)).toEqual([]);
  });
});

describe('countdown formatting', () => {
  it('renders HH:MM:SS zero-padded', () => {
    expect(formatCountdown(14 * HOUR)).toBe('14:00');
    // partial minutes round UP — the timer must never understate the wait
    expect(formatCountdown(9 * 60 * 1000 + 7 * 1000)).toBe('00:10');
    expect(formatCountdown(23 * HOUR + 59 * 60 * 1000 + 59 * 1000)).toBe('24:00');
  });

  it('never shows a negative timer', () => {
    expect(formatCountdown(-5000)).toBe('00:00');
    expect(formatCountdown(0)).toBe('00:00');
  });
});
