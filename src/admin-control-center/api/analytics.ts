/**
 * Analytics — reads public.events (admin-only under RLS).
 *
 * ONE query per period, aggregated in the browser, rather than a request per
 * metric: the row shape is small and this keeps the section to a single
 * round-trip. `ROW_CAP` bounds the transfer; when it is hit the UI says so
 * explicitly instead of quietly reporting a partial total as if it were
 * complete.
 *
 * Nothing here invents a number. A metric that cannot be derived from the rows
 * is absent, not estimated. In particular there is NO country/city breakdown:
 * the collector never stores an IP or a location, so any map of "where the
 * visitors are" would be fabricated.
 *
 * A second, small query joins profiles for the signed-in visitors that appear
 * in the session list — that is the only way "who visited" can be answered
 * with a name rather than an opaque id. Anonymous visitors stay anonymous;
 * nothing in the event log can identify them, and nothing here pretends
 * otherwise.
 */
import { ccSb, orThrow, tallyTop } from './client';
import { iso, type Range } from '../period';
import { BUSINESS_TIMEZONE, businessDateParts } from '../../lib/metrics/timezone';

/** Enough for this site's volume; surfaced in the UI when reached. */
export const ROW_CAP = 5000;

/** How many individual visits the "who visited" table lists, newest first. */
export const VISITOR_CAP = 200;

/** Guard against an absurd day loop if a range is ever built by hand. */
const MAX_DAYS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

interface EventRow {
  session_id: string;
  event_type: string;
  path: string;
  target: string | null;
  locale: string;
  device: string;
  referrer: string | null;
  user_id: string | null;
  created_at: string;
}

/** One point on the "visits per day" trend. Empty days are present, with 0. */
export interface DailyPoint {
  /** YYYY-MM-DD in the business timezone, so days line up with the rest of the admin. */
  day: string;
  sessions: number;
  pageViews: number;
}

/**
 * One visit — every event sharing a session_id, rolled up. This is the row the
 * owner reads as "someone came to the site": when, on what, from where, what
 * they looked at, and who they were if they were signed in.
 */
export interface VisitorSession {
  sessionId: string;
  userId: string | null;
  /** From profiles, for signed-in visitors only. null = anonymous visitor. */
  name: string | null;
  email: string | null;
  firstAt: string;
  lastAt: string;
  device: string;
  locale: string;
  referrer: string | null;
  /** The first page of the visit — where they landed. */
  landingPath: string;
  pageViews: number;
  events: number;
  /** Pages in visit order, consecutive repeats collapsed. */
  paths: string[];
  /** Everything that was not a page view, in visit order (service_click, ...). */
  actions: string[];
}

export interface AnalyticsSnapshot {
  /** True when the row cap was hit — totals below are a floor, not the full count. */
  capped: boolean;
  totalEvents: number;
  uniqueSessions: number;
  signedInSessions: number;
  pageViews: number;
  /** Distinct signed-in people (not visits) seen in the period. */
  knownVisitors: number;
  daily: DailyPoint[];
  /** Newest first, capped at VISITOR_CAP. */
  visitors: VisitorSession[];
  /** How many visits exist in total, so the UI can say the list was trimmed. */
  visitorsTotal: number;
  byType: [string, number][];
  topPaths: [string, number][];
  topReferrers: [string, number][];
  byDevice: [string, number][];
  byLocale: [string, number][];
  topServices: [string, number][];
  funnel: { step: string; count: number }[];
}

/**
 * The acquisition→conversion funnel, in the order a real visit happens. Each
 * step counts DISTINCT SESSIONS that reached it (not raw events), which is the
 * only way the percentages between steps mean anything.
 */
const FUNNEL_STEPS: { step: string; types: string[] }[] = [
  { step: 'page_view', types: ['page_view'] },
  { step: 'service_view', types: ['service_view', 'service_click'] },
  { step: 'request_started', types: ['request_started'] },
  { step: 'request_submitted', types: ['request_submitted'] },
  { step: 'checkout_opened', types: ['checkout_opened'] },
  { step: 'payment_submitted', types: ['payment_submitted'] },
];

/** YYYY-MM-DD in the business timezone. */
export function dayKey(d: Date): string {
  const { year, month, day } = businessDateParts(d, BUSINESS_TIMEZONE);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Visits per day across the whole range — including the days with nothing on
 * them, which are the point of a trend. Without them a quiet week renders as a
 * straight line between two busy days and reads like steady traffic.
 */
export function buildDaily(rows: EventRow[], range: Range): DailyPoint[] {
  const byDay = new Map<string, { sessions: Set<string>; pageViews: number }>();
  for (const r of rows) {
    const k = dayKey(new Date(r.created_at));
    let slot = byDay.get(k);
    if (!slot) byDay.set(k, (slot = { sessions: new Set(), pageViews: 0 }));
    slot.sessions.add(r.session_id);
    if (r.event_type === 'page_view') slot.pageViews += 1;
  }

  const out: DailyPoint[] = [];
  // Step a day at a time from the range start. `to` is exclusive, so a day
  // starting at or after it is outside the window.
  for (let i = 0, t = range.from.getTime(); i < MAX_DAYS && t < range.to.getTime(); i += 1, t += DAY_MS) {
    const k = dayKey(new Date(t));
    const slot = byDay.get(k);
    out.push({ day: k, sessions: slot ? slot.sessions.size : 0, pageViews: slot ? slot.pageViews : 0 });
  }
  return out;
}

/**
 * Roll the flat event log up into one row per visit, newest visit first.
 *
 * `rows` arrive newest-first from PostgREST; the visit itself has to be
 * replayed oldest-first, otherwise the "landing page" would be the last page
 * seen and the path list would read backwards.
 */
export function buildVisitorSessions(rows: EventRow[]): VisitorSession[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byId = new Map<string, VisitorSession>();

  for (const r of ordered) {
    let s = byId.get(r.session_id);
    if (!s) {
      byId.set(
        r.session_id,
        (s = {
          sessionId: r.session_id,
          userId: null,
          name: null,
          email: null,
          firstAt: r.created_at,
          lastAt: r.created_at,
          device: r.device,
          locale: r.locale,
          referrer: r.referrer,
          landingPath: r.path,
          pageViews: 0,
          events: 0,
          paths: [],
          actions: [],
        }),
      );
    }
    s.lastAt = r.created_at;
    s.events += 1;
    // A visit starts anonymous and gains a user_id at sign-in; the identity,
    // once known, belongs to the whole visit.
    if (r.user_id) s.userId = r.user_id;
    if (r.event_type === 'page_view') {
      s.pageViews += 1;
      if (s.paths[s.paths.length - 1] !== r.path) s.paths.push(r.path);
    } else {
      s.actions.push(r.event_type);
    }
  }

  return [...byId.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/**
 * Attach names/emails to the signed-in visits. Mutates in place and never
 * throws: a failed profile read must leave the visit list rendering without
 * names, not blank out the whole section.
 */
async function attachIdentities(visitors: VisitorSession[]): Promise<void> {
  const ids = [...new Set(visitors.map((v) => v.userId).filter((v): v is string => !!v))];
  if (ids.length === 0) return;
  try {
    const { data } = await ccSb().from('profiles').select('id,name,email').in('id', ids);
    const rows = (data ?? []) as { id: string; name: string | null; email: string | null }[];
    const byId = new Map(rows.map((p) => [p.id, p]));
    for (const v of visitors) {
      const p = v.userId ? byId.get(v.userId) : undefined;
      if (p) {
        v.name = p.name ?? null;
        v.email = p.email ?? null;
      }
    }
  } catch {
    /* identities are an enrichment; the visits themselves are the data */
  }
}

export async function fetchAnalytics(range: Range): Promise<AnalyticsSnapshot> {
  const rows = orThrow(
    await ccSb()
      .from('events')
      .select('session_id,event_type,path,target,locale,device,referrer,user_id,created_at')
      .gte('created_at', iso(range.from))
      .lt('created_at', iso(range.to))
      .order('created_at', { ascending: false })
      .limit(ROW_CAP),
  ) as EventRow[];

  const sessions = new Set<string>();
  const signedIn = new Set<string>();
  const people = new Set<string>();
  const sessionsByType = new Map<string, Set<string>>();

  for (const r of rows) {
    sessions.add(r.session_id);
    if (r.user_id) {
      signedIn.add(r.session_id);
      people.add(r.user_id);
    }
    let set = sessionsByType.get(r.event_type);
    if (!set) sessionsByType.set(r.event_type, (set = new Set()));
    set.add(r.session_id);
  }

  const funnel = FUNNEL_STEPS.map(({ step, types }) => {
    const reached = new Set<string>();
    for (const t of types) for (const s of sessionsByType.get(t) ?? []) reached.add(s);
    return { step, count: reached.size };
  });

  const allVisitors = buildVisitorSessions(rows);
  const visitors = allVisitors.slice(0, VISITOR_CAP);
  await attachIdentities(visitors);

  return {
    capped: rows.length >= ROW_CAP,
    totalEvents: rows.length,
    uniqueSessions: sessions.size,
    signedInSessions: signedIn.size,
    pageViews: rows.filter((r) => r.event_type === 'page_view').length,
    knownVisitors: people.size,
    daily: buildDaily(rows, range),
    visitors,
    visitorsTotal: allVisitors.length,
    byType: tallyTop(rows, (r) => r.event_type, 20),
    topPaths: tallyTop(
      rows.filter((r) => r.event_type === 'page_view'),
      (r) => r.path,
      10,
    ),
    // "(direct)" is a real, meaningful bucket — a visit with no referring site.
    topReferrers: tallyTop(rows, (r) => r.referrer ?? '(direct)', 8),
    byDevice: tallyTop(rows, (r) => r.device, 4),
    byLocale: tallyTop(rows, (r) => r.locale, 6),
    topServices: tallyTop(
      rows.filter((r) => r.event_type === 'service_view' || r.event_type === 'service_click'),
      (r) => r.target,
      10,
    ),
    funnel,
  };
}
