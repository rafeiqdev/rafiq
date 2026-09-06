import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GooglePlaceResult, PlaceOverlay } from '../../lib/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}));

vi.mock('../../lib/api', () => ({
  placeSearch: { photoUrl: () => null },
}));

import { PlaceCard } from './PlaceCard';

const PLACE: GooglePlaceResult = {
  placeId: 'ChIJtest',
  name: 'مطعم تجريبي',
  address: 'Beyoğlu, İstanbul',
  lat: 41.03,
  lng: 28.98,
  primaryType: 'restaurant',
  rating: 4.4,
  ratingCount: 210,
  openNow: true,
  hours: ['الاثنين: 09:00–22:00'],
  phone: '0212 000 00 00',
  photoRef: null,
  mapsUri: 'https://maps.google.com/?cid=1',
  websiteUri: null,
  businessStatus: 'OPERATIONAL',
};

function show(overlay?: PlaceOverlay) {
  return render(
    <MemoryRouter>
      <PlaceCard place={PLACE} overlay={overlay} saved={false} onToggleSave={() => {}} onClose={() => {}} />
    </MemoryRouter>,
  );
}

/**
 * The product rule: a Google result is just a Google result. Rafiq's badge is
 * editorial and may only appear when an admin reviewed the place. Silence must
 * read as "not reviewed", never as endorsement.
 */
describe('Rafiq trust block', () => {
  it('shows "not reviewed" for a plain Google result with no overlay', () => {
    show(undefined);

    expect(screen.getByText('map.notReviewed')).toBeInTheDocument();
    expect(screen.getByText('map.notReviewedBody')).toBeInTheDocument();
    expect(screen.queryByText('map.recommended')).not.toBeInTheDocument();
    expect(screen.queryByText('map.verified')).not.toBeInTheDocument();
  });

  it('does not promote an unverified overlay row to a badge', () => {
    show({
      googlePlaceId: PLACE.placeId,
      verifiedStatus: 'unverified',
      recommended: false,
      recommendationReason: null,
      lastReviewedAt: null,
    });

    expect(screen.getByText('map.notReviewed')).toBeInTheDocument();
    expect(screen.queryByText('map.recommended')).not.toBeInTheDocument();
  });

  it('shows verified — but NOT recommended — when the place was only vetted', () => {
    show({
      googlePlaceId: PLACE.placeId,
      verifiedStatus: 'verified',
      recommended: false,
      recommendationReason: null,
      lastReviewedAt: '2026-06-01T00:00:00Z',
    });

    expect(screen.getByText('map.verified')).toBeInTheDocument();
    expect(screen.queryByText('map.recommended')).not.toBeInTheDocument();
  });

  it('treats a rejected place as not reviewed, never as verified', () => {
    show({
      googlePlaceId: PLACE.placeId,
      verifiedStatus: 'rejected',
      recommended: false,
      recommendationReason: null,
      lastReviewedAt: '2026-06-01T00:00:00Z',
    });

    expect(screen.queryByText('map.verified')).not.toBeInTheDocument();
    expect(screen.queryByText('map.recommended')).not.toBeInTheDocument();
  });

  it('shows the recommendation with its reason and review date once reviewed', () => {
    show({
      googlePlaceId: PLACE.placeId,
      verifiedStatus: 'verified',
      recommended: true,
      recommendationReason: 'طاقم يتحدث العربية وأسعار واضحة.',
      lastReviewedAt: '2026-06-01T00:00:00Z',
    });

    expect(screen.getByText('map.recommended')).toBeInTheDocument();
    expect(screen.getByText('طاقم يتحدث العربية وأسعار واضحة.')).toBeInTheDocument();
    // The date is interpolated by i18n, so assert the key was reached.
    expect(screen.getByText('map.lastReviewed')).toBeInTheDocument();
  });
});

describe('place details', () => {
  it('renders address, rating, phone and hours', () => {
    show(undefined);

    expect(screen.getByText('Beyoğlu, İstanbul')).toBeInTheDocument();
    // rating and review count are separate cells now (count goes through i18n)
    expect(screen.getByText('4.4')).toBeInTheDocument();
    expect(screen.getByText('map.card.reviewsCount')).toBeInTheDocument();
    expect(screen.getByText('0212 000 00 00')).toBeInTheDocument();
    expect(screen.getByText('الاثنين: 09:00–22:00')).toBeInTheDocument();
    expect(screen.getByText('map.openNow')).toBeInTheDocument();
  });

  it('links directions to Google Maps and opens it safely', () => {
    show(undefined);

    const link = screen.getByText('map.directory.directions').closest('a');
    expect(link).toHaveAttribute('href', 'https://maps.google.com/?cid=1');
    expect(link).toHaveAttribute('target', '_blank');
    // Without noopener the opened tab can reach back through window.opener.
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('offers the booking-help action', () => {
    show(undefined);
    expect(screen.getByText('map.requestHelp')).toBeInTheDocument();
  });
});
