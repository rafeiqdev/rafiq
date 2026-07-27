import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CLASS B — "correct RLS plus an unresolved session equals a silent,
 * error-free lie."
 *
 * An owner-scoped read fired before the session attaches returns [] with
 * HTTP 200. There is no error, so no catch runs and no error handling can
 * help: at the network layer it is indistinguishable from a user who
 * genuinely has nothing. Every screen happens to be gated today, but nothing
 * enforces that the gates stay, so the API layer itself must refuse to ask
 * the question before the session can answer it.
 *
 * These tests run each owner-scoped read with NO session present and require
 * a not_authenticated rejection — never a resolved [].
 */

let hasSession = true;

/** Emulates PostgREST under RLS with no JWT: success, zero rows, no error. */
function makeBuilder() {
  const rows = { data: [] as unknown[], error: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(rows),
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: () => makeBuilder(),
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: hasSession ? { user: { id: 'u1' } } : null } }),
    },
  },
  supabaseEnabled: true,
}));

import { bookings, leads, placeFavorites, documents } from './api';

beforeEach(() => {
  hasSession = false;
});

describe('owner-scoped reads with no session', () => {
  it('bookings.mine() rejects instead of resolving to []', async () => {
    await expect(bookings.mine()).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('leads.mine() rejects instead of resolving to []', async () => {
    await expect(leads.mine()).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('placeFavorites.list() rejects instead of resolving to []', async () => {
    await expect(placeFavorites.list()).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('documents.list() rejects instead of resolving to []', async () => {
    await expect(documents.list()).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});

describe('the same reads with a session behave normally', () => {
  beforeEach(() => {
    hasSession = true;
  });

  it('bookings.mine() resolves', async () => {
    await expect(bookings.mine()).resolves.toEqual([]);
  });

  it('leads.mine() resolves', async () => {
    await expect(leads.mine()).resolves.toEqual([]);
  });

  it('placeFavorites.list() resolves', async () => {
    await expect(placeFavorites.list()).resolves.toEqual([]);
  });

  it('documents.list() resolves', async () => {
    await expect(documents.list()).resolves.toEqual([]);
  });
});
