import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
  }),
}));

import { CompetitorAdCard } from './CompetitorAdCard';
import type { CompetitorAd } from '../../lib/api';

const AD = (over: Partial<CompetitorAd> = {}): CompetitorAd => ({
  id: 'ad-1', importId: 'i1', serviceId: 'res-tourist', adLibraryId: 'lib-1',
  advertiserName: 'شركة أ', status: 'Active', startedOn: '27 Jul 2021 - 27 Jul 2021',
  platforms: 'Facebook, Instagram', contentType: 'صورة', adText: 'نص الإعلان',
  adUrl: 'https://www.facebook.com/ads/library/?id=1',
  amountSpent: 'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
  searchLanguage: 'العربية', searchKeyword: 'إقامة سياحية', seenInPreviousImport: false,
  createdAt: '2026-08-20T00:00:00Z',
  ...over,
});

describe('CompetitorAdCard', () => {
  it('shows the advertiser name and total ad count collapsed', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD(), AD({ id: 'ad-2', status: 'Inactive' })]} />);

    expect(screen.getByText('شركة أ')).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('counts active ads separately from the total', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ status: 'Active' }), AD({ id: 'ad-2', status: 'Inactive' })]} />);

    expect(screen.getByText('competitorAds.card.activeCount 1')).toBeInTheDocument();
  });

  it('does not show individual ad text until expanded', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ adText: 'نص فريد للإعلان' })]} />);

    expect(screen.queryByText('نص فريد للإعلان')).not.toBeInTheDocument();
  });

  it('reveals every ad after clicking to expand', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ adText: 'نص فريد للإعلان' })]} />);

    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getByText('نص فريد للإعلان')).toBeInTheDocument();
  });

  it('links out to the ad library URL', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ adUrl: 'https://example.com/ad/1' })]} />);
    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getByRole('link', { name: /competitorAds.card.openInLibrary/ })).toHaveAttribute('href', 'https://example.com/ad/1');
  });

  it('shows the "seen before" badge only on ads flagged seenInPreviousImport', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ id: 'new', seenInPreviousImport: false }), AD({ id: 'old', seenInPreviousImport: true })]} />);
    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getAllByText('competitorAds.card.seenBefore')).toHaveLength(1);
  });

  it('shows every distinct platform as a chip, without duplicates', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ platforms: 'Facebook, Instagram' }), AD({ id: 'ad-2', platforms: 'Facebook' })]} />);

    expect(screen.getAllByText('Facebook')).toHaveLength(1);
    expect(screen.getAllByText('Instagram')).toHaveLength(1);
  });

  it('renders amountSpent as a note, not a styled figure', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD()]} />);
    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getByText('غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية')).toBeInTheDocument();
  });
});
