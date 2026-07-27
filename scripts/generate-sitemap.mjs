/**
 * Generates public/sitemap.xml and public/robots.txt — every public route, each
 * with hreflang alternates (ar/en/ru/fa + x-default) via <xhtml:link>.
 *
 * BOTH files are generated because both must carry an absolute origin and there
 * must be exactly one place that decides what it is (scripts/siteUrl.mjs).
 * robots.txt cannot dodge this with a relative reference: per Google's robots.txt
 * specification the Sitemap directive must be a fully-qualified URL, and a
 * relative one is not an error — it is silently ignored, so the sitemap simply
 * never gets discovered. robots.txt's previous hardcoded host disagreed with
 * VITE_BASE_URL, which is precisely that failure already in progress.
 *
 * The site has no per-language URLs (language is a client-only localStorage
 * preference — see src/i18n/index.ts), so every hreflang alternate for a
 * given <url> necessarily points at the SAME <loc> (self-referencing). See
 * src/lib/seo.ts for the same note re: the runtime <head> tags.
 *
 * Dynamic routes are read straight from the local data files that already
 * drive them at runtime (no Supabase round-trip needed — both /services/:slug
 * and /hub/:slug slugs are static, checked-in data):
 *   - /services/:slug ← src/data/guides-ar.json (`slug` field)
 *   - /hub/:slug       ← the fixed 6-slug list also hardcoded in
 *                        src/pages/Hub.tsx / MobileHub.tsx (keep in sync)
 *
 * Run via `npm run build` (prebuild step) or directly: node scripts/generate-sitemap.mjs
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteUrlOrExit } from './siteUrl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// No fallback host, deliberately — see scripts/siteUrl.mjs. Missing or
// malformed, this exits non-zero and takes `npm run build` down with it, which
// is the entire point: a wrong hostname here gets published to Google.
const SITE_URL = resolveSiteUrlOrExit(process.env);
const LANGS = ['ar', 'en', 'ru', 'fa'];
const today = new Date().toISOString().slice(0, 10);

// Keep in sync with Hub.tsx / MobileHub.tsx's GUIDE_SLUGS.
const HUB_SLUGS = ['istanbulkart', 'esim', 'ikamet', 'vergi', 'bank', 'districts'];

/** @type {{ path: string, changefreq: string, priority: string }[]} */
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'weekly', priority: '0.9' },
  { path: '/hub', changefreq: 'weekly', priority: '0.8' },
  { path: '/pricing', changefreq: 'monthly', priority: '0.8' },
  { path: '/residency', changefreq: 'monthly', priority: '0.8' },
  { path: '/real-estate', changefreq: 'weekly', priority: '0.8' },
  { path: '/health-tourism', changefreq: 'monthly', priority: '0.7' },
  { path: '/tricks', changefreq: 'monthly', priority: '0.6' },
  { path: '/referrals', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund', changefreq: 'yearly', priority: '0.3' },
];

function serviceSlugs() {
  const guides = JSON.parse(readFileSync(join(root, 'src/data/guides-ar.json'), 'utf8'));
  return guides.map((g) => g.slug);
}

const dynamicRoutes = [
  ...serviceSlugs().map((slug) => ({ path: `/services/${slug}`, changefreq: 'monthly', priority: '0.7' })),
  ...HUB_SLUGS.map((slug) => ({ path: `/hub/${slug}`, changefreq: 'monthly', priority: '0.6' })),
];

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function urlEntry({ path, changefreq, priority }) {
  const loc = escapeXml(`${SITE_URL}${path}`);
  const alternates = [...LANGS, 'x-default']
    .map((hreflang) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${loc}" />`)
    .join('\n');
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alternates,
    '  </url>',
  ].join('\n');
}

const body = [...STATIC_ROUTES, ...dynamicRoutes].map(urlEntry).join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;

writeFileSync(join(root, 'public/sitemap.xml'), xml, 'utf8');

// robots.txt — same origin, same single source. Kept byte-for-byte in the shape
// it already had (allow-all + one Sitemap line); only the host is now derived.
const robots = ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n');
writeFileSync(join(root, 'public/robots.txt'), robots, 'utf8');

console.log(
  `sitemap.xml + robots.txt generated: ${STATIC_ROUTES.length} static + ${dynamicRoutes.length} dynamic routes (${SITE_URL})`,
);
