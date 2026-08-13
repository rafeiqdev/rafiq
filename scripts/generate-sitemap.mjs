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
 * Every page lives under a language segment (/ar /en /ru /fa — see
 * src/i18n/index.ts and App.tsx). Each route therefore emits FOUR <url>
 * entries, one per language, each cross-linking its three siblings via
 * hreflang plus an x-default pointing at the Arabic variant (the primary
 * audience and the target of the langless 301s in vercel.json). See
 * src/lib/seo.ts for the matching runtime <head> tags.
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
// Detail pages are indexable only after their language-specific SEO copy is reviewed.
const SERVICE_LANGS = ['ar', 'en', 'ru', 'fa'];
const today = new Date().toISOString().slice(0, 10);

/** @type {{ path: string, changefreq: string, priority: string }[]} */
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'weekly', priority: '0.9' },
  { path: '/real-estate', changefreq: 'weekly', priority: '0.8' },
  { path: '/health-tourism', changefreq: 'monthly', priority: '0.7' },
  { path: '/tricks', changefreq: 'monthly', priority: '0.6' },
  { path: '/referrals', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund', changefreq: 'yearly', priority: '0.3' },
];

// Service pages are data-driven in src/data/services.ts. Keep sitemap discovery
// coupled to the catalog without importing TypeScript into this Node script.
const servicesSource = readFileSync(join(root, 'src/data/services.ts'), 'utf8');
const serviceIds = [...servicesSource.matchAll(/\{ id: '([^']+)', category:/g)].map((match) => match[1]);
const dynamicRoutes = serviceIds.map((id) => ({
  path: `/services/${id}`,
  changefreq: 'monthly',
  priority: '0.7',
}));

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** /ar + '/' -> https://…/ar ; /ar + '/services' -> https://…/ar/services */
const langUrl = (lang, path) => `${SITE_URL}/${lang}${path === '/' ? '' : path}`;

function urlEntry(lang, { path, changefreq, priority }, alternateLanguages) {
  const alternates = [
    ...alternateLanguages.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(langUrl(l, path))}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(langUrl('ar', path))}" />`,
  ].join('\n');
  return [
    '  <url>',
    `    <loc>${escapeXml(langUrl(lang, path))}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alternates,
    '  </url>',
  ].join('\n');
}

const staticEntries = LANGS.flatMap((lang) => STATIC_ROUTES.map((route) => urlEntry(lang, route, LANGS)));
const dynamicEntries = SERVICE_LANGS.flatMap((lang) => dynamicRoutes.map((route) => urlEntry(lang, route, SERVICE_LANGS)));
const body = [...staticEntries, ...dynamicEntries].join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;

writeFileSync(join(root, 'public/sitemap.xml'), xml, 'utf8');

// robots.txt — same origin, same single source. Kept byte-for-byte in the shape
// it already had (allow-all + one Sitemap line); only the host is now derived.
const robots = ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n');
writeFileSync(join(root, 'public/robots.txt'), robots, 'utf8');

console.log(
  `sitemap.xml + robots.txt generated: ${staticEntries.length + dynamicEntries.length} URLs (${STATIC_ROUTES.length} static routes in ${LANGS.length} languages; ${dynamicRoutes.length} service routes in ${SERVICE_LANGS.length} languages) (${SITE_URL})`,
);
