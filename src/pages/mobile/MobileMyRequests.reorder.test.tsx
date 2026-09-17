import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CustomerRequest } from '../../lib/types';
import { CASE_FILE_DIVIDER } from '../../lib/bookingSummary';

/**
 * Mobile half of MyRequests.reorder.test.tsx: "order again" on a finished
 * request reopens the SAME order form with the previous area + details
 * pre-filled. Rows without a service id keep the /services fallback.
 */

const allMineMock = vi.fn();
const responsesMock = vi.fn();

vi.mock('../../lib/api', () => ({
  customerRequests: {
    allMine: () => allMineMock(),
    responses: (id: string) => responsesMock(id),
    choose: vi.fn(),
  },
  reviews: { create: vi.fn() },
  // MedicalRequestsPanel mounts alongside the generic requests list; these
  // stubs keep it inert (empty list) for tests that aren't about it.
  medicalRequests: { mine: () => Promise.resolve([]) },
  medicalContent: { specialties: () => Promise.resolve([]) },
  // The expanded row also fetches offer/payment history — inert here.
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
vi.mock('../../components/MobileTabBar', () => ({ MobileTabBar: () => null }));

// The real modal is covered in ServiceRequestModal.test.tsx — here only the
// wiring matters: which service opens, and what travels with it.
vi.mock('../../components/ServiceRequestModal', () => ({
  ServiceRequestModal: ({
    source,
    initial,
  }: {
    source: { id: string };
    initial?: { area?: string | null; message?: string | null };
  }) => (
    <div data-testid="reorder-modal">
      <span data-testid="reorder-source">{source.id}</span>
      <span data-testid="reorder-area">{initial?.area ?? ''}</span>
      <span data-testid="reorder-message">{initial?.message ?? ''}</span>
    </div>
  ),
}));

function req(over: Partial<CustomerRequest>): CustomerRequest {
  return {
    id: 'r1',
    serviceTitle: 'إقامة سياحية',
    category: 'residency',
    area: null,
    message: null,
    status: 'done',
    createdAt: '2026-07-27T10:00:00Z',
    serviceType: 'direct',
    broadcast: false,
    ...over,
  };
}

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
});

describe('mobile: order again reopens the same form, pre-filled', () => {
  it('opens the order form (not /services) carrying service, area and message', async () => {
    allMineMock.mockResolvedValue([
      req({
        id: 'd1',
        serviceTitle: 'فتح حساب بنكي',
        serviceId: 'bank-account',
        area: 'sisli',
        message: 'معلومات إضافية سابقة',
      }),
    ]);

    await renderPage();
    await screen.findByText('فتح حساب بنكي');

    // A button (opens the form in place), not a link (leaves the page).
    const again = screen.getByRole('button', { name: 'requests.orderAgain' });
    expect(screen.queryByRole('link', { name: 'requests.orderAgain' })).toBeNull();

    fireEvent.click(again);

    expect(screen.getByTestId('reorder-source')).toHaveTextContent('bank-account');
    expect(screen.getByTestId('reorder-area')).toHaveTextContent('sisli');
    expect(screen.getByTestId('reorder-message')).toHaveTextContent('معلومات إضافية سابقة');
  });

  it('strips the machine block from the carried message', async () => {
    allMineMock.mockResolvedValue([
      req({
        id: 'd2',
        serviceTitle: 'رقم ضريبي',
        serviceId: 'tax-number',
        message: `نص إنساني${CASE_FILE_DIVIDER}machine payload`,
      }),
    ]);

    await renderPage();
    await screen.findByText('رقم ضريبي');

    fireEvent.click(screen.getByRole('button', { name: 'requests.orderAgain' }));

    const carried = screen.getByTestId('reorder-message');
    expect(carried).toHaveTextContent('نص إنساني');
    expect(carried.textContent).not.toContain('machine payload');
  });

  it('falls back to /services when the row has no service id', async () => {
    allMineMock.mockResolvedValue([req({ id: 'd3', serviceTitle: 'طلب قديم' })]);

    await renderPage();
    await screen.findByText('طلب قديم');

    const link = screen.getByRole('link', { name: 'requests.orderAgain' });
    expect(link.getAttribute('href')).toBe('/services');
    expect(screen.queryByRole('button', { name: 'requests.orderAgain' })).toBeNull();
  });
});
