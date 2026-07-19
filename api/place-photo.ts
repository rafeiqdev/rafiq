/**
 * Place photo proxy. Places API (New) photo URLs need the API key as a query
 * parameter — putting the server key in an <img src> would publish it, and the
 * browser key would have to be un-restricted to work here. So the bytes are
 * streamed through us instead.
 *
 * GET /api/place-photo?ref=places/ChIJ…/photos/…&w=800
 *
 * Cached hard at the edge: photo bytes for a given reference never change, and
 * each miss is a billed Places call.
 */

export const config = { runtime: 'edge' };

const MAX_WIDTH = 1600;
const DEFAULT_WIDTH = 800;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response('method_not_allowed', { status: 405 });

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return new Response('no_key', { status: 503 });

  const url = new URL(req.url);
  const ref = url.searchParams.get('ref') ?? '';
  const widthRaw = Number(url.searchParams.get('w'));
  const width = Math.min(Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : DEFAULT_WIDTH, MAX_WIDTH);

  // The reference is a Google resource name: places/<id>/photos/<photoId>.
  // Validating the shape stops this endpoint being used as an open proxy.
  if (!/^places\/[A-Za-z0-9_\-]+\/photos\/[A-Za-z0-9_\-]+$/.test(ref)) {
    return new Response('bad_reference', { status: 400 });
  }

  const upstream = await fetch(
    `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}&key=${encodeURIComponent(key)}`,
    { redirect: 'follow' },
  );
  if (!upstream.ok || !upstream.body) return new Response('upstream_error', { status: 502 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
