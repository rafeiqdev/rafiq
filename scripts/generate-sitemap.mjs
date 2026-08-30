/**
 * Generates the sitemap files and public/robots.txt — every public route, each
 * with hreflang alternates (ar/en/ru/fa + x-default) via <xhtml:link>.
 *
 * The ~400 URLs are split across two sitemaps instead of one flat file, because
 * a single from-day-one submission of ~400 near-uniform templated URLs is
 * exactly the shape search engines are cautious about on a low-trust new
 * domain (see the indexing audit that added this split): 78% of the catalog
 * is generated service/guide pages, and search engines crawl a segmented
 * sitemap's sections at independent priorities instead of treating the whole
 * batch as one undifferentiated blob.
 *
 *   - public/sitemap-priority.xml — the ~15-20 highest-value pages (home,
 *     hub pages, the residency spotlight services, the flagship guides).
 *   - public/sitemap-guides.xml   — every remaining guide and service page.
 *   - public/sitemap.xml          — a sitemap INDEX pointing at the two
 *     above (see https://www.sitemaps.org/protocol.html#index), which is what
 *     robots.txt and IndexNow's key-file location reference. This is the only
 *     file a crawler fetches directly.
 *
 * ALL THREE files are generated (plus robots.txt) because all must carry an
 * absolute origin and there must be exactly one place that decides what it is
 * (scripts/siteUrl.mjs). robots.txt cannot dodge this with a relative
 * reference: per Google's robots.txt specification the Sitemap directive must
 * be a fully-qualified URL, and a relative one is not an error — it is
 * silently ignored, so the sitemap simply never gets discovered. robots.txt's
 * previous hardcoded host disagreed with VITE_BASE_URL, which is precisely
 * that failure already in progress.
 *
 * Every page lives under a language segment (/ar /en /ru /fa — see
 * src/i18n/index.ts and App.tsx). Each route therefore emits FOUR <url>
 * entries, one per language, each cross-linking its three siblings via
 * hreflang plus an x-default pointing at the Arabic variant (the primary
 * audience and the target of the langless 301s in vercel.json). See
 * src/lib/seo.ts for the matching runtime <head> tags.
 *
 * scripts/generate-seo-pages.mjs, scripts/submit-indexnow.mjs and
 * scripts/check-seo-build.mjs all read the full page-URL list back out of
 * sitemap-priority.xml + sitemap-guides.xml (NOT sitemap.xml, which is an
 * index and carries no <url> entries of its own).
 *
 * Run via `npm run build` (prebuild step) or directly: node scripts/generate-sitemap.mjs
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
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

// Every <lastmod> used to be `today` unconditionally — a build-timestamp, not
// a content-change date, on all 400 URLs including pages like /terms that
// hadn't changed in weeks. Google explicitly discounts a <lastmod> it judges
// untrustworthy (identical, ever-advancing date on every URL is exactly that
// pattern), which forfeits the crawl-prioritization the tag exists for. Real
// signal instead: the most recent git commit date touching the source
// file(s) that actually feed each route's content. Falls back to `today`
// only if git has no history for a path (e.g. a brand-new file not yet
// committed) — never silently wrong, just as informative as before in that
// edge case.
const lastmodCache = new Map();
function gitLastModified(paths) {
  const key = paths.join('|');
  if (lastmodCache.has(key)) return lastmodCache.get(key);
  let result = today;
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cd', '--date=short', '--', ...paths],
      { cwd: root, encoding: 'utf8' },
    ).trim();
    if (out) result = out;
  } catch {
    // Not a git checkout, or git unavailable in this build environment —
    // fall back to the build date rather than failing the whole sitemap.
  }
  lastmodCache.set(key, result);
  return result;
}

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * Real content-change date for one route, scoped as tightly as the source
 * layout allows. Deliberately tracks only the CONTENT source files, not
 * scripts/generate-seo-pages.mjs (the shared rendering/template logic) — a
 * templating change reformats how content displays, it doesn't change the
 * facts on the page, and including it here would recreate the exact
 * every-URL-bumps-together pattern this fix exists to avoid, just on a
 * longer cycle (whenever the shared generator is next touched instead of
 * every build).
 */
function lastmodFor(path, lang) {
  if (path.startsWith('/guides/')) {
    return gitLastModified(['src/data/categoryGuides.ts']);
  }
  if (path.startsWith('/compare/')) {
    return gitLastModified(['src/data/comparisons.ts']);
  }
  const serviceMatch = path.match(/^\/services\/([^/]+)$/);
  if (serviceMatch) {
    return gitLastModified([`src/data/serviceSeo${capitalize(lang)}.ts`, 'src/data/services.ts']);
  }
  // Every other route (home, hubs, legal pages) is driven by the locale
  // strings — no more precise per-route source file to point at.
  return gitLastModified([`src/i18n/locales/${lang}.json`]);
}

// Priority pages: the homepage, the three hub/listing pages, the flagship
// guides and the residency-spotlight + health-tourism services — the ~15-20
// pages an engine should crawl and trust first. Everything else (the long
// tail of category guides and individual service pages) ships in the
// larger, lower-priority sitemap-guides.xml instead. See the file header.
const PRIORITY_GUIDE_IDS = ['residency', 'health', 'realestate', 'banking', 'tourism'];
const PRIORITY_SERVICE_IDS = [
  'res-tourist', 'res-property', 'res-renew', 'res-citizenship',
  'health-tourism', 're-buy', 'bank-account',
];
// Hand-maintained like the two lists above (src/data/comparisons.ts is
// hand-written, not catalog-generated, so there is no source array to derive
// this from) — update it when a new /compare/:id entry is added there.
// Comparison content is deliberately always "priority": there are only ever
// a few of these, each one written for a specific high-intent query, so none
// belongs in the long-tail sitemap-guides.xml.
const COMPARISON_IDS = ['residency-diy'];

/** @type {{ path: string, changefreq: string, priority: string, isPriority?: boolean }[]} */
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0', isPriority: true },
  { path: '/services', changefreq: 'weekly', priority: '0.9', isPriority: true },
  { path: '/news', changefreq: 'daily', priority: '0.7', isPriority: true },
  { path: '/real-estate', changefreq: 'weekly', priority: '0.8', isPriority: true },
  { path: '/health-tourism', changefreq: 'monthly', priority: '0.7', isPriority: true },
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
const categoryIds = [...servicesSource.matchAll(/\{ id: '([^']+)',\s+icon:/g)].map((match) => match[1]);
const guideRoutes = categoryIds.map((id) => ({
  path: `/guides/${id}`,
  changefreq: 'monthly',
  priority: PRIORITY_GUIDE_IDS.includes(id) ? '0.85' : '0.75',
  isPriority: PRIORITY_GUIDE_IDS.includes(id),
}));
const dynamicRoutes = serviceIds.map((id) => ({
  path: `/services/${id}`,
  changefreq: 'monthly',
  priority: PRIORITY_SERVICE_IDS.includes(id) ? '0.8' : '0.7',
  isPriority: PRIORITY_SERVICE_IDS.includes(id),
}));
const comparisonRoutes = COMPARISON_IDS.map((id) => ({
  path: `/compare/${id}`,
  changefreq: 'monthly',
  priority: '0.8',
  isPriority: true,
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
    `    <lastmod>${lastmodFor(path, lang)}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alternates,
    '  </url>',
  ].join('\n');
}

const staticEntries = LANGS.flatMap((lang) => STATIC_ROUTES.map((route) => [route, urlEntry(lang, route, LANGS)]));
const guideEntries = LANGS.flatMap((lang) => guideRoutes.map((route) => [route, urlEntry(lang, route, LANGS)]));
const dynamicEntries = SERVICE_LANGS.flatMap((lang) => dynamicRoutes.map((route) => [route, urlEntry(lang, route, SERVICE_LANGS)]));
const comparisonEntries = LANGS.flatMap((lang) => comparisonRoutes.map((route) => [route, urlEntry(lang, route, LANGS)]));
const allEntries = [...staticEntries, ...guideEntries, ...dynamicEntries, ...comparisonEntries];
const priorityBody = allEntries.filter(([route]) => route.isPriority).map(([, entry]) => entry).join('\n');
const guidesBody = allEntries.filter(([route]) => !route.isPriority).map(([, entry]) => entry).join('\n');

const urlset = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;

writeFileSync(join(root, 'public/sitemap-priority.xml'), urlset(priorityBody), 'utf8');
writeFileSync(join(root, 'public/sitemap-guides.xml'), urlset(guidesBody), 'utf8');

// sitemap.xml is now a sitemap INDEX — the only file robots.txt references —
// pointing at the two sitemaps above. <lastmod> uses the same build date
// since both member sitemaps were just (re)written together.
const sitemapIndex =
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [
    { loc: `${SITE_URL}/sitemap-priority.xml` },
    { loc: `${SITE_URL}/sitemap-guides.xml` },
  ]
    .map(({ loc }) => `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`)
    .join('\n') +
  '\n</sitemapindex>\n';
writeFileSync(join(root, 'public/sitemap.xml'), sitemapIndex, 'utf8');

// robots.txt — same origin, same single source. Kept byte-for-byte in the shape
// it already had (allow-all + one Sitemap line); only the host is now derived.
// One Sitemap directive is enough: it points at the index above, and per the
// sitemaps.org protocol a crawler that fetches an index automatically follows
// every <sitemap><loc> it contains.
const robots = [
  'User-agent: OAI-SearchBot',
  'Allow: /',
  '',
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  '',
].join('\n');
writeFileSync(join(root, 'public/robots.txt'), robots, 'utf8');

console.log(
  `sitemap-priority.xml (${allEntries.filter(([r]) => r.isPriority).length} URLs) + sitemap-guides.xml (${allEntries.filter(([r]) => !r.isPriority).length} URLs) + sitemap.xml index + robots.txt generated: ${staticEntries.length + guideEntries.length + dynamicEntries.length + comparisonEntries.length} URLs total (${STATIC_ROUTES.length} static routes, ${guideRoutes.length} guide routes, ${dynamicRoutes.length} service routes and ${comparisonRoutes.length} comparison routes in ${LANGS.length} languages) (${SITE_URL})`,
);
