/**
 * Request-time pre-render for one news post (/<lang>/news/<id>) — the
 * NewsArticle counterpart to api/render/listing.ts. See that file's header
 * for why this exists as a request-time render instead of a
 * generate-seo-pages.mjs build-time shell: news_posts is a Supabase table,
 * not build-time content.
 */
import { parseNewsBody } from '../../src/lib/newsBody.js';
import { escapeHtml, isLang, patchTemplate, type Lang } from '../_lib/prerenderShell.js';

export const config = { runtime: 'edge' };

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NEWS_TITLE: Record<Lang, string> = {
  ar: 'آخر أخبار رفيق', en: 'Latest from Rafiq', ru: 'Последние новости Rafiq', fa: 'تازه‌ترین اخبار رفیق',
};
const NOT_FOUND: Record<Lang, string> = {
  ar: 'هذا الخبر لم يعد متاحًا.', en: 'This news post is no longer available.',
  ru: 'Эта новость больше недоступна.', fa: 'این خبر دیگر در دسترس نیست.',
};
const BACK_TO_NEWS: Record<Lang, string> = {
  ar: 'العودة إلى الأخبار', en: 'Back to news', ru: 'Назад к новостям', fa: 'بازگشت به اخبار',
};
const NAV_HOME: Record<Lang, string> = { ar: 'الرئيسية', en: 'Home', ru: 'Главная', fa: 'خانه' };

interface NewsRow {
  id: string; title: string; body: string | null; image_url: string | null; created_at: string;
  translations?: Record<string, { title: string; body: string }> | null;
}

async function fetchPost(supaUrl: string, anonKey: string, id: string): Promise<NewsRow | null> {
  const res = await fetch(
    `${supaUrl}/rest/v1/news_posts?id=eq.${id}&published=eq.true&select=id,title,body,image_url,created_at,translations`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as NewsRow[];
  return rows[0] ?? null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const langParam = url.searchParams.get('lang');
  const id = url.searchParams.get('id') ?? '';
  const origin = url.origin;

  if (!isLang(langParam) || !UUID_RE.test(id)) {
    return new Response('bad_request', { status: 400 });
  }
  const lang = langParam;
  const routePath = `/news/${id}`;

  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('VITE_SUPABASE_ANON_KEY');

  const templateRes = await fetch(`${origin}/index.html`);
  const template = await templateRes.text();
  if (!supaUrl || !anonKey) return new Response(template, { headers: { 'content-type': 'text/html; charset=utf-8' } });

  const post = await fetchPost(supaUrl, anonKey, id);

  if (!post) {
    const html = patchTemplate(template, {
      lang, origin, routePath,
      title: `${NOT_FOUND[lang]} — ${NEWS_TITLE[lang]}`,
      description: NOT_FOUND[lang],
      noindex: true,
      jsonLdBlocks: [],
      mainHtml: `
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(NEWS_TITLE[lang])}</h1>
        <p>${escapeHtml(NOT_FOUND[lang])}</p>
      </article>
      <nav aria-label="${escapeHtml(NAV_HOME[lang])}"><a href="/${lang}">${escapeHtml(NAV_HOME[lang])}</a> · <a href="/${lang}/news">${escapeHtml(BACK_TO_NEWS[lang])}</a></nav>`,
    });
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  // Arabic is the source of truth; other languages use the machine
  // translation when the sync has produced one yet (localizeNewsPost's rule
  // in src/lib/api.ts — mirrored here since that function is client-only).
  const localized = lang !== 'ar' ? post.translations?.[lang] : undefined;
  const title = localized?.title || post.title;
  const body = localized?.body || post.body;
  const parsed = parseNewsBody(body);
  const description = (parsed.lead ?? body ?? '').slice(0, 200) || NEWS_TITLE[lang];
  const fullTitle = `${title} — Rafiq`;

  const bulletsHtml = parsed.bullets.length
    ? `<ul>${parsed.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : '';

  const mainHtml = `
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(title)}</h1>
        ${post.image_url ? `<img src="${escapeHtml(post.image_url)}" alt="" width="1200" height="675" />` : ''}
        ${parsed.lead ? `<p>${escapeHtml(parsed.lead)}</p>` : ''}
        ${bulletsHtml}
      </article>
      <nav aria-label="${escapeHtml(NAV_HOME[lang])}"><a href="/${lang}">${escapeHtml(NAV_HOME[lang])}</a> · <a href="/${lang}/news">${escapeHtml(BACK_TO_NEWS[lang])}</a></nav>`;

  const pageUrl = `${origin}/${lang}${routePath}`;
  const jsonLdBlocks: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      name: fullTitle,
      description,
      url: pageUrl,
      inLanguage: lang,
      dateModified: post.created_at,
      isPartOf: { '@id': `${origin}/#website` },
      about: { '@id': `${origin}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: title,
      description,
      image: post.image_url ?? undefined,
      datePublished: post.created_at,
      dateModified: post.created_at,
      inLanguage: lang,
      url: pageUrl,
      isPartOf: { '@id': `${origin}/#website` },
      publisher: { '@id': `${origin}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: NAV_HOME[lang], item: `${origin}/${lang}` },
        { '@type': 'ListItem', position: 2, name: NEWS_TITLE[lang], item: `${origin}/${lang}/news` },
        { '@type': 'ListItem', position: 3, name: title },
      ],
    },
  ];

  const html = patchTemplate(template, {
    lang, origin, routePath, title: fullTitle, description, mainHtml, jsonLdBlocks,
    image: post.image_url ?? undefined,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
