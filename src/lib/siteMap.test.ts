import { describe, expect, it } from 'vitest';
import { CATEGORY_INDEX, SERVICE_INDEX } from './serviceIndex.generated';
import { SERVICES, SERVICE_CATEGORIES } from '../data/services';
import {
  SITE_MAP,
  cleanLinkIds,
  hasNavigationIntent,
  isKnownLinkId,
  linkPath,
  matchDestinations,
  parseLinkId,
} from './siteMap';

describe('service index stays in step with the catalogue', () => {
  // The assistant runs in an edge function that cannot import the catalogue, so
  // it reads a generated copy. If this fails: npm run generate:service-index
  it('lists every service with its current id, category and titles', () => {
    expect(SERVICE_INDEX.map((s) => ({ id: s.id, category: s.category, ar: s.ar, en: s.en }))).toEqual(
      SERVICES.map((s) => ({ id: s.id, category: s.category, ar: s.title.ar, en: s.title.en })),
    );
  });

  it('lists every category', () => {
    expect(CATEGORY_INDEX.map((c) => ({ id: c.id, ar: c.ar, en: c.en }))).toEqual(
      SERVICE_CATEGORIES.map((c) => ({ id: c.id, ar: c.title.ar, en: c.title.en })),
    );
  });
});

describe('site map', () => {
  it('has unique ids and a label in every language', () => {
    const ids = SITE_MAP.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of SITE_MAP) {
      for (const lang of ['ar', 'en', 'ru', 'fa'] as const) expect(d.label[lang], `${d.id}/${lang}`).toBeTruthy();
      expect(d.path.startsWith('/')).toBe(true);
    }
  });
});

describe('link ids', () => {
  it('accepts real pages, services, categories and guides', () => {
    expect(linkPath('news')).toBe('/news');
    expect(linkPath('realestate')).toBe('/real-estate');
    expect(linkPath('service:res-tourist')).toBe('/services/res-tourist');
    expect(linkPath('category:realestate')).toBe('/services?category=realestate');
    expect(linkPath('guide:residency')).toBe('/guides/residency');
  });

  it('rejects anything the model might invent', () => {
    for (const bad of ['', 'nope', 'service:does-not-exist', 'category:x', 'https://evil.example', 'javascript:alert(1)', 'service:']) {
      expect(isKnownLinkId(bad), bad).toBe(false);
      expect(linkPath(bad), bad).toBeNull();
    }
    expect(parseLinkId('news')).toEqual({ kind: 'page', id: 'news' });
  });

  it('cleanLinkIds dedupes, drops unknowns and caps the count', () => {
    expect(cleanLinkIds(['news', 'news', 'bogus', 'map', 'faq', 'about'], 3)).toEqual(['news', 'map', 'faq']);
    expect(cleanLinkIds([])).toEqual([]);
  });
});

describe('offline matcher', () => {
  it('finds the news page for the owner\'s own example sentence', () => {
    const q = 'وين فيني شوف احدث الاخبار';
    expect(matchDestinations(q)).toContain('news');
    expect(hasNavigationIntent(q)).toBe(true);
  });

  it.each([
    ['بدي شوف عقارات', 'realestate'],
    ['أريد أن أتصفح العقارات', 'realestate'],
    ['where can I see the map', 'map'],
    ['show me the latest news', 'news'],
    ['покажи недвижимость', 'realestate'],
    ['اخبار ترکیه کجاست', 'news'],
    ['كيف أدعو أصدقائي وأربح عمولة', 'referrals'],
    ['I want to book a free consultation', 'consultation'],
  ])('%s → %s', (text, expected) => {
    expect(matchDestinations(text)).toContain(expected);
  });

  it('does not fire on look-alike words', () => {
    // "أخبرني" (= tell me) contains "خبر" but is not the news
    expect(matchDestinations('أخبرني عن تجربتك')).not.toContain('news');
    // "example" contains "map"? no — and "mapping" is not a request for the map page either way
    expect(matchDestinations('for example')).toEqual([]);
  });

  it('returns nothing for small talk', () => {
    expect(matchDestinations('مرحبا كيف حالك')).toEqual([]);
    expect(hasNavigationIntent('مرحبا كيف حالك')).toBe(false);
  });
});
