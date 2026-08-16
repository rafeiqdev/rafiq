import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const getSummaryMock = vi.fn();
const getTransactionsMock = vi.fn();
const getPayoutRequestsMock = vi.fn();
const requestPayoutMock = vi.fn();

vi.mock('../lib/api', () => ({
  wallet: {
    getSummary: () => getSummaryMock(),
    getTransactions: () => getTransactionsMock(),
    getPayoutRequests: () => getPayoutRequestsMock(),
    requestPayout: (...a: unknown[]) => requestPayoutMock(...a),
  },
  calculateCommission: (amount: number) => amount * 0.05,
}));

import { Wallet } from './Wallet';

describe('Wallet Page (Desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({
      user: { id: 'usr_123', name: 'Ahmad' },
      authLoading: false,
    });
  });

  it('renders empty state when there are no transactions', async () => {
    getSummaryMock.mockResolvedValue({
      totalCommissions: 0,
      pending: 0,
      available: 0,
      paid: 0,
      primaryCurrency: 'USD',
      currencies: {},
      totalCount: 0,
    });
    getTransactionsMock.mockResolvedValue([]);
    getPayoutRequestsMock.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Wallet />
      </MemoryRouter>,
    );

    expect(await screen.findByText('wallet.emptyStateTitle')).toBeDefined();
    expect(await screen.findByText('wallet.emptyStateBody')).toBeDefined();
  });

  it('renders transactions ledger with 5% commission details when records exist', async () => {
    getSummaryMock.mockResolvedValue({
      totalCommissions: 2550,
      pending: 50,
      available: 2500,
      paid: 0,
      primaryCurrency: 'USD',
      currencies: {
        USD: { total: 2550, pending: 50, available: 2500, paid: 0 },
      },
      totalCount: 2,
    });
    getTransactionsMock.mockResolvedValue([
      {
        id: 'tx_1',
        serviceName: 'Medical Tourism Package',
        transactionAmount: 50000,
        currency: 'USD',
        commissionRate: 0.05,
        commissionAmount: 2500,
        status: 'available',
        date: '2026-08-15T12:00:00Z',
      },
      {
        id: 'tx_2',
        serviceName: 'Residency Application',
        transactionAmount: 1000,
        currency: 'USD',
        commissionRate: 0.05,
        commissionAmount: 50,
        status: 'pending',
        date: '2026-08-16T09:00:00Z',
      },
    ]);
    getPayoutRequestsMock.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Wallet />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Medical Tourism Package')).toBeDefined();
    expect(await screen.findByText('Residency Application')).toBeDefined();

    const matches2500 = await screen.findAllByText('$2,500.00');
    expect(matches2500.length).toBeGreaterThanOrEqual(1);

    const matches50 = await screen.findAllByText('$50.00');
    expect(matches50.length).toBeGreaterThanOrEqual(1);
  });
});
