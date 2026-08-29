import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import handler from './listing';

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

const ROW = {
  id: '324b0d0a-86d5-4f80-9a1c-ad1129ade2ba',
  district: 'Bağcılar',
  rooms: '2+1',
  m2: 65,
  price_usd: 140244,
  image: 'https://cdn.example/photo.jpg',
  images: ['https://cdn.example/photo.jpg'],
  description: 'A nice flat.',
  bathrooms: 1,
  floor: 4,
  listing_type: 'sale',
  updated_at: '2026-08-20',
  translations: null,
};

function req(lang: string, id: string) {
  return new Request(`https://test.invalid/api/render/listing?lang=${lang}&id=${id}`);
}

describe('api/render/listing', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  it('rejects a non-UUID id before touching the network', async () => {
    const res = await handler(req('ar', 'not-a-uuid'));
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported language', async () => {
    const res = await handler(req('de', ROW.id));
    expect(res.status).toBe(400);
  });

  it('renders real listing data into the shell for an existing row', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/index.html')) return new Response(TEMPLATE);
      if (url.includes('/rest/v1/listings')) return new Response(JSON.stringify([ROW]));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await handler(req('en', ROW.id));
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('<title>Bağcılar — Istanbul real estate</title>');
    expect(html).toContain('A nice flat.');
    expect(html).toContain('$140,244');
    expect(html).toContain('rel="canonical" href="https://test.invalid/en/real-estate/324b0d0a-86d5-4f80-9a1c-ad1129ade2ba"');
    expect(html).toContain('hreflang="ar"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('meta name="robots" content="index,follow"');
  });

  it('returns 404 with a noindex shell when the listing does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/index.html')) return new Response(TEMPLATE);
      if (url.includes('/rest/v1/listings')) return new Response(JSON.stringify([]));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await handler(req('ar', ROW.id));
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('meta name="robots" content="noindex,follow"');
    expect(html).toContain('هذا العقار ما عاد متاح');
  });

  it('falls back to the plain shell when Supabase env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/index.html')) return new Response(TEMPLATE);
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await handler(req('ar', ROW.id));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toBe(TEMPLATE);
  });
});
