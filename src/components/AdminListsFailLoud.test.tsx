import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * COMMIT 6 — the admin lists may say "empty" only after a successful fetch.
 *
 * ServiceRequestsManager rendered "no requests" on a failed load — the exact
 * defect AdminNewRequests was built to never commit, three inches above it on
 * the same page. For the admin that is the costliest lie the product can
 * tell: an empty queue reads as "nobody needs me" while requests sit
 * unanswered. Six admin lists shared the shape; all are pinned here.
 */

const api = {
  serviceRequests: { adminList: vi.fn(), adminSetStatus: vi.fn() },
  companyPayments: { pending: vi.fn(), resolve: vi.fn(), openReceipt: vi.fn() },
  adminBroadcast: { requests: vi.fn(), responses: vi.fn() },
  adminCompanies: { list: vi.fn() },
  listings: { adminList: vi.fn() },
  adminPlaces: { list: vi.fn() },
  bookings: { adminList: vi.fn() },
};

vi.mock('../lib/api', () => ({
  serviceRequests: { adminList: () => api.serviceRequests.adminList(), adminSetStatus: (...a: unknown[]) => api.serviceRequests.adminSetStatus(...a) },
  companyPayments: { pending: () => api.companyPayments.pending(), resolve: vi.fn(), openReceipt: vi.fn() },
  adminBroadcast: { requests: () => api.adminBroadcast.requests(), responses: () => api.adminBroadcast.responses() },
  adminCompanies: { list: () => api.adminCompanies.list() },
  listings: { adminList: () => api.listings.adminList() },
  adminPlaces: { list: () => api.adminPlaces.list() },
  bookings: { adminList: () => api.bookings.adminList() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

// AdminBookings wraps in RequireAdmin; neutralise the gate for the unit test.
vi.mock('./Gates', () => ({ RequireAdmin: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../components/Gates', () => ({ RequireAdmin: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

beforeEach(() => {
  vi.resetModules();
  for (const group of Object.values(api)) for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockReset();
});

const boom = () => Promise.reject(new Error('network'));

describe('ServiceRequestsManager', () => {
  async function renderIt() {
    const { ServiceRequestsManager } = await import('./ServiceRequestsManager');
    return render(<ServiceRequestsManager />);
  }

  it('a failed load shows error-with-retry, NOT "no requests"', async () => {
    api.serviceRequests.adminList.mockImplementation(boom);

    await renderIt();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('admin.serviceRequests.empty')).toBeNull();
  });

  it('retry recovers into the list', async () => {
    api.serviceRequests.adminList
      .mockImplementationOnce(boom)
      .mockResolvedValueOnce([{ id: 'r1', name: 'محمد', phone: '+90', serviceTitle: 'إقامة', category: 'residency', serviceType: 'direct', status: 'new', createdAt: '2026-07-27T10:00:00Z' }]);

    await renderIt();
    (await screen.findByRole('button', { name: 'chat.retry' })).click();

    expect(await screen.findByText('إقامة')).toBeInTheDocument();
    expect(api.serviceRequests.adminList).toHaveBeenCalledTimes(2);
  });

  it('the genuine empty state still renders after a successful zero-row fetch', async () => {
    api.serviceRequests.adminList.mockResolvedValue([]);

    await renderIt();

    expect(await screen.findByText('admin.serviceRequests.empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
  });
});

describe('AdminCompanyPaymentsManager', () => {
  it('money owed can never render as nothing: failed load shows error, not empty', async () => {
    api.companyPayments.pending.mockImplementation(boom);
    const { AdminCompanyPaymentsManager } = await import('./AdminCompanyPaymentsManager');
    render(<AdminCompanyPaymentsManager />);

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('companyAdmin.payments.empty')).toBeNull();
  });
});

describe('AdminBroadcastManager', () => {
  it('each half fails independently: requests error while responses render', async () => {
    api.adminBroadcast.requests.mockImplementation(boom);
    api.adminBroadcast.responses.mockResolvedValue([
      { id: 'x1', companyName: 'شركة', serviceTitle: 'خدمة', quote: 100, message: null, chosen: false, createdAt: '2026-07-27T10:00:00Z' },
    ]);
    const { AdminBroadcastManager } = await import('./AdminBroadcastManager');
    render(<AdminBroadcastManager />);

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('companyAdmin.broadcast.requestsEmpty')).toBeNull();
    expect(await screen.findByText('شركة')).toBeInTheDocument();
  });
});

describe('AdminCompaniesManager', () => {
  it('failed load shows error, not "no companies"', async () => {
    api.adminCompanies.list.mockImplementation(boom);
    const { AdminCompaniesManager } = await import('./AdminCompaniesManager');
    render(<AdminCompaniesManager />);

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('companyAdmin.companies.empty')).toBeNull();
  });
});

describe('ListingsManager / PlacesManager', () => {
  it('a failed listings load shows error, not an empty manager', async () => {
    api.listings.adminList.mockImplementation(boom);
    api.adminPlaces.list.mockResolvedValue([]);
    const { ListingsManager } = await import('./AdminManagers');
    render(<ListingsManager />);

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
  });

  it('a failed places load shows error, not an empty manager', async () => {
    api.adminPlaces.list.mockImplementation(boom);
    api.listings.adminList.mockResolvedValue([]);
    const { PlacesManager } = await import('./AdminManagers');
    render(<PlacesManager />);

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
  });
});

describe('AdminBookings', () => {
  it('failed load shows error, not the empty state', async () => {
    api.bookings.adminList.mockImplementation(boom);
    const { AdminBookings } = await import('../pages/AdminBookings');
    const { MemoryRouter } = await import('react-router-dom');
    render(<MemoryRouter><AdminBookings /></MemoryRouter>);

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('adminBookings.empty')).toBeNull();
  });
});
