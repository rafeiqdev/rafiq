import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
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
    ? join(dist, `${lang}.html`)
    : join(dist, lang, `${route.slice(1)}.html`);
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
}

if (urls.length !== 396) errors.push(`Unexpected sitemap URL count: ${urls.length}`);
if (!readFileSync(join(root, 'public/robots.txt'), 'utf8').includes('Sitemap: https://rafiq.ist/sitemap.xml')) {
  errors.push('robots.txt sitemap directive is missing or incorrect');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`SEO build check passed: ${urls.length} sitemap URLs have route-specific HTML, metadata, hreflang, and pre-rendered content.`);
