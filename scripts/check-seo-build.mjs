import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Not `new URL('..', import.meta.url).pathname` — on Windows that keeps the
// leading slash (`/C:/Users/...`), which join() then doubles into a bogus
// `C:\C:\Users\...` path. fileURLToPath matches the sibling scripts.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const servicesSource = readFileSync(join(root, 'src/data/services.ts'), 'utf8');
const categoryIds = [...servicesSource.matchAll(/\{ id: '([^']+)',\s+icon:/g)].map((match) => match[1]);
// sitemap.xml is a sitemap INDEX (see generate-sitemap.mjs); the actual page
// URLs live in its two member sitemaps.
const sitemap = ['public/sitemap-priority.xml', 'public/sitemap-guides.xml']
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const errors = [];
const langs = ['ar', 'en', 'ru', 'fa'];

function routeInfo(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, '') || '/';
  const match = pathname.match(/^\/(ar|en|ru|fa)(\/.*)?$/);
  return match ? { lang: match[1], route: match[2] || '/' } : null;
}

function expectedFile({ lang, route }) {
  return route === '/'
    ? join(dist, lang, 'index.html')
    : join(dist, lang, route.slice(1), 'index.html');
}

function readJsonLd(html, id) {
  const match = html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function checkSiteEntity(html, url) {
  const entity = readJsonLd(html, 'ld-organization');
  const graph = entity?.['@graph'] ?? [];
  if (!entity || !graph.some((item) => item['@type'] === 'Organization')) errors.push(`Missing Organization schema: ${url}`);
  const website = graph.find((item) => item['@type'] === 'WebSite');
  if (!website || website.potentialAction?.['@type'] !== 'SearchAction') errors.push(`Missing WebSite SearchAction: ${url}`);
}

for (const url of urls) {
  const info = routeInfo(url);
  if (!info) {
    errors.push(`Invalid sitemap URL: ${url}`);
    continue;
  }
  const file = expectedFile(info);
  if (!existsSync(file)) {
    errors.push(`Missing HTML: ${file}`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const canonical = [...html.matchAll(/<link\s+rel="canonical"[^>]*>/gi)];
  const expectedCanonical = `${url}`;
  if (canonical.length !== 1 || !canonical[0][0].includes(`href="${expectedCanonical}"`)) {
    errors.push(`Canonical mismatch: ${url}`);
  }
  for (const lang of langs) {
    const alternate = `<link rel="alternate" hreflang="${lang}" href="`;
    if (!html.includes(alternate)) errors.push(`Missing hreflang ${lang}: ${url}`);
  }
  if (!html.includes('<link rel="alternate" hreflang="x-default" href="')) {
    errors.push(`Missing hreflang x-default: ${url}`);
  }
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`Missing title: ${url}`);
  if (!/<meta name="description" content="[^"]+"\s*\/?\s*>/i.test(html)) errors.push(`Missing description: ${url}`);
  if (!html.includes('<main id="seo-fallback"')) errors.push(`Missing pre-rendered content: ${url}`);
  checkSiteEntity(html, url);
  if ((info.route === '/' || info.route === '/services') && !html.includes(`/${info.lang}/services/res-tourist`)) {
    errors.push(`Priority residence link is missing from pre-rendered HTML: ${url}`);
  }
  const missingGuideLinks = categoryIds.filter((id) => !html.includes(`href="/${info.lang}/guides/${id}"`));
  if (missingGuideLinks.length) {
    errors.push(`Footer guide links missing from pre-rendered HTML (${missingGuideLinks.join(', ')}): ${url}`);
  }
  // Everything pre-rendered into #root must sit inside <main id="seo-fallback">,
  // because only that id carries index.html's visually-hidden rule. Content
  // after </main> paints as raw visible text until React hydrates.
  const footerHeadingIndex = html.indexOf('id="seo-footer-guides-heading"');
  const mainCloseIndex = html.indexOf('</main>');
  if (footerHeadingIndex !== -1 && (mainCloseIndex === -1 || footerHeadingIndex > mainCloseIndex)) {
    errors.push(`Footer guide links sit outside the hidden #seo-fallback main (they flash as visible text): ${url}`);
  }
  if (info.route === '/' && (!readJsonLd(html, 'ld-faq') || (html.match(/<details>/g) ?? []).length < 6)) {
    errors.push(`Home FAQ schema/content is incomplete: ${url}`);
  }
  if (/^\/guides\/[^/]+$/.test(info.route) && (!readJsonLd(html, 'ld-faq') || (html.match(/<details>/g) ?? []).length === 0)) {
    errors.push(`Guide FAQ schema/content is incomplete: ${url}`);
  }
  if (info.route === '/health-tourism' && (!readJsonLd(html, 'ld-faq') || (html.match(/<details>/g) ?? []).length === 0)) {
    errors.push(`Health-tourism FAQ schema/content is incomplete: ${url}`);
  }
  if (/^\/services\/[^/]+$/.test(info.route) && !readJsonLd(html, 'ld-service')) {
    errors.push(`Service schema is missing: ${url}`);
  }
}

if (urls.length !== 400) errors.push(`Unexpected sitemap URL count: ${urls.length}`);
const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');
const sitemapDirective = robots.match(/^Sitemap:\s*(\S+)$/im)?.[1];
const expectedSitemap = urls[0] ? `${new URL(urls[0]).origin}/sitemap.xml` : null;
if (!sitemapDirective || sitemapDirective !== expectedSitemap) {
  errors.push('robots.txt sitemap directive is missing or incorrect');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`SEO build check passed: ${urls.length} sitemap URLs have route-specific HTML, metadata, hreflang, and pre-rendered content.`);
