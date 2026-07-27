import { beforeEach, describe, expect, it } from 'vitest';

import {
  SUBMIT_COOLDOWN_MS,
  SUBMIT_MAX_PER_WINDOW,
  SUBMIT_WINDOW_MS,
  checkSubmitThrottle,
  recordSubmit,
} from './submitThrottle';

/**
 * S5 client half. A UX guard, not security — it lives in the visitor's own
 * localStorage. The property that matters most is that it never traps a
 * legitimate customer: every block must expire, and corrupt storage must fail
 * open rather than locking someone out of the form.
 */

const KEY = 'rafiq_sr_submits';
const T0 = Date.parse('2026-07-27T12:00:00Z');

beforeEach(() => {
  localStorage.clear();
});

describe('the 60-second cooldown', () => {
  it('allows the first submission', () => {
    expect(checkSubmitThrottle(T0)).toMatchObject({ allowed: true, retryInMs: 0 });
  });

  it('blocks an immediate second submission', () => {
    recordSubmit(T0);

    const v = checkSubmitThrottle(T0 + 1_000);

    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('cooldown');
    expect(v.retryInMs).toBe(SUBMIT_COOLDOWN_MS - 1_000);
  });

  it('allows a legitimate second submission once the window passes', () => {
    // The case that must not regress: a real customer with a second enquiry.
    recordSubmit(T0);

    expect(checkSubmitThrottle(T0 + SUBMIT_COOLDOWN_MS + 1).allowed).toBe(true);
  });

  it('reports a shrinking retry time as the cooldown elapses', () => {
    recordSubmit(T0);

    const early = checkSubmitThrottle(T0 + 10_000).retryInMs;
    const later = checkSubmitThrottle(T0 + 40_000).retryInMs;

    expect(later).toBeLessThan(early);
    expect(later).toBeGreaterThan(0);
  });
});

describe('the hourly burst limit', () => {
  it(`allows exactly ${SUBMIT_MAX_PER_WINDOW} inside the window`, () => {
    recordSubmit(T0);
    recordSubmit(T0 + 5 * 60_000);

    // Third is still fine, spaced past the cooldown.
    expect(checkSubmitThrottle(T0 + 10 * 60_000).allowed).toBe(true);
  });

  it('blocks the fourth, citing the hourly rule rather than the cooldown', () => {
    recordSubmit(T0);
    recordSubmit(T0 + 5 * 60_000);
    recordSubmit(T0 + 10 * 60_000);

    const v = checkSubmitThrottle(T0 + 20 * 60_000);

    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('hourly');
  });

  it('frees a slot as the oldest submission leaves the window', () => {
    recordSubmit(T0);
    recordSubmit(T0 + 5 * 60_000);
    recordSubmit(T0 + 10 * 60_000);

    // Just after the first one ages out of the rolling hour.
    expect(checkSubmitThrottle(T0 + SUBMIT_WINDOW_MS + 1).allowed).toBe(true);
  });

  it('points at when the oldest entry expires', () => {
    recordSubmit(T0);
    recordSubmit(T0 + 60_000);
    recordSubmit(T0 + 120_000);

    const v = checkSubmitThrottle(T0 + 180_000);

    expect(v.retryInMs).toBe(SUBMIT_WINDOW_MS - 180_000);
  });
});

describe('storage robustness — must never lock a real customer out', () => {
  it('fails open on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');

    expect(checkSubmitThrottle(T0).allowed).toBe(true);
  });

  it('fails open when the stored value is not an array', () => {
    localStorage.setItem(KEY, '"nope"');

    expect(checkSubmitThrottle(T0).allowed).toBe(true);
  });

  it('discards non-numeric entries rather than throwing', () => {
    localStorage.setItem(KEY, JSON.stringify(['x', null, T0]));

    expect(checkSubmitThrottle(T0 + 1_000)).toMatchObject({ allowed: false, reason: 'cooldown' });
  });

  it('prunes entries older than the window instead of growing forever', () => {
    localStorage.setItem(KEY, JSON.stringify([T0 - 10 * SUBMIT_WINDOW_MS, T0 - 5 * SUBMIT_WINDOW_MS]));

    recordSubmit(T0);

    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual([T0]);
  });
});
