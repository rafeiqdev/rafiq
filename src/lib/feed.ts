import type { InvestmentRecord, Listing } from './types';

export type FeedItem =
  | { kind: 'listing'; listing: Listing; index: number }
  | { kind: 'invest'; opp: InvestmentRecord };

/**
 * Interleaves investment opportunities into the listings feed — one after every
 * `every` listings.
 *
 * Two rules that are easy to get wrong and both look like bugs to a user:
 *
 * 1. Nothing is injected before the first `every` listings have been rendered.
 *    An opportunity card at position 0 reads as an ad above the results the
 *    user actually asked for.
 * 2. No opportunity is injected after the last listing. A trailing card at the
 *    bottom of a short result set looks like the filter matched something it
 *    did not.
 *
 * Opportunities cycle if there are fewer of them than slots, so a long feed
 * never runs out — but the same one never appears twice in a row.
 */
export function interleaveInvestments(
  listings: Listing[],
  opportunities: InvestmentRecord[],
  every = 10,
): FeedItem[] {
  const out: FeedItem[] = [];
  if (every < 1) return listings.map((listing, index) => ({ kind: 'listing', listing, index }));

  let injected = 0;
  listings.forEach((listing, index) => {
    out.push({ kind: 'listing', listing, index });

    const isSlot = (index + 1) % every === 0;
    const isLast = index === listings.length - 1;
    if (isSlot && !isLast && opportunities.length > 0) {
      out.push({ kind: 'invest', opp: opportunities[injected % opportunities.length] });
      injected++;
    }
  });

  return out;
}
