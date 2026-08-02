/**
 * Self-hosts listing photos instead of hotlinking sahibinden's CDN.
 *
 * A single listing can carry 60 full-resolution i0.shbdn.com/big_*.jpg URLs
 * with no thumbnail variant — that's the bulk of the page weight on
 * /real-estate/:id, and it depends on a third party's willingness to keep
 * serving our traffic for free. This downloads each photo, re-encodes it to
 * WebP at two sizes, uploads both to the existing Supabase `listings`
 * storage bucket, and rewrites listings.images to point at our own URLs.
 *
 * Generic and idempotent: run it after any import (this one or a future
 * one). It only touches rows whose images still point at a hotlinked host,
 * so re-running is a no-op for rows already self-hosted.
 *
 * Usage:
 *   node scripts/rehost-listing-photos.mjs           # process every eligible row
 *   node scripts/rehost-listing-photos.mjs --limit=3 # smoke-test on a few rows first
 *   node scripts/rehost-listing-photos.mjs --dry-run  # log what would happen, write nothing
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (server-side
 * only — never the anon key, RLS would block the write).
 */
import 'dotenv/config';
import sharp from 'sharp';
import { requireSupabaseEnv, restFetch, uploadToStorage } from './lib/supabaseRest.mjs';

const MAX_IMAGES_PER_LISTING = 12;
const GALLERY_WIDTH = 1200;
const THUMB_WIDTH = 400;
const WEBP_QUALITY = 78;
const HOTLINK_HOST_MARKERS = ['shbdn.com', 'sahibinden.com'];
const BUCKET = 'listings';
const FETCH_TIMEOUT_MS = 15000;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const limitArg = [...args].find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

function isHotlinked(url) {
  return typeof url === 'string' && HOTLINK_HOST_MARKERS.some((h) => url.includes(h));
}

async function downloadImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toWebp(buffer, width) {
  return sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer();
}

async function rehostOne(supa, listingId, sourceUrls) {
  const capped = sourceUrls.slice(0, MAX_IMAGES_PER_LISTING);
  const galleryUrls = [];

  for (let i = 0; i < capped.length; i++) {
    const src = capped[i];
    let original;
    try {
      original = await downloadImage(src);
    } catch (e) {
      console.warn(`  [skip photo ${i}] ${e.message}`);
      continue;
    }

    const [gallery, thumb] = await Promise.all([toWebp(original, GALLERY_WIDTH), toWebp(original, THUMB_WIDTH)]);
    const galleryPath = `${listingId}/${i}-${GALLERY_WIDTH}.webp`;
    const thumbPath = `${listingId}/${i}-${THUMB_WIDTH}.webp`;

    if (dryRun) {
      console.log(`  [dry-run] would upload ${galleryPath} (${gallery.length}b) + ${thumbPath} (${thumb.length}b)`);
      galleryUrls.push(src);
      continue;
    }

    const [galleryUrl] = await Promise.all([
      uploadToStorage(supa, BUCKET, galleryPath, gallery, 'image/webp'),
      uploadToStorage(supa, BUCKET, thumbPath, thumb, 'image/webp'),
    ]);
    galleryUrls.push(galleryUrl);
  }

  return galleryUrls;
}

async function main() {
  const supa = requireSupabaseEnv();
  const res = await restFetch(supa, 'listings?select=id,images,image&order=sort.asc');
  const rows = await res.json();

  const eligible = rows.filter((r) => Array.isArray(r.images) && r.images.some(isHotlinked)).slice(0, limit);
  console.log(`${rows.length} listings total, ${eligible.length} still hotlinking a source CDN.`);

  let done = 0;
  for (const row of eligible) {
    console.log(`\n${row.id} — ${row.images.length} source photos`);
    const galleryUrls = await rehostOne(supa, row.id, row.images);
    if (galleryUrls.length === 0) {
      console.warn('  no photos rehosted successfully, leaving row untouched');
      continue;
    }

    if (!dryRun) {
      await restFetch(supa, `listings?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: galleryUrls, image: galleryUrls[0] }),
      });
    }
    console.log(`  -> ${galleryUrls.length} photos self-hosted${dryRun ? ' (dry-run, not written)' : ''}`);
    done++;
  }

  console.log(`\nDone. ${done}/${eligible.length} listings updated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
