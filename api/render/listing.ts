/**
 * Request-time pre-render for one real-estate listing (/<lang>/real-estate/<id>).
 *
 * Listings are Supabase rows, not build-time content — scripts/generate-seo-pages.mjs
 * can only bake a shell for pages whose content is known when `npm run build`
 * runs, which is why every listing previously fell through to the generic SPA
 * shell for any client that doesn't execute JavaScript (a non-JS crawler, most
 * AI-answer-engine fetchers). This does the same job that script does for
 * services/guides, but at request time: fetch the one row, build a real title,
 * description, canonical, hreflang set and JSON-LD, and patch them into the
 * site's own bootstrap template (see api/_lib/prerenderShell.ts for why that
 * template is fetched from "/index.html" rather than duplicated here).
 *
 * Wired in vercel.json: /:lang(ar|en|ru|fa)/real-estate/:id(<uuid>) rewrites
 * here BEFORE the catch-all SPA rewrite. A real user's browser still hydrates
 * React over this HTML exactly as it does over every other pre-rendered page
 * (see index.html's #seo-fallback comment) — this is not a bot-only shell,
 * it's the same content for every requester, just assembled per-request
 * instead of at build time.
 */
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

const REAL_ESTATE_TITLE: Record<Lang, string> = {
  ar: 'العقارات في إسطنبول', en: 'Istanbul real estate', ru: 'Недвижимость в Стамбуле', fa: 'املاک استانبول',
};
const REAL_ESTATE_SUBTITLE: Record<Lang, string> = {
  ar: 'عروض مختارة، مع توضيح المؤهل لحد الجنسية التركية وغير المتحقق منه.',
  en: 'Selected listings, showing which ones meet the Turkish citizenship threshold and which are unverified.',
  ru: 'Отобранные объекты с пометкой, какие подходят под порог турецкого гражданства, а какие не проверены.',
  fa: 'آگهی‌های منتخب، با مشخص بودن اینکه کدام واجد شرایط شهروندی ترکیه است و کدام بررسی نشده.',
};
const MISSING_TITLE: Record<Lang, string> = {
  ar: 'هذا العقار ما عاد متاح', en: 'This listing is no longer available',
  ru: 'Объект больше недоступен', fa: 'این آگهی دیگر موجود نیست',
};
const MISSING_BODY: Record<Lang, string> = {
  ar: 'يمكن انحذف الإعلان أو تغيّر رابطه. تصفّح باقي العروض.',
  en: 'It may have been removed or its link changed. Browse the rest of the offers.',
  ru: 'Возможно, объявление снято или ссылка изменилась. Посмотрите другие варианты.',
  fa: 'ممکن است حذف شده یا لینکش تغییر کرده باشد. سایر آگهی‌ها را ببینید.',
};
const BACK_TO_LIST: Record<Lang, string> = {
  ar: 'رجوع للعقارات', en: 'Back to listings', ru: 'Назад к списку', fa: 'بازگشت به املاک',
};
const NAV_HOME: Record<Lang, string> = { ar: 'الرئيسية', en: 'Home', ru: 'Главная', fa: 'خانه' };
const SPEC_LABELS: Record<Lang, { price: string; rooms: string; area: string; bathrooms: string; floor: string }> = {
  ar: { price: 'السعر', rooms: 'الغرف', area: 'المساحة', bathrooms: 'الحمامات', floor: 'الطابق' },
  en: { price: 'Price', rooms: 'Rooms', area: 'Area', bathrooms: 'Bathrooms', floor: 'Floor' },
  ru: { price: 'Цена', rooms: 'Комнаты', area: 'Площадь', bathrooms: 'Ванные', floor: 'Этаж' },
  fa: { price: 'قیمت', rooms: 'اتاق‌ها', area: 'متراژ', bathrooms: 'حمام‌ها', floor: 'طبقه' },
};

interface ListingRow {
  id: string; district: string; rooms: string; m2: number; price_usd: number;
  image: string | null; images: string[] | null; description: string | null;
  bathrooms: number | null; floor: number | null; listing_type: string | null;
  updated_at: string | null;
  translations?: Partial<Record<Lang, { title?: string; description?: string }>> | null;
}

async function fetchListing(supaUrl: string, anonKey: string, id: string): Promise<ListingRow | null> {
  const res = await fetch(`${supaUrl}/rest/v1/listings?id=eq.${id}&select=*`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as ListingRow[];
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
  const routePath = `/real-estate/${id}`;

  const supaUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('VITE_SUPABASE_ANON_KEY');

  // Misconfigured env — degrade to the previous behavior (generic shell)
  // instead of a hard failure. A real production deploy always has these,
  // since the client bundle needs them to load listings at all.
  const templateRes = await fetch(`${origin}/index.html`);
  const template = await templateRes.text();
  if (!supaUrl || !anonKey) return new Response(template, { headers: { 'content-type': 'text/html; charset=utf-8' } });

  const listing = await fetchListing(supaUrl, anonKey, id);

  if (!listing) {
    const html = patchTemplate(template, {
      lang, origin, routePath,
      title: `${MISSING_TITLE[lang]} — ${REAL_ESTATE_TITLE[lang]}`,
      description: MISSING_BODY[lang],
      noindex: true,
      jsonLdBlocks: [],
      mainHtml: `
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(MISSING_TITLE[lang])}</h1>
        <p>${escapeHtml(MISSING_BODY[lang])}</p>
      </article>
      <nav aria-label="${escapeHtml(NAV_HOME[lang])}"><a href="/${lang}">${escapeHtml(NAV_HOME[lang])}</a> · <a href="/${lang}/real-estate">${escapeHtml(BACK_TO_LIST[lang])}</a></nav>`,
    });
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const photos = listing.images?.length ? listing.images : [listing.image].filter((v): v is string => !!v);
  const description = listing.translations?.[lang]?.description || listing.description || REAL_ESTATE_SUBTITLE[lang];
  const title = `${listing.district} — ${REAL_ESTATE_TITLE[lang]}`;
  const dateModified = listing.updated_at ?? new Date().toISOString().slice(0, 10);
  const labels = SPEC_LABELS[lang];

  const specsHtml = [
    `<li><strong>${escapeHtml(labels.price)}:</strong> $${listing.price_usd.toLocaleString('en-US')}</li>`,
    `<li><strong>${escapeHtml(labels.rooms)}:</strong> ${escapeHtml(listing.rooms)}</li>`,
    `<li><strong>${escapeHtml(labels.area)}:</strong> ${listing.m2} m²</li>`,
    listing.bathrooms != null ? `<li><strong>${escapeHtml(labels.bathrooms)}:</strong> ${listing.bathrooms}</li>` : '',
    listing.floor != null ? `<li><strong>${escapeHtml(labels.floor)}:</strong> ${listing.floor}</li>` : '',
  ].filter(Boolean).join('');

  const mainHtml = `
      <article aria-labelledby="seo-title">
        <h1 id="seo-title">${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <ul>${specsHtml}</ul>
        ${photos[0] ? `<img src="${escapeHtml(photos[0])}" alt="${escapeHtml(listing.district)}" width="1200" height="675" />` : ''}
      </article>
      <nav aria-label="${escapeHtml(NAV_HOME[lang])}"><a href="/${lang}">${escapeHtml(NAV_HOME[lang])}</a> · <a href="/${lang}/real-estate">${escapeHtml(BACK_TO_LIST[lang])}</a></nav>`;

  const pageUrl = `${origin}/${lang}${routePath}`;
  const jsonLdBlocks: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      name: title,
      description,
      url: pageUrl,
      inLanguage: lang,
      dateModified,
      isPartOf: { '@id': `${origin}/#website` },
      about: { '@id': `${origin}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description,
      image: photos[0] ?? undefined,
      url: pageUrl,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'rooms', value: listing.rooms },
        { '@type': 'PropertyValue', name: 'area_m2', value: listing.m2 },
      ],
      offers: {
        '@type': 'Offer',
        price: listing.price_usd,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        businessFunction: listing.listing_type === 'rent' ? 'https://schema.org/LeaseOut' : 'https://schema.org/Sell',
        url: pageUrl,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: NAV_HOME[lang], item: `${origin}/${lang}` },
        { '@type': 'ListItem', position: 2, name: REAL_ESTATE_TITLE[lang], item: `${origin}/${lang}/real-estate` },
        { '@type': 'ListItem', position: 3, name: listing.district },
      ],
    },
  ];

  const html = patchTemplate(template, {
    lang, origin, routePath, title, description, mainHtml, jsonLdBlocks,
    image: photos[0],
  });

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Live data, but listings don't change second-to-second — cache at the
      // edge briefly and let stale-while-revalidate absorb the rest, instead
      // of hitting Supabase on every single crawl/request.
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
