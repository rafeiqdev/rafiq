/**
 * Event-tracking client — batches to public.events (see the
 * 20260727_events_tracking.sql migration for schema, RLS and taxonomy docs,
 * and 20260909_events_country.sql for the country column).
 *
 * Hard rules, enforced here (see analytics.test.ts):
 *  - track() never throws and never awaits anything the caller can see —
 *    every call site fires-and-forgets.
 *  - Nothing is collected before explicit consent (getConsent() === 'granted'),
 *    not even page_view, and nothing is collected at all when the browser
 *    sends Do Not Track. That includes the country lookup below, which is a
 *    network request and therefore does not happen either.
 *  - The visitor's country is a two-letter code resolved at the CDN edge
 *    (api/geo.ts). No IP address is ever received by this module, sent to the
 *    events table, or stored anywhere; an unresolved country is recorded as
 *    unknown rather than inferred from the locale or timezone.
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

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    rafiqGoogleAnalytics?: {
      setConsent: (state: 'granted' | 'declined') => void;
    };
    rafiqMetaPixel?: {
      setConsent: (state: 'granted' | 'declined') => void;
    };
  }
}

export type AnalyticsEventType =
  | 'page_view'
  | 'service_view'
  | 'guide_viewed'
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
const COUNTRY_KEY = 'rafiq_analytics_country';
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
  const previous = getConsent();
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* storage unavailable — the in-memory guard below still applies this session */
  }

  // The Google tag itself is loaded only after a visitor grants analytics
  // consent. This keeps the site's GA4 collection aligned with the banner,
  // rather than letting an unconditional page tag measure visitors first.
  try {
    window.rafiqGoogleAnalytics?.setConsent(state);
  } catch {
    /* Google Analytics must never affect the product experience. */
  }

  // Same contract for the Meta pixel: the ad platform learns nothing about a
  // visitor who has not agreed. Unlike GA4 there is no consent-update call to
  // fall back on, so index.html simply never fetches fbevents.js on 'declined'.
  try {
    window.rafiqMetaPixel?.setConsent(state);
  } catch {
    /* Ad measurement must never affect the product experience. */
  }

  if (state === 'granted' && previous !== 'granted') {
    sendGooglePageView();
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

/**
 * Fired when the visitor asks to revisit their cookie choice, so the banner can
 * come back from anywhere on the site (the footer link is nowhere near it in
 * the tree, and a shared store for one boolean would be heavier than an event).
 */
export const CONSENT_REOPEN_EVENT = 'rafiq:consent-reopen';

/**
 * Puts the choice back in front of the visitor. Clearing the stored answer is
 * what actually stops collection: track() refuses to enqueue while the answer
 * is null, and the ad pixel is asked to stand down too.
 *
 * NOTE the one thing this cannot do — once fbevents.js has been fetched there
 * is no call that unloads it, so a visitor switching from "accept" to
 * "decline" is given a fresh page load by ConsentBanner rather than a promise
 * we cannot keep.
 */
export function reopenConsentChoice(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* storage unavailable — the banner still reopens for this page load */
  }
  try {
    window.rafiqGoogleAnalytics?.setConsent('declined');
  } catch {
    /* analytics must never affect the product experience */
  }
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT));
  } catch {
    /* nothing to do — the next page load shows the banner anyway */
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

// ── visitor country ───────────────────────────────────────────────────────
//
// The browser cannot name its own country without a location prompt or handing
// the visitor's IP to a third party. api/geo.ts reads it off the CDN edge
// (which already resolved it for this very request) and returns ONLY the
// two-letter code — no IP is returned, logged or stored, here or in the events
// table.
//
// Resolved once per session and cached in sessionStorage: one extra request per
// visit, not one per event. Never resolved before consent — track() is what
// kicks it off.

/** '' in the cache means "we asked and the answer was unknown" — do not re-ask. */
let countryValue: string | null = null;
let countryLookup: Promise<void> | null = null;

/**
 * Set once an insert is rejected specifically because `events.country` does not
 * exist — i.e. the 20260909 migration has not been pasted into the SQL Editor
 * yet. Migrations here are applied by hand, so the deploy and the column can
 * legitimately be days apart in either order, and collection must not break in
 * the gap. Module state, not persisted: it re-tests itself on the next page
 * load, so applying the migration starts filling the column with no redeploy.
 */
let countryColumnMissing = false;

/**
 * Set after an insert carrying `country` is accepted. Until then the unload
 * path (sendBeacon, whose response we can never read) omits the country, so a
 * batch sent before we know the column exists can't be silently rejected in
 * full. Losing a country is nothing; losing a visit is not.
 */
let countryConfirmed = false;

function cachedCountry(): string | null | undefined {
  try {
    const v = sessionStorage.getItem(COUNTRY_KEY);
    if (v === null) return undefined; // never asked
    return v === '' ? null : v;
  } catch {
    return undefined;
  }
}

function rememberCountry(code: string | null): void {
  countryValue = code;
  try {
    sessionStorage.setItem(COUNTRY_KEY, code ?? '');
  } catch {
    /* private mode — the in-memory value still serves this page load */
  }
}

/** Fire-and-forget; at most one lookup per page load. Never throws. */
function ensureCountry(): void {
  if (countryLookup) return;
  const cached = cachedCountry();
  if (cached !== undefined) {
    countryValue = cached;
    countryLookup = Promise.resolve();
    return;
  }
  countryLookup = (async () => {
    try {
      const res = await fetch('/api/geo', { headers: { accept: 'application/json' } });
      const body = (await res.json()) as { country?: unknown };
      const code = typeof body.country === 'string' && /^[A-Z]{2}$/.test(body.country) ? body.country : null;
      rememberCountry(code);
    } catch {
      // No edge (local dev), offline, or a non-JSON response. "Unknown" is a
      // legitimate answer; it is never guessed from the locale or timezone,
      // which say where a device is CONFIGURED, not where it is.
      rememberCountry(null);
    }
  })();
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

/**
 * Keep AI attribution intentionally narrow and non-identifying. We never send
 * the full URL, query string, or referring page; only a fixed source label.
 */
function aiReferralSource(): 'chatgpt.com' | null {
  try {
    const utmSource = new URLSearchParams(window.location.search).get('utm_source')?.trim().toLowerCase();
    if (utmSource === 'chatgpt.com') return 'chatgpt.com';

    const hostname = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
    if (hostname === 'chatgpt.com' || hostname.endsWith('.chatgpt.com') || hostname === 'chatgpt.site' || hostname.endsWith('.chatgpt.site')) {
      return 'chatgpt.com';
    }
  } catch {
    /* Attribution is optional and must never affect the page. */
  }
  return null;
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
 * so "Residency Permit" and "residency permit" roll up as the same demand
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

// ── campaign attribution (UTM) ────────────────────────────────────────────
//
// Paid traffic arrives with ?utm_source=... on the LANDING url only. The
// instant the visitor taps anything, react-router rewrites the address bar and
// the campaign that paid for the visit is gone — so a request submitted three
// screens later can no longer be traced to the ad that produced it. The five
// parameters are therefore read once, kept for the rest of the visit, and
// stamped onto the events that represent commercial intent.
//
// These are OUR labels (we name the campaigns), never anything the visitor
// typed, and they pass the same PII screen as every other field: lowercased,
// capped at 60 characters, and rejected outright if they contain anything but
// slug punctuation. Nothing from a UTM parameter is ever forwarded to Meta —
// the ad platform attributes its own clicks; this is for our own reporting.
//
// Held in memory always (a route change must not lose it) but mirrored into
// sessionStorage only once consent is granted: persisting an advertising
// identifier for a visitor who declined is exactly what the banner promises
// not to do.

const ATTRIBUTION_KEY = 'rafiq_attribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Attribution = Partial<Record<UtmKey, string>>;
const MAX_UTM_LEN = 60;

let attribution: Attribution | null = null;
let attributionHydrated = false;
let attributionPersisted = false;

/** null = not a value we are willing to store, let alone report on. */
export function sanitizeUtmValue(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, MAX_UTM_LEN);
  if (!v) return null;
  if (!/^[a-z0-9._~+|-]+$/.test(v)) return null; // slug punctuation only — not free text
  if (looksLikePii(v)) return null;
  return v;
}

function persistAttribution(value: Attribution): void {
  if (getConsent() !== 'granted') return;
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
    attributionPersisted = true;
  } catch {
    /* private mode — the in-memory copy still serves this page load */
  }
}

/**
 * Reads the current URL's UTM parameters, keeping the LAST campaign seen: a
 * second ad click inside one visit is a new touch, not a duplicate of the
 * first. Safe to call on every route change — a URL with no utm_* parameters
 * leaves the stored set untouched, which is the whole point.
 */
export function captureAttribution(): Attribution {
  if (!attributionHydrated) {
    attributionHydrated = true;
    try {
      const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      if (parsed) {
        const restored: Attribution = {};
        for (const key of UTM_KEYS) {
          const value = parsed[key];
          const clean = typeof value === 'string' ? sanitizeUtmValue(value) : null;
          if (clean) restored[key] = clean;
        }
        if (Object.keys(restored).length > 0) attribution = restored;
      }
    } catch {
      /* nothing stored, unreadable, or storage unavailable */
    }
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: Attribution = {};
    for (const key of UTM_KEYS) {
      const raw = params.get(key);
      const clean = raw === null ? null : sanitizeUtmValue(raw);
      if (clean) fresh[key] = clean;
    }
    if (Object.keys(fresh).length > 0) {
      attribution = fresh;
      attributionPersisted = false;
      persistAttribution(fresh);
    }
  } catch {
    /* attribution is optional and must never affect the page */
  }

  // The usual ad visit arrives with the campaign in the URL and the banner not
  // yet answered, so the capture above happens BEFORE there is consent to store
  // anything. Writing it here, on the next route change, is what keeps the
  // campaign attached to a visitor who accepts and then reloads — without it,
  // consenting a second later quietly cost us the attribution.
  if (attribution && !attributionPersisted) persistAttribution(attribution);

  return attribution ? { ...attribution } : {};
}

/** What this visit is attributed to; `{}` when the visitor arrived directly. */
export function getAttribution(): Attribution {
  return attribution ? { ...attribution } : {};
}

/** The events where knowing the campaign is worth the extra fields. */
const ATTRIBUTED_EVENTS = new Set<AnalyticsEventType>([
  'request_started',
  'request_submitted',
  'whatsapp_clicked',
  'signup',
  'checkout_opened',
  'payment_submitted',
]);

// ── queue + flush ─────────────────────────────────────────────────────────

function endpointUrl(): string | null {
  return SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/events` : null;
}

/**
 * Set once the sink answers "that table does not exist", after which this
 * module stops collecting entirely for the rest of the page's life.
 *
 * HISTORY — this comment used to state that public.events did not exist in the
 * live database and that every batch was therefore being thrown away. That is
 * NO LONGER TRUE and the stale note caused a real misdiagnosis: the table was
 * created at some point after this file was written. Verified 2026-08-17
 * against the live project by requesting /rest/v1/events with the anon key —
 * it answers 200 (empty array, because SELECT is admin-only under RLS), whereas
 * a genuinely absent relation answers 404/PGRST205. So the sink is live and
 * collection is working; what actually gates volume is visitor consent, not
 * this flag.
 *
 * The guard stays as a safety net for the reverse case (a dropped/renamed
 * table). Deliberately module state and NOT persisted: it resets on the next
 * page load, so if the relation ever disappears and is restored, collection
 * resumes on its own with no redeploy and no flag to remember to flip back.
 */
let sinkMissing = false;

/** PostgREST answers 404 for an unknown relation. 401/403 are NOT this — those
 * are RLS or key problems, where retrying is legitimate. */
function isMissingTable(status: number): boolean {
  return status === 404;
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
 * real pagehide/visibilitychange DOM events (which, across a test file's many
 * module reloads, would pile up stale listeners on jsdom's single shared
 * window). Call sites should not call this directly — track() schedules it. */
/** The batch as it goes on the wire, with the country stamped on if we have one. */
function withCountry(batch: QueuedEvent[]): unknown[] {
  const code = countryColumnMissing ? null : countryValue;
  return code ? batch.map((r) => ({ ...r, country: code })) : batch;
}

/** PostgREST's complaint about an unknown column names the column. */
async function rejectedTheCountryColumn(res: Response): Promise<boolean> {
  try {
    return /country/i.test(await res.text());
  } catch {
    return false;
  }
}

export async function flush(reason: 'interval' | 'unload'): Promise<void> {
  if (sinkMissing) {
    queue = [];
    return;
  }
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
      // countryConfirmed, not countryValue: a beacon's response can never be
      // read, so a batch rejected over a column that does not exist yet would
      // vanish with no retry. Until a normal flush has proven the column is
      // there, this path sends what it always sent. See countryConfirmed.
      const rows = (countryConfirmed ? withCountry(batch) : batch) as QueuedEvent[];
      const anonRows = rows.map((r) => ({ ...r, user_id: null }));
      const blob = new Blob([JSON.stringify(anonRows)], { type: 'application/json' });
      if (navigator.sendBeacon(`${url}?apikey=${encodeURIComponent(ANON_KEY)}`, blob)) return;
    } catch {
      /* fall through to fetch */
    }
  }

  try {
    const token = await sessionToken();
    const post = (body: unknown[]) =>
      fetch(url, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(body),
      });

    const rows = withCountry(batch);
    const carriedCountry = rows !== (batch as unknown[]);
    let res = await post(rows);

    // The country column is added by a migration the owner pastes in by hand,
    // so a deploy can legitimately run against a database that does not have
    // it yet. Recognise that one rejection and re-send WITHOUT the field, so
    // the visit is still recorded — then stop sending it for this page load.
    if (carriedCountry && res.status === 400 && (await rejectedTheCountryColumn(res))) {
      countryColumnMissing = true;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] events.country does not exist yet — resent without it (apply 20260909_events_country.sql)');
      }
      res = await post(batch);
    } else if (carriedCountry && res.ok) {
      countryConfirmed = true;
    }

    if (isMissingTable(res.status)) {
      sinkMissing = true;
      queue = [];
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] public.events does not exist — collection disabled for this page load');
      }
    }
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

// ── Google Analytics 4 ─────────────────────────────────────────────────────

/**
 * GA4 event bridge. The app's existing privacy guard runs before this function,
 * so it only receives flat, non-identifying values after explicit consent.
 */
function sendGooglePageView(): void {
  try {
    if (typeof window === 'undefined' || getConsent() !== 'granted') return;
    const landingPage = safePath();
    const aiSource = aiReferralSource();
    window.gtag?.('event', 'page_view', {
      page_path: landingPage,
      page_location: window.location.origin + landingPage,
      page_title: document.title,
      language: currentLocale(),
      ...(aiSource ? { ai_referral_source: aiSource } : {}),
    });
    if (aiSource) {
      window.gtag?.('event', 'ai_referral', {
        source: aiSource,
        landing_page: landingPage,
      });
    }
  } catch {
    /* Analytics must remain best-effort. */
  }
}

function sendGoogleEvent(eventType: AnalyticsEventType, opts: TrackOptions): void {
  try {
    if (typeof window === 'undefined') return;
    const gtag = window.gtag;
    if (!gtag) return;

    const target = opts.target ?? undefined;
    const meta = opts.meta ?? {};
    const category = typeof meta.category === 'string' ? meta.category : undefined;

    switch (eventType) {
      case 'page_view':
        sendGooglePageView();
        return;
      case 'service_view':
        gtag('event', 'view_service', { service_id: target, service_category: category });
        return;
      case 'guide_viewed':
        gtag('event', 'view_service_guide', { service_id: target, service_category: category });
        return;
      case 'service_click':
        gtag('event', 'select_service', { service_id: target, service_category: category });
        return;
      case 'request_started':
        gtag('event', 'service_request_started', { service_id: target, service_category: category });
        return;
      case 'request_submitted':
        // A successful server-side insert is the lead; never send request_id,
        // contact fields, or free text to Google Analytics.
        gtag('event', 'generate_lead', {
          lead_source: 'service_request',
          service_id: target,
          service_category: category,
          request_type: meta.broadcast === true ? 'partner' : 'direct',
        });
        return;
      case 'whatsapp_clicked':
        gtag('event', 'contact', { method: 'whatsapp', placement: target ?? 'unknown' });
        return;
      case 'signup':
        gtag('event', 'sign_up', { method: typeof meta.method === 'string' ? meta.method : (target ?? 'website') });
        return;
      case 'login':
        gtag('event', 'login', { method: typeof meta.method === 'string' ? meta.method : 'website' });
        return;
      case 'checkout_opened':
        gtag('event', 'begin_checkout', { checkout_type: target });
        return;
      default:
        // Keep the remaining approved taxonomy visible in GA4 without changing
        // their names or including any user-entered information.
        gtag('event', eventType, { target, ...meta });
    }
  } catch {
    /* Analytics must remain best-effort. */
  }
}

// ── Meta (Facebook/Instagram) Pixel ─────────────────────────────

/**
 * Meta's standard event names. Anything not on this list is sent as a custom
 * event instead, because `track` with an unknown name is silently ignored by
 * Events Manager — the worst possible failure mode for a conversion signal.
 */
const META_STANDARD_EVENTS = new Set([
  'PageView', 'ViewContent', 'Search', 'Lead', 'Contact', 'CompleteRegistration',
  'InitiateCheckout', 'AddToCart', 'AddPaymentInfo', 'Purchase', 'Subscribe',
  'StartTrial', 'SubmitApplication', 'Schedule', 'FindLocation', 'CustomizeProduct',
  'AddToWishlist', 'Donate',
]);

type MetaEventData = Record<string, MetaValue | string[] | undefined>;

/** Keys already sent, for events that must not be counted twice. */
const metaFiredOnce = new Set<string>();

/**
 * The ONE way anything reaches the Meta pixel. Every promise this site makes
 * about ad measurement is kept here rather than at twenty call sites:
 *
 *  - nothing is sent without granted consent, or while Do Not Track is on;
 *  - nothing is sent when fbevents.js never loaded — a declined visitor, a
 *    content blocker, or a non-production host. A missing `fbq` is the normal
 *    case, not an error;
 *  - every value is screened for anything email- or phone-shaped and the WHOLE
 *    event is dropped when one is found, so a passport or ikamet number, a
 *    medical detail, a legal case description or a chat message cannot reach
 *    an ad platform through a careless call site. Nested objects are refused
 *    for the same reason: they are where free text hides;
 *  - `once` collapses repeats, so a re-render cannot inflate a conversion;
 *  - it never throws. Ad measurement is not allowed to break the product.
 */
export function trackMetaEvent(
  eventName: string,
  eventData: MetaEventData = {},
  options: { once?: string } = {},
): void {
  try {
    if (typeof window === 'undefined') return;
    if (isDoNotTrackEnabled()) return;
    if (getConsent() !== 'granted') return;
    const fbq = window.fbq;
    if (typeof fbq !== 'function') return;

    const payload: Record<string, MetaValue | string[]> = {};
    for (const [key, value] of Object.entries(eventData)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        if (value.some((entry) => typeof entry !== 'string' || looksLikePii(entry))) return;
      } else if (typeof value === 'object') {
        return; // flat identifiers and enums only
      } else if (typeof value === 'string' && looksLikePii(value)) {
        return;
      }
      payload[key] = value;
    }

    if (options.once) {
      if (metaFiredOnce.has(options.once)) return;
      metaFiredOnce.add(options.once);
    }

    fbq(META_STANDARD_EVENTS.has(eventName) ? 'track' : 'trackCustom', eventName, payload);
  } catch {
    /* Ad measurement must never affect the product experience. */
  }
}

/**
 * A tap on Rafiq's own phone number, forwarded to the ad platforms only.
 *
 * Deliberately NOT a track() event: the first-party events table accepts a
 * fixed list of event types (a CHECK constraint in 20260727_events_tracking.sql)
 * and migrations here are pasted into the SQL editor by hand, so a new type
 * would be rejected by the live database — and because inserts are batched,
 * one rejected row takes up to nineteen unrelated events down with it. The ad
 * platforms need this signal now; the first-party table can gain it the next
 * time a migration is applied.
 */
export function trackPhoneContact(placement: string): void {
  try {
    trackMetaEvent('Contact', {
      content_name: 'Phone Contact',
      content_category: 'Rafiq Services',
      placement,
    });
    if (typeof window === 'undefined') return;
    if (isDoNotTrackEnabled() || getConsent() !== 'granted') return;
    window.gtag?.('event', 'contact', { method: 'phone', placement });
  } catch {
    /* never let analytics break a phone link */
  }
}

/**
 * Meta pixel bridge for the first-party taxonomy. Campaigns optimise against
 * these events, so only the handful that represent real commercial intent are
 * forwarded, under Meta's standard-event names — everything else stays in GA4
 * and the first-party table.
 *
 * `Contact` (a WhatsApp or phone tap) is what a "send us a message" campaign
 * should optimise for, and `Lead` is the submitted service request — keep
 * those two names stable, or in-flight campaigns lose their optimisation
 * history.
 *
 * content_name carries the service ID, not its translated title: it is stable
 * across the four languages (so one campaign does not report as four things),
 * readable in Events Manager, and cannot contain anything a visitor typed.
 */
function sendMetaEvent(eventType: AnalyticsEventType, opts: TrackOptions): void {
  const target = opts.target ?? undefined;
  const meta = opts.meta ?? {};
  const category = typeof meta.category === 'string' ? meta.category : undefined;
  const content: MetaEventData = {
    content_name: target,
    content_ids: target ? [target] : undefined,
    content_category: category,
  };

  switch (eventType) {
    case 'service_view':
    case 'guide_viewed':
      trackMetaEvent('ViewContent', content);
      return;
    case 'request_started':
      trackMetaEvent('InitiateCheckout', content);
      return;
    case 'request_submitted': {
      // One Lead per request that the database actually accepted, even if the
      // success screen re-renders or the visitor navigates back to it.
      const requestId = typeof meta.request_id === 'string' ? meta.request_id : null;
      trackMetaEvent('Lead', content, requestId ? { once: `lead:${requestId}` } : {});
      return;
    }
    case 'whatsapp_clicked':
      trackMetaEvent('Contact', {
        content_name: 'WhatsApp Contact',
        content_category: 'Rafiq Services',
        placement: target ?? 'unknown',
      });
      return;
    case 'signup':
      trackMetaEvent('CompleteRegistration', {
        method: typeof meta.method === 'string' ? meta.method : (target ?? 'website'),
      });
      return;
    default:
      // PageView is handled by the bootstrap and useTrackPageViews; the rest of
      // the taxonomy is product analytics with no advertising meaning.
      return;
  }
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

    // Stamp the campaign onto the events that answer "which ad produced this".
    // Added AFTER the PII screen above so a caller can never smuggle a value
    // past it, and only for the commercial-intent events — a page_view does not
    // need five extra fields to be useful.
    const campaign = ATTRIBUTED_EVENTS.has(eventType) ? getAttribution() : {};
    const enrichedMeta = Object.keys(campaign).length > 0 ? { ...(meta ?? {}), ...campaign } : meta;

    // GA4 remains useful even if the optional first-party event table is not
    // deployed. Its delivery must not depend on the Supabase event sink.
    sendGoogleEvent(eventType, { target, meta: enrichedMeta ?? undefined });
    sendMetaEvent(eventType, { target, meta: enrichedMeta ?? undefined });

    if (sinkMissing) return; // Skip only the unavailable first-party queue.

    // Country is resolved once per visit and stamped on at flush time, not
    // here: the lookup is a network round-trip and track() must stay
    // synchronous and instant for its callers.
    ensureCountry();

    enqueue({
      event_type: eventType,
      path: safePath(),
      target,
      meta: enrichedMeta,
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

/** False until the landing route has been seen — see the comment inside. */
let metaLandingPageViewCounted = false;

/** Call once near the root (inside <Layout>, which wraps every routed page —
 *  desktop and the mobile variants alike) to auto-capture page_view on every
 *  route change. */
export function useTrackPageViews(): void {
  const location = useLocation();
  useEffect(() => {
    // Before track(), so the very first event of an ad visit already carries
    // the campaign that paid for it.
    captureAttribution();
    track('page_view');

    // The pixel bootstrap in index.html already sent PageView for the URL the
    // browser actually loaded (and sends one the moment consent is granted
    // mid-visit), so counting the landing route here would double every
    // landing. From the second route onward there is no other sender — this is
    // a single-page app, the browser never navigates again — so each in-app
    // route change has to send its own.
    if (metaLandingPageViewCounted) trackMetaEvent('PageView');
    else metaLandingPageViewCounted = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
