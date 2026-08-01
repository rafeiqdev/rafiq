import type { Listing, ListingType } from './types';

/**
 * Client-side filtering for the real-estate page.
 *
 * Filtering runs in the browser on the already-fetched list on purpose: the
 * catalogue is small (tens of rows, not thousands), so a round trip per
 * checkbox would be slower and noisier than filtering in memory. If the
 * catalogue ever grows past a few hundred rows this moves to the query layer —
 * the shape of `ListingFilters` is deliberately serialisable so it can become
 * URL params without touching the components.
 */
export interface ListingFilters {
  type: ListingType;
  q: string;
  district: string;
  minPrice: number | null;
  maxPrice: number | null;
  rooms: string[];
  minM2: number | null;
  maxM2: number | null;
  /** citizenship eligibility: 'yes' = meets the threshold, 'unknown' = unverified */
  citizenship: ('yes' | 'unknown')[];
  /** investment angles: yield / build status */
  investment: ('yield' | 'under-construction' | 'ready')[];
  amenities: string[];
  sort: 'newest' | 'priceAsc' | 'priceDesc' | 'yield';
}

export const EMPTY_FILTERS: ListingFilters = {
  type: 'sale',
  q: '',
  district: '',
  minPrice: null,
  maxPrice: null,
  rooms: [],
  minM2: null,
  maxM2: null,
  citizenship: [],
  investment: [],
  amenities: [],
  sort: 'newest',
};

export const ROOM_OPTIONS = ['1+0', '1+1', '2+1', '3+1', '4+1'];
export const AMENITY_OPTIONS = ['furnished', 'parking', 'elevator', 'security'];

/** Unique, sorted district list built from whatever rows actually exist. */
export function districtsOf(listings: Listing[]): string[] {
  return [...new Set(listings.map((l) => l.district).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function hasAmenity(l: Listing, key: string): boolean {
  if (key === 'furnished') return !!l.furnished || (l.amenities ?? []).includes('furnished');
  return (l.amenities ?? []).includes(key);
}

/**
 * Count of filters the user actively set — powers the "3" badge on the mobile
 * filter button. The tab (`type`) and `sort` are navigation, not filters, so
 * they are excluded.
 */
export function activeFilterCount(f: ListingFilters): number {
  let n = 0;
  if (f.q.trim()) n++;
  if (f.district) n++;
  if (f.minPrice !== null || f.maxPrice !== null) n++;
  if (f.rooms.length) n++;
  if (f.minM2 !== null || f.maxM2 !== null) n++;
  n += f.citizenship.length;
  n += f.investment.length;
  n += f.amenities.length;
  return n;
}

export function applyFilters(listings: Listing[], f: ListingFilters): Listing[] {
  const q = f.q.trim().toLowerCase();

  const out = listings.filter((l) => {
    if ((l.listingType ?? 'sale') !== f.type) return false;

    if (q && !`${l.district} ${l.rooms} ${l.description ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.district && l.district !== f.district) return false;

    if (f.minPrice !== null && l.priceUsd < f.minPrice) return false;
    if (f.maxPrice !== null && l.priceUsd > f.maxPrice) return false;

    if (f.rooms.length && !f.rooms.includes(l.rooms)) return false;

    if (f.minM2 !== null && l.m2 < f.minM2) return false;
    if (f.maxM2 !== null && l.m2 > f.maxM2) return false;

    // Citizenship: the boolean column means "meets the threshold". False is
    // NOT "ineligible" — it means nobody verified it yet, which is why the UI
    // labels it "unknown" rather than showing a negative badge.
    if (f.citizenship.length) {
      const state = l.citizenship ? 'yes' : 'unknown';
      if (!f.citizenship.includes(state)) return false;
    }

    if (f.investment.length) {
      const matches = f.investment.some((k) => {
        if (k === 'yield') return (l.yieldPct ?? 0) > 0;
        return l.buildStatus === k;
      });
      if (!matches) return false;
    }

    if (f.amenities.length && !f.amenities.every((a) => hasAmenity(l, a))) return false;

    return true;
  });

  switch (f.sort) {
    case 'priceAsc':
      return [...out].sort((a, b) => a.priceUsd - b.priceUsd);
    case 'priceDesc':
      return [...out].sort((a, b) => b.priceUsd - a.priceUsd);
    case 'yield':
      return [...out].sort((a, b) => (b.yieldPct ?? 0) - (a.yieldPct ?? 0));
    default:
      return out;
  }
}

/** Toggle a value inside one of the array-valued filter fields. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Parse a free-typed number input; empty / invalid → null (= no bound). */
export function num(v: string): number | null {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return v.trim() === '' || Number.isNaN(n) ? null : n;
}
