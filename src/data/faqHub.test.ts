import { describe, expect, it } from 'vitest';
import { FAQ_HUB } from './faqHub';

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;

describe('FAQ hub content', () => {
  it('has the same category headings and question count in every language', () => {
    const [first, ...rest] = LANGS;
    const referenceHeadings = FAQ_HUB[first].categories.map((c) => c.heading);
    const referenceCounts = FAQ_HUB[first].categories.map((c) => c.items.length);
    for (const lang of rest) {
      expect(FAQ_HUB[lang].categories.map((c) => c.heading).length, lang).toBe(referenceHeadings.length);
      expect(FAQ_HUB[lang].categories.map((c) => c.items.length), lang).toEqual(referenceCounts);
    }
  });

  it('keeps every question and answer non-trivial and every category non-empty', () => {
    for (const lang of LANGS) {
      const content = FAQ_HUB[lang];
      expect(content.seoTitle.length, `${lang} title`).toBeGreaterThan(20);
      expect(content.metaDescription.length, `${lang} description`).toBeGreaterThan(60);
      expect(content.categories.length, `${lang} categories`).toBeGreaterThanOrEqual(3);
      for (const category of content.categories) {
        expect(category.items.length, `${lang}/${category.heading} items`).toBeGreaterThanOrEqual(3);
        for (const item of category.items) {
          expect(item.question.length, `${lang}/${category.heading} question length`).toBeGreaterThan(10);
          expect(item.answer.length, `${lang}/${category.heading} answer length`).toBeGreaterThan(40);
        }
      }
    }
  });

  it('never duplicates a question within one language', () => {
    for (const lang of LANGS) {
      const questions = FAQ_HUB[lang].categories.flatMap((c) => c.items.map((i) => i.question));
      expect(new Set(questions).size, lang).toBe(questions.length);
    }
  });
});
