import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CustomerRequest } from '../lib/types';

/**
 * THE REGRESSION THIS FILE EXISTS FOR.
 *
 * customerRequests.mine() carried `.eq('broadcast', true)`. A customer who
 * submitted a direct service request — stored correctly, owned correctly,
 * readable under RLS — opened /requests and was shown a page telling him he had
 * never made one. The name was the real defect: "mine" reads as "all of mine",
 * so no call site suggested a filter was being applied.
 *
 * The load is now allMine(), unfiltered. These tests pin the two properties
 * that matter: every owned request is listed, and nothing on screen reveals
 * whether a request was broadcast to companies or handled directly.
 */

const allMineMock = vi.fn();
const responsesMock = vi.fn();
const bookingsMineMock = vi.fn();
const leadsMineMock = vi.fn();

vi.mock('../lib/api', () => ({
  customerRequests: {
    allMine: () => allMineMock(),
    responses: (id: string) => responsesMock(id),
    choose: vi.fn(),
  },
  // /requests merges three sources — an assistant handoff writes `bookings`
  // and a property enquiry writes `leads`. Inert unless a test is about them.
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

vi.mock('../components/Gates', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function req(over: Partial<CustomerRequest>): CustomerRequest {
  return {
    id: 'r1',
    serviceTitle: 'إقامة سياحية',
    category: 'residency',
    area: null,
    message: null,
    status: 'new',
    createdAt: '2026-07-27T10:00:00Z',
    serviceType: 'direct',
    broadcast: false,
    ...over,
  };
}

/** The exact shape of the live account that exposed the bug: one broadcast
 *  request and one direct request, both owned by customer cac6dcb8. */
const BROADCAST = req({ id: 'b1', serviceTitle: 'استخراج الرقم الضريبي', serviceType: 'partner', broadcast: true });
const DIRECT = req({ id: 'd1', serviceTitle: 'مراقبة فتح حساب بنكي', serviceType: 'direct', broadcast: false });

async function renderPage() {
  const { MyRequests } = await import('./MyRequests');
  return render(
    <MemoryRouter>
      <MyRequests />
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

describe('a customer sees every request they own', () => {
  it('lists BOTH a broadcast request and a direct one', async () => {
    allMineMock.mockResolvedValue([BROADCAST, DIRECT]);

    await renderPage();

    // Before the fix this rendered exactly one row — the broadcast one — and
    // the direct request was invisible to the person who submitted it.
    expect(await screen.findByText('استخراج الرقم الضريبي')).toBeInTheDocument();
    expect(await screen.findByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
  });

  it('shows the empty state only when the customer really owns nothing', async () => {
    allMineMock.mockResolvedValue([]);

    await renderPage();

    expect(await screen.findByText('requests.empty')).toBeInTheDocument();
  });

  it('a lone direct request is enough to fill the page', async () => {
    allMineMock.mockResolvedValue([DIRECT]);

    await renderPage();

    expect(await screen.findByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
    expect(screen.queryByText('requests.empty')).toBeNull();
  });
});

describe('the broadcast/direct distinction is invisible to the customer', () => {
  it('never renders the words broadcast, partner or direct', async () => {
    allMineMock.mockResolvedValue([BROADCAST, DIRECT]);

    const { container } = await renderPage();
    await screen.findByText('مراقبة فتح حساب بنكي');

    const text = container.textContent ?? '';
    for (const word of ['broadcast', 'partner', 'direct', 'بث', 'شريك']) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('renders the two kinds identically when neither has offers', async () => {
    allMineMock.mockResolvedValue([BROADCAST, DIRECT]);

    await renderPage();
    await screen.findByText('استخراج الرقم الضريبي');

    // Same status pill, same structure — the only difference is the title.
    const pills = screen.getAllByText('admin.serviceRequests.status.pending');
    expect(pills).toHaveLength(2);
  });
});

describe('the admin workflow is finally visible to the customer', () => {
  it('shows a plain-language status for each state', async () => {
    for (const [status, key] of [
      ['new', 'pending'],
      ['pending', 'pending'],
      ['accepted', 'accepted'],
      ['done', 'done'],
      ['rejected', 'rejected'],
    ] as const) {
      allMineMock.mockResolvedValue([req({ status })]);
      const view = await renderPage();
      await waitFor(() =>
        expect(screen.getByText(`admin.serviceRequests.status.${key}`)).toBeInTheDocument(),
      );
      view.unmount();
    }
  });
});

/**
 * COMMIT 4 — the empty state may only ever mean "the fetch succeeded and
 * returned zero rows".
 *
 * `.catch(() => setRows([]))` made a network hiccup indistinguishable from a
 * customer who has never contacted us: the page confidently told them their
 * case did not exist. The responses fetch had the same shape, where the false
 * statement is worse still — "no company wants your work".
 *
 * These assert the three states are distinct on both fetches.
 */
describe('a failed fetch is never an empty state', () => {
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
    const retry = await screen.findByRole('button', { name: 'chat.retry' });
    retry.click();

    expect(await screen.findByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
    expect(allMineMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error, not silence, when the offers fetch fails', async () => {
    allMineMock.mockResolvedValue([BROADCAST]);
    responsesMock.mockRejectedValue(new Error('network'));

    await renderPage();
    (await screen.findByText('استخراج الرقم الضريبي')).closest('button')!.click();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
  });
});

/**
 * THE ROW ITSELF — a request is only "tracked" if the customer can identify it,
 * date it, tell what kind it is, see where it stands, open its detail and find
 * the updates that followed. Each of those was missing from at least one of the
 * three kinds before the merge.
 *
 * (The write→reload half of the cycle is MyRequests.roundtrip.test.tsx, which
 * runs the real api layer against an RLS-shaped fake instead of these mocks.)
 */
const AI_BOOKING = {
  id: 'a1', userId: 'u1', userEmail: 'a@b.c', problemSummary: 'تجديد الإقامة السياحية',
  transcript: [], preferredDatetime: '2026-08-20T09:00:00Z', preferredLanguage: 'ar' as const,
  status: 'new' as const, createdAt: '2026-08-11T10:00:00Z', media: [],
};
const RE_LEAD = {
  id: 'l1', kind: 'realestate' as const, item: '[viewing] Beşiktaş 2+1 · $250,000 · #L-9',
  status: 'new', createdAt: '2026-08-12T10:00:00Z',
};

describe('every request carries what it takes to follow it', () => {
  it('shows a reference, a kind and a date on each row', async () => {
    allMineMock.mockResolvedValue([DIRECT]);

    await renderPage();
    await screen.findByText('مراقبة فتح حساب بنكي');

    const { referenceFor } = await import('../lib/myRequests');
    expect(screen.getByText(referenceFor('service', 'd1'))).toBeInTheDocument();
    expect(screen.getByText('requests.kind.service')).toBeInTheDocument();
    // Also stamped on the timeline inside the row, hence getAllByText.
    expect(screen.getAllByText(new Date('2026-07-27T10:00:00Z').toLocaleDateString('ar')).length).toBeGreaterThan(0);
    // …and where it stands.
    expect(screen.getByText('admin.serviceRequests.status.pending')).toBeInTheDocument();
  });

  it('opens the details and points at the updates that followed', async () => {
    allMineMock.mockResolvedValue([DIRECT]);

    await renderPage();
    (await screen.findByText('مراقبة فتح حساب بنكي')).closest('button')!.click();

    const link = await screen.findByRole('link', { name: 'requests.notificationsLink' });
    // The updates tab specifically — landing on whichever tab happens to have
    // content is not "see the updates on this request".
    expect(link).toHaveAttribute('href', expect.stringContaining('/notifications?tab=updates'));
  });

  it('lists an assistant appointment and a property enquiry alongside services', async () => {
    allMineMock.mockResolvedValue([DIRECT]);
    bookingsMineMock.mockResolvedValue([AI_BOOKING]);
    leadsMineMock.mockResolvedValue([RE_LEAD]);

    await renderPage();

    // Neither of these could appear on this page before: they live in tables
    // /requests never read.
    expect(await screen.findByText('تجديد الإقامة السياحية')).toBeInTheDocument();
    expect(screen.getByText('Beşiktaş 2+1 · $250,000 · #L-9')).toBeInTheDocument();
    expect(screen.getByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
    expect(screen.getByText('requests.kind.ai')).toBeInTheDocument();
    expect(screen.getByText('requests.kind.realestate')).toBeInTheDocument();
  });

  it('shows an assistant appointment its date, language and attachments', async () => {
    bookingsMineMock.mockResolvedValue([{ ...AI_BOOKING, media: [{ path: 'p', name: 'x.pdf' }] }]);
    allMineMock.mockResolvedValue([]);

    await renderPage();
    (await screen.findByText('تجديد الإقامة السياحية')).closest('button')!.click();

    expect(await screen.findByText('requests.details.appointment')).toBeInTheDocument();
    expect(screen.getByText('requests.details.language')).toBeInTheDocument();
    expect(screen.getByText('requests.details.attachments')).toBeInTheDocument();
  });
});

/**
 * Three sources, three independent loads. One dead source must not be able to
 * delete the other two from the screen — and must never be reported as "you
 * have no requests".
 */
describe('one broken source never blanks the page', () => {
  it('still lists the sources that answered, and names the one that did not', async () => {
    allMineMock.mockResolvedValue([DIRECT]);
    bookingsMineMock.mockRejectedValue(new Error('network'));
    leadsMineMock.mockResolvedValue([RE_LEAD]);

    await renderPage();

    expect(await screen.findByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
    expect(screen.getByText('Beşiktaş 2+1 · $250,000 · #L-9')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('requests.kind.ai');
    expect(screen.queryByText('requests.empty')).toBeNull();
  });

  it('never claims the customer has nothing while a source is still failing', async () => {
    allMineMock.mockResolvedValue([]);
    bookingsMineMock.mockRejectedValue(new Error('network'));
    leadsMineMock.mockResolvedValue([]);

    await renderPage();

    await screen.findByRole('alert');
    expect(screen.queryByText('requests.empty')).toBeNull();
  });

  it('shows the empty state only once all three answered with nothing', async () => {
    allMineMock.mockResolvedValue([]);
    bookingsMineMock.mockResolvedValue([]);
    leadsMineMock.mockResolvedValue([]);

    await renderPage();

    expect(await screen.findByText('requests.empty')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
