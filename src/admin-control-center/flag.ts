/**
 * Feature flag for the Admin Control Center (additive surface beside /admin).
 *
 * The Control Center is ON by default: the owner asked for it to be visible.
 * The flag is therefore a KILL-SWITCH, not an opt-in:
 *
 *   1. Build-time env `VITE_ADMIN_CONTROL_CENTER_ENABLED = "false"` turns it OFF
 *      everywhere on the next deploy — the route stops being registered, the
 *      sidebar link disappears, and the app behaves exactly as it did before
 *      this feature existed. No code change needed.
 *   2. Per-browser `localStorage.rafiq_cc_enabled = "false"` turns it off for one
 *      browser instantly (handy to compare against the old behavior without a
 *      redeploy). `"true"` forces it on even if the env var disabled it.
 *
 * Being "on" grants no new data access on its own: the page sits behind the same
 * RequireAdmin gate as /admin, and every query underneath is is_admin()-scoped
 * by Postgres RLS.
 */
export const CONTROL_CENTER_FLAG_KEY = 'rafiq_cc_enabled';

/** undefined/'' = not configured (stay on). Only the exact string 'false' disables. */
function envSetting(): string | undefined {
  try {
    return import.meta.env.VITE_ADMIN_CONTROL_CENTER_ENABLED as string | undefined;
  } catch {
    return undefined;
  }
}

function localSetting(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(CONTROL_CENTER_FLAG_KEY) : null;
  } catch {
    return null;
  }
}

export function isControlCenterEnabled(): boolean {
  // The per-browser override wins in both directions, so the surface can be
  // toggled for a single session without waiting for a deploy.
  const local = localSetting();
  if (local === 'false') return false;
  if (local === 'true') return true;
  return envSetting() !== 'false';
}
