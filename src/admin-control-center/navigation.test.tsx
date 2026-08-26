import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Click-through navigation test: every one of the 7 owner-facing nav items
 * must actually take you to its page, and an old `?section=` link from the
 * pre-redesign 11-section layout must still land somewhere real instead of
 * a blank/placeholder screen.
 *
 * Mirrors the mocking approach in pages/sections.render.test.tsx (same data
 * layer, same reasons) but drives the whole `<ControlCenter />` tree — the
 * render test proves each page's data branch renders; this proves the
 * sidebar actually gets you there.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// The Control Center sits behind the same admin gate as classic /admin; that
// gate depends on app-wide auth context this test has no business setting
// up, so it's bypassed here the same way every other route test in this
// module bypasses it — the navigation logic under test is unrelated to auth.
vi.mock('../components/Gates', () => ({
  RequireAdmin: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./api/analytics', () => ({
  ROW_CAP: 5000,
  fetchAnalytics: vi.fn().mockResolvedValue({
    capped: false,
    totalEvents: 120,
    uniqueSessions: 40,
    signedInSessions: 12,
    pageViews: 90,
    byType: [['page_view', 90]],
    topPaths: [['/services', 30]],
    topReferrers: [['(direct)', 25]],
    byDevice: [['mobile', 70]],
    byLocale: [['ar', 80]],
    topServices: [['residency', 15]],
    funnel: [{ step: 'page_view', count: 40 }],
  }),
}));

vi.mock('./api/operations', async (orig) => {
  const actual = await orig<typeof import('./api/operations')>();
  return {
    ...actual,
    fetchOperations: vi.fn().mockResolvedValue([
      { kind: 'request', id: 'r1', title: 'Residency', who: 'Ahmad', status: 'new', createdAt: new Date().toISOString(), href: '/admin?tab=serviceRequests' },
      { kind: 'booking', id: 'b1', title: 'Consult', who: 'a@b.co', status: 'done', createdAt: new Date().toISOString(), href: '/admin?tab=bookings' },
      { kind: 'lead', id: 'l1', title: 'Villa', who: 'c@d.co', status: 'pending', createdAt: new Date().toISOString(), href: '/admin?tab=leads' },
    ]),
  };
});

vi.mock('./api/finance', () => ({
  fetchFinance: vi.fn().mockResolvedValue([
    {
      source: 'subscriptions',
      href: '/admin?tab=payments',
      rows: [],
      count: 3,
      byStatus: [['verified', 2], ['pending', 1]],
      byCurrency: { TRY: { verified: 5000, pending: 1200 } },
    },
  ]),
}));

vi.mock('./api/growth', () => ({
  fetchReferrals: vi.fn().mockResolvedValue({
    commissions: [], payouts: [], byCurrency: {}, byStatus: [], referrers: 0,
  }),
  fetchJourney: vi.fn().mockResolvedValue({
    totalItems: 0, done: 0, todo: 0, usersWithJourney: 0, byTask: [],
  }),
}));

vi.mock('./api/platform', () => ({
  fetchContent: vi.fn().mockResolvedValue({
    listings: { total: 12 },
    investments: { total: 5, published: 3 },
    news: { total: 20, published: 18, translated: 9 },
  }),
  fetchPlaces: vi.fn().mockResolvedValue({ total: 3, recent: [] }),
  fetchHealth: vi.fn().mockResolvedValue({ fxRuns: [], fxRates: 0, lastSuccessfulFx: null, failedFxRuns: 0 }),
  fetchDocuments: vi.fn().mockResolvedValue({ files: [], totalBytes: 0 }),
  fetchBroadcasts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/api', () => ({
  adminAuditLog: {
    list: vi.fn().mockResolvedValue([
      { id: 'a1', actorName: 'Admin', action: 'pii_reveal', targetType: 'profile', targetId: 'x', meta: {}, createdAt: new Date().toISOString() },
    ]),
  },
  adminPayments: { list: vi.fn().mockResolvedValue({ payments: [] }) },
  adminUsers: {
    list: vi.fn().mockResolvedValue([
      { id: 'u1', email: 'a@b.co', name: 'Ahmad', provider: 'email', isAdmin: false, role: 'user', isCompany: false, tier: 'pro', bookings: 2, leads: 1, createdAt: new Date().toISOString() },
    ]),
    cancellations: vi.fn().mockResolvedValue([]),
  },
  adminPlaces: { list: vi.fn().mockResolvedValue([]) },
}));

import { ccTranslate } from './i18n';
import { CC_SECTIONS } from './sections';
import { ControlCenter } from './ControlCenter';

const T = (key: string) => ccTranslate('ar', key);

/** One marker string per section, proving its actual page content rendered. */
const SECTION_MARKER: Record<string, string> = {
  today: T('today.needsAction'),
  orders: T('ops.total'),
  customers: T('overview.kpi.totalUsers'),
  content: T('ct.news'),
  money: T('fin.source.subscriptions'),
  properties: T('properties.listings'),
  settings: T('sec.recent'),
};

describe('Control Center navigation', () => {
  it('lands on Today by default', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/control-center']}>
        <ControlCenter />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(SECTION_MARKER.today).length).toBeGreaterThan(0));
  });

  it('the sidebar carries its responsive layout classes (mobile: horizontal scroller, desktop: sticky column)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/control-center']}>
        <ControlCenter />
      </MemoryRouter>,
    );
    const sidebar = await screen.findByRole('navigation', { name: T('title') });
    // Below `md`: a horizontally-scrolling row (all 7 items reachable on a
    // narrow phone screen without a hidden overflow menu). At `md` and up:
    // a sticky single column, so the section list stays in view while a
    // long page (e.g. Today's accordions) scrolls underneath it.
    expect(sidebar.className).toContain('flex-row');
    expect(sidebar.className).toContain('overflow-x-auto');
    expect(sidebar.className).toContain('md:flex-col');
    expect(sidebar.className).toContain('md:sticky');
  });

  it.each(CC_SECTIONS)('navigates to $id via its sidebar button', async (section) => {
    render(
      <MemoryRouter initialEntries={['/admin/control-center']}>
        <ControlCenter />
      </MemoryRouter>,
    );

    // Scoped to the sidebar nav landmark: a collapsed accordion's content
    // isn't actually display:none in jsdom (no UA stylesheet for
    // `details:not([open])`, unlike a real browser), so an unscoped query
    // can also match a same-labelled control buried in a closed accordion
    // (e.g. the "اليوم" period-picker option inside Today's Analytics
    // accordion) — scoping to the sidebar avoids that false ambiguity.
    const sidebar = await screen.findByRole('navigation', { name: T('title') });
    const label = T(section.labelKey);
    const button = within(sidebar).getByRole('button', { name: (accessibleName) => accessibleName.includes(label) });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getAllByText(SECTION_MARKER[section.id]).length).toBeGreaterThan(0);
    });
  });

  it('redirects a legacy ?section= id (from the old 11-section layout) to its new page', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/control-center?section=overview']}>
        <ControlCenter />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(SECTION_MARKER.today).length).toBeGreaterThan(0));
  });

  it('redirects a legacy ?section=operations id to the Requests page', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/control-center?section=operations']}>
        <ControlCenter />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(SECTION_MARKER.orders).length).toBeGreaterThan(0));
  });
});
