import { describe, expect, it } from 'vitest';
import { interleaveInvestments } from './feed';
import type { InvestmentRecord, Listing } from './types';

const listings = (n: number): Listing[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i), district: 'D', rooms: '2+1', m2: 100, priceUsd: 100_000, citizenship: false,
  }));

const opp = (slug: string) => ({ slug }) as InvestmentRecord;
const opps = [opp('a'), opp('b')];

const shape = (n: number, o: InvestmentRecord[], every?: number) =>
  interleaveInvestments(listings(n), o, every).map((x) => (x.kind === 'listing' ? 'L' : `I:${x.opp.slug}`));

describe('interleaveInvestments', () => {
  it('injects nothing before the first full block of listings', () => {
    expect(shape(9, opps)).toEqual(Array(9).fill('L'));
  });

  it('injects one opportunity after every tenth listing', () => {
    const out = shape(25, opps);
    expect(out.filter((x) => x.startsWith('I'))).toEqual(['I:a', 'I:b']);
    expect(out[10]).toBe('I:a');
    expect(out[21]).toBe('I:b');
  });

  it('never leaves an opportunity card dangling after the last listing', () => {
    const out = shape(20, opps);
    expect(out[out.length - 1]).toBe('L');
    expect(out.filter((x) => x.startsWith('I'))).toHaveLength(1);
  });

  it('cycles opportunities so a long feed never runs dry', () => {
    const out = shape(45, opps).filter((x) => x.startsWith('I'));
    expect(out).toEqual(['I:a', 'I:b', 'I:a', 'I:b']);
  });

  it('degrades to a plain list when there are no opportunities', () => {
    expect(shape(25, [])).toEqual(Array(25).fill('L'));
  });

  it('keeps the original index on each listing so photo fallbacks stay stable', () => {
    const out = interleaveInvestments(listings(12), opps);
    const last = out[out.length - 1];
    expect(last.kind === 'listing' && last.index).toBe(11);
  });

  it('does not divide by zero when every is invalid', () => {
    expect(shape(3, opps, 0)).toEqual(['L', 'L', 'L']);
  });
});
