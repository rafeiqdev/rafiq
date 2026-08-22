import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { relativeTime } from '../lib/relativeTime';

/**
 * The "needs action" block at the top of /admin.
 *
 * Nothing notifies the admin out of band, so this is the surface that decides
 * whether an incoming request is seen at all. The two states that matter most
 * are the ones that look alike from a distance: an empty queue (render nothing)
 * and a queue that failed to load (must NOT look empty).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'en' },
  }),
}));

const adminListMock = vi.fn();
const setStatusMock = vi.fn();
vi.mock('../lib/api', () => ({
  serviceRequests: {
    adminList: () => adminListMock(),
    adminSetStatus: (...a: unknown[]) => setStatusMock(...a),
  },
}));

import { AdminNewRequests } from './AdminNewRequests';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1',
  name: 'Ahmet',
  phone: '+90 555 123 45 67',
  message: undefined,
  serviceId: 'res-tourist',
  serviceTitle: 'İkamet',
  category: 'residency',
  serviceType: 'direct',
  status: 'new',
  createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  ...over,
});

beforeEach(() => {
  adminListMock.mockReset();
  setStatusMock.mockReset().mockResolvedValue({ ok: true });
});

describe('empty vs failed — the two states that must not be confused', () => {
  it('renders NOTHING when no request is waiting', async () => {
    adminListMock.mockResolvedValue([]);

    const { container } = render(<AdminNewRequests />);

    await waitFor(() => expect(adminListMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every request is already handled', async () => {
    adminListMock.mockResolvedValue([row({ status: 'accepted' }), row({ id: 'r2', status: 'done' })]);

    const { container } = render(<AdminNewRequests />);

    await waitFor(() => expect(adminListMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an inline error — never an empty-looking queue — when the fetch fails', async () => {
    adminListMock.mockRejectedValue(new Error('network'));

    render(<AdminNewRequests />);

    expect(await screen.findByRole('alert')).toHaveTextContent('admin.newRequests.error');
  });

  it('recovers when the retry succeeds', async () => {
    adminListMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([row()]);

    render(<AdminNewRequests />);
    fireEvent.click(await screen.findByRole('button', { name: 'chat.retry' }));

    expect(await screen.findByText('Ahmet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the queue itself', () => {
  it('counts both unhandled statuses and ignores handled ones', async () => {
    adminListMock.mockResolvedValue([
      row({ id: 'a', status: 'new' }),
      row({ id: 'b', status: 'pending' }),
      row({ id: 'c', status: 'accepted' }),
      row({ id: 'd', status: 'rejected' }),
    ]);

    render(<AdminNewRequests />);

    // 2 unhandled, matching serviceRequests.newCount()
    expect(await screen.findByRole('heading')).toHaveTextContent('admin.newRequests.title 2');
  });

  it('shows at most 5 and links the remainder down to the full manager', async () => {
    adminListMock.mockResolvedValue(Array.from({ length: 8 }, (_, i) => row({ id: `r${i}` })));

    render(<AdminNewRequests />);

    expect(await screen.findAllByRole('listitem')).toHaveLength(5);
    const more = screen.getByRole('link', { name: /admin\.newRequests\.more 3/ });
    expect(more).toHaveAttribute('href', '#service-requests');
  });

  it('omits the "and N more" link when everything fits', async () => {
    adminListMock.mockResolvedValue([row(), row({ id: 'r2' })]);

    render(<AdminNewRequests />);

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.queryByRole('link', { name: /more/ })).toBeNull();
  });

  it('offers tap-to-call with the spaces stripped from the tel: target', async () => {
    adminListMock.mockResolvedValue([row()]);

    render(<AdminNewRequests />);

    const call = await screen.findByRole('link', { name: /admin\.newRequests\.callAria/ });
    expect(call).toHaveAttribute('href', 'tel:+905551234567');
    expect(call).toHaveTextContent('+90 555 123 45 67');
  });

  it('accepts a request inline and refreshes', async () => {
    adminListMock.mockResolvedValueOnce([row({ id: 'r9' })]).mockResolvedValueOnce([]);

    render(<AdminNewRequests />);
    fireEvent.click(await screen.findByRole('button', { name: /markReady/ }));

    expect(setStatusMock).toHaveBeenCalledWith('r9', 'accepted');
    await waitFor(() => expect(adminListMock).toHaveBeenCalledTimes(2));
  });

  it('rejects a request inline', async () => {
    adminListMock.mockResolvedValueOnce([row({ id: 'r9' })]).mockResolvedValueOnce([]);

    render(<AdminNewRequests />);
    fireEvent.click(await screen.findByRole('button', { name: /reject/ }));

    expect(setStatusMock).toHaveBeenCalledWith('r9', 'rejected');
  });

  it('surfaces an error when the action itself fails', async () => {
    adminListMock.mockResolvedValue([row({ id: 'r9' })]);
    setStatusMock.mockRejectedValue(new Error('rls'));

    render(<AdminNewRequests />);
    fireEvent.click(await screen.findByRole('button', { name: /markReady/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('links to that service\'s competitor view when serviceId is known', async () => {
    adminListMock.mockResolvedValue([row({ id: 'r9', serviceId: 'res-tourist' })]);

    render(<AdminNewRequests />);

    const link = await screen.findByRole('link', { name: 'admin.newRequests.competitors' });
    expect(link).toHaveAttribute('href', '/admin?tab=competitors&service=res-tourist');
  });

  it('omits the competitor link when serviceId is unknown (pre-migration rows)', async () => {
    adminListMock.mockResolvedValue([row({ id: 'r9', serviceId: null })]);

    render(<AdminNewRequests />);

    await screen.findByText('Ahmet');
    expect(screen.queryByRole('link', { name: 'admin.newRequests.competitors' })).toBeNull();
  });

  it('gives every control a >=44px tap target', async () => {
    // The admin uses this from a phone; the !h-8 (32px) pattern in
    // ServiceRequestsManager is deliberately not copied here.
    adminListMock.mockResolvedValue([row()]);

    render(<AdminNewRequests />);
    await screen.findByText('Ahmet');

    for (const el of [
      screen.getByRole('link', { name: /callAria/ }),
      screen.getByRole('button', { name: /markReady/ }),
      screen.getByRole('button', { name: /reject/ }),
    ]) {
      expect(el.className, el.textContent ?? '').toMatch(/min-h-\[44px\]/);
    }
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-07-27T12:00:00Z');

  it.each([
    ['3 hours ago', new Date(now - 3 * 3600_000).toISOString(), /3 hours ago/],
    ['minutes', new Date(now - 5 * 60_000).toISOString(), /5 minutes ago/],
    ['days', new Date(now - 2 * 86_400_000).toISOString(), /2 days ago/],
  ])('formats %s in English', (_label, iso, expected) => {
    expect(relativeTime(iso, 'en', now)).toMatch(expected);
  });

  it('reads as "now" under a minute rather than "in 0 seconds"', () => {
    expect(relativeTime(new Date(now - 5_000).toISOString(), 'en', now)).toBe('now');
  });

  it.each(['ar', 'ru', 'fa'])('produces non-Latin output for %s', (lang) => {
    const out = relativeTime(new Date(now - 3 * 3600_000).toISOString(), lang, now);

    expect(out).not.toBe('');
    expect(out).not.toMatch(/hours ago/); // i.e. actually localised
  });

  it('returns empty string for an unusable timestamp', () => {
    expect(relativeTime('not-a-date', 'en', now)).toBe('');
  });

  it('falls back to English rather than throwing on a bad language tag', () => {
    expect(relativeTime(new Date(now - 3600_000).toISOString(), 'not a tag!', now)).toMatch(/hour/);
  });
});
