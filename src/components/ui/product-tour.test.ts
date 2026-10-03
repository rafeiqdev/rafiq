import { describe, expect, it } from 'vitest';
import { clampSpot, veilPath } from './product-tour';

const VP = { w: 375, h: 812 };

describe('clampSpot', () => {
  it('pads a small target and leaves it where it is', () => {
    expect(clampSpot({ top: 100, left: 50, width: 40, height: 40 }, 6, VP)).toEqual({
      top: 94,
      left: 44,
      width: 52,
      height: 52,
    });
  });

  it('caps a tall target (a whole list) at 45% of the screen so the veil still shows', () => {
    const s = clampSpot({ top: 200, left: 0, width: 375, height: 4000 }, 6, VP);
    expect(s.top).toBe(194);
    expect(s.height).toBe(Math.round(812 * 0.45));
    expect(s.width).toBeLessThan(375);
  });

  it('keeps the hole inside the screen when the target sticks out of it', () => {
    const s = clampSpot({ top: -50, left: -10, width: 120, height: 120 }, 8, VP);
    expect(s.top).toBeGreaterThanOrEqual(8);
    expect(s.left).toBeGreaterThanOrEqual(4);
    expect(s.top + s.height).toBeLessThanOrEqual(812 - 8);
  });
});

describe('veilPath', () => {
  it('is a plain full-screen veil when there is no hole', () => {
    expect(veilPath(187, 406, 0, 0, 375, 812)).toBe('path(evenodd, "M0,0 H375 V812 H0 Z")');
  });

  it('cuts a rounded hole with the even-odd rule', () => {
    const p = veilPath(10, 20, 100, 50, 375, 812);
    expect(p.startsWith('path(evenodd, "M0,0 H375 V812 H0 Z M24,20')).toBe(true);
    expect(p).toContain('A14,14');
  });

  it('never uses a corner radius larger than half the hole', () => {
    expect(veilPath(0, 0, 10, 10, 375, 812)).toContain('A5,5');
  });
});
