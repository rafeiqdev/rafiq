import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { businessAddDays, businessDateParts, businessStartOfDayForYMD, businessStartOfDayUTC } from './timezone';

/**
 * Istanbul has run a fixed UTC+3 offset (no DST) since 2016, so every boundary
 * below has one unambiguous expected UTC instant. The real thing under test is
 * that these functions ignore the machine's own timezone entirely — proven by
 * flipping process.env.TZ mid-test and asserting the output does not move.
 */
const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('businessStartOfDayUTC', () => {
  it('returns Istanbul midnight (21:00 UTC the previous day) for an afternoon instant', () => {
    const d = new Date('2026-08-17T14:30:00.000Z'); // 17:30 Istanbul time
    expect(businessStartOfDayUTC(d).toISOString()).toBe('2026-08-16T21:00:00.000Z');
  });

  it('a row 1ms before Istanbul midnight belongs to the earlier business day', () => {
    const justBefore = new Date('2026-08-16T20:59:59.999Z'); // 23:59:59.999 Istanbul, Aug 16
    expect(businessStartOfDayUTC(justBefore).toISOString()).toBe('2026-08-15T21:00:00.000Z'); // Aug 16 00:00 Istanbul
  });

  it('a row exactly at Istanbul midnight belongs to the new business day', () => {
    const exactly = new Date('2026-08-16T21:00:00.000Z'); // 00:00:00.000 Istanbul, Aug 17
    expect(businessStartOfDayUTC(exactly).toISOString()).toBe('2026-08-16T21:00:00.000Z');
  });

  it('does not depend on the machine timezone', () => {
    const d = new Date('2026-08-17T14:30:00.000Z');
    const results = new Set<string>();
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Istanbul']) {
      process.env.TZ = tz;
      results.add(businessStartOfDayUTC(d).toISOString());
    }
    expect(results.size).toBe(1);
    expect([...results][0]).toBe('2026-08-16T21:00:00.000Z');
  });
});

describe('businessDateParts', () => {
  it('reads the Istanbul calendar date, not the UTC one', () => {
    // 2026-08-16T22:00:00Z is 2026-08-17 01:00 in Istanbul (UTC+3).
    const parts = businessDateParts(new Date('2026-08-16T22:00:00.000Z'));
    expect(parts).toEqual({ year: 2026, month: 8, day: 17 });
  });
});

describe('businessStartOfDayForYMD', () => {
  it('builds the Istanbul-midnight instant for an explicit calendar date', () => {
    expect(businessStartOfDayForYMD(2026, 1, 1).toISOString()).toBe('2025-12-31T21:00:00.000Z');
  });
});

describe('businessAddDays', () => {
  it('rolls the month/year correctly across a calendar boundary', () => {
    const lastDayOfJuly = businessStartOfDayForYMD(2026, 7, 31);
    expect(businessAddDays(lastDayOfJuly, 1).toISOString()).toBe('2026-07-31T21:00:00.000Z'); // Aug 1 midnight Istanbul
  });

  it('is symmetric: +n then -n returns to the same instant', () => {
    const start = businessStartOfDayForYMD(2026, 8, 17);
    const roundTrip = businessAddDays(businessAddDays(start, 45), -45);
    expect(roundTrip.getTime()).toBe(start.getTime());
  });
});
