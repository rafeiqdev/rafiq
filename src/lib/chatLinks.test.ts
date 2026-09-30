import { describe, expect, it } from 'vitest';
import { SERVICES, SERVICE_CATEGORIES } from '../data/services';
import { resolveChatLink, resolveChatLinks } from './chatLinks';
import { fallbackRespond } from './ai-fallback';

const catalog = { services: SERVICES, categories: SERVICE_CATEGORIES };

describe('resolveChatLink', () => {
  it("names a page in the visitor's language", () => {
    expect(resolveChatLink('news', 'ar', catalog)).toMatchObject({ to: '/news', label: 'صفحة الأخبار', kind: 'page' });
    expect(resolveChatLink('news', 'en', catalog)?.label).toBe('News page');
    expect(resolveChatLink('realestate', 'ar-SA', catalog)?.label).toBe('صفحة العقارات');
  });

  it('uses the live catalogue title for a service and a category', () => {
    const svc = resolveChatLink('service:res-tourist', 'en', catalog);
    expect(svc).toMatchObject({ to: '/services/res-tourist', kind: 'service' });
    expect(svc?.label).toContain('Tourist residence permit');
    expect(resolveChatLink('category:realestate', 'ar', catalog)).toMatchObject({ to: '/services?category=realestate', label: 'العقارات' });
    expect(resolveChatLink('guide:residency', 'ar', catalog)).toMatchObject({ to: '/guides/residency', kind: 'guide' });
  });

  it('drops ids the catalogue no longer has', () => {
    expect(resolveChatLink('service:res-tourist', 'en', { services: [], categories: [] })).toBeNull();
    expect(resolveChatLink('bogus', 'en', catalog)).toBeNull();
    expect(resolveChatLinks(['news', 'bogus', 'map'], 'en', catalog).map((l) => l.id)).toEqual(['news', 'map']);
    expect(resolveChatLinks(undefined, 'en', catalog)).toEqual([]);
  });
});

describe('offline replies still hand over a button', () => {
  it('sends a news question to the news page', () => {
    expect(fallbackRespond([], 'وين فيني شوف احدث الاخبار', 'ar').links).toContain('news');
  });

  it('sends a residency question to the residency services', () => {
    expect(fallbackRespond([], 'I need a residence permit', 'en').links).toContain('category:residency');
  });

  it('offers nothing for small talk', () => {
    expect(fallbackRespond([], 'hello there', 'en').links).toEqual([]);
  });
});
