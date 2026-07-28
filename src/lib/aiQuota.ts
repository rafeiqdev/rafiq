/**
 * Free-tier quota for the AI assistant.
 *
 * Model: a user WITHOUT a paid plan may open a limited number of *topics*
 * (conversations) per rolling 24 hours. Inside a topic the conversation is
 * unlimited — only opening a NEW topic consumes quota.
 *
 * NOTE: this is enforced in the browser (localStorage) because the database has
 * no ai_usage table yet. It is a fair-use guard, not a security boundary — a
 * determined user can clear storage. Move the counter into Postgres (owner-only
 * RLS + a SECURITY DEFINER consume RPC) when the schema is in place.
 */

export const FREE_TOPICS_PER_DAY = 3;
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface QuotaState {
  /** topics opened inside the rolling window */
  used: number;
  remaining: number;
  limitReached: boolean;
  /** when the oldest topic leaves the window (i.e. one slot frees up) */
  resetAt: number | null;
  msUntilReset: number;
}

export function topicsKey(userId: string): string {
  return `rafiq_ai_topics_${userId}`;
}

/** Parse stored timestamps, dropping anything outside the rolling window. */
export function activeStarts(raw: unknown, now: number): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .filter((ts) => now - ts < QUOTA_WINDOW_MS)
    .sort((a, b) => a - b);
}

export function quotaFrom(starts: number[], now: number, limit = FREE_TOPICS_PER_DAY): QuotaState {
  const active = starts.filter((ts) => now - ts < QUOTA_WINDOW_MS).sort((a, b) => a - b);
  const used = active.length;
  const remaining = Math.max(0, limit - used);
  const limitReached = used >= limit;
  // the first slot frees up exactly 24h after the OLDEST topic in the window
  const resetAt = limitReached && active.length > 0 ? active[0] + QUOTA_WINDOW_MS : null;
  return {
    used,
    remaining,
    limitReached,
    resetAt,
    msUntilReset: resetAt ? Math.max(0, resetAt - now) : 0,
  };
}

/** Read the user's topic starts from localStorage (never throws). */
export function readTopicStarts(userId: string, now: number): number[] {
  try {
    return activeStarts(JSON.parse(localStorage.getItem(topicsKey(userId)) ?? '[]'), now);
  } catch {
    return [];
  }
}

/** Record a newly opened topic and return the resulting quota. */
export function recordTopicStart(userId: string, now: number, limit = FREE_TOPICS_PER_DAY): QuotaState {
  const starts = [...readTopicStarts(userId, now), now];
  try {
    localStorage.setItem(topicsKey(userId), JSON.stringify(starts));
  } catch {
    /* storage full / disabled — quota simply won't persist */
  }
  return quotaFrom(starts, now, limit);
}

/** The subject the current conversation is about (survives a page reload). */
export function subjectKey(userId: string): string {
  return `rafiq_ai_subject_${userId}`;
}

export function readSubject(userId: string): string | null {
  try {
    return localStorage.getItem(subjectKey(userId)) || null;
  } catch {
    return null;
  }
}

export function saveSubject(userId: string, subject: string | null): void {
  try {
    if (subject) localStorage.setItem(subjectKey(userId), subject);
    else localStorage.removeItem(subjectKey(userId));
  } catch {
    /* storage disabled */
  }
}

/** "23:59:07" — always two digits, never negative. */
/**
 * HH:MM, rounded UP so it never claims 00:00 while the limit still holds.
 * Minute precision is deliberate: the wait is hours long, and the seconds
 * digit forced the whole chat page to re-render every second just to tick.
 */
export function formatCountdown(msLeft: number): string {
  const totalMinutes = Math.max(0, Math.ceil(msLeft / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}
