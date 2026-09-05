import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Listing } from '../../lib/types';

/**
 * Smoke + behaviour tests for the mobile real-estate page (owner's mockup,
 * transferred 1:1 and wired to the real listings feed).
 *
 * The page renders money, citizenship eligibility and WhatsApp contact links —
 * a blank or crashing mount here is a broken storefront, so the mount itself
 * is pinned, plus the three behaviours the redesign exists for:
 * chips filter the feed, a card opens the in-page detail overlay, and an
 * empty catalogue renders an invitation instead of nothing.
 */

const ROWS: Listing[] = [
  {
    id: '1',
    district: 'Bağcılar',
    rooms: '2+1',
    m2: 65,
    priceUsd: 140000,
    citizenship: true,
    image: null,
    images: [],
    bathrooms: 1,
    furnished: false,
    floor: 3,
    totalFloors: 8,
    listingType: 'sale',
    buildStatus: 'ready',
    amenities: ['parking'],
    updatedAt: '2026-09-01',
    description: 'شقة لقطة',
  },
  {
    id: '2',
    district: 'Fatih',
    rooms: '1+1',
    m2: 55,
    priceUsd: 99000,
    citizenship: false,
    image: null,
    images: [],
    bathrooms: 1,
    furnished: true,
    listingType: 'sale',
    updatedAt: null,
    description: null,
  },
];

let rows: Listing[] = ROWS;

vi.mock('../../lib/api', () => ({
  listings: { list: () => Promise.resolve(rows) },
  investments: { list: () => Promise.resolve([]) },
}));

vi.mock('../../hooks/useInvestments', () => ({
  useInvestments: () => ({ items: [], loading: false, source: 'db' as const }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

vi.mock('../../components/MobileTabBar', () => ({ MobileTabBar: () => <div /> }));
vi.mock('../../lib/seo', () => ({ usePageMeta: () => {}, SITE_URL: 'https://rafiq.ist', BANNERS: {} }));

import { MobileRealEstate } from './MobileRealEstate';

function mount(): void {
  render(
    <MemoryRouter>
      <MobileRealEstate />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  rows = ROWS;
});

describe('MobileRealEstate', () => {
  it('mounts the owner design with real rows', async () => {
    mount();
    // Header from the mockup, keyed (tests assert structure, not copy).
    expect(await screen.findByText('realEstate.title')).toBeInTheDocument();
    expect(screen.getByText('realEstate.mx.bestTitle')).toBeInTheDocument();
    expect(screen.getByText('realEstate.mx.allTitle')).toBeInTheDocument();
    // Turkish district localised through istanbulAreas, not shipped raw.
    expect(screen.getAllByText('باغجلار').length).toBeGreaterThan(0);
    // Cheapest first in the preview rail (mockup default order).
    expect(screen.getAllByText('$99,000').length).toBeGreaterThan(0);
  });

  it('chips narrow the feed to citizenship-eligible rows', async () => {
    mount();
    await screen.findByText('realEstate.title');
    fireEvent.click(screen.getByText('realEstate.mx.chipCit'));
    await waitFor(() => {
      // The non-eligible row's price vanishes from every visible card.
      expect(screen.queryByText('$99,000')).toBeNull();
    });
    expect(screen.getAllByText('باغجلار').length).toBeGreaterThan(0);
  });

  it('a card opens the in-page detail overlay', async () => {
    mount();
    await screen.findByText('realEstate.title');
    fireEvent.click(screen.getAllByText('باغجلار')[0]);
    expect(await screen.findByText('realEstate.mx.detailsTitle')).toBeInTheDocument();
    expect(screen.getByText('realEstate.mx.descTitle')).toBeInTheDocument();
  });

  it('an empty catalogue renders invitations, not a blank page', async () => {
    rows = [];
    mount();
    await waitFor(() => {
      expect(screen.getAllByText('realEstate.mx.noResults').length).toBeGreaterThanOrEqual(2);
    });
  });
});
