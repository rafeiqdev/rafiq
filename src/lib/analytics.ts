/**
 * Event-tracking client — batches to public.events (see the
 * 20260727_events_tracking.sql migration for schema, RLS and taxonomy docs).
 *
 * Hard rules, enforced here (see analytics.test.ts):
 *  - track() never throws and never awaits anything the caller can see —
 *    every call site fires-and-forgets.
 *  - Nothing is collected before explicit consent (getConsent() === 'granted'),
 *    not even page_view, and nothing is collected at all when the browser
 *    sends Do Not Track.
 *  - `target` and every value in `meta` are screened for anything shaped like
 *    an email or a phone number and the WHOLE event is dropped if one is
 *    found. meta must hold identifiers/enums only (flat, no nested
 *    objects/arrays) — never a phone number, email, password, AI chat
 *    message, document content, or any other free text the user typed.
 *  - ONE documented exception: search_performed's meta.query carries the
 *    visitor's own search text (normalizeSearchQuery() below), because a
 *    length integer told the business nothing about unmet demand. It still
 *    goes through the same email/phone screen as everything else, but a
 *    screen built for structured fields can't catch a name, an address, or a
 *    sensitive topic typed into a search box — this is a real, accepted
 *    residual privacy risk on a site whose catalog includes health and
 *    immigration services, not an oversight. See the migration's taxonomy
 *    comment for search_performed.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from './supabase';

export type AnalyticsEventType =
  | 'page_view'
  | 'service_view'
  | 'service_click'
  | 'request_started'
  | 'request_submitted'
  | 'chat_opened'
  | 'chat_message_sent'
  | 'login'
  | 'signup'
  | 'checkout_opened'
  | 'payment_submitted'
  | 'whatsapp_clicked'
  | 'lang_changed'
  | 'guide_viewed'
  | 'search_performed'
  | 'paywall_shown'
  | 'upgrade_clicked';

type MetaValue = string | number | boolean | null;
export interface TrackOptions {
  target?: string | null;
  meta?: Record<string, MetaValue>;
}

interface QueuedEvent {
  event_type: AnalyticsEventType;
  path: string;
  target: string | null;
  meta: Record<string, MetaValue> | null;
  locale: string;
  device: 'mobile' | 'desktop';
  referrer: string | null;
  session_id: string;
  user_id: string | null;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const SESSION_KEY = 'rafiq_analytics_sid';
const CONSENT_KEY = 'rafiq_analytics_consent';
/** Exported for tests — not meant to be tuned from call sites. */
export const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 20;

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let memorySessionId: string | null = null;
let currentUserId: string | null = null;
let cachedReferrerOrigin: string | null | undefined; // undefined = not computed yet

// ── consent ───────────────────────────────────────────────────────────────

export type ConsentState = 'granted' | 'declined' | null;

/** null = not yet decided. The banner must show until this is set. */
export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(state: 'granted' | 'declined'): void {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* storage unavailable — the in-memory guard below still applies this session */
  }
  if (state !== 'granted') {
    // Declining clears anything already queued this page load — none of it
    // was sent (track() already refused to enqueue without consent), but a
    // late queue from before a prior "granted" -> "declined" flip must not
    // linger either.
    queue = [];
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
}

function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const w = window as unknown as { doNotTrack?: string };
  return navigator.doNotTrack === '1' || w.doNotTrack === '1' || (navigator as { msDoNotTrack?: string }).msDoNotTrack === '1';
}

// ── session id ────────────────────────────────────────────────────────────

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = newId();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    // Privacy mode or storage disabled — still tag every event THIS page load
    // with one consistent id rather than a fresh one per call.
    if (!memorySessionId) memorySessionId = newId();
    return memorySessionId;
  }
}

/** Called by AppContext whenever the signed-in user changes (including sign-out -> null). */
export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
}

// ── context helpers ──────────────────────────────────────────────────────

function currentLocale(): string {
  return (typeof document !== 'undefined' && document.documentElement.lang) || 'ar';
}

function detectDevice(): 'mobile' | 'desktop' {
  try {
    return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

function safePath(): string {
  // pathname only — NEVER location.search, which can carry a free-text query
  // (e.g. /services?q=...) the user typed themselves.
  try {
    return window.location.pathname || '/';
  } catch {
    return '/';
  }
}

/** Origin only, computed once per session — never the full referring URL (see migration comment). */
function referrerOrigin(): string | null {
  if (cachedReferrerOrigin !== undefined) return cachedReferrerOrigin;
  try {
    cachedReferrerOrigin = document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    cachedReferrerOrigin = null;
  }
  return cachedReferrerOrigin;
}

const MAX_QUERY_LEN = 100;

/**
 * search_performed's meta.query — call this before track(), not after. Caps
 * length so a pasted essay can't inflate the row, and normalises case/spacing
 * so "Residency  Permit" and "residency permit" roll up as the same demand
 * signal rather than two.
 */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_QUERY_LEN);
}

// ── PII guard ─────────────────────────────────────────────────────────────

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Deliberately conservative: flags any string that is ENTIRELY digits and
 * phone punctuation (7-15 digits once separators are stripped). A false
 * positive just drops one event silently — a leaked phone number does not.
 * Callers must not put raw dates/amounts as bare digit strings in meta; use
 * enums or numbers with named keys instead (e.g. { query_len: 12 }).
 */
function looksLikePhone(value: string): boolean {
  const v = value.trim();
  if (!v || !/^[\d\s()+\-.]+$/.test(v)) return false;
  const digits = v.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function looksLikePii(value: string): boolean {
  return EMAIL_RE.test(value) || looksLikePhone(value);
}

/** Returns false (reject the whole event) if target or any meta value is unsafe. */
function isSafePayload(target: string | null, meta: Record<string, MetaValue> | null): boolean {
  if (target && looksLikePii(target)) return false;
  if (!meta) return true;
  for (const v of Object.values(meta)) {
    if (v !== null && typeof v === 'object') return false; // flat identifiers/enums only
    if (typeof v === 'string' && looksLikePii(v)) return false;
  }
  return true;
}

// ── queue + flush ─────────────────────────────────────────────────────────

function endpointUrl(): string | null {
  return SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/events` : null;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush('interval');
  }, FLUSH_INTERVAL_MS);
}

function enqueue(row: QueuedEvent): void {
  queue.push(row);
  if (queue.length >= MAX_BATCH) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush('interval');
  } else {
    scheduleFlush();
  }
}

async function sessionToken(): Promise<string> {
  try {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? ANON_KEY ?? '';
  } catch {
    return ANON_KEY ?? '';
  }
}

/**
 * `reason: 'unload'` is the pagehide/visibilitychange path: it tries
 * sendBeacon first (fire-and-forget, survives the page going away), falling
 * back to fetch(keepalive) if sendBeacon is unavailable or refuses the send.
 *
 * sendBeacon cannot carry the Authorization header a signed-in user's events
 * need for the `user_id = auth.uid()` RLS check to pass (only apikey can ride
 * along, as a query param), so any user_id on this final batch is stripped —
 * those events land as anonymous rather than being dropped. They stay
 * correlatable to the rest of the visit via session_id, which every earlier
 * event in the same session already carries with the real user_id attached.
 */
/** Exported for tests, so "flush on hide" can be exercised without relying on
 *  real pagehide/visibilitychange DOM events (which, across a test file's many
 *  module reloads, would pile up stale listeners on jsdom's single shared
 *  window). Call sites should not call this directly — track() schedules it. */
export async function flush(reason: 'interval' | 'unload'): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const url = endpointUrl();
  if (!url || !ANON_KEY) return; // Supabase not configured — drop silently

  if (reason === 'unload' && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const anonRows = batch.map((r) => ({ ...r, user_id: null }));
      const blob = new Blob([JSON.stringify(anonRows)], { type: 'application/json' });
      if (navigator.sendBeacon(`${url}?apikey=${encodeURIComponent(ANON_KEY)}`, blob)) return;
    } catch {
      /* fall through to fetch */
    }
  }

  try {
    const token = await sessionToken();
    await fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
  } catch {
    /* best-effort — a lost analytics batch must never surface to the user */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush('unload'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush('unload');
  });
}

// ── public API ────────────────────────────────────────────────────────────

export function track(eventType: AnalyticsEventType, opts: TrackOptions = {}): void {
  try {
    if (typeof window === 'undefined') return;
    if (isDoNotTrackEnabled()) return;
    if (getConsent() !== 'granted') return;

    const target = opts.target ?? null;
    const meta = opts.meta ?? null;
    if (!isSafePayload(target, meta)) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] dropped event — payload looked like PII or was not flat', eventType);
      }
      return;
    }

    enqueue({
      event_type: eventType,
      path: safePath(),
      target,
      meta,
      locale: currentLocale(),
      device: detectDevice(),
      referrer: referrerOrigin(),
      session_id: getSessionId(),
      user_id: currentUserId,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* never let analytics break the UI */
  }
}

/** Call once near the root (inside <Layout>, which wraps every routed page —
 *  desktop and the mobile variants alike) to auto-capture page_view on every
 *  route change. */
export function useTrackPageViews(): void {
  const location = useLocation();
  useEffect(() => {
    track('page_view');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
