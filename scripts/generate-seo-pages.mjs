/**
 * Create route-specific HTML shells after Vite has produced dist/index.html.
 *
 * The application is a client-rendered SPA, but public URLs need useful HTML
 * before JavaScript executes. Every URL in sitemap.xml gets its own static
 * shell under dist/<lang>/<route>/index.html. Vercel's filesystem routing
 * serves these files before the SPA rewrite; the React app then hydrates the
 * same #root element and keeps the existing client-side behavior.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteUrlOrExit } from './siteUrl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE_URL = resolveSiteUrlOrExit(process.env);
const today = new Date().toISOString().slice(0, 10);

// Same real-content-change-date approach as generate-sitemap.mjs's
// gitLastModified/lastmodFor (see that file's header comment for the "why
// git, not build time" reasoning) — duplicated rather than imported because
// the two scripts key their route -> source-file mapping differently (one by
// sitemap <loc> path, one by in-memory route string) and neither route table
// is a strict subset of the other. AI answer engines weight recency heavily
// (pages stale 6+ months lose citation eligibility), so exposing a real
// dateModified here — not just in the sitemap Google already sees — is what
// actually reaches AI crawlers reading the static HTML directly.
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
    // fall back to the build date rather than failing the whole build.
  }
  lastmodCache.set(key, result);
  return result;
}

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

function dateModifiedFor(lang, route) {
  if (route.startsWith('/guides/')) return gitLastModified(['src/data/categoryGuides.ts']);
  if (route.startsWith('/compare/')) return gitLastModified(['src/data/comparisons.ts']);
  if (route === '/faq') return gitLastModified(['src/data/faqHub.ts']);
  const serviceMatch = route.match(/^\/services\/([^/]+)$/);
  if (serviceMatch) return gitLastModified([`src/data/serviceSeo${capitalize(lang)}.ts`, 'src/data/services.ts']);
  return gitLastModified([`src/i18n/locales/${lang}.json`]);
}
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
  // "body" is an optional field some services (e.g. res-rejected) carry
  // between metaDescription and searchPhrases — it must stay optional here or
  // any record that has it silently fails to match and falls through to the
  // generic "services · <id>" fallback title/meta at render time.
  const recordPattern = new RegExp(
    `"([^\"]+)"\\s*:\\s*\\{\\s*"seoTitle"\\s*:\\s*${quoted}\\s*,\\s*"metaDescription"\\s*:\\s*${quoted}\\s*,\\s*(?:"body"\\s*:\\s*${quoted}\\s*,\\s*)?"searchPhrases"\\s*:\\s*\\[([\\s\\S]*?)\\]`,
    'g',
  );
  for (const match of source.matchAll(recordPattern)) {
    const phrases = [...match[5].matchAll(new RegExp(quoted, 'g'))].map((item) => decodeTsString(item[1]));
    records[match[1]] = {
      title: decodeTsString(match[2]),
      description: decodeTsString(match[3]),
      body: match[4] ? decodeTsString(match[4]) : undefined,
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

/** Index of the character after `start` in `source` that closes the brace opened at `start`. */
function findMatchingBrace(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return i;
  }
  throw new Error(`Unbalanced braces from index ${start}`);
}

/**
 * src/data/comparisons.ts's string values are double-quoted with JSON-style
 * escaping (see that file's header for why), so — unlike the field-by-field
 * regex parsing readGuideSeo/readGuideFaqs/readGuideSections do above — each
 * per-language block can be sliced out by brace-matching and handed straight
 * to JSON.parse. Simpler and more robust than replicating that regex
 * approach for a shape with an extra nesting level (the "rows" array).
 */
function readComparisons() {
  const source = readFileSync(join(root, 'src/data/comparisons.ts'), 'utf8');
  const records = {};
  const idPattern = /^ {2}"([^"]+)":\s*\{$/gm;
  for (const idMatch of source.matchAll(idPattern)) {
    const openIndex = idMatch.index + idMatch[0].length - 1;
    const closeIndex = findMatchingBrace(source, openIndex);
    const block = source.slice(openIndex, closeIndex + 1);
    records[idMatch[1]] = {};
    for (const langMatch of block.matchAll(/"(ar|en|ru|fa)":\s*\{/g)) {
      const langOpen = langMatch.index + langMatch[0].length - 1;
      const langClose = findMatchingBrace(block, langOpen);
      records[idMatch[1]][langMatch[1]] = JSON.parse(block.slice(langOpen, langClose + 1));
    }
  }
  return records;
}

/**
 * src/data/faqHub.ts's FAQ_HUB is a flat Record<Lang, Content> (unlike
 * COMPARISONS, which nests an id above the language) — the top-level keys
 * ARE the language codes, so this is a simpler version of readComparisons()'s
 * brace-matching + JSON.parse approach, one level shallower.
 */
function readFaqHub() {
  const source = readFileSync(join(root, 'src/data/faqHub.ts'), 'utf8');
  const records = {};
  for (const langMatch of source.matchAll(/^ {2}"(ar|en|ru|fa)":\s*\{$/gm)) {
    const openIndex = langMatch.index + langMatch[0].length - 1;
    const closeIndex = findMatchingBrace(source, openIndex);
    records[langMatch[1]] = JSON.parse(source.slice(openIndex, closeIndex + 1));
  }
  return records;
}

const serviceSeo = Object.fromEntries(LANGS.map((lang) => [lang, readServiceSeo(lang)]));
const guideSeo = readGuideSeo();
const guideFaqs = readGuideFaqs();
const guideSections = readGuideSections();
const comparisons = readComparisons();
const faqHub = readFaqHub();

// Same category order as the live SiteFooter (src/components/SiteFooter.tsx's
// useGuideLinks, sourced from SERVICE_CATEGORIES) and the same extraction
// regex generate-sitemap.mjs already uses on this file.
const servicesSource = readFileSync(join(root, 'src/data/services.ts'), 'utf8');
const categoryIds = [...servicesSource.matchAll(/\{ id: '([^']+)',\s+icon:/g)].map((match) => match[1]);
// service id -> 'direct' | 'partner', used to pick the same directSupport /
// partnerSupport line ServiceDetail.tsx shows live, so the static shell never
// says something the hydrated page contradicts.
const serviceType = Object.fromEntries(
  [...servicesSource.matchAll(/\{ id: '([^']+)',\s+category: '[^']+',\s+type: '(direct|partner)'/g)]
    .map((match) => [match[1], match[2]]),
);
// service id -> category, and id -> {ar,en} title, for the "related services"
// cross-links below. Mirrors ServiceDetail.tsx's pickText() fallback: ru/fa
// fall back to the English title because services.ts itself has no ru/fa
// titles (only ar/en/tr).
const serviceCategory = {};
const serviceTitleByLang = { ar: {}, en: {} };
for (const match of servicesSource.matchAll(
  /\{ id: '([^']+)',\s+category: '([^']+)',\s+type: '(?:direct|partner)',\s+icon: '[^']+',\s+title: \{ ar: '([^']*)', en: '([^']*)'/g,
)) {
  const [, id, category, ar, en] = match;
  serviceCategory[id] = category;
  serviceTitleByLang.ar[id] = ar;
  serviceTitleByLang.en[id] = en;
}
// Plain catalog name (e.g. "إقامة سياحية"), not the SEO title (which carries
// a "| رفيق" brand suffix and would read oddly interpolated mid-sentence).
function catalogTitle(lang, id) {
  return (lang === 'ar' ? serviceTitleByLang.ar[id] : serviceTitleByLang.en[id]) ?? '';
}

// Mirrors ServiceDetail.tsx's copyFor(): static per-language strings already
// shown on the live page. directSupport/directSupport carry a {service}
// token filled with the service's own title, so the 78 service pages don't
// all ship the exact same sentence verbatim — two independent SEO audit
// passes (technical + content) flagged the fully generic version as a
// doorway/thin-content pattern at that page count. The fact conveyed
// (direct vs. partner coordination) is unchanged, still 100% accurate,
// still not inventing anything — just naming the specific service instead
// of saying "this service".
const SERVICE_DETAIL_COPY = {
  ar: {
    howHeading: 'كيف يساعدك رفيق في هذه الخدمة؟',
    directSupport: 'يقدّم رفيق تنسيق خدمة «{service}» مباشرة، ويمكنك إرسال احتياجك ليتم ترتيب الخطوة التالية معك.',
    partnerSupport: 'ينسّق رفيق خدمة «{service}» عبر شريك مختص، ويمكنك إرسال احتياجك ليتم توجيهك إلى الخطوة المناسبة.',
    topicsHeading: 'أسئلة ومواضيع مرتبطة بالخدمة',
    topicsIntro: 'هذه أبرز الموضوعات التي يبحث عنها العملاء قبل بدء الإجراءات. المتطلبات والقرارات النهائية تعتمد على حالتك والجهات المختصة.',
    relatedHeading: 'خدمات ذات صلة',
  },
  en: {
    howHeading: 'How can Rafiq help with this service?',
    directSupport: 'Rafiq coordinates {service} directly. Send your needs and we will discuss an appropriate next step with you.',
    partnerSupport: 'Rafiq coordinates {service} through a partner. Send your needs for guidance on an appropriate next step.',
    topicsHeading: 'Common questions and related topics',
    topicsIntro: 'These are common topics customers research before starting. Requirements and final decisions depend on your situation and the relevant authorities or providers.',
    relatedHeading: 'Related services',
  },
  ru: {
    howHeading: 'Как Rafiq может помочь с этой услугой?',
    directSupport: 'Rafiq координирует услугу «{service}» напрямую. Отправьте свой запрос, и мы обсудим подходящий следующий шаг.',
    partnerSupport: 'Rafiq координирует услугу «{service}» через партнёра. Отправьте свой запрос, чтобы получить ориентир по следующему шагу.',
    topicsHeading: 'Частые вопросы и связанные темы',
    topicsIntro: 'Это распространённые темы, которые клиенты изучают до начала процесса. Требования и окончательные решения зависят от вашей ситуации и компетентных органов или поставщиков.',
    relatedHeading: 'Связанные услуги',
  },
  fa: {
    howHeading: 'Rafiq چگونه می‌تواند در این خدمت کمک کند؟',
    directSupport: 'Rafiq خدمت «{service}» را مستقیماً هماهنگ می‌کند. نیاز خود را بفرستید تا درباره گام بعدی مناسب صحبت کنیم.',
    partnerSupport: 'Rafiq خدمت «{service}» را از طریق همکار هماهنگ می‌کند. نیاز خود را بفرستید تا برای گام بعدی مناسب راهنمایی شوید.',
    topicsHeading: 'پرسش‌های رایج و موضوعات مرتبط',
    topicsIntro: 'این‌ها موضوعات رایجی هستند که مشتریان پیش از شروع بررسی می‌کنند. شرایط و تصمیم‌های نهایی به وضعیت شما و مراجع یا ارائه‌کنندگان مربوط بستگی دارد.',
    relatedHeading: 'خدمات مرتبط',
  },
};

// Same 4-item related-services list ServiceDetail.tsx shows live (same
// category, excluding itself, catalog declaration order). ru/fa use the
// English title, matching pickText()'s fallback since services.ts has no
// ru/fa titles.
function relatedServiceItems(lang, id) {
  const category = serviceCategory[id];
  if (!category) return [];
  const titles = lang === 'ar' ? serviceTitleByLang.ar : serviceTitleByLang.en;
  return Object.keys(serviceCategory)
    .filter((otherId) => serviceCategory[otherId] === category && otherId !== id)
    .slice(0, 4)
    .map((otherId) => [otherId, titles[otherId]])
    .filter(([, label]) => label);
}

function renderRelatedServices(lang, id) {
  const items = relatedServiceItems(lang, id);
  if (!items.length) return '';
  const copy = SERVICE_DETAIL_COPY[lang];
  const links = items.map(([otherId, label]) =>
    `<li><a href="${escapeHtml(`/${lang}/services/${otherId}`)}">${escapeHtml(label)}</a></li>`,
  ).join('');
  return `
      <section aria-labelledby="seo-related-heading">
        <h2 id="seo-related-heading">${escapeHtml(copy.relatedHeading)}</h2>
        <ul>${links}</ul>
      </section>`;
}

// Renders the same "how we help" + "related topics" sections ServiceDetail.tsx
// shows after hydration, using data that already exists for all 78 services
// (not just the one with a `body`): the catalog description, the direct/
// partner line, and the searchPhrases array already written per service.
// Without this, ~300 of the site's 400 pages (77 services x 4 languages)
// shipped as a title plus one sentence — the likely reason GSC reported 394
// of 400 sitemap URLs as "Discovered - currently not indexed" days after
// submission.
const FALLBACK_SERVICE_LABEL = { ar: 'هذه الخدمة', en: 'this service', ru: 'эту услугу', fa: 'این خدمت' };

function renderServiceTopicsSections(lang, id, serviceTitle) {
  const copy = SERVICE_DETAIL_COPY[lang];
  const phrases = serviceSeo[lang][id]?.phrases ?? [];
  const template = serviceType[id] === 'direct' ? copy.directSupport : copy.partnerSupport;
  const supportLine = template.replace('{service}', serviceTitle || FALLBACK_SERVICE_LABEL[lang]);

  // The "quick answer" section right above this one already shows
  // meta.description, so this only adds the direct/partner line — repeating
  // the same sentence twice in one page reads as low-effort filler.
  const howHtml = `
      <section aria-labelledby="seo-how-heading">
        <h2 id="seo-how-heading">${escapeHtml(copy.howHeading)}</h2>
        <p>${escapeHtml(supportLine)}</p>
      </section>`;

  const topicsHtml = phrases.length ? `
      <section aria-labelledby="seo-topics-heading">
        <h2 id="seo-topics-heading">${escapeHtml(copy.topicsHeading)}</h2>
        <p>${escapeHtml(copy.topicsIntro)}</p>
        <ul>${phrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}</ul>
      </section>` : '';

  const relatedHtml = renderRelatedServices(lang, id);

  return howHtml + topicsHtml + relatedHtml;
}

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
  '/faq': (lang) => ({
    title: faqHub[lang].seoTitle,
    description: faqHub[lang].metaDescription,
    content: faqHub[lang].intro,
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

// Mirrors ServiceDetail.tsx's renderServiceBody: paragraphs separated by a
// blank line, except a block where every line starts with "- " renders as a
// bullet list, so the static shell matches what crawlers/no-JS visitors see.
function renderServiceBody(body) {
  return body
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n').filter(Boolean);
      const isList = lines.length > 0 && lines.every((line) => line.startsWith('- '));
      if (isList) {
        return `<ul>${lines.map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join('')}</ul>`;
      }
      return `<p>${escapeHtml(block)}</p>`;
    })
    .join('');
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

// No standalone Guides index page exists (only /guides/:id), so that
// breadcrumb level omits `item` rather than link to a route that 404s.
const GUIDES_LABEL = { ar: 'الأدلة', en: 'Guides', ru: 'Гиды', fa: 'راهنماها' };

function breadcrumbJsonLd(lang, route, meta) {
  if (route === '/') return null;
  const items = [{ '@type': 'ListItem', position: 1, name: text(lang, 'nav.home'), item: pageUrl(lang, '/') }];
  const guideMatch = route.match(/^\/guides\/([^/]+)$/);
  const serviceMatch = route.match(/^\/services\/([^/]+)$/);

  if (serviceMatch) {
    items.push({ '@type': 'ListItem', position: 2, name: text(lang, 'nav.allServices'), item: pageUrl(lang, '/services') });
    items.push({ '@type': 'ListItem', position: 3, name: meta.title });
  } else if (guideMatch) {
    items.push({ '@type': 'ListItem', position: 2, name: GUIDES_LABEL[lang] });
    items.push({ '@type': 'ListItem', position: 3, name: meta.title });
  } else {
    items.push({ '@type': 'ListItem', position: 2, name: meta.title });
  }

  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

function homeFaqItems(lang) {
  return ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']
    .map((id) => ({
      question: text(lang, `home.faq.${id}.q`),
      answer: text(lang, `home.faq.${id}.a`),
    }))
    .filter((item) => item.question && item.answer);
}

/** Just the <details> blocks, no wrapping <section>/heading — for callers (like /faq's per-category sections) that already provide their own heading. renderFaqHtml wraps both, which would be a redundant, duplicate-id heading here. */
function renderDetailsListHtml(items) {
  return items.map((item) => `
        <details>
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>`).join('');
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

// The medical.landing.desktop.* keys already power the live health-tourism
// page (specialties grid, 4-step process, logistics cards). They're static
// per-language strings, not live API data, so they're safe to bake into the
// crawler-visible shell the same way FAQ items already are — without this,
// a non-JS crawler only ever sees the one-line meta description instead of
// the actual treatment list that ranks for "hair transplant Istanbul" etc.
function renderHealthTourismSections(lang) {
  const specialties = text(lang, 'medical.landing.desktop.specialties.items') ?? [];
  const steps = text(lang, 'medical.landing.desktop.how.steps') ?? [];
  const cards = text(lang, 'medical.landing.desktop.logistics.cards') ?? [];

  const specialtiesHtml = specialties.length ? `
      <section aria-labelledby="seo-specialties-heading">
        <h2 id="seo-specialties-heading">${escapeHtml(text(lang, 'medical.landing.desktop.specialties.title'))}</h2>
        <ul>${specialties.map((item) =>
          `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.description)}</li>`,
        ).join('')}</ul>
      </section>` : '';

  const howHtml = steps.length ? `
      <section aria-labelledby="seo-how-heading">
        <h2 id="seo-how-heading">${escapeHtml(text(lang, 'medical.landing.desktop.how.title'))}</h2>
        <ol>${steps.map((step) =>
          `<li><strong>${escapeHtml(step.title)}</strong> — ${escapeHtml(step.body)}</li>`,
        ).join('')}</ol>
      </section>` : '';

  const logisticsHtml = cards.length ? `
      <section aria-labelledby="seo-logistics-heading">
        <h2 id="seo-logistics-heading">${escapeHtml(text(lang, 'medical.landing.desktop.logistics.title'))}</h2>
        <ul>${cards.map((card) =>
          `<li><strong>${escapeHtml(card.title)}</strong> — ${escapeHtml(card.description)}</li>`,
        ).join('')}</ul>
      </section>` : '';

  return specialtiesHtml + howHtml + logisticsHtml;
}

// realEstate.citizenshipNotice and .invest.* are static per-language strings
// (unlike the live listings grid, which is fetched at runtime and correctly
// stays out of the static shell to avoid going stale between deploys).
function renderRealEstateSections(lang) {
  const notice = text(lang, 'realEstate.citizenshipNotice');
  const investTitle = text(lang, 'realEstate.invest.title');
  const investBody = text(lang, 'realEstate.invest.body');
  const parts = [];
  if (notice) parts.push(`<p>${escapeHtml(notice)}</p>`);
  if (investTitle && investBody) {
    parts.push(`
      <section aria-labelledby="seo-invest-heading">
        <h2 id="seo-invest-heading">${escapeHtml(investTitle)}</h2>
        <p>${escapeHtml(investBody)}</p>
      </section>`);
  }
  return parts.join('');
}

const COMPARISON_ASPECT_LABEL = { ar: 'النقطة', en: 'What matters', ru: 'Что важно', fa: 'نکته مهم' };

/** Mirrors the <table> Comparison.tsx renders client-side — same three columns, same row data. */
function renderComparisonTableHtml(comparison, lang) {
  const rowsHtml = comparison.rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.aspect)}</td>
            <td>${escapeHtml(row.alone)}</td>
            <td>${escapeHtml(row.rafiq)}</td>
          </tr>`).join('');
  return `
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(COMPARISON_ASPECT_LABEL[lang])}</th>
            <th>${escapeHtml(comparison.aloneLabel)}</th>
            <th>${escapeHtml(comparison.rafiqLabel)}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>`;
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

// Mirrors SiteFooter's useGuideLinks, but baked into the static shell instead
// of depending on client-side hydration: a crawler that doesn't run (or
// budgets) JS otherwise only ever sees the single /guides/residency link from
// renderPriorityLinks above, which is the same orphan-link gap the footer
// change was meant to close. See the indexing audit this responds to.
function footerGuideLinkItems(lang) {
  // Mirrors SiteFooter.tsx's useGuideLinks(), which appends /compare/:id
  // links after the category guides — keep both lists in the same order so
  // the pre-rendered shell matches what React hydrates over it.
  const guideLinks = categoryIds
    .map((id) => [`/guides/${id}`, guideSeo[id]?.[lang]?.title])
    .filter(([, label]) => label);
  const comparisonLinks = Object.keys(comparisons)
    .map((id) => [`/compare/${id}`, comparisons[id]?.[lang]?.navLabel])
    .filter(([, label]) => label);
  return [...guideLinks, ...comparisonLinks];
}

function renderFooterGuideLinks(lang) {
  const items = footerGuideLinkItems(lang);
  if (!items.length) return '';
  const heading = { ar: 'كل الأدلة', en: 'All guides', ru: 'Все гиды', fa: 'همه راهنماها' }[lang];
  const links = items.map(([path, label]) =>
    `<li><a href="${escapeHtml(`/${lang}${path}`)}">${escapeHtml(label)}</a></li>`,
  ).join('');
  return `
    <footer aria-labelledby="seo-footer-guides-heading">
      <h2 id="seo-footer-guides-heading">${escapeHtml(heading)}</h2>
      <ul>${links}</ul>
    </footer>`;
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

  const comparisonMatch = route.match(/^\/compare\/([^/]+)$/);
  if (comparisonMatch) {
    const record = comparisons[comparisonMatch[1]]?.[lang];
    if (record) return { title: record.seoTitle, description: record.metaDescription, content: record.intro };
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
  const guideMatch = route.match(/^\/guides\/([^/]+)$/);
  const serviceMatch = route.match(/^\/services\/([^/]+)$/);
  const comparisonMatch = route.match(/^\/compare\/([^/]+)$/);
  const comparison = comparisonMatch ? comparisons[comparisonMatch[1]]?.[lang] : undefined;
  const serviceBodyHtml = serviceMatch && meta.body ? renderServiceBody(meta.body) : '';
  let staticMain = `\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">\n      <article aria-labelledby="seo-title">\n        <h1 id="seo-title">${escapeHtml(meta.title)}</h1>\n        <section aria-labelledby="seo-answer-heading">\n          <h2 id="seo-answer-heading">${escapeHtml(answerHeading)}</h2>\n          <p>${escapeHtml(meta.content || meta.description)}</p>\n        </section>\n        ${serviceBodyHtml}\n      </article>\n      <nav aria-label="${escapeHtml(text(lang, 'nav.home'))}">${nav}</nav>\n      ${priorityLinksHtml}\n    </main>`;
  const siteJsonLd = escapeJsonForHtml(siteEntityJsonLd(lang));
  const faqItems = route === '/'
    ? homeFaqItems(lang)
    : guideMatch
      ? guideFaqs[guideMatch[1]]?.[lang] ?? []
      : comparison
        ? comparison.faqs
        : route === '/faq'
          ? faqHub[lang].categories.flatMap((category) => category.items)
          : route === '/health-tourism'
            ? (text(lang, 'medical.landing.desktop.faq.items') ?? []).map((item) => ({ question: item.q, answer: item.a }))
            : [];
  const faqJsonLd = faqItems.length ? escapeJsonForHtml(faqPageJsonLd(faqItems)) : '';
  const breadcrumbData = breadcrumbJsonLd(lang, route, meta);
  const breadcrumbSchemaJsonLd = breadcrumbData ? escapeJsonForHtml(breadcrumbData) : '';
  const dateModified = dateModifiedFor(lang, route);
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
  // ItemList of the row-by-row comparison — the structured-data shape the
  // ai-seo skill recommends for comparison content specifically, distinct
  // from the generic WebPage entry every route already carries.
  const comparisonJsonLd = comparison
    ? escapeJsonForHtml({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: meta.title,
        itemListElement: comparison.rows.map((row, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: row.aspect,
          description: `${comparison.aloneLabel}: ${row.alone} — ${comparison.rafiqLabel}: ${row.rafiq}`,
        })),
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
  } else if (comparison) {
    const sectionHtml = comparison.sections.map((section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </section>`).join('');
    staticMain = `\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(meta.title)}</h1>
        <p>${escapeHtml(comparison.intro)}</p>
        ${renderComparisonTableHtml(comparison, lang)}${sectionHtml}${renderFaqHtml(comparison.faqs, lang)}
      </article>
      <nav aria-label="${escapeHtml(text(lang, 'nav.home'))}">${nav}</nav>
      ${priorityLinksHtml}
    </main>`;
  } else if (route === '/faq') {
    const categoriesHtml = faqHub[lang].categories.map((category) => `
        <section>
          <h2>${escapeHtml(category.heading)}</h2>
          ${renderDetailsListHtml(category.items)}
        </section>`).join('');
    staticMain = `\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(meta.title)}</h1>
        <p>${escapeHtml(faqHub[lang].intro)}</p>${categoriesHtml}
      </article>
      <nav aria-label="${escapeHtml(text(lang, 'nav.home'))}">${nav}</nav>
      ${priorityLinksHtml}
    </main>`;
  } else {
    const extraSectionsHtml = route === '/health-tourism'
      ? renderHealthTourismSections(lang)
      : route === '/real-estate'
        ? renderRealEstateSections(lang)
        : serviceMatch && serviceSeo[lang][serviceMatch[1]]
          ? renderServiceTopicsSections(lang, serviceMatch[1], catalogTitle(lang, serviceMatch[1]))
          : '';
    if (faqItems.length || extraSectionsHtml) {
      staticMain = staticMain.replace(
        '</article>',
        `${extraSectionsHtml}${renderFaqHtml(faqItems, lang)}\n      </article>`,
      );
    }
  }

  const jsonLd = escapeJsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: meta.title,
    description: meta.description,
    url,
    inLanguage: lang,
    dateModified,
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
    ${faqJsonLd ? `<script id="ld-faq" type="application/ld+json">${faqJsonLd}</script>` : ''}\n    ${breadcrumbSchemaJsonLd ? `<script id="ld-breadcrumb" type="application/ld+json">${breadcrumbSchemaJsonLd}</script>` : ''}\n    ${comparisonJsonLd ? `<script id="ld-comparison" type="application/ld+json">${comparisonJsonLd}</script>` : ''}\n    <script type="application/ld+json">${jsonLd}</script>\n  </head>`);
  // The footer must live INSIDE <main id="seo-fallback">: that id carries the
  // visually-hidden rule in index.html, and a sibling footer outside it paints
  // as raw visible text at the top of every page until React hydrates.
  const footerHtml = renderFooterGuideLinks(lang);
  const staticMainWithFooter = footerHtml
    ? staticMain.replace('</main>', `  ${footerHtml}\n    </main>`)
    : staticMain;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${staticMainWithFooter}\n    </div>`);
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
  // Directory + index.html (dist/<lang>/<route>/index.html), not a flat
  // dist/<lang>/<route>.html file — this is plain static-file serving Vercel
  // handles natively, so it needs no cleanUrls flag. cleanUrls' own clean-URL
  // resolution was found to swallow the catch-all SPA-fallback rewrite for
  // every route that ISN'T one of these pre-rendered files (every dynamic
  // page — news articles, trick pages, real-estate listings — and several
  // core client routes like /journey and /wallet), turning them into hard
  // 404s in production. See the incident writeup for the full diagnosis.
  const output = routeInfo.route === '/'
    ? join(dist, routeInfo.lang, 'index.html')
    : join(dist, routeInfo.lang, routeInfo.route.slice(1), 'index.html');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, buildHtml(template, routeInfo.lang, routeInfo.route, meta), 'utf8');
  generated += 1;
}

console.log(`Generated ${generated} route-specific SEO HTML shells under ${relative(root, resolve(dist))}.`);
