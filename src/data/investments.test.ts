import { describe, expect, it } from 'vitest';
import {
  CITIZENSHIP_THRESHOLD_USD,
  INVESTMENTS,
  RESIDENCY_THRESHOLD_USD,
  citizenshipEligibility,
  eligibilityFor,
  investmentBySlug,
  priceRange,
  residencyEligibility,
} from './investments';

describe('eligibilityFor', () => {
  it('says yes only when the cheapest unit already clears the threshold', () => {
    expect(eligibilityFor(550_000, 1_850_000, CITIZENSHIP_THRESHOLD_USD)).toBe('yes');
  });

  it('says partial — never yes — when only the top of the range clears it', () => {
    expect(eligibilityFor(320_000, 1_100_000, CITIZENSHIP_THRESHOLD_USD)).toBe('partial');
  });

  it('treats an unpublished ceiling as partial rather than assuming it qualifies', () => {
    expect(eligibilityFor(266_000, null, CITIZENSHIP_THRESHOLD_USD)).toBe('partial');
  });

  it('says no when the whole range sits below the threshold', () => {
    expect(eligibilityFor(106_000, 150_000, RESIDENCY_THRESHOLD_USD)).toBe('no');
    expect(eligibilityFor(220_000, 337_000, CITIZENSHIP_THRESHOLD_USD)).toBe('no');
  });
});

describe('the opportunity catalogue', () => {
  it('has unique slugs', () => {
    const slugs = INVESTMENTS.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('never quotes a max below its min', () => {
    for (const o of INVESTMENTS) {
      if (o.maxUsd !== null) expect(o.maxUsd).toBeGreaterThanOrEqual(o.minUsd);
    }
  });

  it('gives every project a distinct brand colour so cards stay distinguishable', () => {
    const brands = INVESTMENTS.map((o) => o.brand);
    expect(new Set(brands).size).toBe(brands.length);
  });

  it('carries all four locales for every translated field', () => {
    for (const o of INVESTMENTS) {
      for (const lang of ['ar', 'en', 'fa', 'ru'] as const) {
        expect(o.name[lang], `${o.slug} name.${lang}`).toBeTruthy();
        expect(o.district[lang], `${o.slug} district.${lang}`).toBeTruthy();
        expect(o.type[lang], `${o.slug} type.${lang}`).toBeTruthy();
        expect(o.summary[lang], `${o.slug} summary.${lang}`).toBeTruthy();
        for (const p of o.pros) expect(p[lang], `${o.slug} pros.${lang}`).toBeTruthy();
        for (const c of o.cons) expect(c[lang], `${o.slug} cons.${lang}`).toBeTruthy();
      }
    }
  });

  it('states at least one risk per opportunity — an all-upside file is not a file', () => {
    for (const o of INVESTMENTS) expect(o.cons.length, o.slug).toBeGreaterThan(0);
  });

  it('marks the sub-threshold projects honestly', () => {
    const avcilar = investmentBySlug('avcilar-coastal')!;
    expect(citizenshipEligibility(avcilar)).toBe('no');
    expect(residencyEligibility(avcilar)).toBe('no');

    const basaksehir = investmentBySlug('basaksehir-projects')!;
    expect(citizenshipEligibility(basaksehir)).toBe('no');
    expect(residencyEligibility(basaksehir)).toBe('yes');
  });
});

describe('priceRange', () => {
  it('renders a closed range', () => {
    expect(priceRange(investmentBySlug('emaar-square-residences')!, 'from')).toBe('$320,000 – $1,100,000');
  });

  it('renders an open range with the "from" label', () => {
    expect(priceRange(investmentBySlug('casablu-vadi-beylikduzu')!, 'from')).toBe('from $266,000');
  });
});
