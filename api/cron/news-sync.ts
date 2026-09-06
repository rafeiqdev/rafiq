/**
 * News feed sync: Turkish tourism sources -> news_posts.
 *
 * Replaces the old Telegram channel mirror (api/cron/telegram-sync.ts). The
 * channel carried whatever it carried — killings, politics, "breaking" — and
 * no source publishes an Arabic, Türkiye-tourism-only feed, so the shape here
 * is deliberately different: several tourism-first feeds, then a model that
 * SCREENS each story against what a Rafiq visitor actually needs, then a
 * translation into the site's four languages.
 *
 * Three gates stand between a publisher and the home page:
 *   1. the sources themselves (tourism desks, not news desks);
 *   2. the screening call below — anything about crime, war, accidents,
 *      politics or sport is dropped and never written;
 *   3. `published: false` on insert — the owner still reviews every item in
 *      /admin before a visitor sees it.
 *
 * Triggers:
 *   - daily Vercel cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`;
 *   - the admin card's "sync now" button, sending the admin's own Supabase
 *     JWT — verified here against auth + the profiles.role row before any
 *     write. Anyone else gets 403 and no fetch happens.
 *
 * Writes use the service-role key (RLS untouched: visitors read published
 * rows only, the browser never activates anything here).
 */

import { mergeNewest, normalizeFeedUrl, parseFeed, type FeedItem } from '../../src/lib/rssNews.js';
import { MODEL_CHAIN, callWithFallback, extractJson } from '../_lib/gemini.js';

export const config = { runtime: 'edge' };

/**
 * Sources used when the owner hasn't set his own list in /admin. Tourism and
 * travel desks first; Anadolu (the state agency, Arabic) is the trusted
 * general wire, and leans on the screening step to keep only what belongs.
 */
const DEFAULT_FEEDS = [
  'https://www.turizmgunlugu.com/rss',
  'https://www.turizmajansi.com/rss',
  'https://www.hurriyet.com.tr/rss/seyahat',
  'https://www.aa.com.tr/ar/rss/default?cat=guncel',
];

/** Newest stories read per feed, before screening. */
const PER_FEED = 8;
/**
 * Stories put in front of the screening model in one run. Kept at or above
 * PER_FEED × the number of sources on purpose: a general wire posts far more
 * often than a tourism desk, so a tighter cap would sort the wire's stories
 * to the top and silently drop the very items these sources are here for.
 */
const MAX_CANDIDATES = 40;
/** Stories written per run — the home page shows five. */
const SYNC_COUNT = 5;
const FETCH_TIMEOUT_MS = 8000;

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;
type Lang = (typeof LANGS)[number];

const SCREEN_SYSTEM_PROMPT = [
  'You are the editor of the news strip on Rafiq Istanbul, a paid concierge service for Arabic-speaking people who visit, study, live, invest or get medical treatment in Istanbul and Türkiye.',
  'You will receive a numbered list of news headlines. Decide which ones belong on that strip.',
  '',
  'KEEP a story only when it is useful or pleasant for that reader:',
  'tourism and travel in Türkiye; places, regions and seasons to visit; festivals, exhibitions, concerts and cultural events; transport (flights, airlines, airports, metro, ferries, trains, travel cards, roads); hotels and hospitality; museums and historical sites; residence, visa and immigration rules affecting foreigners; universities and students; health and medical tourism; property and investment for foreigners; practical guidance (public holidays, opening hours, weather that changes travel plans); tourism figures, new routes, new openings.',
  '',
  'REJECT everything else, including:',
  'killing, crime, violence, accidents, fires, drowning, disasters, war, terrorism; courts, investigations, scandals, corruption; protests, elections, party politics, statements by politicians attacking each other; sport results; celebrity gossip; deaths and obituaries; anything framed as "breaking" or alarming; anything with no connection to Türkiye; and industry-insider trade news (tax lobbying, company earnings, sector complaints) that an ordinary visitor would not care about.',
  '',
  'A story about a child dying in a hotel pool is REJECTED even though it is about tourism. When in doubt, REJECT.',
  'Output ONLY a compact JSON object listing the indexes you keep, best first, no markdown fences:',
  '{"keep":[0,4,7]}',
].join('\n');

const TRANSLATE_SYSTEM_PROMPT = [
  'You rewrite one news item for Rafiq Istanbul, a service for Arabic-speaking people in Türkiye. The item may be in Turkish, Arabic or English.',
  'Produce a short, calm news brief in each of: ar (Arabic), en (English), ru (Russian), fa (Persian).',
  'Rules: keep the meaning exactly; do NOT add facts, numbers, opinions, advice or context that is not in the source; do NOT address the reader or promote anything; title max 90 characters; body 1-2 sentences.',
  'Output ONLY a single compact JSON object, no markdown fences, shaped exactly like:',
  '{"ar":{"title":"...","body":"..."},"en":{"title":"...","body":"..."},"ru":{"title":"...","body":"..."},"fa":{"title":"...","body":"..."}}',
].join('\n');

type Localized = { title: string; body: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

/** One feed document, or null when the publisher is down/slow/blocking us. */
async function fetchFeed(url: string): Promise<FeedItem[] | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some Turkish publishers 403 an unfamiliar agent outright.
        'User-Agent': 'Mozilla/5.0 (compatible; RafiqNewsSync/1.0; +https://rafeiq.dev)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!res.ok) return null;
    return parseFeed(await res.text(), url).slice(0, PER_FEED);
  } catch {
    return null;
  }
}

/**
 * Which of these stories belong on the site. Returns the kept items in the
 * model's own order (it ranks them), capped.
 *
 * Fails CLOSED: if the screening call fails there is no way to tell a museum
 * opening from a murder, and the whole point of this rebuild is that the
 * second kind never reaches the site. A skipped run costs a day of news.
 */
async function screen(key: string, items: FeedItem[], limit: number): Promise<FeedItem[] | null> {
  const list = items
    .map((p, i) => `${i}. ${p.title}${p.body ? ` — ${p.body.slice(0, 180)}` : ''}`)
    .join('\n');
  const res = await callWithFallback(key, MODEL_CHAIN[0], SCREEN_SYSTEM_PROMPT, [
    { role: 'user', parts: [{ text: list }] },
  ]);
  if (!res.text) return null;
  const parsed = extractJson(res.text);
  const keep = parsed?.keep;
  if (!Array.isArray(keep)) return null;

  const out: FeedItem[] = [];
  for (const raw of keep) {
    const i = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isInteger(i) && i >= 0 && i < items.length && !out.includes(items[i])) out.push(items[i]);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * One item in all four site languages. Returns null when the model is
 * unavailable or answers unusably — the caller then skips the item rather
 * than publishing a Turkish headline to an Arabic-first site.
 */
async function localize(key: string, item: FeedItem): Promise<Record<Lang, Localized> | null> {
  const res = await callWithFallback(key, MODEL_CHAIN[0], TRANSLATE_SYSTEM_PROMPT, [
    { role: 'user', parts: [{ text: `Title: ${item.title}\nBody: ${item.body ?? ''}` }] },
  ]);
  if (!res.text) return null;
  const parsed = extractJson(res.text);
  if (!parsed) return null;

  const out = {} as Record<Lang, Localized>;
  for (const lang of LANGS) {
    const entry = parsed[lang] as { title?: unknown; body?: unknown } | undefined;
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    if (!title) return null; // a partial answer would leave one language raw
    out[lang] = { title: title.slice(0, 200), body: typeof entry?.body === 'string' ? entry.body.trim().slice(0, 2000) : '' };
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = env('CRON_SECRET');
  if (!supaUrl || !serviceKey) return json({ error: 'not_configured' }, 503);

  const supa = (path: string, init: RequestInit = {}) =>
    fetch(`${supaUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  // ---- caller must be the cron or a signed-in admin --------------------
  const auth = req.headers.get('authorization') ?? '';
  const isCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  if (!isCron) {
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'unauthorized' }, 401);
    const uid = ((await userRes.json()) as { id?: string }).id;
    if (!uid) return json({ error: 'unauthorized' }, 401);
    const roleRes = await supa(`profiles?id=eq.${uid}&select=role`);
    const role = roleRes.ok ? ((await roleRes.json()) as { role?: string }[])[0]?.role : null;
    if (role !== 'admin') return json({ error: 'forbidden' }, 403);
  }

  // Screening is not optional — without the model there is no filter, and an
  // unfiltered wire is exactly what this replaced.
  const geminiKey = env('GEMINI_API_KEY');
  if (!geminiKey) return json({ error: 'ai_unavailable' }, 503);

  // ---- which feeds -----------------------------------------------------
  const settingRes = await supa('settings?key=eq.news_sources&select=value');
  if (!settingRes.ok) return json({ error: 'db_error' }, 502);
  const saved = ((await settingRes.json()) as { value?: { feeds?: unknown } }[])[0]?.value?.feeds;
  const feeds = (Array.isArray(saved) ? saved : [])
    .map((f) => (typeof f === 'string' ? normalizeFeedUrl(f) : null))
    .filter((f): f is string => Boolean(f));
  const sources = feeds.length > 0 ? feeds : DEFAULT_FEEDS;

  // ---- fetch + parse ---------------------------------------------------
  const fetched = await Promise.all(sources.map(fetchFeed));
  const reachable = fetched.filter((f): f is FeedItem[] => f !== null);
  if (reachable.length === 0) return json({ error: 'feeds_unreachable' }, 502);

  const candidates = mergeNewest(reachable, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return json({ error: 'no_items_parsed', hint: 'The sources answered but held no readable stories.' }, 422);
  }

  // Stories already in the table were screened on an earlier run — skip them
  // so the model only ever pays for genuinely new headlines.
  //
  // This lookup FAILING is not survivable: treating an existing story as new
  // makes the upsert below rewrite its row with published:false, quietly
  // un-publishing something the owner had already approved.
  const idList = candidates.map((p) => `"${p.id}"`).join(',');
  const existingRes = await supa(`news_posts?tg_id=in.(${idList})&select=tg_id`);
  if (!existingRes.ok) return json({ error: 'db_error' }, 502);
  const existingIds = new Set(((await existingRes.json()) as { tg_id: string }[]).map((r) => r.tg_id));
  const fresh = candidates.filter((p) => !existingIds.has(p.id));
  if (fresh.length === 0) {
    return json({ ok: true, sources: sources.length, parsed: candidates.length, synced: 0 });
  }

  // ---- screen, then translate what survived ----------------------------
  const kept = await screen(geminiKey, fresh, SYNC_COUNT);
  if (kept === null) return json({ error: 'ai_unavailable' }, 503);
  if (kept.length === 0) {
    return json({ ok: true, sources: sources.length, parsed: candidates.length, screened: fresh.length, synced: 0 });
  }

  const localized = await Promise.all(kept.map((item) => localize(geminiKey, item)));
  const rows = kept
    .map((item, i) => ({ item, text: localized[i] }))
    .filter((r): r is { item: FeedItem; text: Record<Lang, Localized> } => r.text !== null)
    .map(({ item, text }) => ({
      tg_id: item.id,
      // Arabic is the site's base language; en/ru/fa live in `translations`
      // and localizeNewsPost() falls back to these two.
      title: text.ar.title,
      body: text.ar.body || null,
      url: item.url,
      image_url: item.imageUrl,
      source: 'rss',
      // Every row here is new (the ones already stored were filtered out
      // above), so they all land as drafts and wait for /admin to publish them.
      published: false,
      translations: { en: text.en, ru: text.ru, fa: text.fa },
      ...(item.createdAt ? { created_at: item.createdAt } : {}),
    }));

  if (rows.length === 0) return json({ error: 'ai_unavailable' }, 503);

  const upsert = await supa('news_posts?on_conflict=tg_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
  if (!upsert.ok) return json({ error: 'db_error', detail: (await upsert.text()).slice(0, 300) }, 502);
  const written = (await upsert.json()) as unknown[];

  return json({
    ok: true,
    sources: sources.length,
    unreachable: sources.length - reachable.length,
    parsed: candidates.length,
    screened: fresh.length,
    synced: written.length,
  });
}
