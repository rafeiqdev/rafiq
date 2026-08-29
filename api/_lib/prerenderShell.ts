/**
 * Request-time equivalent of scripts/generate-seo-pages.mjs's buildHtml() —
 * that script can only bake a static shell for content known at BUILD time
 * (services, guides). Real-estate listings and news posts are Supabase rows
 * that change between deploys, so their crawler-visible shell has to be
 * assembled per-request instead, from the same `dist/index.html` bootstrap
 * template (reachable unmodified at "/index.html" on the live deployment —
 * generate-seo-pages.mjs reads it once and never overwrites the file itself,
 * only writes per-route copies under dist/<lang>/<route>/).
 *
 * Used by api/render/listing.ts and api/render/news-article.ts. Kept
 * dependency-free (no node:fs) so it runs on the Edge runtime.
 */

export const LANGS = ['ar', 'en', 'ru', 'fa'] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: string | null | undefined): value is Lang {
  return !!value && (LANGS as readonly string[]).includes(value);
}

const OG_LOCALE: Record<Lang, string> = { ar: 'ar_SA', en: 'en_US', ru: 'ru_RU', fa: 'fa_IR' };
const RTL: Record<Lang, boolean> = { ar: true, en: false, ru: false, fa: true };

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function upsertTag(html: string, pattern: RegExp, tag: string): string {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

export interface PatchOptions {
  lang: Lang;
  origin: string;
  /** Path after the language segment, e.g. "/real-estate/<id>" or "/news/<id>". */
  routePath: string;
  title: string;
  description: string;
  /** Inner HTML for <main id="seo-fallback">…</main> — already escaped by the caller. */
  mainHtml: string;
  /** Each becomes its own <script type="application/ld+json">. */
  jsonLdBlocks: unknown[];
  image?: string;
  /** Missing/unpublished content: index the hub instead of this dead URL. */
  noindex?: boolean;
}

/** Absolute URL for a given language + this route's path. */
export function pageUrl(origin: string, lang: Lang, routePath: string): string {
  return `${origin}/${lang}${routePath}`;
}

export function patchTemplate(template: string, opts: PatchOptions): string {
  const { lang, origin, routePath, title, description, mainHtml, jsonLdBlocks, image, noindex } = opts;
  const url = pageUrl(origin, lang, routePath);
  const rtl = RTL[lang];

  const alternateTags =
    LANGS.map((l) => `    <link rel="alternate" hreflang="${l}" href="${escapeHtml(pageUrl(origin, l, routePath))}" />`).join('\n') +
    `\n    <link rel="alternate" hreflang="x-default" href="${escapeHtml(pageUrl(origin, 'ar', routePath))}" />`;

  let html = template;
  html = html.replace(/<html\b[^>]*>/i, `<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">`);
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertTag(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = upsertTag(html, /<meta\s+name="robots"[^>]*>/i, `<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow'}" />`);
  html = upsertTag(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(url)}" />`);
  html = upsertTag(html, /<meta\s+property="og:locale"[^>]*>/i, `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`);
  html = upsertTag(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = upsertTag(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = upsertTag(html, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = upsertTag(html, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  if (image) {
    html = upsertTag(html, /<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`);
    html = upsertTag(html, /<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  html = upsertTag(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`);
  html = html.replace(/\s*<link\s+rel="alternate"[^>]*hreflang="(?:ar|en|ru|fa|x-default)"[^>]*>\s*/gi, '\n');

  const jsonLdScripts = jsonLdBlocks.map((block) => `<script type="application/ld+json">${escapeJsonForHtml(block)}</script>`).join('\n    ');
  html = html.replace('</head>', `${alternateTags}\n    ${jsonLdScripts}\n  </head>`);

  html = html.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">\n    <main id="seo-fallback" lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">\n      ${mainHtml}\n    </main>\n    </div>`,
  );
  return html;
}
