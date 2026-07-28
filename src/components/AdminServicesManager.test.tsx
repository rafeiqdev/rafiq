import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SERVICES, pickText } from '../data/services';

/**
 * The inverse of the empty-state defect, and sneakier for it.
 *
 * This panel's list is derived from the statically bundled SERVICES catalog
 * merged with fetched overrides, so a failed fetch never produced an empty
 * state — it rendered the FULL catalog without the admin's edits, hidden flags
 * and added services. Nothing looked wrong: a service the admin had hidden
 * appeared live, edited titles silently reverted to the bundled originals, and
 * the next hide/unhide would have been computed from `{}` and saved over the
 * real overrides.
 *
 * Decision: when the overrides fetch fails the ADMIN panel shows
 * error-with-retry and NOTHING else. The admin must never operate on a catalog
 * that is not showing their real edits. (The customer-facing catalogStore keeps
 * its tolerant behaviour and is out of scope.)
 */

const get = vi.fn();

vi.mock('../lib/api', () => ({
  adminCatalog: { get: () => get(), save: vi.fn() },
}));
vi.mock('../data/catalogStore', () => ({ reloadCatalog: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

/** A title that only exists because SERVICES is bundled into the build. */
const BUNDLED_TITLE = pickText(SERVICES[0].title, 'ar');

async function renderPanel() {
  const { AdminServicesManager } = await import('./AdminServicesManager');
  return render(<AdminServicesManager />);
}

beforeEach(() => {
  vi.resetModules();
  get.mockReset();
});

describe('AdminServicesManager overrides fetch', () => {
  it('does NOT render the bundled catalog when the overrides fetch fails', async () => {
    get.mockRejectedValue(new Error('network'));

    await renderPanel();

    expect(await screen.findByRole('button', { name: 'chat.retry' })).toBeInTheDocument();
    // The whole point: no rows at all. Showing the bundled list here would be
    // the admin editing a catalog that is not the one customers see.
    expect(screen.queryByText(BUNDLED_TITLE)).toBeNull();
  });

  it('renders the catalog once the overrides fetch succeeds', async () => {
    get.mockResolvedValue({});

    await renderPanel();

    expect(await screen.findByText(BUNDLED_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.retry' })).toBeNull();
  });

  it('applies the fetched overrides rather than the bundled text', async () => {
    get.mockResolvedValue({ edits: { [SERVICES[0].id]: { title: { ar: 'عنوان معدّل' } } } });

    await renderPanel();

    expect(await screen.findByText('عنوان معدّل')).toBeInTheDocument();
    expect(screen.queryByText(BUNDLED_TITLE)).toBeNull();
  });

  it('retry recovers into the catalog', async () => {
    get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({});

    await renderPanel();
    (await screen.findByRole('button', { name: 'chat.retry' })).click();

    expect(await screen.findByText(BUNDLED_TITLE)).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
