import { describe, expect, it } from 'vitest';
import { SERVICES, keywordsFor } from './services';
import { SERVICE_SEO_AR } from './serviceSeoAr';
import { SERVICE_SEO_EN } from './serviceSeoEn';
import { SERVICE_SEO_RU } from './serviceSeoRu';

type SeoRecord = {
  seoTitle: string;
  metaDescription: string;
  searchPhrases: readonly string[];
};

const catalogs: ReadonlyArray<readonly [string, Record<string, SeoRecord>]> = [
  ['Arabic', SERVICE_SEO_AR],
  ['English', SERVICE_SEO_EN],
  ['Russian', SERVICE_SEO_RU],
];

function normalized(phrase: string): string {
  return phrase.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

describe('service SEO — independent per-service coverage', () => {
  // This creates one isolated unit test per catalog service (78 current services),
  // exceeding the 50-service / 50-unit minimum without relying on a single loop test.
  for (const service of SERVICES) {
    it(`keeps complete localized SEO coverage for ${service.id}`, () => {
      const searchableText = keywordsFor(service.id);

      for (const [language, catalog] of catalogs) {
        const seo = catalog[service.id];
        expect(seo, `${language}: ${service.id}`).toBeDefined();
        expect(seo.seoTitle.trim(), `${language}: ${service.id} title`).not.toHaveLength(0);
        expect(seo.metaDescription.trim(), `${language}: ${service.id} description`).not.toHaveLength(0);
        expect(seo.seoTitle.length, `${language}: ${service.id} title length`).toBeLessThanOrEqual(65);
        expect(seo.metaDescription.length, `${language}: ${service.id} description length`).toBeLessThanOrEqual(155);
        expect(seo.searchPhrases, `${language}: ${service.id} phrase count`).toHaveLength(20);

        const uniquePhrases = new Set(seo.searchPhrases.map(normalized));
        expect(uniquePhrases.size, `${language}: ${service.id} phrase uniqueness`).toBe(20);

        for (const phrase of seo.searchPhrases) {
          expect(phrase.trim(), `${language}: ${service.id} non-empty phrase`).not.toHaveLength(0);
          expect(searchableText, `${language}: ${service.id} searchable phrase`).toContain(phrase);
        }
      }
    });
  }
});
