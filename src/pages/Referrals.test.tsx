import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

const statsMock = vi.fn();
vi.mock('../lib/api', () => ({
  referrals: {
    stats: () => statsMock(),
  },
  calculateCommission: (amount: number) => amount * 0.05,
}));

import { Referrals } from './Referrals';

const SIGNED_IN = { id: 'usr_123', name: 'Ahmad', referralCode: 'AHMAD99' };

const STATS = {
  clicks: 42,
  signups: 5,
  code: 'AHMAD99',
  totalCommissions: 2550,
  pending: 50,
  available: 2500,
  paid: 0,
  primaryCurrency: 'USD',
  currencies: { USD: { total: 2550, pending: 50, available: 2500, paid: 0 } },
  earnedTl: 0,
};

describe('Referrals Page (Desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({ user: SIGNED_IN, authLoading: false });
    statsMock.mockResolvedValue(STATS);
  });

  it('leads with the offer, the link and the three steps', async () => {
    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>,
    );

    expect(screen.getByText('referrals.title')).toBeDefined();
    expect(screen.getByText('referrals.lead')).toBeDefined();
    expect(screen.getByText('referrals.steps.a')).toBeDefined();
    expect(screen.getByText('referrals.steps.b')).toBeDefined();
    expect(screen.getByText('referrals.steps.c')).toBeDefined();
    expect(screen.getByText('referrals.fine')).toBeDefined();
  });

  it('allows copying referral link to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('referrals.copy'));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/r/AHMAD99'));
    });
  });

  /**
   * The bug this pins: with no referral code the page used to render the whole
   * dashboard anyway, showing "<origin>/r/" as the link — a dead URL that the
   * copy button copied happily. A visitor has no code until they have an
   * account, so there must be no link and no copy button at all.
   */
  it('shows a sign-in prompt instead of an empty /r/ link when signed out', async () => {
    useAppMock.mockReturnValue({ user: null, authLoading: false });

    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>,
    );

    expect(screen.getByText('referrals.signedOutCta')).toBeDefined();
    expect(screen.queryByText('referrals.copy')).toBeNull();
    expect(screen.queryByDisplayValue(/\/r\/$/)).toBeNull();
  });
});
