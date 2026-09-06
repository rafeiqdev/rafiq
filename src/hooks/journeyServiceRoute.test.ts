import { describe, expect, it, vi } from 'vitest';

// The hook pulls in the Supabase-backed API layer at import time; these tests
// only exercise the pure route helper next to it.
vi.mock('../lib/api', () => ({ ApiError: class extends Error {}, journey: {} }));
vi.mock('../context/AppContext', () => ({ useApp: () => ({}) }));

import { journeyServiceRoute } from './useJourney';
import type { JourneyItem } from '../lib/types';

function item(over: Partial<JourneyItem>): JourneyItem {
  return {
    id: 'i1',
    taskKey: 'turkishPhone',
    titleAr: 'مهمة',
    status: 'todo',
    sort: 1,
    relatedRoute: null,
    relatedServiceId: null,
    ...over,
  };
}

describe('journeyServiceRoute', () => {
  it('opens the step’s own card on the full services page', () => {
    expect(journeyServiceRoute(item({ relatedServiceId: 'tel-sim' }))).toBe('/services?open=tel-sim');
  });

  it('ignores a stale ?q= route the seeded row carries', () => {
    const route = journeyServiceRoute(
      item({ relatedServiceId: 'res-tax', relatedRoute: '/services?q=%D8%B6%D8%B1%D9%8A%D8%A8%D9%8A' }),
    );
    expect(route).toBe('/services?open=res-tax');
  });

  it('knows the four default tasks without a service id on the row', () => {
    expect(journeyServiceRoute(item({ taskKey: 'turkishPhone' }))).toBe('/services?open=tel-sim');
    expect(journeyServiceRoute(item({ taskKey: 'taxNumber' }))).toBe('/services?open=res-tax');
    expect(journeyServiceRoute(item({ taskKey: 'residencePermit' }))).toBe('/services?open=res-tourist');
    expect(journeyServiceRoute(item({ taskKey: 'bankAccount' }))).toBe('/services?open=bank-account');
  });

  it('falls back to the row’s own route, then to the journey page', () => {
    expect(journeyServiceRoute(item({ taskKey: 'custom', relatedRoute: '/legal' }))).toBe('/legal');
    expect(journeyServiceRoute(item({ taskKey: 'custom' }))).toBe('/journey');
  });
});
