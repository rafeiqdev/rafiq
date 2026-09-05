import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OfferPage } from './OfferPage';
import type { CustomerRequest, ServiceOffer, ServicePayment } from '../lib/types';

const byIdMock = vi.fn();
const listForRequestMock = vi.fn();
const forRequestMock = vi.fn();
const responsesMock = vi.fn();
const createSessionMock = vi.fn();
const rejectMock = vi.fn();

vi.mock('../lib/api', () => ({
  customerRequests: {
    byId: (id: string) => byIdMock(id),
    responses: (id: string) => responsesMock(id),
    choose: vi.fn(),
  },
  serviceOffers: {
    listForRequest: (id: string) => listForRequestMock(id),
    reject: (id: string) => rejectMock(id),
  },
  servicePayments: {
    forRequest: (id: string) => forRequestMock(id),
    createSession: (id: string) => createSessionMock(id),
    resumeUrl: () => 'https://checkout.example.com/resume',
  },
  reviews: { create: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

vi.mock('../components/Gates', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function mockReq(over: Partial<CustomerRequest> = {}): CustomerRequest {
  return {
    id: 'req-123',
    serviceTitle: 'ترجمة نانسي',
    category: 'translation',
    area: 'fatih',
    message: 'أحتاج ترجمة معتمدة للشهادة الجامعية خلال يومين',
    status: 'pending',
    createdAt: '2026-08-31T10:00:00Z',
    serviceType: 'translation',
    broadcast: false,
    ...over,
  };
}

function mockOffer(over: Partial<ServiceOffer> = {}): ServiceOffer {
  return {
    id: 'off-1',
    requestId: 'req-123',
    price: 1500,
    currency: 'TRY',
    details: 'يشمل العرض ترجمة معتمدة لـ 3 صفحات مع التصديق من كاتب العدل (النوتر).',
    imagePaths: ['https://example.com/doc1.jpg', 'https://example.com/doc2.jpg'],
    expiresAt: '2026-09-10T00:00:00Z',
    status: 'sent',
    createdAt: '2026-08-31T12:00:00Z',
    ...over,
  };
}

function renderPage(reqId = 'req-123') {
  return render(
    <MemoryRouter initialEntries={[`/requests/${reqId}/offer`]}>
      <Routes>
        <Route path="/requests/:id/offer" element={<OfferPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OfferPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responsesMock.mockResolvedValue([]);
    forRequestMock.mockResolvedValue([]);
  });

  it('renders request details and in-review state when no custom offer has been sent yet', async () => {
    byIdMock.mockResolvedValue(mockReq({ status: 'pending' }));
    listForRequestMock.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('ترجمة نانسي').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/أحتاج ترجمة معتمدة للشهادة الجامعية/)).toBeInTheDocument();
      expect(screen.getByText('offerPage.noOffersTitle')).toBeInTheDocument();
    });
  });

  it('renders primary offer price, details, and attachments when an offer is sent', async () => {
    byIdMock.mockResolvedValue(mockReq());
    listForRequestMock.mockResolvedValue([mockOffer()]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('ترجمة نانسي').length).toBeGreaterThanOrEqual(1);
      // Price + pay CTA render twice (desktop card + mobile sticky bar), so match all.
      expect(screen.getAllByText(/1,500/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('TRY').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/يشمل العرض ترجمة معتمدة/)).toBeInTheDocument();
      expect(screen.getAllByText('serviceOffer.payCta').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('serviceOffer.reject')).toBeInTheDocument();
    });
  });

  it('renders paid verification status when offer payment is verified', async () => {
    byIdMock.mockResolvedValue(mockReq({ status: 'done' }));
    listForRequestMock.mockResolvedValue([mockOffer()]);
    forRequestMock.mockResolvedValue([
      {
        id: 'pay-1',
        requestId: 'req-123',
        offerId: 'off-1',
        amount: 1500,
        currency: 'TRY',
        status: 'verified',
        createdAt: '2026-08-31T13:00:00Z',
        verifiedAt: '2026-08-31T13:05:00Z',
      } as ServicePayment,
    ]);

    renderPage();

    await waitFor(() => {
      // Paid badge renders twice (desktop banner + mobile sticky bar).
      expect(screen.getAllByText('serviceOffer.paid').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('serviceOffer.payCta')).not.toBeInTheDocument();
    });
  });

  it('shows not found error when request id does not exist', async () => {
    byIdMock.mockResolvedValue(null);
    listForRequestMock.mockResolvedValue([]);

    renderPage('non-existent-id');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('offerPage.notFound');
    });
  });

  it('offers a retry when the payment failed instead of a dead end', async () => {
    byIdMock.mockResolvedValue(mockReq());
    listForRequestMock.mockResolvedValue([mockOffer()]);
    forRequestMock.mockResolvedValue([
      {
        id: 'pay-2',
        requestId: 'req-123',
        offerId: 'off-1',
        amount: 1500,
        currency: 'TRY',
        status: 'rejected',
        createdAt: '2026-08-31T13:00:00Z',
        verifiedAt: null,
      } as ServicePayment,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('serviceOffer.paymentRejected')).toBeInTheDocument();
      expect(screen.getAllByText('serviceOffer.payCta').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('explains a superseded offer and hides the pay button', async () => {
    byIdMock.mockResolvedValue(mockReq());
    listForRequestMock.mockResolvedValue([mockOffer({ status: 'superseded' })]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('serviceOffer.superseded')).toBeInTheDocument();
      expect(screen.queryByText('serviceOffer.payCta')).not.toBeInTheDocument();
    });
  });

  it('hides the pay button when the offer itself was rejected', async () => {
    byIdMock.mockResolvedValue(mockReq());
    listForRequestMock.mockResolvedValue([mockOffer({ status: 'rejected' })]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('serviceOffer.youRejected')).toBeInTheDocument();
      expect(screen.queryByText('serviceOffer.payCta')).not.toBeInTheDocument();
    });
  });
});
