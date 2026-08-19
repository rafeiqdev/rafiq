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

function readGuideFaqs() {
  const source = readFileSync(join(root, 'src/data/categoryGuides.ts'), 'utf8');
  const records = {};
  const blockPattern = /"faqs"\s*:\s*\[([\s\S]*?)\]\s*,/g;
  const pairPattern = new RegExp(
    `"question"\\s*:\\s*${quoted}\\s*,\\s*"answer"\\s*:\\s*${quoted}`,
    'g',
  );
  for (const block of source.matchAll(blockPattern)) {
    const before = source.slice(0, block.index);
    const categoryOpeners = [...before.matchAll(/^  "([^\"]+)"\s*:\s*\{\s*$/gm)];
    const languageOpeners = [...before.matchAll(/^    "(ar|en|ru|fa)"\s*:\s*\{\s*$/gm)];
    const id = categoryOpeners.at(-1)?.[1];
    const lang = languageOpeners.at(-1)?.[1];
    if (!id || !lang) continue;
    const faqs = [...block[1].matchAll(pairPattern)].map((match) => ({
      question: decodeTsString(match[1]),
      answer: decodeTsString(match[2]),
    }));
    records[id] ??= {};
    records[id][lang] = faqs;
  }
  return records;
}

function readGuideSections() {
  const source = readFileSync(join(root, 'src/data/categoryGuides.ts'), 'utf8');
  const records = {};
  const blockPattern = /"sections"\s*:\s*\[([\s\S]*?)\]\s*,\s*"faqs"/g;
  const pairPattern = new RegExp(
    `"heading"\\s*:\\s*${quoted}\\s*,\\s*"body"\\s*:\\s*${quoted}`,
    'g',
  );
  for (const block of source.matchAll(blockPattern)) {
    const before = source.slice(0, block.index);
    const categoryOpeners = [...before.matchAll(/^  "([^\"]+)"\s*:\s*\{\s*$/gm)];
    const languageOpeners = [...before.matchAll(/^    "(ar|en|ru|fa)"\s*:\s*\{\s*$/gm)];
    const id = categoryOpeners.at(-1)?.[1];
    const lang = languageOpeners.at(-1)?.[1];
    if (!id || !lang) continue;
    const sections = [...block[1].matchAll(pairPattern)].map((match) => ({
      heading: decodeTsString(match[1]),
      body: decodeTsString(match[2]),
    }));
    records[id] ??= {};
    records[id][lang] = sections;
  }
  return records;
}

const serviceSeo = Object.fromEntries(LANGS.map((lang) => [lang, readServiceSeo(lang)]));
const guideSeo = readGuideSeo();
const guideFaqs = readGuideFaqs();
const guideSections = readGuideSections();

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

function siteEntityJsonLd(lang) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Rafiq Istanbul',
        alternateName: ['Rafiq', 'رفيق إسطنبول', 'Рафик Стамбул', 'رفیق استانبول'],
        description: text(lang, 'common.tagline'),
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
        image: `${SITE_URL}/og-cover.png`,
        availableLanguage: ['Arabic', 'English', 'Russian', 'Persian'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Rafiq Istanbul',
        alternateName: ['Rafiq', 'رفيق إسطنبول'],
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: ['ar', 'en', 'ru', 'fa'],
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/${lang}/services?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

function faqPageJsonLd(items) {
  const mainEntity = items
    .map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }))
    .filter((item) => item.name && item.acceptedAnswer.text);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
}

function homeFaqItems(lang) {
  return ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']
    .map((id) => ({
      question: text(lang, `home.faq.${id}.q`),
      answer: text(lang, `home.faq.${id}.a`),
    }))
    .filter((item) => item.question && item.answer);
}

function renderFaqHtml(items, lang) {
  if (!items.length) return '';
  const heading = { ar: 'أسئلة شائعة', en: 'Common questions', ru: 'Частые вопросы', fa: 'پرسش‌های رایج' }[lang];
  return `
      <section aria-labelledby="seo-faq-heading">
        <h2 id="seo-faq-heading">${escapeHtml(heading)}</h2>
        ${items.map((item) => `
        <details>
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>`).join('')}
      </section>`;
}

function priorityLinkItems(lang) {
  const items = [
    ['/services/res-tourist', serviceSeo[lang]?.['res-tourist']?.title],
    ['/services/res-property', serviceSeo[lang]?.['res-property']?.title],
    ['/services/res-renew', serviceSeo[lang]?.['res-renew']?.title],
    ['/guides/residency', guideSeo.residency?.[lang]?.title],
  ];
  return items.filter(([, label]) => label);
}

function renderPriorityLinks(lang) {
  const items = priorityLinkItems(lang);
  if (!items.length) return '';
  const heading = {
    ar: 'خدمات الإقامة والأدلة المرتبطة',
    en: 'Residence services and related guides',
    ru: 'Услуги по ВНЖ и связанные гиды',
    fa: 'خدمات اقامت و راهنماهای مرتبط',
  }[lang];
  const intro = {
    ar: 'ابدأ من الصفحة الأقرب إلى حاجتك، ثم راجع التفاصيل والخطوات قبل إرسال الطلب.',
    en: 'Start with the page closest to your need, then review the details and steps before sending a request.',
    ru: 'Начните со страницы, которая ближе всего к вашей задаче, затем проверьте детали и шаги перед отправкой запроса.',
    fa: 'از صفحه‌ای که به نیاز شما نزدیک‌تر است شروع کنید و پیش از ارسال درخواست، جزئیات و مراحل را بررسی کنید.',
  }[lang];
  const links = items.map(([path, label]) =>
    `<li><a href="${escapeHtml(`/${lang}${path}`)}">${escapeHtml(label)}</a></li>`,
  ).join('');
  return `
      <section aria-labelledby="seo-priority-heading">
        <h2 id="seo-priority-heading">${escapeHtml(heading)}</h2>
        <p>${escapeHtml(intro)}</p>
        <ul>${links}</ul>
      </section>`;
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
    ['/', text(lang, 'nav.home')],
    ['/services', text(lang, 'nav.allServices')],
    ['/real-estate', text(lang, 'nav.realEstate')],
    ['/health-tourism', text(lang, 'nav.health')],
    ['/tricks', text(lang, 'nav.tricks')],
  ]
    .map(([path, label]) => `<a href="${escapeHtml(`/${lang}${path === '/' ? '' : path}`)}">${escapeHtml(label)}</a>`)
    .join(' · ');
  const priorityLinksHtml = route === '/' || route === '/services' ? renderPriorityLinks(lang) : '';
  const keywords = meta.keywords?.slice(0, 8).join(', ') ?? '';
  const keywordTag = keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : '';
  const answerHeading = { ar: 'إجابة مختصرة', en: 'Quick answer', ru: 'Краткий ответ', fa: 'پاسخ کوتاه' }[lang];
  let staticMain = `\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">\n      <article aria-labelledby="seo-title">\n        <h1 id="seo-title">${escapeHtml(meta.title)}</h1>\n        <section aria-labelledby="seo-answer-heading">\n          <h2 id="seo-answer-heading">${escapeHtml(answerHeading)}</h2>\n          <p>${escapeHtml(meta.content || meta.description)}</p>\n        </section>\n      </article>\n      <nav aria-label="${escapeHtml(text(lang, 'nav.home'))}">${nav}</nav>\n      ${priorityLinksHtml}\n    </main>`;
  const siteJsonLd = escapeJsonForHtml(siteEntityJsonLd(lang));
  const guideMatch = route.match(/^\/guides\/([^/]+)$/);
  const serviceMatch = route.match(/^\/services\/([^/]+)$/);
  const faqItems = route === '/'
    ? homeFaqItems(lang)
    : guideMatch
      ? guideFaqs[guideMatch[1]]?.[lang] ?? []
      : route === '/health-tourism'
        ? (text(lang, 'medical.landing.desktop.faq.items') ?? []).map((item) => ({ question: item.q, answer: item.a }))
        : [];
  const faqJsonLd = faqItems.length ? escapeJsonForHtml(faqPageJsonLd(faqItems)) : '';
  const serviceJsonLd = serviceMatch && serviceSeo[lang][serviceMatch[1]]
    ? escapeJsonForHtml({
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${url}#service`,
        name: meta.title,
        description: meta.description,
        serviceType: meta.title,
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: { '@type': 'City', name: 'Istanbul' },
        inLanguage: lang,
      })
    : '';

  if (guideMatch) {
    const sections = guideSections[guideMatch[1]]?.[lang] ?? [];
    const guideFaqItems = guideFaqs[guideMatch[1]]?.[lang] ?? [];
    if (sections.length || guideFaqItems.length) {
      const sectionHtml = sections.map((section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </section>`).join('');
      staticMain = `\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(meta.title)}</h1>
        <p>${escapeHtml(meta.content || meta.description)}</p>${sectionHtml}${renderFaqHtml(guideFaqItems, lang)}
      </article>
      <nav aria-label="${escapeHtml(text(lang, 'nav.home'))}">${nav}</nav>
      ${priorityLinksHtml}
    </main>`;
    }
  } else if (faqItems.length) {
    staticMain = staticMain.replace('</article>', `${renderFaqHtml(faqItems, lang)}\n      </article>`);
  }

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
  html = html.replace('</head>', `${alternateTags}\n    ${keywordTag}\n    <script id="ld-organization" type="application/ld+json">${siteJsonLd}</script>\n    ${serviceJsonLd ? `<script id="ld-service" type="application/ld+json">${serviceJsonLd}</script>` : ''}
    ${faqJsonLd ? `<script id="ld-faq" type="application/ld+json">${faqJsonLd}</script>` : ''}\n    <script type="application/ld+json">${jsonLd}</script>\n  </head>`);
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${staticMain}\n    </div>`);
  return html;
}

const template = readFileSync(join(dist, 'index.html'), 'utf8');
// sitemap.xml is a sitemap INDEX (see generate-sitemap.mjs); the actual page
// URLs live in its two member sitemaps.
const sitemaps = ['public/sitemap-priority.xml', 'public/sitemap-guides.xml']
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n');
const urls = [...sitemaps.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
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
