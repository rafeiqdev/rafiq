import { describe, expect, it } from 'vitest';
import { COMPARISONS } from './comparisons';

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;

describe('comparison page content', () => {
  it('provides every language for every comparison entry', () => {
    for (const [id, byLanguage] of Object.entries(COMPARISONS)) {
      expect(Object.keys(byLanguage).sort(), id).toEqual([...LANGS].sort());
    }
  });

  it('keeps every comparison long-form, structured and suitable for a crawlable page', () => {
    for (const [id, byLanguage] of Object.entries(COMPARISONS)) {
      for (const language of LANGS) {
        const c = byLanguage[language];
        const body = [
          c.seoTitle, c.navLabel, c.metaDescription, c.intro, c.aloneLabel, c.rafiqLabel, c.ctaTitle, c.ctaBody,
          ...c.rows.flatMap((row) => [row.aspect, row.alone, row.rafiq]),
          ...c.sections.flatMap((section) => [section.heading, section.body]),
          ...c.faqs.flatMap((faq) => [faq.question, faq.answer]),
        ].join(' ');
        expect(c.seoTitle.length, `${id}/${language} title`).toBeGreaterThan(20);
        expect(c.metaDescription.length, `${id}/${language} description`).toBeGreaterThan(80);
        expect(c.navLabel.length, `${id}/${language} navLabel`).toBeGreaterThan(0);
        expect(c.navLabel.length, `${id}/${language} navLabel should be short`).toBeLessThan(60);
        expect(c.rows.length, `${id}/${language} rows`).toBeGreaterThanOrEqual(3);
        expect(c.sections.length, `${id}/${language} sections`).toBeGreaterThanOrEqual(2);
        expect(c.faqs.length, `${id}/${language} FAQs`).toBeGreaterThanOrEqual(3);
        expect(body.length, `${id}/${language} comparison length`).toBeGreaterThan(800);
      }
    }
  });
});
