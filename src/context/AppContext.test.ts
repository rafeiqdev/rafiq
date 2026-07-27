import { describe, expect, it } from 'vitest';
import { isFreshAccount } from './AppContext';

/**
 * The one piece of judgement behind distinguishing a Google signup from a
 * Google login post-redirect: is the profile row's created_at recent enough
 * that this account was plausibly just created by handle_new_user(), rather
 * than an existing account signing back in.
 */
describe('isFreshAccount', () => {
  const now = Date.parse('2026-07-27T12:00:00Z');

  it('treats an account created moments ago as fresh (signup)', () => {
    expect(isFreshAccount(new Date(now - 2_000).toISOString(), now)).toBe(true);
  });

  it('treats an account created well in the past as not fresh (login)', () => {
    expect(isFreshAccount(new Date(now - 365 * 24 * 60 * 60_000).toISOString(), now)).toBe(false);
  });

  it('treats an account just past the window as not fresh', () => {
    expect(isFreshAccount(new Date(now - (2 * 60_000 + 1)).toISOString(), now)).toBe(false);
  });

  it('treats an account just inside the window as fresh', () => {
    expect(isFreshAccount(new Date(now - (2 * 60_000 - 1_000)).toISOString(), now)).toBe(true);
  });
});
