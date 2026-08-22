/**
 * Live sitemap of real-estate listings — generated fresh from Supabase on
 * every request instead of at build time. A listing published from the admin
 * panel (src/components/AdminManagers.tsx) must be discoverable right away,
 * not only after the next deploy: scripts/generate-sitemap.mjs only knows the
 * static route/service/guide catalogue baked in at build time, and has no
 * idea the `listings` table exists.
 *
 * Referenced as an extra <sitemap> entry from the sitemap index that
 * scripts/generate-sitemap.mjs writes to public/sitemap.xml.
 *
 * GET /api/sitemap-listings.xml
 */

export const config = { runtime: 'edge' };

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function urlset(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Short edge cache: a just-published listing is discoverable within
      // minutes without hitting Supabase on every crawler request.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('method_not_allowed', { status: 405 });

  const siteUrl = env('VITE_BASE_URL');
  const supaUrl = env('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = env('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

  // Nothing configured yet — a valid empty sitemap, not an error: the rest of
  // the site still builds and serves fine before Supabase is wired up.
  if (!siteUrl || !supaUrl || !anonKey) return xmlResponse(urlset(''));

  const res = await fetch(`${supaUrl}/rest/v1/listings?select=id,updated_at`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  // A fetch failure must surface as a fetch failure, not a silent "zero
  // listings" sitemap — Search Console retries a failed sitemap fetch itself.
  if (!res.ok) return new Response('upstream_error', { status: 502 });

  const rows = (await res.json()) as { id: string; updated_at: string | null }[];

  const body = rows
    .flatMap((row) =>
      LANGS.map((lang) => {
        const langUrl = (l: string) => `${siteUrl}/${l}/real-estate/${row.id}`;
        const alternates = [
          ...LANGS.filter((l) => l !== lang).map(
            (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(langUrl(l))}" />`,
          ),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(langUrl('ar'))}" />`,
        ].join('\n');
        return [
          '  <url>',
          `    <loc>${escapeXml(langUrl(lang))}</loc>`,
          `    <lastmod>${(row.updated_at ?? new Date().toISOString()).slice(0, 10)}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          '    <priority>0.75</priority>',
          alternates,
          '  </url>',
        ].join('\n');
      }),
    )
    .join('\n');

  return xmlResponse(urlset(body));
}
