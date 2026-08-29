import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import handler from './news-article';

const TEMPLATE = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>Rafiq Istanbul</title>
    <meta name="description" content="default description" />
    <link rel="canonical" href="https://test.invalid" />
    <meta property="og:url" content="https://test.invalid" />
    <meta property="og:locale" content="ar" />
    <meta property="og:title" content="Rafiq Istanbul" />
    <meta property="og:description" content="default description" />
    <meta name="twitter:title" content="Rafiq Istanbul" />
    <meta name="twitter:description" content="default description" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc123.js"></script>
  </body>
</html>
`;

const POST = {
  id: 'd50a1829-f0ff-46e9-81fa-8c36baaec3cb',
  title: 'خبر عاجل عن الإقامة',
  body: 'مقدمة الخبر.\n📌 نقطة أولى\n📌 نقطة ثانية',
  image_url: 'https://cdn.example/news.jpg',
  created_at: '2026-08-25T10:00:00.000Z',
  translations: {
    en: { title: 'Breaking news about residency', body: 'Intro line.\n📌 First point\n📌 Second point' },
  },
};

function req(lang: string, id: string) {
  return new Request(`https://test.invalid/api/render/news-article?lang=${lang}&id=${id}`);
}

describe('api/render/news-article', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  it('rejects a non-UUID id', async () => {
    const res = await handler(req('ar', 'nope'));
    expect(res.status).toBe(400);
  });

  it('renders the Arabic original when no translation is requested', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/index.html')) return new Response(TEMPLATE);
      if (url.includes('/rest/v1/news_posts')) return new Response(JSON.stringify([POST]));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await handler(req('ar', POST.id));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('خبر عاجل عن الإقامة');
    expect(html).toContain('مقدمة الخبر.');
    expect(html).toContain('نقطة أولى');
    expect(html).toContain('"@type":"NewsArticle"');
    expect(html).toContain('datePublished":"2026-08-25T10:00:00.000Z"');
  });

  it('renders the machine translation for a non-Arabic language', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/index.html')) return new Response(TEMPLATE);
      if (url.includes('/rest/v1/news_posts')) return new Response(JSON.stringify([POST]));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await handler(req('en', POST.id));
    const html = await res.text();
    expect(html).toContain('Breaking news about residency');
    expect(html).toContain('First point');
  });

  it('returns 404 for an unpublished/missing post', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/index.html')) return new Response(TEMPLATE);
      if (url.includes('/rest/v1/news_posts')) return new Response(JSON.stringify([]));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await handler(req('ar', POST.id));
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('meta name="robots" content="noindex,follow"');
  });
});
