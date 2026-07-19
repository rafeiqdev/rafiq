import { describe, expect, it } from 'vitest';
import { SERVICES, SERVICE_CATEGORIES, normalizeSearch, pickText } from './services';
import { TURKEY_CITIES, pickCity } from './turkeyCities';

/**
 * Guard rails: this slice must NOT damage the existing catalog. These tests fail
 * loudly if services/categories are deleted or the search helper regresses.
 */
describe('existing services catalog stays intact', () => {
  it('keeps exactly 78 unique services and 12 categories', () => {
    expect(SERVICES.length).toBe(78);
    expect(new Set(SERVICES.map((s) => s.id)).size).toBe(78);
    expect(SERVICE_CATEGORIES.length).toBe(12);
    expect(new Set(SERVICE_CATEGORIES.map((c) => c.id)).size).toBe(12);
  });

  it('every service has a stable id, a category and a type', () => {
    const ids = new Set<string>();
    for (const s of SERVICES) {
      expect(s.id).toBeTruthy();
      expect(ids.has(s.id)).toBe(false); // no duplicate ids
      ids.add(s.id);
      expect(['direct', 'partner']).toContain(s.type);
      expect(SERVICE_CATEGORIES.some((c) => c.id === s.category)).toBe(true);
    }
  });

  it('keeps the services referenced by the journey tasks', () => {
    for (const id of ['tel-sim', 'res-tax', 'res-tourist', 'bank-account']) {
      expect(SERVICES.some((s) => s.id === id)).toBe(true);
    }
  });

  it('search normalisation still matches forgiving Arabic input', () => {
    expect(normalizeSearch('إقامة')).toBe(normalizeSearch('اقامه'));
  });

  it('pickText falls back to English for a missing locale', () => {
    const s = SERVICES[0];
    expect(pickText(s.title, 'en')).toBeTruthy();
    expect(pickText(s.title, 'zz')).toBe(s.title.en);
  });
});

describe('onboarding city list', () => {
  it('offers cities with unique ids and localised names', () => {
    const ids = new Set(TURKEY_CITIES.map((c) => c.id));
    expect(ids.size).toBe(TURKEY_CITIES.length);
    expect(pickCity('istanbul', 'ar')).toBe('إسطنبول');
    expect(pickCity('istanbul', 'en')).toBe('Istanbul');
  });

  it('passes through an unknown / free-typed city', () => {
    expect(pickCity('Şanlıurfa', 'ar')).toBe('Şanlıurfa');
  });
});
