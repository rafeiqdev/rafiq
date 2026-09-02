/**
 * Generates /llms.txt — a curated, English-language index of the site for AI
 * assistants and answer engines that fetch it directly (ChatGPT, Claude,
 * Perplexity and similar; Google Search explicitly ignores this file, see
 * developers.google.com/search/docs/fundamentals/ai-optimization-guide, so
 * this is a non-Google-only lever, not a ranking mechanism).
 *
 * English was chosen as the file's language regardless of the site's Arabic-
 * first default: llms.txt is read by AI systems, not by the site's human
 * audience, and English is the lowest-common-denominator language those
 * systems query and reason in. Every linked URL still uses the real /en
 * paths, and a note points at the ar/ru/fa alternates so the file does not
 * imply English is the only supported language.
 *
 * Content mirrors the curated "priority" set already defined in
 * generate-sitemap.mjs (PRIORITY_GUIDE_IDS / PRIORITY_SERVICE_IDS) rather
 * than all ~78 services — llms.txt is meant to orient a crawler, not
 * enumerate the full catalog it can already discover via sitemap.xml.
 *
 * Run via `npm run build` (prebuild step) or directly:
 *   node scripts/generate-llms-txt.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteUrlOrExit } from './siteUrl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = resolveSiteUrlOrExit(process.env);
const en = JSON.parse(readFileSync(join(root, 'src/i18n/locales/en.json'), 'utf8'));
const text = (path) => path.split('.').reduce((value, key) => value?.[key], en);

const quoted = '"((?:\\\\.|[^"\\\\])*)"';
const decodeTsString = (value) => JSON.parse(`"${value}"`);

// Same PRIORITY_GUIDE_IDS / PRIORITY_SERVICE_IDS as generate-sitemap.mjs —
// the ~15-20 pages judged worth an engine's first look.
const PRIORITY_GUIDE_IDS = ['residency', 'health', 'realestate', 'banking', 'tourism'];
const PRIORITY_SERVICE_IDS = [
  'res-tourist', 'res-property', 'res-renew', 'res-citizenship',
  'health-tourism', 're-buy', 'bank-account',
];

function readGuideTitles() {
  const source = readFileSync(join(root, 'src/data/categoryGuides.ts'), 'utf8');
  const records = {};
  const recordPattern = new RegExp(
    `"seoTitle"\\s*:\\s*${quoted}\\s*,\\s*"metaDescription"\\s*:\\s*${quoted}`,
    'g',
  );
  for (const match of source.matchAll(recordPattern)) {
    const before = source.slice(0, match.index);
    const categoryOpeners = [...before.matchAll(/^  "([^"]+)"\s*:\s*\{\s*$/gm)];
    const languageOpeners = [...before.matchAll(/^    "(ar|en|ru|fa)"\s*:\s*\{\s*$/gm)];
    const id = categoryOpeners.at(-1)?.[1];
    const lang = languageOpeners.at(-1)?.[1];
    if (!id || lang !== 'en') continue;
    records[id] = { title: decodeTsString(match[1]), description: decodeTsString(match[2]) };
  }
  return records;
}

function readServiceTitles() {
  const source = readFileSync(join(root, 'src/data/serviceSeoEn.ts'), 'utf8');
  const records = {};
  const recordPattern = new RegExp(
    `"([^"]+)"\\s*:\\s*\\{\\s*"seoTitle"\\s*:\\s*${quoted}\\s*,\\s*"metaDescription"\\s*:\\s*${quoted}`,
    'g',
  );
  for (const match of source.matchAll(recordPattern)) {
    records[match[1]] = { title: decodeTsString(match[2]), description: decodeTsString(match[3]) };
  }
  return records;
}

const guideTitles = readGuideTitles();
const serviceTitles = readServiceTitles();

const guideLines = PRIORITY_GUIDE_IDS
  .map((id) => guideTitles[id] && `- [${guideTitles[id].title}](${SITE_URL}/en/guides/${id}): ${guideTitles[id].description}`)
  .filter(Boolean)
  .join('\n');

const serviceLines = PRIORITY_SERVICE_IDS
  .map((id) => serviceTitles[id] && `- [${serviceTitles[id].title}](${SITE_URL}/en/services/${id}): ${serviceTitles[id].description}`)
  .filter(Boolean)
  .join('\n');

const content = `# ${text('common.appName')}

> ${text('common.tagline')} — residency (İkamet), banking, housing, health and daily life in Istanbul, coordinated step by step for foreigners in Arabic, English, Russian and Farsi.

## Core pages
- [Home](${SITE_URL}/en): overview of every service Rafiq coordinates in Istanbul.
- [All services](${SITE_URL}/en/services): the full service catalog, browsable by category.
- [Real estate](${SITE_URL}/en/real-estate): property search, buying, and Turkish real-estate investment guidance.
- [Health tourism](${SITE_URL}/en/health-tourism): medical travel coordination — treatment, hospitals, and logistics in Istanbul.
- [Practical guides](${SITE_URL}/en/tricks): day-to-day tips for living in Istanbul as a foreigner.

## Guides
${guideLines}

## Key services
${serviceLines}

## Full content
- [llms-full.txt](${SITE_URL}/llms-full.txt): every service page and guide in full (Arabic and English) as one Markdown document, with the official Turkish authority behind each topic.

## Languages
Every page above is also published in Arabic (${SITE_URL}/ar/...), Russian (${SITE_URL}/ru/...) and Farsi (${SITE_URL}/fa/...); Arabic is the default for the site's primary audience. Swap the leading /en/ segment for /ar/, /ru/ or /fa/ to reach the same page in another language.

## Contact
Rafiq coordinates these services directly or through vetted local partners; every service page names which, and every page carries a request form to start a conversation about a specific need.
`;

writeFileSync(join(root, 'public/llms.txt'), content, 'utf8');
console.log(`llms.txt generated (${PRIORITY_GUIDE_IDS.length} guides, ${PRIORITY_SERVICE_IDS.length} services) (${SITE_URL})`);
