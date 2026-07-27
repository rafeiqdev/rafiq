/**
 * Client-side submission throttle for the service-request form.
 *
 * Honest framing: this is a UX guard, not security. It lives in the visitor's
 * own localStorage, so anyone who wants to bypass it can. Its job is to stop
 * accidental double-taps and casual repeat submissions — the database trigger
 * (trg_service_requests_rate_limit) is what actually enforces a limit.
 *
 * Deliberately set BELOW the server limit so a well-behaved browser is stopped
 * here, with a friendly explanation, rather than by a database exception.
 */

/** No second submission within a minute — catches the double-tap. */
export const SUBMIT_COOLDOWN_MS = 60_000;

/** Rolling window for the burst limit. */
export const SUBMIT_WINDOW_MS = 60 * 60_000;

/** At most this many inside SUBMIT_WINDOW_MS. */
export const SUBMIT_MAX_PER_WINDOW = 3;

const KEY = 'rafiq_sr_submits';

export interface ThrottleVerdict {
  allowed: boolean;
  /** Which rule stopped it — only set when allowed is false. */
  reason?: 'cooldown' | 'hourly';
  /** Milliseconds until the next submission would be accepted. 0 when allowed. */
  retryInMs: number;
}

/** Timestamps still inside the rolling window, oldest first. */
function readRecent(now: number): number[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      .filter((ts) => now - ts < SUBMIT_WINDOW_MS)
      .sort((a, b) => a - b);
  } catch {
    // Corrupt or unavailable storage must never block a genuine customer.
    return [];
  }
}

/** Would a submission right now be accepted? */
export function checkSubmitThrottle(now: number = Date.now()): ThrottleVerdict {
  const recent = readRecent(now);
  if (recent.length === 0) return { allowed: true, retryInMs: 0 };

  const last = recent[recent.length - 1];
  const sinceLast = now - last;
  if (sinceLast < SUBMIT_COOLDOWN_MS) {
    return { allowed: false, reason: 'cooldown', retryInMs: SUBMIT_COOLDOWN_MS - sinceLast };
  }

  if (recent.length >= SUBMIT_MAX_PER_WINDOW) {
    // The oldest one leaving the window is when a slot frees up.
    return { allowed: false, reason: 'hourly', retryInMs: SUBMIT_WINDOW_MS - (now - recent[0]) };
  }

  return { allowed: true, retryInMs: 0 };
}

/** Record an accepted submission. Called only after the insert succeeds. */
export function recordSubmit(now: number = Date.now()): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const next = [...readRecent(now), now];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — the server trigger still applies.
  }
}
