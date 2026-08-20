import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CustomerRequest } from '../../lib/types';

/**
 * The mobile half of the same guarantee as MyRequests.test.tsx: the empty state
 * may only ever mean "the fetch succeeded and returned zero rows".
 *
 * Both loads on this page used `.catch(() => setX([]))`. On a phone — where a
 * dropped connection is the normal case, not the exception — that told a
 * customer their case did not exist, and told them no company wanted their
 * work. Neither statement was ever checked against reality.
 */

const allMineMock = vi.fn();
const responsesMock = vi.fn();
// The list now merges three sources; the other two stay inert here so these
// tests keep asking only about the service-request source.
const bookingsMineMock = vi.fn();
const leadsMineMock = vi.fn();

vi.mock('../../lib/api', () => ({
  customerRequests: {
    allMine: () => allMineMock(),
    responses: (id: string) => responsesMock(id),
    choose: vi.fn(),
  },
  bookings: { mine: () => bookingsMineMock() },
  leads: { mine: () => leadsMineMock() },
  reviews: { create: vi.fn() },
  // MedicalRequestsPanel mounts alongside the generic requests list; these
  // stubs keep it inert (empty list) for tests that aren't about it.
  medicalRequests: { mine: () => Promise.resolve([]) },
  medicalContent: { specialties: () => Promise.resolve([]) },
  // Every expanded request also fetches its offer/payment history — keep it
  // inert (no offers) for tests that aren't about the offer flow.
  serviceOffers: { listForRequest: () => Promise.resolve([]), reject: vi.fn() },
  servicePayments: { forRequest: () => Promise.resolve([]), createSession: vi.fn(), resumeUrl: () => null },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

vi.mock('../../components/Gates', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../components/SiteImage', () => ({ SiteImage: () => null }));
vi.mock('../../components/MobileTabBar', () => ({ MobileTabBar: () => null }));

const DIRECT: CustomerRequest = {
  id: 'd1', serviceTitle: 'مراقبة فتح حساب بنكي', category: 'banking', area: null,
  message: null, status: 'new', createdAt: '2026-07-27T10:00:00Z',
  serviceType: 'direct', broadcast: false,
};

async function renderPage() {
  const { MobileMyRequests } = await import('./MobileMyRequests');
  return render(
    <MemoryRouter>
      <MobileMyRequests />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetModules();
  allMineMock.mockReset();
  responsesMock.mockReset().mockResolvedValue([]);
  bookingsMineMock.mockReset().mockResolvedValue([]);
  leadsMineMock.mockReset().mockResolvedValue([]);
});

describe('mobile: a failed fetch is never an empty state', () => {
  it('shows an error with retry, and NOT the empty copy, when the request list fails', async () => {
    allMineMock.mockRejectedValue(new Error('network'));

    await renderPage();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('requests.empty')).toBeNull();
  });

  it('retry re-fetches and recovers into the list', async () => {
    allMineMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([DIRECT]);

    await renderPage();
    (await screen.findByRole('button', { name: 'chat.retry' })).click();

    expect(await screen.findByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
    expect(allMineMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error, not silence, when the offers fetch fails', async () => {
    allMineMock.mockResolvedValue([DIRECT]);
    responsesMock.mockRejectedValue(new Error('network'));

    await renderPage();
    (await screen.findByText('مراقبة فتح حساب بنكي')).closest('button')!.click();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
  });

  it('still shows the empty state when the fetch genuinely returns nothing', async () => {
    allMineMock.mockResolvedValue([]);

    await renderPage();

    expect(await screen.findByText('requests.empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
  });
});
