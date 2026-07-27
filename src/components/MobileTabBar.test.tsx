import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * The bottom bar is the only navigation an untrained user reaches without being
 * taught it exists. A customer who had submitted a request reported that no list
 * of requests appeared — the page existed, but the only routes to it were the
 * hamburger menu and a 32px button on the profile page, so he never found it.
 *
 * Two things are pinned here: the destination is in the bar, and the bar itself
 * stays in ONE file. It was previously copy-pasted into fourteen screens, which
 * is how it could drift page to page.
 */

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));

let lang = 'ar';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { get language() { return lang; } } }),
}));

function renderBar(user: unknown, language = 'ar') {
  lang = language;
  useAppMock.mockReturnValue({ user });
  return render(
    <MemoryRouter>
      <MobileTabBarUnderTest />
    </MemoryRouter>,
  );
}

// Imported eagerly so the mocks above are in place first.
import { MobileTabBar as MobileTabBarUnderTest, tabRequestsLabel } from './MobileTabBar';

describe('the requests destination is reachable from the bar', () => {
  it('shows Requests to a signed-in customer, pointing at /requests', () => {
    renderBar({ id: 'u1' });

    const link = screen.getByRole('link', { name: 'طلباتي' });
    expect(link.getAttribute('href')).toBe('/requests');
  });

  it('replaces Map rather than adding a sixth tab', () => {
    renderBar({ id: 'u1' });

    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.queryByRole('link', { name: 'الخريطة' })).toBeNull();
  });

  it('keeps Map for a signed-out visitor — no sign-in wall from a nav slot', () => {
    renderBar(null);

    expect(screen.getByRole('link', { name: 'الخريطة' }).getAttribute('href')).toBe('/map');
    expect(screen.queryByRole('link', { name: 'طلباتي' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('labels stay on one line in every language — the bar height must not vary', () => {
    // Guard on the strings themselves: the pixel budget is ~72px per cell at
    // 10px type, which these fit and the desktop nav.* strings did not.
    for (const l of ['en', 'ar', 'fa', 'ru']) {
      expect(tabRequestsLabel(l).length).toBeLessThanOrEqual(11);
    }
    const { container } = renderBar({ id: 'u1' }, 'fa');
    for (const span of container.querySelectorAll('nav span')) {
      expect(span.className).toContain('whitespace-nowrap');
    }
  });

  it('falls back to English for an unknown language tag', () => {
    expect(tabRequestsLabel('de')).toBe('Requests');
    expect(tabRequestsLabel('')).toBe('Requests');
    expect(tabRequestsLabel('ar-SA')).toBe('طلباتي');
  });
});

describe('the bar lives in one file', () => {
  const MOBILE_DIR = path.join(process.cwd(), 'src/pages/mobile');
  const NAV_MARKER = 'fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark';

  it('no mobile screen draws its own bar except the one known exception', () => {
    const offenders = fs
      .readdirSync(MOBILE_DIR)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
      .filter((f) => fs.readFileSync(path.join(MOBILE_DIR, f), 'utf8').includes(NAV_MARKER));

    // MobileHome belongs to a parallel workstream and keeps its inline copy for
    // now. If this list grows, the duplication is growing back — consolidate the
    // new screen onto <MobileTabBar /> rather than widening this assertion.
    expect(offenders).toEqual(['MobileHome.tsx']);
  });

  it('every consolidated screen imports the shared bar', () => {
    const consolidated = fs
      .readdirSync(MOBILE_DIR)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && f !== 'MobileHome.tsx')
      .filter((f) => fs.readFileSync(path.join(MOBILE_DIR, f), 'utf8').includes('<MobileTabBar />'));

    expect(consolidated.length).toBeGreaterThanOrEqual(13);
    for (const f of consolidated) {
      expect(fs.readFileSync(path.join(MOBILE_DIR, f), 'utf8')).toContain(
        "from '../../components/MobileTabBar'",
      );
    }
  });
});
