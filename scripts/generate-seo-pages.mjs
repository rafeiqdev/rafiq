/**
 * Create route-specific HTML shells after Vite has produced dist/index.html.
 *
 * The application is a client-rendered SPA, but public URLs need useful HTML
 * before JavaScript executes. Every URL in sitemap.xml gets its own static
 * shell under dist/<lang>/<route>/index.html. Vercel's filesystem routing
 * serves these files before the SPA rewrite; the React app then hydrates the
 * same #root element and keeps the existing client-side behavior.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteUrlOrExit } from './siteUrl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE_URL = resolveSiteUrlOrExit(process.env);
const LANGS = ['ar', 'en', 'ru', 'fa'];
const localeDir = join(root, 'src/i18n/locales');
const localeData = Object.fromEntries(
  LANGS.map((lang) => [lang, JSON.parse(readFileSync(join(localeDir, `${lang}.json`), 'utf8'))]),
);

const text = (lang, path) => path.split('.').reduce((value, key) => value?.[key], localeData[lang]);
const decodeTsString = (value) => JSON.parse(`"${value}"`);
const quoted = '"((?:\\\\.|[^"\\\\])*)"';

function readServiceSeo(lang) {
  const source = readFileSync(join(root, `src/data/serviceSeo${lang[0].toUpperCase()}${lang.slice(1)}.ts`), 'utf8');
  const records = {};
  const recordPattern = new RegExp(
    `"([^\"]+)"\\s*:\\s*\\{\\s*"seoTitle"\\s*:\\s*${quoted}\\s*,\\s*"metaDescription"\\s*:\\s*${quoted}\\s*,\\s*"searchPhrases"\\s*:\\s*\\[([\\s\\S]*?)\\]`,
    'g',
  );
  for (const match of source.matchAll(recordPattern)) {
    const phrases = [...match[4].matchAll(new RegExp(quoted, 'g'))].map((item) => decodeTsString(item[1]));
    records[match[1]] = {
      title: decodeTsString(match[2]),
      description: decodeTsString(match[3]),
      phrases,
    };
  }
  return records;
}

function readGuideSeo() {
  const source = readFileSync(join(root, 'src/data/categoryGuides.ts'), 'utf8');
  const records = {};
  const recordPattern = new RegExp(
    `"seoTitle"\\s*:\\s*${quoted}\\s*,\\s*"metaDescription"\\s*:\\s*${quoted}\\s*,\\s*"intro"\\s*:\\s*${quoted}`,
    'g',
  );
  for (const match of source.matchAll(recordPattern)) {
    const before = source.slice(0, match.index);
    const categoryOpeners = [...before.matchAll(/^  "([^"]+)"\s*:\s*\{\s*$/gm)];
    const languageOpeners = [...before.matchAll(/^    "(ar|en|ru|fa)"\s*:\s*\{\s*$/gm)];
    const id = categoryOpeners.at(-1)?.[1];
    const lang = languageOpeners.at(-1)?.[1];
    if (!id || !lang) continue;
    records[id] ??= {};
    records[id][lang] = {
      title: decodeTsString(match[1]),
      description: decodeTsString(match[2]),
      intro: decodeTsString(match[3]),
    };
  }
  return records;
}

const serviceSeo = Object.fromEntries(LANGS.map((lang) => [lang, readServiceSeo(lang)]));
const guideSeo = readGuideSeo();

const staticMeta = {
  '/': (lang) => ({
    title: `${text(lang, 'common.appName')} — ${text(lang, 'home.heroTitle')}`,
    description: text(lang, 'home.heroSubtitle'),
    content: text(lang, 'home.heroSubtitle'),
  }),
  '/services': (lang) => ({
    title: `${text(lang, 'services.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'services.subtitle'),
    content: text(lang, 'services.subtitle'),
  }),
  '/news': (lang) => ({
    title: `${text(lang, 'home.news.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'home.news.eyebrow'),
    content: `${text(lang, 'home.news.title')} — ${text(lang, 'home.news.eyebrow')}`,
  }),
  '/real-estate': (lang) => ({
    title: `${text(lang, 'realEstate.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'realEstate.subtitle'),
    content: text(lang, 'realEstate.subtitle'),
  }),
  '/health-tourism': (lang) => ({
    title: text(lang, 'medical.seo.title'),
    description: text(lang, 'medical.seo.description'),
    content: text(lang, 'medical.seo.description'),
  }),
  '/tricks': (lang) => ({
    title: `${text(lang, 'tricks.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'tricks.subtitle'),
    content: text(lang, 'tricks.subtitle'),
  }),
  '/referrals': (lang) => ({
    title: `${text(lang, 'referrals.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'referrals.subtitle'),
    content: text(lang, 'referrals.subtitle'),
  }),
  '/terms': (lang) => ({
    title: `${text(lang, 'legal.terms.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'legal.terms.body').split(/\n+/)[0],
    content: text(lang, 'legal.terms.body').split(/\n+/)[0],
  }),
  '/privacy': (lang) => ({
    title: `${text(lang, 'legal.privacy.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'legal.privacy.body').split(/\n+/)[0],
    content: text(lang, 'legal.privacy.body').split(/\n+/)[0],
  }),
  '/refund': (lang) => ({
    title: `${text(lang, 'legal.refund.title')} — ${text(lang, 'common.appName')}`,
    description: text(lang, 'legal.refund.body').split(/\n+/)[0],
    content: text(lang, 'legal.refund.body').split(/\n+/)[0],
  }),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function pageUrl(lang, route) {
  return `${SITE_URL}/${lang}${route === '/' ? '' : route}`;
}

function splitSitemapPath(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, '') || '/';
  const match = pathname.match(/^\/(ar|en|ru|fa)(\/.*)?$/);
  if (!match) return null;
  return { lang: match[1], route: match[2] || '/' };
}

function metaFor(lang, route) {
  const staticRecord = staticMeta[route]?.(lang);
  if (staticRecord) return staticRecord;

  const serviceMatch = route.match(/^\/services\/([^/]+)$/);
  if (serviceMatch) {
    const record = serviceSeo[lang][serviceMatch[1]];
    if (record) return { ...record, content: record.description, keywords: record.phrases };
  }

  const guideMatch = route.match(/^\/guides\/([^/]+)$/);
  if (guideMatch) {
    const record = guideSeo[guideMatch[1]]?.[lang];
    if (record) return { ...record, content: record.intro };
  }

  const fallbackName = route.split('/').filter(Boolean).join(' · ') || text(lang, 'common.appName');
  return {
    title: `${fallbackName} — ${text(lang, 'common.appName')}`,
    description: `${text(lang, 'common.appName')} — ${fallbackName}`,
    content: `${text(lang, 'common.appName')} — ${fallbackName}`,
  };
}

function upsertTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function buildHtml(template, lang, route, meta) {
  const url = pageUrl(lang, route);
  const locale = { ar: 'ar_SA', en: 'en_US', ru: 'ru_RU', fa: 'fa_IR' }[lang];
  const rtl = lang === 'ar' || lang === 'fa';
  const alternateTags = LANGS.map((alternate) =>
    `    <link rel="alternate" hreflang="${alternate}" href="${escapeHtml(pageUrl(alternate, route))}" />`,
  ).join('\n') + `\n    <link rel="alternate" hreflang="x-default" href="${escapeHtml(pageUrl('ar', route))}" />`;
  const nav = [
    ['/', text(lang, 'common.home')],
    ['/services', text(lang, 'common.allServices')],
    ['/real-estate', text(lang, 'common.realEstate')],
    ['/health-tourism', text(lang, 'common.health')],
    ['/tricks', text(lang, 'common.tricks')],
  ]
    .map(([path, label]) => `<a href="${escapeHtml(`/${lang}${path === '/' ? '' : path}`)}">${escapeHtml(label)}</a>`)
    .join(' · ');
  const keywords = meta.keywords?.slice(0, 8).join(', ') ?? '';
  const keywordTag = keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : '';
  const answerHeading = { ar: 'إجابة مختصرة', en: 'Quick answer', ru: 'Краткий ответ', fa: 'پاسخ کوتاه' }[lang];
  const staticMain = `\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">\n      <article aria-labelledby="seo-title">\n        <h1 id="seo-title">${escapeHtml(meta.title)}</h1>\n        <section aria-labelledby="seo-answer-heading">\n          <h2 id="seo-answer-heading">${escapeHtml(answerHeading)}</h2>\n          <p>${escapeHtml(meta.content || meta.description)}</p>\n        </section>\n      </article>\n      <nav aria-label="${escapeHtml(text(lang, 'common.home'))}">${nav}</nav>\n    </main>`;
  const jsonLd = escapeJsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: meta.title,
    description: meta.description,
    url,
    inLanguage: lang,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
  });

  let html = template;
  html = html.replace(/<html\b[^>]*>/i, `<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">`);
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = upsertTag(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(meta.description)}" />`);
  html = upsertTag(html, /<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="index,follow" />');
  html = upsertTag(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(url)}" />`);
  html = upsertTag(html, /<meta\s+property="og:locale"[^>]*>/i, `<meta property="og:locale" content="${locale}" />`);
  html = upsertTag(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  html = upsertTag(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
  html = upsertTag(html, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
  html = upsertTag(html, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`);
  html = upsertTag(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`);
  html = html.replace(/\s*<link\s+rel="alternate"[^>]*hreflang="(?:ar|en|ru|fa|x-default)"[^>]*>\s*/gi, '\n');
  html = html.replace('</head>', `${alternateTags}\n    ${keywordTag}\n    <script type="application/ld+json">${jsonLd}</script>\n  </head>`);
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${staticMain}\n    </div>`);
  return html;
}

const template = readFileSync(join(dist, 'index.html'), 'utf8');
const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
let generated = 0;
for (const url of urls) {
  const routeInfo = splitSitemapPath(url);
  if (!routeInfo) continue;
  const meta = metaFor(routeInfo.lang, routeInfo.route);
  const output = routeInfo.route === '/'
    ? join(dist, `${routeInfo.lang}.html`)
    : join(dist, routeInfo.lang, `${routeInfo.route.slice(1)}.html`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, buildHtml(template, routeInfo.lang, routeInfo.route, meta), 'utf8');
  generated += 1;
}

console.log(`Generated ${generated} route-specific SEO HTML shells under ${relative(root, resolve(dist))}.`);
