/**
 * Telegram channel -> news_posts sync.
 *
 * Reads the channel URL from public.settings (key 'telegram', set in the
 * /admin news card), fetches the channel's public web page (t.me/s/<slug> —
 * the only feed a PUBLIC channel exposes without running a bot), parses the
 * latest posts, scrubs the channel's self-promo links out of the text
 * (src/lib/telegramNews.ts, unit-tested), and upserts the newest N into
 * news_posts keyed on tg_id — re-running never duplicates or re-orders.
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

import { channelSlug, parseChannelPage, splitTitleBody } from '../../src/lib/telegramNews';
import { MODEL_CHAIN, callWithFallback, extractJson } from '../_lib/gemini';

export const config = { runtime: 'edge' };

/** How many of the channel's newest posts the site mirrors. */
const SYNC_COUNT = 5;
const FETCH_TIMEOUT_MS = 8000;

/** Languages the channel (Arabic-only) gets machine-translated into. */
const TRANSLATE_TARGETS = ['en', 'ru', 'fa'] as const;

const TRANSLATE_SYSTEM_PROMPT = [
  'You translate short news posts for a Turkey-based service that helps foreigners living in Istanbul.',
  `Translate the given Arabic title and body into each of: ${TRANSLATE_TARGETS.join(', ')} (English, Russian, Persian/Farsi).`,
  'Preserve the meaning and tone exactly. Do not add facts, opinions, or context that is not in the original text. Keep line breaks in the body as \\n.',
  'Output ONLY a single compact JSON object, no markdown fences, shaped exactly like:',
  '{"en":{"title":"...","body":"..."},"ru":{"title":"...","body":"..."},"fa":{"title":"...","body":"..."}}',
  'If body is empty, translate title only and use an empty string for body.',
].join('\n');

/**
 * Best-effort translation of one post into en/ru/fa. Never throws: a failed
 * or unconfigured translation just leaves `translations` empty, and the site
 * falls back to the Arabic original (src/lib/api.ts pickLocalized).
 */
async function translatePost(key: string | undefined, title: string, body: string | null): Promise<Record<string, { title: string; body: string }>> {
  if (!key) return {};
  const userText = `Title: ${title}\nBody: ${body ?? ''}`;
  const res = await callWithFallback(key, MODEL_CHAIN[0], TRANSLATE_SYSTEM_PROMPT, [{ role: 'user', parts: [{ text: userText }] }]);
  if (!res.text) return {};
  const parsed = extractJson(res.text);
  if (!parsed) return {};
  const out: Record<string, { title: string; body: string }> = {};
  for (const lang of TRANSLATE_TARGETS) {
    const entry = parsed[lang] as { title?: unknown; body?: unknown } | undefined;
    if (entry && typeof entry.title === 'string' && entry.title.trim()) {
      out[lang] = { title: entry.title.trim(), body: typeof entry.body === 'string' ? entry.body.trim() : '' };
    }
  }
  return out;
}

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

  // ---- which channel ---------------------------------------------------
  const settingRes = await supa('settings?key=eq.telegram&select=value');
  if (!settingRes.ok) return json({ error: 'db_error' }, 502);
  const channelUrl = ((await settingRes.json()) as { value?: { channel?: string } }[])[0]?.value?.channel ?? '';
  const slug = channelSlug(channelUrl);
  if (!slug) return json({ error: 'no_channel', hint: 'Set the Telegram channel URL in /admin first.' }, 400);

  // ---- fetch + parse the public channel page ---------------------------
  let html: string;
  try {
    const res = await fetch(`https://t.me/s/${slug}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RafiqNewsSync/1.0)' },
    });
    if (!res.ok) return json({ error: 'telegram_unreachable', status: res.status }, 502);
    html = await res.text();
  } catch {
    return json({ error: 'telegram_unreachable' }, 502);
  }

  const parsed = parseChannelPage(html);
  if (parsed.length === 0) {
    // Either the channel is empty/private or t.me changed its markup —
    // report loudly instead of quietly writing nothing forever.
    return json({ error: 'no_posts_parsed', hint: 'Channel empty, private, or t.me markup changed.' }, 422);
  }

  const geminiKey = env('GEMINI_API_KEY');
  const rows = await Promise.all(
    parsed.slice(-SYNC_COUNT).map(async (p) => {
      const { title, body } = splitTitleBody(p.text);
      const finalTitle = title || 'Telegram';
      const translations = await translatePost(geminiKey, finalTitle, body);
      return {
        tg_id: p.tgId,
        title: finalTitle,
        body,
        url: p.url,
        image_url: p.imageUrl,
        source: 'telegram',
        published: true,
        // Omit on failure so the upsert's partial SET leaves any translation
        // from a previous sync in place, instead of clobbering it with {}.
        ...(Object.keys(translations).length > 0 ? { translations } : {}),
        ...(p.createdAt ? { created_at: p.createdAt } : {}),
      };
    }),
  );

  const upsert = await supa('news_posts?on_conflict=tg_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
  if (!upsert.ok) return json({ error: 'db_error', detail: (await upsert.text()).slice(0, 300) }, 502);
  const written = (await upsert.json()) as unknown[];

  return json({ ok: true, channel: slug, parsed: parsed.length, synced: written.length });
}
