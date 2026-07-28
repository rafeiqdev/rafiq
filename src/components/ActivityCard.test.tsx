import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * The profile activity card merged bookings + leads ONLY. A service_request
 * could never appear in it — three tables hold a customer's activity and it
 * read two — so a customer with a live request was told "nothing yet", four
 * lines above the link to the page that would have proved otherwise.
 *
 * Both sources were also useState([]) + .catch(() => {}), so the card asserted
 * emptiness on first paint and again on total failure.
 *
 * Pinned here: a request appears; one failed source never blanks the others or
 * reads as empty; and "nothing yet" requires all three to have succeeded.
 */

const mineBookings = vi.fn();
const mineLeads = vi.fn();
const allMine = vi.fn();

vi.mock('../lib/api', () => ({
  bookings: { mine: () => mineBookings() },
  leads: { mine: () => mineLeads() },
  customerRequests: { allMine: () => allMine() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

const REQUEST = {
  id: 'r1', serviceTitle: 'إقامة سياحية', category: 'residency', area: null,
  message: null, status: 'accepted', createdAt: '2026-07-27T10:00:00Z',
  serviceType: 'direct', broadcast: false,
};
const BOOKING = {
  id: 'b1', problemSummary: 'موعد استشارة', status: 'new',
  createdAt: '2026-07-26T10:00:00Z', preferredDatetime: '', preferredLanguage: 'ar',
  transcript: [], userEmail: 'a@b.c',
};
const LEAD = { id: 'l1', kind: 'health', item: 'زراعة أسنان', createdAt: '2026-07-25T10:00:00Z', userEmail: 'a@b.c' };

async function renderCard() {
  const { ActivityCard } = await import('./ActivityCard');
  return render(<MemoryRouter><ActivityCard /></MemoryRouter>);
}

beforeEach(() => {
  vi.resetModules();
  mineBookings.mockReset().mockResolvedValue([]);
  mineLeads.mockReset().mockResolvedValue([]);
  allMine.mockReset().mockResolvedValue([]);
});

describe('service requests finally appear in the activity card', () => {
  it('shows a service request when there are no bookings and no leads', async () => {
    allMine.mockResolvedValue([REQUEST]);

    await renderCard();

    // Before this commit the card read bookings+leads only, so this row could
    // not exist and the customer saw "nothing yet" instead.
    expect(await screen.findByText('إقامة سياحية')).toBeInTheDocument();
    expect(screen.queryByText('profile.pipeline.empty')).toBeNull();
  });

  it('carries the same status pill the /requests page uses', async () => {
    allMine.mockResolvedValue([REQUEST]);

    await renderCard();

    expect(await screen.findByText('admin.serviceRequests.status.accepted')).toBeInTheDocument();
  });

  it('links the request row to /requests', async () => {
    allMine.mockResolvedValue([REQUEST]);

    await renderCard();

    expect((await screen.findByText('إقامة سياحية')).getAttribute('href')).toBe('/requests');
  });

  it('merges all three sources newest-first', async () => {
    mineBookings.mockResolvedValue([BOOKING]);
    mineLeads.mockResolvedValue([LEAD]);
    allMine.mockResolvedValue([REQUEST]);

    const { container } = await renderCard();
    await screen.findByText('إقامة سياحية');

    const text = container.textContent ?? '';
    // request (27th) before booking (26th); the lead (25th) is behind "view all".
    expect(text.indexOf('إقامة سياحية')).toBeLessThan(text.indexOf('موعد استشارة'));
    expect(screen.getByText(/common.viewAll/)).toBeInTheDocument();
  });
});

describe('one failed source never blanks the card', () => {
  it('shows an error for requests while bookings still render', async () => {
    allMine.mockRejectedValue(new Error('network'));
    mineBookings.mockResolvedValue([BOOKING]);

    await renderCard();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(await screen.findByText('موعد استشارة')).toBeInTheDocument();
    expect(screen.queryByText('profile.pipeline.empty')).toBeNull();
  });

  it('never says "nothing yet" when a source failed and the rest are empty', async () => {
    allMine.mockRejectedValue(new Error('network'));

    await renderCard();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    expect(screen.queryByText('profile.pipeline.empty')).toBeNull();
  });

  it('retry refetches only the failed source and recovers', async () => {
    allMine.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([REQUEST]);

    await renderCard();
    (await screen.findByRole('button', { name: 'chat.retry' })).click();

    expect(await screen.findByText('إقامة سياحية')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
    // The healthy sources were not refetched by the retry.
    expect(mineBookings).toHaveBeenCalledTimes(1);
    expect(allMine).toHaveBeenCalledTimes(2);
  });

  it('says "nothing yet" only when ALL THREE succeeded with zero rows', async () => {
    await renderCard();

    expect(await screen.findByText('profile.pipeline.empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
  });
});
