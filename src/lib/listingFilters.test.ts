import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeFilterCount, applyFilters, districtsOf, num, toggle } from './listingFilters';
import type { Listing } from './types';

const base: Listing = {
  id: '1', district: 'Beylikduzu', rooms: '2+1', m2: 110, priceUsd: 182000, citizenship: true,
};

const rows: Listing[] = [
  { ...base },
  { ...base, id: '2', district: 'Fatih', rooms: '3+1', m2: 145, priceUsd: 246000, citizenship: false },
  { ...base, id: '3', district: 'Kartal', rooms: '1+1', m2: 68, priceUsd: 129000, citizenship: true, yieldPct: 7, buildStatus: 'under-construction' },
  { ...base, id: '4', district: 'Fatih', rooms: '2+1', m2: 95, priceUsd: 158000, citizenship: false, listingType: 'rent' },
];

describe('applyFilters', () => {
  it('defaults to sale-only, so rent rows never leak into the sale tab', () => {
    expect(applyFilters(rows, EMPTY_FILTERS).map((l) => l.id)).toEqual(['1', '2', '3']);
  });

  it('treats a missing listingType as sale rather than dropping the row', () => {
    expect(applyFilters([base], EMPTY_FILTERS)).toHaveLength(1);
  });

  it('maps citizenship=false to "unknown", not to "ineligible"', () => {
    const only = applyFilters(rows, { ...EMPTY_FILTERS, citizenship: ['unknown'] });
    expect(only.map((l) => l.id)).toEqual(['2']);
  });

  it('filters by price bounds inclusively', () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, minPrice: 129000, maxPrice: 182000 });
    expect(out.map((l) => l.id)).toEqual(['1', '3']);
  });

  it('matches any selected investment angle rather than all of them', () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, investment: ['yield', 'ready'] });
    expect(out.map((l) => l.id)).toEqual(['3']);
  });

  it('requires every selected amenity', () => {
    const withAmenities: Listing[] = [
      { ...base, id: 'a', furnished: true, amenities: ['elevator'] },
      { ...base, id: 'b', furnished: true, amenities: [] },
    ];
    const out = applyFilters(withAmenities, { ...EMPTY_FILTERS, amenities: ['furnished', 'elevator'] });
    expect(out.map((l) => l.id)).toEqual(['a']);
  });

  it('sorts by price and by yield', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, sort: 'priceAsc' }).map((l) => l.id)).toEqual(['3', '1', '2']);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, sort: 'yield' })[0].id).toBe('3');
  });
});

describe('helpers', () => {
  it('counts only user-set filters, not the tab or sort', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, type: 'rent', sort: 'priceAsc' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, district: 'Fatih', rooms: ['2+1'], citizenship: ['yes'] })).toBe(3);
  });

  it('lists districts uniquely', () => {
    expect(districtsOf(rows)).toEqual(['Beylikduzu', 'Fatih', 'Kartal']);
  });

  it('toggles values in and out', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('reads an empty numeric input as "no bound" instead of zero', () => {
    expect(num('')).toBeNull();
    expect(num('  ')).toBeNull();
    expect(num('180000')).toBe(180000);
  });
});
