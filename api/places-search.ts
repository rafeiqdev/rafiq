/**
 * Places API (New) proxy — runs on Vercel, so GOOGLE_MAPS_SERVER_KEY never
 * reaches the browser. The browser key (VITE_GOOGLE_MAPS_API_KEY) only ever
 * loads the Maps JS SDK and runs Autocomplete; every billable *search* goes
 * through here instead, which keeps the quota behind our own origin check and
 * lets us pin a tight FieldMask.
 *
 * Cost control: Places API (New) bills by which fields you ask for. We send a
 * deliberately small `X-Goog-FieldMask` per mode — the list needs far less than
 * the detail card, so asking for one mask everywhere would multiply the bill.
 *
 * Query translation: an expat types "شاورما لحمة" or "аптека" — Google's Text
 * Search matches Turkish place data far better when the query itself is Turkish.
 * So free-text queries are normalised to a Turkish search phrase BEFORE they hit
 * Google: a static dictionary handles the common expat vocabulary for free, and
 * anything it does not cover is translated once by Gemini (the same provider and
 * key as api/ai-chat.ts). Every step degrades gracefully — if translation is
 * unavailable the original text is searched, exactly as before.
 *
 * Modes (POST body):
 *   { mode: 'nearby', category, lat, lng, radius? }  → { places: [] }
 *   { mode: 'text',   query, lat?, lng?, category? } → { places: [], query, translatedQuery }
 *   { mode: 'details', placeId }                     → { place }
 *
 * Convention matches api/ai-chat.ts: every failure returns HTTP 200 with
 * `{ error }` so the client renders a service-failure state instead of throwing.
 */

export const config = { runtime: 'edge' };

const PLACES_ROOT = 'https://places.googleapis.com/v1';

/** Istanbul city centre — the default bias for every search. */
const ISTANBUL = { latitude: 41.0151, longitude: 28.9795 };
const DEFAULT_RADIUS_M = 5000;
const MAX_RADIUS_M = 50000;
const MAX_RESULTS = 20;

/**
 * The seven UI categories. Google's `includedTypes` only covers some of them
 * cleanly — a Turkish noter or an Arabic-speaking business is not a Places
 * type, so those fall back to Text Search with a canned query. This is exactly
 * the "Nearby vs Text by search kind" split.
 */
const CATEGORIES: Record<string, { types?: string[]; textQuery?: string }> = {
  dining: { types: ['restaurant', 'cafe'] },
  hotels: { types: ['hotel', 'motel', 'guest_house'] },
  hospitals: { types: ['hospital', 'doctor', 'pharmacy'] },
  shopping: { types: ['shopping_mall', 'supermarket', 'department_store'] },
  government: { types: ['local_government_office', 'city_hall', 'embassy'] },
  // No Places type exists for these two — search them as text instead.
  notary: { textQuery: 'noter' },
  arabic: { textQuery: 'arapça konuşan restoran suriye mutfağı' },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

/**
 * Common expat search vocabulary → Turkish, matched whole-word and
 * case/diacritic-insensitively. This resolves the majority of real queries
 * with ZERO translation cost or latency; only phrases outside this list fall
 * through to Gemini. Keep the values as the words a local would actually type
 * into Google Maps in Istanbul.
 */
const PHRASE_DICT: Record<string, string> = {
  // food
  'شاورما': 'dürüm döner',
  'شاورما لحمة': 'et döner dürüm',
  'شاورما دجاج': 'tavuk döner dürüm',
  'مطعم': 'restoran',
  'مطعم عربي': 'arap restoranı',
  'مطعم سوري': 'suriye restoranı',
  'كباب': 'kebap',
  'فلافل': 'falafel',
  'حلويات': 'tatlıcı',
  'مخبز': 'fırın',
  'خبز': 'ekmek fırını',
  'قهوة': 'kahve',
  'مقهى': 'kafe',
  'مطعم بحري': 'balık restoranı',
  'حلاق': 'kuaför berber',
  // health
  'صيدلية': 'eczane',
  'مستشفى': 'hastane',
  'طبيب': 'doktor',
  'طبيب اسنان': 'diş hekimi',
  'مختبر': 'laboratuvar',
  'عيادة': 'klinik',
  // services / admin
  'كاتب عدل': 'noter',
  'نوتر': 'noter',
  'ترجمة': 'yeminli tercüman',
  'مترجم': 'yeminli tercüman',
  'محامي': 'avukat',
  'بنك': 'banka',
  'صراف': 'atm',
  'صرافة': 'döviz bürosu',
  'دائرة الهجرة': 'göç idaresi',
  'النفوس': 'nüfus müdürlüğü',
  'بلدية': 'belediye',
  // shopping / daily
  'سوق': 'market',
  'سوبر ماركت': 'süpermarket',
  'بقالة': 'bakkal',
  'مول': 'alışveriş merkezi',
  'محل موبايلات': 'telefon dükkanı',
  'محطة بنزين': 'benzin istasyonu',
  'مغسلة': 'çamaşırhane',
  'مدرسة': 'okul',
  'جامع': 'cami',
  'مسجد': 'cami',
  // russian / persian quick hits
  'аптека': 'eczane',
  'больница': 'hastane',
  'ресторан': 'restoran',
  'داروخانه': 'eczane',
  'بیمارستان': 'hastane',
  'رستوران': 'restoran',
};

/** Normalise for dictionary lookup: trim, lowercase, collapse whitespace. */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Fast path: exact whole-phrase dictionary hit. Returns null when not found. */
function dictLookup(query: string): string | null {
  const key = norm(query);
  for (const [ar, tr] of Object.entries(PHRASE_DICT)) {
    if (norm(ar) === key) return tr;
  }
  return null;
}

/** Already Latin/Turkish? Then translation would only add cost and risk. */
function looksTurkish(query: string): boolean {
  // No Arabic, Cyrillic, or Persian script present → treat as Latin/Turkish.
  return !/[؀-ۿЀ-ӿ]/.test(query);
}

interface GeminiResult {
  text: string;
  failStatus?: number;
}

/** One Gemini generateContent call — mirrors api/ai-chat.ts. Never throws. */
async function callGemini(key: string, model: string, systemText: string, userText: string): Promise<GeminiResult> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 40, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) return { text: '', failStatus: res.status };
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? '').join('').trim() ?? '';
    return { text };
  } catch {
    return { text: '', failStatus: 0 };
  }
}

// Lite models first — same reasoning as ai-chat.ts: the flagship free tier is
// tiny, the lite tiers are generous, and translation is a trivial task.
const MODEL_CHAIN = ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];

const TRANSLATE_SYSTEM = [
  'You convert a place/business search query into a short Turkish query for Google Maps in Istanbul, Turkey.',
  'Return ONLY the Turkish search phrase — no punctuation, no quotes, no explanation, at most 6 words.',
  'If the input is already Turkish, a proper name, or a brand, return it unchanged.',
  'Prefer the everyday word a local would type (e.g. "et döner", "eczane", "noter", "diş hekimi").',
].join('\n');

/**
 * Best-effort translation of a free-text query to Turkish.
 * Order: skip Latin/Turkish → dictionary → Gemini → original as fallback.
 * `translated` equals `original` whenever nothing changed, so the caller can
 * decide whether to show a "searched in Turkish" hint.
 */
async function toTurkish(query: string, lang: string): Promise<string> {
  const q = query.trim();
  if (!q || looksTurkish(q)) return q;

  const hit = dictLookup(q);
  if (hit) return hit;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return q; // no translator configured → search as-is (previous behaviour)

  const userText = `Input language: ${lang || 'unknown'}\nQuery: ${q}`;
  for (const model of MODEL_CHAIN) {
    const res = await callGemini(key, model, TRANSLATE_SYSTEM, userText);
    if (res.text) {
      // Guard against a chatty model: take the first line, cap the length.
      const cleaned = res.text.split('\n')[0].replace(/["'`]/g, '').trim().slice(0, 80);
      return cleaned || q;
    }
    // Only quota/retired errors are worth walking the chain for.
    if (res.failStatus !== 429 && res.failStatus !== 404 && res.failStatus !== 400) break;
  }
  return q;
}

/** Lean mask for list views. Every extra field here is billed per result. */
const LIST_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
].join(',');

/** Richer mask, charged once for the single place the user actually opened. */
const DETAIL_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'nationalPhoneNumber',
  'regularOpeningHours',
  'photos',
  'googleMapsUri',
  'websiteUri',
  'businessStatus',
].join(',');

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  photos?: { name?: string }[];
  googleMapsUri?: string;
  websiteUri?: string;
}

/** Flattened shape the client consumes — never leaks Google's nesting. */
function shape(p: GooglePlace) {
  return {
    placeId: p.id ?? '',
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    primaryType: p.primaryType ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    openNow: p.regularOpeningHours?.openNow ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? null,
    phone: p.nationalPhoneNumber ?? null,
    // Photo bytes are fetched through /api/place-photo so the key stays server-side.
    photoRef: p.photos?.[0]?.name ?? null,
    mapsUri: p.googleMapsUri ?? null,
    websiteUri: p.websiteUri ?? null,
    businessStatus: p.businessStatus ?? null,
  };
}

/**
 * The env values, reduced to WELL-FORMED Google API keys only.
 *
 * Two real incidents drove the strictness: an OAuth client id pasted into
 * GOOGLE_MAPS_SERVER_KEY (Google answers 401 "API keys are not supported"),
 * and a value with a trailing newline (fetch throws "Invalid header value"
 * before the request even leaves). Every Google API key matches AIza + 35 url-
 * safe chars; anything else is config noise and must not reach a header.
 */
export function candidateKeys(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  // EXTRACT rather than validate: a value pasted with wrapping quotes, a
  // trailing newline, or a "key=AIza…" fragment still contains one well-formed
  // key — pull it out instead of rejecting the whole variable. Values with no
  // AIza token at all (the OAuth client id incident) yield nothing.
  return [env.GOOGLE_MAPS_SERVER_KEY, env.VITE_GOOGLE_MAPS_API_KEY]
    .map((k) => (k ?? '').match(/AIza[\w-]{30,}/)?.[0])
    .filter((k): k is string => Boolean(k));
}

/**
 * Our own production origin, for the Referer header above.
 *
 * Vercel injects VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL on every deployment,
 * so those cover production and previews. VITE_BASE_URL is the local-dev answer
 * and the same single source of truth the rest of the repo uses
 * (scripts/siteUrl.mjs) — it is a bare origin, hence the same normalisation.
 *
 * There is deliberately no hardcoded host left here. The previous one pointed at
 * a domain that no longer matches VITE_BASE_URL, which meant that after a domain
 * change this would have sent a Referer the Maps browser key's HTTP-referrer
 * restriction no longer allows — Places failing with API_KEY_HTTP_REFERRER_BLOCKED
 * for a reason nothing in the code would explain. Throwing names the cause.
 */
export function siteReferer(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || env.VITE_BASE_URL;
  if (!host) {
    throw new Error(
      'Cannot determine this site\'s own origin for the Google Places Referer header: ' +
        'none of VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL or VITE_BASE_URL is set. ' +
        'Vercel provides the first two automatically; set VITE_BASE_URL in .env for local dev.',
    );
  }
  return `https://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/`;
}

/**
 * Calls Places trying each key in order. A 401/403 means THIS key is bad
 * (invalid value, wrong restriction, disabled API) — the next key may still
 * work, so only auth-type failures fall through; anything else returns as-is.
 * In practice: a misconfigured GOOGLE_MAPS_SERVER_KEY no longer takes search
 * down while a working browser key is sitting right next to it.
 */
async function callPlaces(
  url: string,
  keys: string[],
  mask: string,
  body?: unknown,
): Promise<{ data?: Record<string, unknown>; error?: string; status?: number; detail?: string }> {
  let last: { error: string; status?: number; detail?: string } = { error: 'no_key' };
  for (const key of keys) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': mask,
        // The browser-key fallback carries an HTTP-referrer restriction scoped
        // to our own site. These requests ARE made on that site's behalf, so
        // identify as it — otherwise Google sees referer <empty> and blocks
        // (API_KEY_HTTP_REFERRER_BLOCKED). Harmless for the dedicated server
        // key, which has no referrer restriction.
        Referer: siteReferer(),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return { data: (await res.json()) as Record<string, unknown> };

    const detail = (await res.text()).slice(0, 300);
    // 403 here almost always means the key is restricted to the wrong API or
    // carries a referrer restriction it cannot satisfy from a server.
    last = { error: res.status === 403 ? 'key_rejected' : 'upstream_error', status: res.status, detail };
    if (res.status !== 401 && res.status !== 403) return last;
  }
  return last;
}

function clampRadius(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_RADIUS_M;
  return Math.min(Math.max(n, 100), MAX_RADIUS_M);
}

function coord(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Preferred: a dedicated, referrer-unrestricted server key. Fallback: the
  // browser key — it is already public in the JS bundle, so reusing it here
  // exposes nothing new, and it unblocks search while the separate server key
  // is missing or misconfigured. callPlaces() walks this list past auth
  // failures, so a bad first key cannot take search down on its own.
  const keys = candidateKeys();
  if (keys.length === 0) return json({ error: 'no_key' });

  let payload: {
    mode?: string;
    category?: string;
    query?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    placeId?: string;
    lang?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const lang = typeof payload.lang === 'string' ? payload.lang.slice(0, 5) : 'ar';
  const lat = coord(payload.lat, ISTANBUL.latitude);
  const lng = coord(payload.lng, ISTANBUL.longitude);

  try {
    // ---- details: one place, rich fields -----------------------------------
    if (payload.mode === 'details') {
      const placeId = typeof payload.placeId === 'string' ? payload.placeId.trim() : '';
      if (!placeId) return json({ error: 'bad_request' }, 400);
      const res = await callPlaces(
        `${PLACES_ROOT}/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(lang)}`,
        keys,
        DETAIL_MASK,
      );
      if (res.error) return json({ error: res.error, status: res.status, detail: res.detail });
      return json({ place: shape(res.data as GooglePlace) });
    }

    // ---- text search: the user typed something ------------------------------
    if (payload.mode === 'text') {
      const typed = typeof payload.query === 'string' ? payload.query.trim() : '';
      const canned = payload.category ? CATEGORIES[payload.category]?.textQuery : undefined;
      const original = typed || canned;
      if (!original) return json({ error: 'bad_request' }, 400);

      // Translate only what the user actually typed; canned category queries are
      // already Turkish. This is the fix for "search doesn't work for Arabic".
      const textQuery = typed ? await toTurkish(typed, lang) : (canned as string);

      const res = await callPlaces(`${PLACES_ROOT}/places:searchText`, keys, LIST_MASK, {
        textQuery,
        languageCode: lang,
        maxResultCount: MAX_RESULTS,
        // Bias, not restrict: a user searching a landmark by name should still
        // find it if it sits just outside the circle.
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(payload.radius) },
        },
      });
      if (res.error) return json({ error: res.error, status: res.status, detail: res.detail });
      const places = ((res.data?.places as GooglePlace[]) ?? []).map(shape).filter((p) => p.placeId);
      // Echo both strings so the UI can show "we searched Turkish: X" honestly.
      return json({ places, query: original, translatedQuery: textQuery });
    }

    // ---- nearby search: the user picked a category -------------------------
    if (payload.mode === 'nearby') {
      const cat = typeof payload.category === 'string' ? payload.category : '';
      const spec = CATEGORIES[cat];
      if (!spec) return json({ error: 'unknown_category' }, 400);

      // Categories with no clean Places type resolve as text instead.
      if (!spec.types) {
        const res = await callPlaces(`${PLACES_ROOT}/places:searchText`, keys, LIST_MASK, {
          textQuery: spec.textQuery,
          languageCode: lang,
          maxResultCount: MAX_RESULTS,
          locationBias: {
            circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(payload.radius) },
          },
        });
        if (res.error) return json({ error: res.error, status: res.status, detail: res.detail });
        const places = ((res.data?.places as GooglePlace[]) ?? []).map(shape).filter((p) => p.placeId);
        return json({ places });
      }

      const res = await callPlaces(`${PLACES_ROOT}/places:searchNearby`, keys, LIST_MASK, {
        includedTypes: spec.types,
        languageCode: lang,
        maxResultCount: MAX_RESULTS,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(payload.radius) },
        },
        rankPreference: 'POPULARITY',
      });
      if (res.error) return json({ error: res.error, status: res.status, detail: res.detail });
      const places = ((res.data?.places as GooglePlace[]) ?? []).map(shape).filter((p) => p.placeId);
      return json({ places });
    }

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 200) });
  }
}
