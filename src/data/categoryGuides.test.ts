import { describe, expect, it } from 'vitest';
import { CATEGORY_GUIDES } from './categoryGuides';
import { SERVICE_CATEGORIES } from './services';

const GUIDE_LANGS = ['ar', 'en', 'ru', 'fa'] as const;

describe('category guide SEO coverage', () => {
  it('provides one guide for every catalog category in every reviewed language', () => {
    expect(Object.keys(CATEGORY_GUIDES).sort()).toEqual(SERVICE_CATEGORIES.map((category) => category.id).sort());
    for (const category of SERVICE_CATEGORIES) {
      expect(Object.keys(CATEGORY_GUIDES[category.id]).sort()).toEqual([...GUIDE_LANGS].sort());
    }
  });

  it('keeps every guide long-form, structured and suitable for a crawlable page', () => {
    for (const [categoryId, byLanguage] of Object.entries(CATEGORY_GUIDES)) {
      for (const language of GUIDE_LANGS) {
        const guide = byLanguage[language];
        const body = [
          guide.seoTitle,
          guide.metaDescription,
          guide.intro,
          guide.ctaTitle,
          guide.ctaBody,
          ...guide.sections.flatMap((section) => [section.heading, section.body]),
          ...guide.faqs.flatMap((faq) => [faq.question, faq.answer]),
        ].join(' ');
        expect(guide.seoTitle.length, `${categoryId}/${language} title`).toBeGreaterThan(20);
        expect(guide.metaDescription.length, `${categoryId}/${language} description`).toBeGreaterThan(80);
        expect(guide.sections, `${categoryId}/${language} sections`).toHaveLength(3);
        expect(guide.faqs, `${categoryId}/${language} FAQs`).toHaveLength(3);
        expect(body.length, `${categoryId}/${language} guide length`).toBeGreaterThan(800);
      }
    }
  });
});
