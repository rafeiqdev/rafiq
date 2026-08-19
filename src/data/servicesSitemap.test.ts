import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SERVICES } from './services';

/**
 * Sitemap/catalog integrity guard.
 *
 * scripts/generate-sitemap.mjs discovers service routes by regex-parsing
 * src/data/services.ts (to avoid importing TypeScript into a plain Node
 * script), then drops any id an admin has hidden live in Supabase
 * (settings.service_catalog — see src/data/catalogStore.ts) before writing
 * public/sitemap.xml. That gap — a service hidden at runtime but still
 * published in a build-time sitemap — is exactly what once left
 * /ar/services/tour-vip crawlable, linked from the sitemap, and rendering a
 * generic runtime error because the live catalog had already dropped it.
 *
 * This test does not re-run the live Supabase fetch (that would make CI
 * depend on network/secrets and be flaky by construction). It instead pins
 * down everything that *is* deterministic from checked-in source, so a
 * regression in either direction fails loudly:
 *   - the generator's regex must still match every real service id
 *   - the committed sitemap must never reference an id that isn't a real,
 *     current service (a stale/renamed/typo'd slug)
 *   - the committed sitemap must never contain duplicate service URLs
 *   - the sitemap can only be a subset of the registry, never a superset
 *     (a superset would mean the generator invented ids it didn't parse)
 *
 * public/sitemap.xml is a sitemap INDEX (see generate-sitemap.mjs); actual
 * service URLs live in its two member sitemaps, priority and guides.
 */

const root = process.cwd();
const sitemapXml = () =>
  ['public/sitemap-priority.xml', 'public/sitemap-guides.xml']
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
const servicesSource = () => readFileSync(join(root, 'src/data/services.ts'), 'utf8');

function serviceIdsFromSource(): string[] {
  return [...servicesSource().matchAll(/\{ id: '([^']+)', category:/g)].map((m) => m[1]);
}

function serviceIdsFromSitemap(): string[] {
  return [...sitemapXml().matchAll(/<loc>https:\/\/[^<]+\/ar\/services\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);
}

describe('service registry stays the single source of truth for the sitemap', () => {
  it("generate-sitemap.mjs's regex still matches every service in the registry", () => {
    const registryIds = new Set(SERVICES.map((s) => s.id));
    const parsedIds = new Set(serviceIdsFromSource());
    expect(parsedIds, 'services.ts formatting drifted from the sitemap generator\'s parser').toEqual(registryIds);
  });

  it('every sitemap service URL is a real, current service id', () => {
    const registryIds = new Set(SERVICES.map((s) => s.id));
    const orphans = serviceIdsFromSitemap().filter((id) => !registryIds.has(id));
    expect(orphans, `sitemap references unknown service id(s): ${orphans.join(', ')}`).toEqual([]);
  });

  it('has no duplicate service URLs', () => {
    const ids = serviceIdsFromSitemap();
    const seen = new Set<string>();
    const dupes = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dupes, `duplicate service URL(s) in sitemap: ${dupes.join(', ')}`).toEqual([]);
  });

  it('never lists more services than the registry has (sitemap can only omit, never invent)', () => {
    const uniqueSitemapIds = new Set(serviceIdsFromSitemap());
    expect(uniqueSitemapIds.size).toBeLessThanOrEqual(SERVICES.length);
    expect(uniqueSitemapIds.size).toBeGreaterThan(0);
  });
});
