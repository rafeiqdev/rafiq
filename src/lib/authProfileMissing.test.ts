import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * B1 regression suite — the silent auth lockout.
 *
 * `auth.me()` used to return `{ user: null }` both when there was no session
 * and when the session was valid but the profiles row was unreadable. The
 * second case produced an infinite, unexplained loop: signInWithPassword
 * succeeded, me() reported "guest", login() resolved WITHOUT throwing so no
 * error was ever displayed, the sign-in wall reappeared, and the user tried
 * again forever.
 *
 * The two cases must now be distinguishable by the caller.
 */

let sessionUserValue: { id: string; email: string } | null = null;
let profileRow: unknown = null;

vi.mock('./supabase', () => {
  const table = (name: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () =>
        Promise.resolve(name === 'profiles' ? { data: profileRow, error: null } : { data: null, error: null }),
      then: (r: (v: { data: unknown[]; error: null }) => unknown) => r({ data: [], error: null }),
    };
    return builder;
  };
  return {
    supabase: {
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: sessionUserValue ? { user: sessionUserValue } : null } }),
      },
      from: (name: string) => table(name),
    },
    supabaseEnabled: true,
  };
});

import { ApiError, auth } from './api';

beforeEach(() => {
  sessionUserValue = null;
  profileRow = null;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('auth.me() separates "no session" from "broken account"', () => {
  it('returns { user: null } when there is genuinely no session', async () => {
    sessionUserValue = null;

    await expect(auth.me()).resolves.toEqual({ user: null });
  });

  it('THROWS profile_missing when the session is valid but the profile is unreadable', async () => {
    // The exact shape of the old dead end: valid session, no profile row.
    sessionUserValue = { id: 'u-123', email: 'someone@example.com' };
    profileRow = null;

    await expect(auth.me()).rejects.toMatchObject({ code: 'profile_missing', status: 409 });
  });

  it('throws an ApiError, so callers can map it to a message', async () => {
    sessionUserValue = { id: 'u-123', email: 'someone@example.com' };

    await expect(auth.me()).rejects.toBeInstanceOf(ApiError);
  });

  it('does NOT resolve — a silent success is what caused the retry loop', async () => {
    sessionUserValue = { id: 'u-123', email: 'someone@example.com' };

    const outcome = await auth.me().then(
      () => 'resolved',
      () => 'rejected',
    );

    expect(outcome).toBe('rejected');
  });

  it('logs the uid and both candidate causes for debugging', async () => {
    // RLS denial and a genuinely absent row are indistinguishable from the
    // client (PostgREST reports an RLS-filtered row as an empty result, not an
    // error), so the log has to name both and hand over the uid.
    sessionUserValue = { id: 'u-abc-999', email: 'x@y.z' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await auth.me().catch(() => {});

    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain('u-abc-999');
    expect(msg).toContain('pg_policies');
    expect(msg).toContain('handle_new_user');
  });
});
