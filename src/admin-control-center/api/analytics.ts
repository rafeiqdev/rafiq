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
 * is absent, not estimated.
 */
import { ccSb, orThrow, tallyTop } from './client';
import { iso, type Range } from '../period';

/** Enough for this site's volume; surfaced in the UI when reached. */
export const ROW_CAP = 5000;

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

export interface AnalyticsSnapshot {
  /** True when the row cap was hit — totals below are a floor, not the full count. */
  capped: boolean;
  totalEvents: number;
  uniqueSessions: number;
  signedInSessions: number;
  pageViews: number;
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
  const sessionsByType = new Map<string, Set<string>>();

  for (const r of rows) {
    sessions.add(r.session_id);
    if (r.user_id) signedIn.add(r.session_id);
    let set = sessionsByType.get(r.event_type);
    if (!set) sessionsByType.set(r.event_type, (set = new Set()));
    set.add(r.session_id);
  }

  const funnel = FUNNEL_STEPS.map(({ step, types }) => {
    const reached = new Set<string>();
    for (const t of types) for (const s of sessionsByType.get(t) ?? []) reached.add(s);
    return { step, count: reached.size };
  });

  return {
    capped: rows.length >= ROW_CAP,
    totalEvents: rows.length,
    uniqueSessions: sessions.size,
    signedInSessions: signedIn.size,
    pageViews: rows.filter((r) => r.event_type === 'page_view').length,
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
