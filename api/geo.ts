/**
 * Visitor country, for the admin traffic screen.
 *
 * WHY A SERVER ENDPOINT AT ALL
 * ----------------------------------------------------------------------------
 * The browser cannot know which country it is in without either asking for
 * location permission (a scary prompt for a two-letter analytics field) or
 * shipping the visitor's IP to a third-party lookup service. Vercel's edge
 * already resolves the country from the IP for every request that reaches it,
 * and hands it over in `x-vercel-ip-country`. So the country is read HERE, off
 * a request the visitor was making anyway, and only the two-letter code is
 * returned.
 *
 * The IP itself is never returned, never logged, and never stored — the events
 * table has no IP column and this endpoint has no storage. A country code
 * alone cannot identify anyone.
 *
 * WHY NOT CITY
 * ----------------------------------------------------------------------------
 * `x-vercel-ip-city` exists, but a city plus a browsing history on a site
 * covering health and immigration services is a meaningfully different privacy
 * proposition from a country, and the owner's question was "which countries are
 * my visitors from". Country only, deliberately.
 *
 * Convention matches the other endpoints here: never throw at the caller. An
 * unknown country returns 200 with `{ country: null }`, and the client simply
 * records the visit without one.
 */

export const config = { runtime: 'edge' };

/** ISO 3166-1 alpha-2, or Vercel's "unknown" sentinel for an unresolved IP. */
const ISO2 = /^[A-Z]{2}$/;

export default async function handler(req: Request): Promise<Response> {
  const raw = (req.headers.get('x-vercel-ip-country') ?? '').trim().toUpperCase();
  // "XX" is what Vercel sends when it cannot resolve the IP (and what a local
  // `vite dev` sends: nothing at all). Both mean "unknown", not a country.
  const country = ISO2.test(raw) && raw !== 'XX' ? raw : null;

  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      // Per-visitor answer, so it must never be shared by a shared cache; the
      // client caches it for the session itself.
      'cache-control': 'private, no-store',
    },
  });
}
