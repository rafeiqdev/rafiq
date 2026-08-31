import { describe, expect, it } from 'vitest';
import { nextAvailableSlot } from './scheduling';

describe('nextAvailableSlot', () => {
  it('offers later today when the slot hour has not passed yet', () => {
    const now = new Date(2026, 7, 31, 9, 0, 0); // Monday 2026-08-31, 09:00
    const slot = nextAvailableSlot(now);
    expect(slot.getDate()).toBe(31);
    expect(slot.getHours()).toBe(10);
  });

  it('rolls to tomorrow once the slot hour has passed', () => {
    const now = new Date(2026, 7, 31, 15, 0, 0); // Monday 2026-08-31, 15:00
    const slot = nextAvailableSlot(now);
    expect(slot.getDate()).toBe(1);
    expect(slot.getMonth()).toBe(8);
    expect(slot.getHours()).toBe(10);
  });

  it('skips the weekend (Saturday/Sunday)', () => {
    const fridayAfternoon = new Date(2026, 8, 4, 15, 0, 0); // Friday 2026-09-04, 15:00
    const slot = nextAvailableSlot(fridayAfternoon);
    // next business day should be Monday 2026-09-07
    expect(slot.getDay()).not.toBe(0);
    expect(slot.getDay()).not.toBe(6);
    expect(slot.getDate()).toBe(7);
  });

  it('never returns a slot in the past', () => {
    const now = new Date();
    expect(nextAvailableSlot(now).getTime()).toBeGreaterThan(now.getTime());
  });
});
