import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import { NewsSection } from './NewsSection';

/**
 * The public news section mirrors the owner's Telegram channel. Two rules
 * matter enough to pin:
 *  - it renders NOTHING until posts exist (an empty or failed marketing block
 *    on the guest home must degrade to absence, never an error box — this is
 *    also what keeps the home working before the news_posts migration runs);
 *  - with posts, the items and the "follow on Telegram" link are all there.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

const latest = vi.fn();
const telegramChannel = vi.fn();
vi.mock('../../lib/api', () => ({
  news: {
    latest: (...a: unknown[]) => latest(...a),
    telegramChannel: (...a: unknown[]) => telegramChannel(...a),
  },
}));

const post = {
  id: 'n1',
  title: 'New ikamet rules',
  body: 'Appointments move online from March.',
  url: 'https://t.me/rafiq/42',
  published: true,
  createdAt: '2026-07-28T10:00:00Z',
};

describe('NewsSection', () => {
  afterEach(cleanup);

  it('renders nothing when there are no posts', async () => {
    latest.mockResolvedValueOnce([]);
    telegramChannel.mockResolvedValueOnce('https://t.me/rafiq');

    const { container } = render(<NewsSection />);
    await waitFor(() => expect(latest).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing (not an error) when the table does not exist yet', async () => {
    latest.mockRejectedValueOnce(new Error('relation news_posts does not exist'));
    telegramChannel.mockRejectedValueOnce(new Error('nope'));

    const { container } = render(<NewsSection />);
    await waitFor(() => expect(latest).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('shows posts, the read-more link, and the Telegram follow button', async () => {
    latest.mockResolvedValueOnce([post]);
    telegramChannel.mockResolvedValueOnce('https://t.me/rafiq');

    render(<NewsSection />);

    expect(await screen.findByText('New ikamet rules')).toBeInTheDocument();
    expect(screen.getByText('Appointments move online from March.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home.news.readMore/ })).toHaveAttribute('href', 'https://t.me/rafiq/42');
    expect(screen.getByRole('link', { name: /home.news.follow/ })).toHaveAttribute('href', 'https://t.me/rafiq');
  });

  it('omits the follow button when no channel is configured', async () => {
    latest.mockResolvedValueOnce([post]);
    telegramChannel.mockResolvedValueOnce(null);

    render(<NewsSection />);

    expect(await screen.findByText('New ikamet rules')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /home.news.follow/ })).toBeNull();
  });
});
