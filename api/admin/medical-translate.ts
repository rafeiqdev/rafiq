/**
 * Admin-only "translate this into the other 3 languages" helper for the
 * medical-tourism landing-page CMS (AdminMedical > Content). Staff type the
 * text once in whichever language they're comfortable in; this endpoint
 * fills in the rest so nobody has to hand-translate into ar/en/ru/fa.
 *
 * POST { sourceLang: 'ar'|'en'|'ru'|'fa', fields: Record<string,string> }
 *   Authorization: Bearer <the caller's own Supabase JWT>
 * -> { ar?: Record<string,string>, en?: ..., ru?: ..., fa?: ... }
 *    (only the 3 non-source languages are present; the source is echoed
 *    back by the client, not by this endpoint)
 *
 * Same Gemini provider + fallback chain as api/cron/telegram-sync.ts's post
 * translation, and the same "admin's own JWT, checked against profiles.role"
 * auth shape — extended here to medical_coordinator, since that's who
 * actually uses this CMS.
 */

import { MODEL_CHAIN, callWithFallback, extractJson } from '../_lib/gemini.js';

export const config = { runtime: 'edge' };

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;
type Lang = (typeof LANGS)[number];
const LANG_NAME: Record<Lang, string> = { ar: 'Arabic', en: 'English', ru: 'Russian', fa: 'Persian (Farsi)' };

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
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supaUrl = env('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = env('GEMINI_API_KEY');
  if (!supaUrl || !serviceKey) return json({ error: 'not_configured' }, 503);
  if (!geminiKey) return json({ error: 'translation_unavailable' }, 503);

  // ---- caller must be a signed-in admin or medical coordinator ---------
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const userRes = await fetch(`${supaUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401);
  const uid = ((await userRes.json()) as { id?: string }).id;
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const roleRes = await fetch(`${supaUrl}/rest/v1/profiles?id=eq.${uid}&select=role`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const role = roleRes.ok ? ((await roleRes.json()) as { role?: string }[])[0]?.role : null;
  if (role !== 'admin' && role !== 'medical_coordinator') return json({ error: 'forbidden' }, 403);

  // ---- validate body -----------------------------------------------------
  let body: { sourceLang?: string; fields?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const sourceLang = body.sourceLang;
  if (!sourceLang || !(LANGS as readonly string[]).includes(sourceLang)) return json({ error: 'bad_source_lang' }, 400);
  const fields = body.fields;
  if (!fields || typeof fields !== 'object') return json({ error: 'bad_fields' }, 400);
  const entries = Object.entries(fields).filter(([, v]) => typeof v === 'string' && v.trim()) as [string, string][];
  if (entries.length === 0) return json({});

  const targets = LANGS.filter((l) => l !== sourceLang);
  const fieldKeys = entries.map(([k]) => k);
  const systemPrompt = [
    `You translate short marketing/UI copy for a Turkey-based medical-tourism coordination service, from ${LANG_NAME[sourceLang as Lang]} into each of: ${targets.map((l) => LANG_NAME[l]).join(', ')}.`,
    'Preserve meaning and tone exactly. Do not add facts, prices, or claims not present in the source. Keep formatting/punctuation style natural for each target language.',
    `The input is a JSON object with these keys: ${fieldKeys.join(', ')}. Translate the value of every key.`,
    'Output ONLY a single compact JSON object, no markdown fences, shaped exactly like:',
    `{${targets.map((l) => `"${l}":{${fieldKeys.map((k) => `"${k}":"..."`).join(',')}}`).join(',')}}`,
  ].join('\n');
  const userText = JSON.stringify(Object.fromEntries(entries));

  const res = await callWithFallback(geminiKey, MODEL_CHAIN[0], systemPrompt, [{ role: 'user', parts: [{ text: userText }] }]);
  if (!res.text) return json({ error: 'translation_failed' }, 502);
  const parsed = extractJson(res.text);
  if (!parsed) return json({ error: 'translation_failed' }, 502);

  const out: Partial<Record<Lang, Record<string, string>>> = {};
  for (const lang of targets) {
    const entry = parsed[lang] as Record<string, unknown> | undefined;
    if (!entry || typeof entry !== 'object') continue;
    const translated: Record<string, string> = {};
    for (const key of fieldKeys) {
      const v = entry[key];
      if (typeof v === 'string' && v.trim()) translated[key] = v.trim();
    }
    if (Object.keys(translated).length) out[lang] = translated;
  }
  return json(out);
}
