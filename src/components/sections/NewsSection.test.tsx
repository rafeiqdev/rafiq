import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NewsSection } from './NewsSection';

const renderIt = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * The public news section mirrors the owner's Telegram channel, but reads as
 * an on-site feed: no Telegram branding, and "read more" always stays in-app.
 * Two rules matter enough to pin:
 *  - it renders NOTHING until posts exist (an empty or failed marketing block
 *    on the guest home must degrade to absence, never an error box — this is
 *    also what keeps the home working before the news_posts migration runs);
 *  - with posts, the items and the in-app read-more link are all there, and
 *    there is no Telegram follow link anywhere.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

const latest = vi.fn();
vi.mock('../../lib/api', () => ({
  news: {
    latest: (...a: unknown[]) => latest(...a),
  },
  localizeNewsPost: (post: { title: string; body: string | null }) => ({ title: post.title, body: post.body }),
}));

const post = {
  id: 'n1',
  title: 'New ikamet rules',
  body: 'Appointments move online from March.',
  url: 'https://t.me/rafiq/42',
  imageUrl: 'https://cdn4.cdn-telegram.org/file/abc.jpg',
  source: 'telegram' as const,
  published: true,
  createdAt: '2026-07-28T10:00:00Z',
};

describe('NewsSection', () => {
  afterEach(cleanup);

  it('renders nothing when there are no posts', async () => {
    latest.mockResolvedValueOnce([]);

    const { container } = renderIt(<NewsSection />);
    await waitFor(() => expect(latest).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing (not an error) when the table does not exist yet', async () => {
    latest.mockRejectedValueOnce(new Error('relation news_posts does not exist'));

    const { container } = renderIt(<NewsSection />);
    await waitFor(() => expect(latest).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('fetches up to six posts', async () => {
    latest.mockResolvedValueOnce([post]);

    renderIt(<NewsSection />);
    await waitFor(() => expect(latest).toHaveBeenCalledWith(6));
  });

  it('shows posts, the photo, and the IN-APP read-more link, with no Telegram branding', async () => {
    latest.mockResolvedValueOnce([post]);

    const { container } = renderIt(<NewsSection />);

    expect(await screen.findByText('New ikamet rules')).toBeInTheDocument();
    expect(screen.getByText('Appointments move online from March.')).toBeInTheDocument();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn4.cdn-telegram.org/file/abc.jpg');
    // Read more stays on-site (/news/:id) — it must NOT point at Telegram.
    expect(screen.getByRole('link', { name: /home.news.readMore/ })).toHaveAttribute('href', '/news/n1');
    expect(screen.queryByRole('link', { name: /home.news.follow/ })).toBeNull();
    expect(screen.queryByText(/telegram/i)).toBeNull();
  });
});
