import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Render smoke tests for every Control Center section.
 *
 * Typecheck cannot catch what actually breaks these pages at runtime: an icon
 * name that is not in the registry, a hook used wrongly, a field read off an
 * undefined object. Each section here is rendered with realistic mocked data
 * and asserted to reach its loaded state — so a section that would explode in
 * front of an admin fails here first.
 *
 * The data layer is mocked deliberately: these tests prove the COMPONENTS
 * render, not that Supabase works.
 */

// `initReactI18next` must be part of the mock: the module-local dictionary
// imports the app's src/i18n for RTL_LANGS, and that module calls
// i18n.use(initReactI18next) at import time.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../api/analytics', () => ({
  ROW_CAP: 5000,
  fetchAnalytics: vi.fn().mockResolvedValue({
    capped: false,
    totalEvents: 120,
    uniqueSessions: 40,
    signedInSessions: 12,
    pageViews: 90,
    byType: [['page_view', 90], ['service_view', 20]],
    topPaths: [['/services', 30]],
    topReferrers: [['(direct)', 25]],
    byDevice: [['mobile', 70]],
    byLocale: [['ar', 80]],
    topServices: [['residency', 15]],
    funnel: [
      { step: 'page_view', count: 40 },
      { step: 'service_view', count: 18 },
      { step: 'request_started', count: 6 },
      { step: 'request_submitted', count: 3 },
      { step: 'checkout_opened', count: 2 },
      { step: 'payment_submitted', count: 1 },
    ],
  }),
}));

vi.mock('../api/operations', async (orig) => {
  const actual = await orig<typeof import('../api/operations')>();
  return {
    ...actual, // keep the real summarizeOperations — its logic is under test too
    fetchOperations: vi.fn().mockResolvedValue([
      { kind: 'request', id: 'r1', title: 'Residency', who: 'Ahmad', status: 'new', createdAt: new Date().toISOString(), href: '/admin?tab=serviceRequests' },
      { kind: 'booking', id: 'b1', title: 'Consult', who: 'a@b.co', status: 'done', createdAt: new Date().toISOString(), href: '/admin?tab=bookings' },
      { kind: 'lead', id: 'l1', title: 'Villa', who: 'c@d.co', status: 'pending', createdAt: new Date().toISOString(), href: '/admin?tab=leads' },
    ]),
  };
});

vi.mock('../api/finance', () => ({
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

vi.mock('../api/growth', () => ({
  fetchReferrals: vi.fn().mockResolvedValue({
    commissions: [
      { id: 'c1', serviceType: 'service', serviceName: 'Translation', amount: 200, commission: 10, currency: 'USD', status: 'pending', createdAt: new Date().toISOString() },
    ],
    payouts: [
      { id: 'p1', amount: 100, currency: 'USD', method: 'bank_transfer', status: 'under_review', createdAt: new Date().toISOString() },
    ],
    byCurrency: { USD: { pending: 10, available: 5, paid: 0 } },
    byStatus: [['pending', 1]],
    referrers: 2,
  }),
  fetchJourney: vi.fn().mockResolvedValue({
    totalItems: 10,
    done: 4,
    todo: 6,
    usersWithJourney: 3,
    byTask: [{ task: 'turkishPhone', total: 3, done: 2 }],
  }),
}));

vi.mock('../api/platform', () => ({
  fetchContent: vi.fn().mockResolvedValue({
    listings: { total: 12 },
    investments: { total: 5, published: 3 },
    news: { total: 20, published: 18, translated: 9 },
  }),
  fetchHealth: vi.fn().mockResolvedValue({
    fxRuns: [
      { id: 'f1', startedAt: new Date().toISOString(), finishedAt: null, status: 'success', providerName: 'er-api', pairsUpdated: 6, pairsRejected: 0, error: null, localTime: '09:05' },
    ],
    fxRates: 6,
    lastSuccessfulFx: new Date().toISOString(),
    failedFxRuns: 0,
  }),
  fetchDocuments: vi.fn().mockResolvedValue({
    files: [{ id: 'd1', filename: 'report.pdf', mime: 'application/pdf', sizeBytes: 2048, createdAt: new Date().toISOString() }],
    totalBytes: 2048,
  }),
  fetchBroadcasts: vi.fn().mockResolvedValue([
    { id: 'n1', customText: 'Welcome', createdAt: new Date().toISOString() },
  ]),
}));

vi.mock('../../lib/api', () => ({
  adminAuditLog: {
    list: vi.fn().mockResolvedValue([
      { id: 'a1', actorName: 'Admin', action: 'pii_reveal', targetType: 'profile', targetId: 'x', meta: {}, createdAt: new Date().toISOString() },
    ]),
  },
}));

// The sections translate through the module-local dictionary, not react-i18next,
// so assertions resolve the same key the component will render ('ar' is what the
// mocked i18n.language reports).
import { ccTranslate } from '../i18n';
const T = (key: string) => ccTranslate('ar', key);

import { Analytics } from './Analytics';
import { Operations } from './Operations';
import { CRM } from './CRM';
import { Finance } from './Finance';
import { Referrals } from './Referrals';
import { Journey } from './Journey';
import { Content, Documents, Notifications, Security, SystemHealth } from './Platform';

const cases: [string, () => JSX.Element, string][] = [
  ['Analytics', () => <Analytics />, 'an.events'],
  ['Operations', () => <Operations />, 'ops.total'],
  ['CRM', () => <CRM />, 'crm.leadsTotal'],
  ['Finance', () => <Finance />, 'fin.source.subscriptions'],
  ['Referrals', () => <Referrals />, 'ref.referrers'],
  ['Journey', () => <Journey />, 'jr.users'],
  ['Content', () => <Content />, 'ct.listings'],
  ['SystemHealth', () => <SystemHealth />, 'sh.fxRates'],
  ['Documents', () => <Documents />, 'dc.files'],
  ['Notifications', () => <Notifications />, 'nt.broadcasts'],
  ['Security', () => <Security />, 'sec.recent'],
];

describe('Control Center sections render with real data shapes', () => {
  it.each(cases)('%s reaches its loaded state', async (_name, Page, marker) => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

    // Waits past the loading state — proves the data branch rendered, which is
    // where an unregistered icon or a bad field access would throw.
    await waitFor(() => {
      expect(screen.getAllByText(T(marker)).length).toBeGreaterThan(0);
    });
  });
});

describe('the honesty rules survive rendering', () => {
  it('Operations counts the three record kinds separately', async () => {
    render(
      <MemoryRouter>
        <Operations />
      </MemoryRouter>,
    );
    // one of each kind was mocked
    await waitFor(() => expect(screen.getAllByText(T('ops.requests')).length).toBeGreaterThan(0));
    expect(screen.getAllByText(T('ops.bookings')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(T('ops.leads')).length).toBeGreaterThan(0);
  });

  it('Documents never renders a link or download control for a file', async () => {
    const { container } = render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeDefined());
    // The filename must be inert text — no anchor, no download affordance.
    expect(container.querySelector('a[download]')).toBeNull();
    expect(screen.getByText('report.pdf').closest('a')).toBeNull();
  });
});
