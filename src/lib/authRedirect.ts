/**
 * Where to send a user back to after signing in from an auth-gated route.
 *
 * Email/password sign-in stays on the same page load, so `from` travels via
 * router state. Google sign-in is a full-page redirect through Supabase — any
 * in-memory state is gone by the time the app remounts — so that path is
 * stashed here instead and picked up once the fresh session resolves.
 */
const KEY = 'rafiq_post_auth_redirect';

export function stashPostAuthRedirect(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* storage disabled — the user just lands on the default page instead */
  }
}

export function popPostAuthRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
