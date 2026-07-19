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
 * Modes (POST body):
 *   { mode: 'nearby', category, lat, lng, radius? }  → { places: [] }
 *   { mode: 'text',   query, lat?, lng?, category? } → { places: [] }
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
  arabic: { textQuery: 'مطعم عربي سوري arabic service' },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

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

async function callPlaces(
  url: string,
  key: string,
  mask: string,
  body?: unknown,
): Promise<{ data?: Record<string, unknown>; error?: string; status?: number; detail?: string }> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': mask,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // 403 here almost always means the key is restricted to the wrong API or
    // carries a referrer restriction it cannot satisfy from a server.
    return { error: res.status === 403 ? 'key_rejected' : 'upstream_error', status: res.status, detail };
  }
  return { data: (await res.json()) as Record<string, unknown> };
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

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return json({ error: 'no_key' });

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
        key,
        DETAIL_MASK,
      );
      if (res.error) return json({ error: res.error, status: res.status });
      return json({ place: shape(res.data as GooglePlace) });
    }

    // ---- text search: the user typed something ------------------------------
    if (payload.mode === 'text') {
      const typed = typeof payload.query === 'string' ? payload.query.trim() : '';
      const canned = payload.category ? CATEGORIES[payload.category]?.textQuery : undefined;
      const textQuery = typed || canned;
      if (!textQuery) return json({ error: 'bad_request' }, 400);

      const res = await callPlaces(`${PLACES_ROOT}/places:searchText`, key, LIST_MASK, {
        textQuery,
        languageCode: lang,
        maxResultCount: MAX_RESULTS,
        // Bias, not restrict: a user searching a landmark by name should still
        // find it if it sits just outside the circle.
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(payload.radius) },
        },
      });
      if (res.error) return json({ error: res.error, status: res.status });
      const places = ((res.data?.places as GooglePlace[]) ?? []).map(shape).filter((p) => p.placeId);
      return json({ places });
    }

    // ---- nearby search: the user picked a category -------------------------
    if (payload.mode === 'nearby') {
      const cat = typeof payload.category === 'string' ? payload.category : '';
      const spec = CATEGORIES[cat];
      if (!spec) return json({ error: 'unknown_category' }, 400);

      // Categories with no clean Places type resolve as text instead.
      if (!spec.types) {
        const res = await callPlaces(`${PLACES_ROOT}/places:searchText`, key, LIST_MASK, {
          textQuery: spec.textQuery,
          languageCode: lang,
          maxResultCount: MAX_RESULTS,
          locationBias: {
            circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(payload.radius) },
          },
        });
        if (res.error) return json({ error: res.error, status: res.status });
        const places = ((res.data?.places as GooglePlace[]) ?? []).map(shape).filter((p) => p.placeId);
        return json({ places });
      }

      const res = await callPlaces(`${PLACES_ROOT}/places:searchNearby`, key, LIST_MASK, {
        includedTypes: spec.types,
        languageCode: lang,
        maxResultCount: MAX_RESULTS,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(payload.radius) },
        },
        rankPreference: 'POPULARITY',
      });
      if (res.error) return json({ error: res.error, status: res.status });
      const places = ((res.data?.places as GooglePlace[]) ?? []).map(shape).filter((p) => p.placeId);
      return json({ places });
    }

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 200) });
  }
}
