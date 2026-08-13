import { describe, expect, it } from 'vitest';
import { SERVICES, keywordsFor } from './services';
import { SERVICE_SEO_AR } from './serviceSeoAr';
import { SERVICE_SEO_EN } from './serviceSeoEn';

describe('service SEO catalogs', () => {
  const catalogs = [
    ['Arabic', SERVICE_SEO_AR],
    ['English', SERVICE_SEO_EN],
  ] as const;

  for (const [language, catalog] of catalogs) {
    it(`provides exactly twenty unique ${language} search phrases for every catalog service`, () => {
      expect(Object.keys(catalog)).toHaveLength(SERVICES.length);

      for (const service of SERVICES) {
        const seo = catalog[service.id];
        expect(seo, service.id).toBeDefined();
        expect(seo.searchPhrases, service.id).toHaveLength(20);
        expect(new Set(seo.searchPhrases), service.id).toHaveLength(20);
        expect(seo.seoTitle.length, service.id).toBeLessThanOrEqual(65);
        expect(seo.metaDescription.length, service.id).toBeLessThanOrEqual(155);
        expect(keywordsFor(service.id), service.id).toContain(seo.searchPhrases[0]);
      }
    });
  }
});
