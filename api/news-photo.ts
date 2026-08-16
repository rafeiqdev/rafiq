/**
 * News photo proxy — resolves a Telegram post's photo at request time instead
 * of trusting a URL saved days ago.
 *
 * GET /api/news-photo?post=akhbarturkiye/50202
 *
 * WHY THIS EXISTS
 * ----------------------------------------------------------------------------
 * cdn*.telesco.pe URLs are ephemeral. The sync stored whatever URL the channel
 * page carried at the time, and within a few days every one of them answers
 * 404 — the home page's news cards silently lost their photos. Re-syncing does
 * not heal it either: the cron only refreshes posts still inside the channel's
 * latest-N window, so an older post's dead URL is frozen forever.
 *
 * A post's *permalink*, though, is permanent, and its embed page always carries
 * a currently-valid photo URL. So the durable fix is to stop storing the photo
 * URL at all and resolve it per request, which also heals every already-broken
 * row without a backfill. Same shape as api/place-photo.ts, for the same
 * reason: the bytes come through us so the page never depends on a URL that
 * expires.
 *
 * Cached hard at the edge — a post's photo never changes, and each miss costs
 * two upstream requests.
 */

import { parsePostPhotoUrl, postRef } from '../src/lib/telegramNews.js';

export const config = { runtime: 'edge' };

const FETCH_TIMEOUT_MS = 8000;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response('method_not_allowed', { status: 405 });

  // Re-validate through the same parser the client used to build the link.
  // This is what keeps the endpoint from being an open proxy: only
  // "<channel>/<messageId>" gets past it, and the only host ever fetched is
  // t.me — then, for the photo itself, Telegram's own CDN (checked in
  // parsePostPhotoUrl, because that URL comes out of third-party HTML).
  const ref = postRef(`https://t.me/${new URL(req.url).searchParams.get('post') ?? ''}`);
  if (!ref) return new Response('bad_reference', { status: 400 });

  let photoUrl: string | null = null;
  try {
    const page = await fetch(`https://t.me/${ref}?embed=1`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RafiqIstanbul/1.0)' },
    });
    if (page.ok) photoUrl = parsePostPhotoUrl(await page.text());
  } catch {
    // Fall through to the 502 below — a timeout here is not different, to the
    // caller, from Telegram having removed the post.
  }
  // A post with no photo (text-only, or deleted) is not an error worth
  // retrying, but the card already degrades to text on any non-2xx, so the
  // single failure status keeps the client simple.
  if (!photoUrl) return new Response('no_photo', { status: 502 });

  const upstream = await fetch(photoUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response('upstream_error', { status: 502 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
