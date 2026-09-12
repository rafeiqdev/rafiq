import { describe, expect, it } from 'vitest';
import { PROPERTY_RESIDENCE, PROPERTY_RESIDENCE_PATH } from './propertyResidence';
import { SERVICES } from './services';
import { COMPARISONS } from './comparisons';
import { CATEGORY_GUIDES } from './categoryGuides';

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;

/** Routes this page is allowed to link to, beyond services/guides/comparisons. */
const STATIC_TARGETS = ['/real-estate', '/real-estate/investments'];

describe('property residence page content', () => {
  it('provides every language', () => {
    expect(Object.keys(PROPERTY_RESIDENCE).sort()).toEqual([...LANGS].sort());
  });

  it('is long-form and structured enough to stand as a crawlable page', () => {
    for (const language of LANGS) {
      const c = PROPERTY_RESIDENCE[language];
      const body = [
        c.seoTitle, c.navLabel, c.metaDescription, c.h1, c.intro, c.heroAlt,
        c.documentsHeading, c.documentsIntro, c.stepsHeading, c.stepsIntro,
        c.faqHeading, c.relatedHeading, c.relatedIntro,
        c.ctaTitle, c.ctaBody, c.disclaimer,
        ...c.highlights,
        ...c.sections.flatMap((section) => [section.heading, section.body]),
        ...c.documents.flatMap((doc) => [doc.label, doc.note]),
        ...c.steps.flatMap((step) => [step.title, step.body]),
        ...c.faqs.flatMap((faq) => [faq.question, faq.answer]),
        ...c.related.flatMap((link) => [link.label, link.note]),
      ].join(' ');
      expect(c.seoTitle.length, `${language} title`).toBeGreaterThan(20);
      expect(c.metaDescription.length, `${language} description`).toBeGreaterThan(80);
      expect(c.navLabel.length, `${language} navLabel should be short`).toBeLessThan(60);
      expect(c.sections.length, `${language} sections`).toBeGreaterThanOrEqual(5);
      expect(c.documents.length, `${language} documents`).toBeGreaterThanOrEqual(4);
      expect(c.steps.length, `${language} steps`).toBeGreaterThanOrEqual(4);
      expect(c.faqs.length, `${language} FAQs`).toBeGreaterThanOrEqual(5);
      expect(c.related.length, `${language} related links`).toBeGreaterThanOrEqual(5);
      expect(body.length, `${language} page length`).toBeGreaterThan(3000);
    }
  });

  it('keeps the same link targets in every language, and every target is a real route', () => {
    const serviceIds = new Set(SERVICES.map((service) => service.id));
    const arabicTargets = PROPERTY_RESIDENCE.ar.related.map((link) => link.to);
    for (const language of LANGS) {
      expect(PROPERTY_RESIDENCE[language].related.map((link) => link.to), language).toEqual(arabicTargets);
    }
    for (const to of arabicTargets) {
      const service = to.match(/^\/services\/(.+)$/);
      const guide = to.match(/^\/guides\/(.+)$/);
      const comparison = to.match(/^\/compare\/(.+)$/);
      if (service) expect(serviceIds.has(service[1]), to).toBe(true);
      else if (guide) expect(CATEGORY_GUIDES[guide[1]], to).toBeDefined();
      else if (comparison) expect(COMPARISONS[comparison[1]], to).toBeDefined();
      else expect(STATIC_TARGETS, to).toContain(to);
    }
  });

  it('hands off to the property-residence service page, which is the request path', () => {
    expect(PROPERTY_RESIDENCE.ar.related.map((link) => link.to)).toContain('/services/res-property');
  });

  it('never publishes a hard minimum property value or a government fee', () => {
    // The threshold is set by regulation and was last raised in October 2023.
    // Publishing a figure here would go stale and mislead someone mid-purchase
    // — see this data file's header and CLAUDE.md.
    for (const language of LANGS) {
      const c = PROPERTY_RESIDENCE[language];
      const body = JSON.stringify(c);
      expect(body, `${language} must not quote a dollar amount`).not.toMatch(/\$\s?\d/);
      expect(body, `${language} must not quote a lira amount`).not.toMatch(/\d[\d.,]*\s?(TL|TRY|₺)/);
      // "200,000" / "٢٠٠ ألف" style thresholds, in any of the four scripts.
      expect(body, `${language} must not quote a value threshold`).not.toMatch(/\d{3}[.,]\d{3}/);
    }
  });

  it('targets the keyword in the places that matter, without stuffing it', () => {
    const ar = PROPERTY_RESIDENCE.ar;
    const keyword = 'الإقامة العقارية في إسطنبول';
    expect(ar.seoTitle).toContain(keyword);
    expect(ar.metaDescription).toContain(keyword);
    expect(ar.h1).toContain(keyword);
    expect(ar.intro).toContain(keyword);
    expect(ar.heroAlt).toContain(keyword);
    // At least one H2 carries the full phrase.
    const headings = [...ar.sections.map((s) => s.heading), ar.documentsHeading, ar.stepsHeading, ar.faqHeading];
    expect(headings.some((heading) => heading.includes(keyword))).toBe(true);
    // …and it stays a handful of deliberate placements, not a repeated tic.
    const occurrences = JSON.stringify(ar).split(keyword).length - 1;
    expect(occurrences, 'exact-phrase repetitions').toBeLessThanOrEqual(8);
  });

  it('exposes the canonical path the whole site links to', () => {
    expect(PROPERTY_RESIDENCE_PATH).toBe('/real-estate/residence-permit');
  });
});
