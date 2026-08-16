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

describe('Referrals Page (Desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({
      user: { id: 'usr_123', name: 'Ahmad', referralCode: 'AHMAD99' },
      authLoading: false,
    });
    statsMock.mockResolvedValue({
      clicks: 42,
      signups: 5,
      code: 'AHMAD99',
      totalCommissions: 2550,
      pending: 50,
      available: 2500,
      paid: 0,
      primaryCurrency: 'USD',
      currencies: {
        USD: { total: 2550, pending: 50, available: 2500, paid: 0 },
      },
      earnedTl: 0,
    });
  });

  it('renders the 5% referral title, description, and link sharing box', async () => {
    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>,
    );

    expect(screen.getByText('referrals.title')).toBeDefined();
    expect(screen.getByText('referrals.subtitle')).toBeDefined();
    expect(screen.getByText('referrals.how.title')).toBeDefined();
    expect(screen.getByText('referrals.calc.title')).toBeDefined();
    expect(screen.getByText('referrals.faq.title')).toBeDefined();
  });

  it('allows copying referral link to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>,
    );

    const copyBtn = screen.getByText('referrals.copy');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });
  });
});
