import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminPayments, adminUsers, leads, logPiiReveal, notifications } from '../lib/api';
import type { PaymentStatusFilter } from '../lib/api';
import type { AdminUser, Booking, Lead, PaymentRequest, PlanTier, Profile } from '../lib/types';
import { RequireAdmin } from '../components/Gates';
import { useApp } from '../context/AppContext';
import { AppIcon } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ListingsManager, PlacesManager } from '../components/AdminManagers';
import { InvestmentsManager } from '../components/admin/InvestmentsManager';
import { ServiceRequestsManager } from '../components/ServiceRequestsManager';
import { AdminNewRequests } from '../components/AdminNewRequests';
import { AdminServicesManager } from '../components/AdminServicesManager';
import { AdminCompaniesManager } from '../components/AdminCompaniesManager';
import { FxRatesPanel } from '../components/admin/FxRatesPanel';
import { NewsFeedManager } from '../components/admin/NewsFeedManager';
import { PaymentSettingsPanel } from '../components/admin/PaymentSettingsPanel';
import { AdminCompanyPaymentsManager } from '../components/AdminCompanyPaymentsManager';
import { AdminBroadcastManager } from '../components/AdminBroadcastManager';
import { AdminBookingsPanel } from './AdminBookings';
import { SectionState } from '../components/SectionState';
import { RequestStatusPill } from '../components/RequestStatusPill';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { ConfirmActionModal } from '../components/admin/ConfirmActionModal';
import { AdminAuditLog } from '../components/admin/AdminAuditLog';
import { RevealField } from '../components/admin/RevealField';
import { maskEmail } from '../lib/format';
import { isControlCenterEnabled } from '../admin-control-center/flag';

/**
 * Every section that used to be its own stacked card (or, worse, its own
 * top-nav page — /admin/bookings) is now one entry in this list. One page,
 * one section visible at a time, chosen from the sidebar — instead of
 * everything mixed together in a single long scroll.
 */
const TABS = [
  'overview', 'users', 'bookings', 'serviceRequests', 'payments',
  'paymentSettings', 'rates', 'cancellations', 'leads', 'companies', 'companyPayments',
  'broadcast', 'newsFeed', 'catalog', 'listings', 'investments', 'places', 'news', 'auditLog',
] as const;
type AdminTab = (typeof TABS)[number];
const DEFAULT_TAB: AdminTab = 'overview';
function isAdminTab(v: string | null): v is AdminTab {
  return !!v && (TABS as readonly string[]).includes(v);
}

const TIERS: PlanTier[] = ['free', 'light', 'pro', 'elite'];
const HAS_KEYS = ['turkishPhone', 'taxNumber', 'residencePermit', 'bankAccount'] as const;

/** One user row in the admin table — click the name to expand full detail. */
function UserRow({
  user: u, onSetTier, onSetRole,
}: {
  user: AdminUser;
  onSetTier: (id: string, tier: PlanTier) => void;
  onSetRole: (id: string, role: 'user' | 'medical_coordinator') => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminUsers.detail>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null);
  const [pendingRole, setPendingRole] = useState(false);
  // A detail panel that failed to load must not present as a customer with no
  // history. This was `catch { /* ignore */ }`, which did exactly that.
  const [failed, setFailed] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setDetail(await adminUsers.detail(u.id));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) await loadDetail();
  };

  const ob = detail?.onboarding ?? null;
  const owned = ob ? HAS_KEYS.filter((k) => ob.has?.[k]) : [];

  return (
    <>
      <tr className="border-b border-cream-dark/60">
        <td className="py-2.5">
          <button onClick={toggle} className="text-start inline-flex items-center gap-1.5 group" aria-expanded={open}>
            <AppIcon name="arrow-right" className={`w-3 h-3 text-navy/40 transition-transform ${open ? 'rotate-90' : ''}`} />
            <span className="font-semibold text-navy inline-flex items-center gap-1.5 group-hover:underline">
              {u.name}
              {u.isAdmin && <AppIcon name="shield-check" className="w-3.5 h-3.5 text-brand-red" />}
            </span>
          </button>
          <div className="ms-[18px] text-xs text-gray-500">
            <RevealField masked={maskEmail(u.email)} full={u.email} className="break-all" onReveal={() => logPiiReveal('profile', u.id)} />
          </div>
        </td>
        <td className="py-2.5 text-gray-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString(i18n.language)}</td>
        {/* "—" means that table could not be read. It is NOT zero. */}
        <td className="py-2.5 text-center font-semibold text-navy" dir="ltr">{u.bookings ?? '—'}</td>
        <td className="py-2.5 text-center font-semibold text-navy" dir="ltr">{u.leads ?? '—'}</td>
        <td className="py-2.5">
          <select
            className="input !h-9 !w-auto text-xs"
            value={u.tier}
            onChange={(e) => setPendingTier(e.target.value as PlanTier)}
            aria-label={t('admin.users.setTier')}
          >
            {TIERS.map((x) => (
              <option key={x} value={x}>
                {x === 'free' ? t('common.free') : t(`pricing.${x}.name`)}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {open && (
        <tr className="bg-cream/50">
          <td colSpan={5} className="px-4 py-4">
            {loading ? (
              <p className="text-xs text-gray-500">{t('common.loading')}</p>
            ) : failed ? (
              <div role="alert">
                <p className="flex items-center gap-2 text-xs font-semibold text-brand-red">
                  <AppIcon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" />
                  {t('common.error')}
                </p>
                <button onClick={loadDetail} className="btn-secondary mt-2 min-h-[44px] px-4 text-xs">
                  {t('chat.retry')}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                {/* persona / profile */}
                <div>
                  <p className="font-bold text-navy text-xs mb-2">{t('profile.persona.title')}</p>
                  <dl className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{t('profile.persona.path')}</dt>
                      <dd className="font-semibold text-navy">{ob?.path ? t(`onboarding.q1.${ob.path}.title`) : '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{t('profile.persona.reason')}</dt>
                      <dd className="font-semibold text-navy">{ob?.reason ? t(`onboarding.q2.${ob.reason}.title`) : '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{t('profile.persona.family')}</dt>
                      <dd className="font-semibold text-navy">{ob?.family ? t(`common.${ob.family}`) : '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{t('nav.referrals')}</dt>
                      <dd className="font-semibold text-navy" dir="ltr">{u.referralCode || '—'}</dd>
                    </div>
                  </dl>
                </div>
                {/* what they already have */}
                <div>
                  <p className="font-bold text-navy text-xs mb-2">{t('profile.checklist.title')}</p>
                  {owned.length === 0 ? (
                    <p className="text-xs text-gray-500">—</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {owned.map((k) => (
                        <li key={k} className="text-xs text-navy inline-flex items-center gap-1">
                          <AppIcon name="check" className="w-3 h-3 text-green-600" />
                          {t(`onboarding.q3.${k}.title`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* activity */}
                <div>
                  <p className="font-bold text-navy text-xs mb-2">{t('profile.pipeline.title')}</p>
                  {detail && detail.bookings.length === 0 && detail.leads.length === 0 && detail.requests.length === 0 ? (
                    <p className="text-xs text-gray-500">{t('profile.pipeline.empty')}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {/* What this customer actually asked us for. Absent until
                          now: the detail panel read bookings and leads only, so
                          a customer's service requests were invisible from
                          their own account row. */}
                      {detail?.requests.map((r) => (
                        <li key={r.id} className="text-xs text-navy flex items-center gap-1.5">
                          <AppIcon name="inbox" className="w-3 h-3 shrink-0 text-navy/60" />
                          <span className="min-w-0 flex-1 break-anywhere">{r.serviceTitle}</span>
                          <RequestStatusPill status={r.status} className="shrink-0" />
                        </li>
                      ))}
                      {detail?.bookings.map((b) => (
                        <li key={b.id} className="text-xs text-navy inline-flex items-center gap-1">
                          <AppIcon name="calendar" className="w-3 h-3 text-navy/60" />
                          {b.problemSummary}
                        </li>
                      ))}
                      {detail?.leads.map((l) => (
                        <li key={l.id} className="text-xs text-navy inline-flex items-center gap-1">
                          <AppIcon name="mail" className="w-3 h-3 text-navy/60" />
                          {t(`leads.kind.${l.kind}`)} — {l.item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {!u.isAdmin && (
              <div className="mt-3 flex items-center gap-2 border-t border-cream-dark pt-3">
                <span className="text-xs font-semibold text-navy/60">{t('medical.admin.roleLabel')}</span>
                <button
                  onClick={() => setPendingRole(true)}
                  className="btn-secondary !h-8 px-3 text-xs"
                >
                  <AppIcon name="heart-pulse" className="w-3.5 h-3.5" />
                  {u.isMedicalCoordinator ? t('medical.admin.revokeCoordinator') : t('medical.admin.makeCoordinator')}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
      {pendingTier && (
        <ConfirmActionModal
          title={t('admin.users.setTier')}
          record={u.name}
          currentStatus={u.tier === 'free' ? t('common.free') : t(`pricing.${u.tier}.name`)}
          expectedResult={pendingTier === 'free' ? t('common.free') : t(`pricing.${pendingTier}.name`)}
          reversible
          notifiesCustomer={false}
          onClose={() => setPendingTier(null)}
          onConfirm={() => {
            onSetTier(u.id, pendingTier);
            setPendingTier(null);
          }}
        />
      )}
      {pendingRole && (
        <ConfirmActionModal
          title={u.isMedicalCoordinator ? t('medical.admin.revokeCoordinator') : t('medical.admin.makeCoordinator')}
          record={u.name}
          expectedResult={u.isMedicalCoordinator ? t('medical.admin.revokeCoordinator') : t('medical.admin.makeCoordinator')}
          reversible
          notifiesCustomer={false}
          onClose={() => setPendingRole(false)}
          onConfirm={() => {
            onSetRole(u.id, u.isMedicalCoordinator ? 'user' : 'medical_coordinator');
            setPendingRole(false);
          }}
        />
      )}
    </>
  );
}

/**
 * The sidebar used to be one flat list of 18 links — every one of them a
 * scattered, single-purpose page even when several manage the same real-world
 * thing (a service request IS a booking IS a catalog entry; a payment IS a
 * subscription). These two groups fold the related tabs under one collapsible
 * nav entry so they read as one place, without merging their (very
 * different) underlying editors into one screen. `companies` and
 * `companyPayments` stay valid tabs (reachable via ?tab=) but are left out of
 * every group/flat list below — unused for now, hidden rather than deleted.
 */
const NAV_GROUPS: { id: string; icon: IconName; labelKey: string; tabs: AdminTab[] }[] = [
  { id: 'operations', icon: 'inbox', labelKey: 'admin.groups.operations', tabs: ['serviceRequests', 'bookings', 'catalog', 'leads'] },
  { id: 'paymentsGroup', icon: 'credit-card', labelKey: 'admin.groups.payments', tabs: ['payments', 'paymentSettings', 'cancellations'] },
  { id: 'content', icon: 'newspaper', labelKey: 'admin.groups.content', tabs: ['broadcast', 'newsFeed', 'news'] },
  { id: 'realEstate', icon: 'home', labelKey: 'admin.groups.realEstate', tabs: ['listings', 'investments', 'places'] },
  { id: 'settingsGroup', icon: 'trending-up', labelKey: 'admin.groups.settings', tabs: ['rates', 'auditLog'] },
];
const GROUPED_TABS = new Set(NAV_GROUPS.flatMap((g) => g.tabs));
const HIDDEN_FROM_NAV = new Set<AdminTab>(['companies', 'companyPayments']);
const FLAT_TABS = TABS.filter((tab) => !GROUPED_TABS.has(tab) && !HIDDEN_FROM_NAV.has(tab));

/** icon shown next to each sidebar entry */
const TAB_ICON: Record<AdminTab, IconName> = {
  overview: 'layers',
  users: 'users',
  bookings: 'calendar',
  serviceRequests: 'inbox',
  payments: 'credit-card',
  paymentSettings: 'shield-check',
  rates: 'trending-up',
  cancellations: 'x-circle',
  leads: 'mail',
  companies: 'building',
  companyPayments: 'receipt',
  broadcast: 'megaphone',
  newsFeed: 'newspaper',
  catalog: 'shopping-bag',
  listings: 'home',
  investments: 'landmark',
  places: 'map-pin',
  news: 'send',
  auditLog: 'shield-check',
};

/** One sidebar link — shared by the flat top-level tabs and the tabs nested inside a group. */
function TabButton({
  active, onClick, icon, label,
}: { tab: AdminTab; active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 md:shrink-0 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors text-start ${
        active ? 'bg-navy text-white' : 'text-navy/70 hover:bg-cream'
      }`}
    >
      <AppIcon name={icon} className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

function AdminInner() {
  const { t, i18n } = useTranslation();
  const { refresh } = useApp();
  const [news, setNews] = useState('');

  // The active section lives in the URL (?tab=…) so a bookmark, a refresh, or
  // a link sent to a colleague lands on the right section instead of always
  // dumping back onto the overview.
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const activeTab: AdminTab = isAdminTab(rawTab) ? rawTab : DEFAULT_TAB;
  const setActiveTab = (tab: AdminTab) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === DEFAULT_TAB) next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  };

  // Manually expanded/collapsed groups. A group also reads as open whenever
  // the active tab lives inside it, so following a link straight to e.g.
  // ?tab=cancellations lands with "Payments & subscriptions" already open.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const TAB_LABEL: Record<AdminTab, string> = {
    overview: t('admin.overview'),
    users: t('admin.users.title'),
    bookings: t('adminBookings.title'),
    serviceRequests: t('admin.serviceRequests.title'),
    payments: t('admin.payments.title'),
    paymentSettings: t('admin.paymentSettings.title'),
    rates: t('admin.rates.title'),
    cancellations: t('admin.cancellations.title'),
    leads: t('admin.leads.title'),
    companies: t('companyAdmin.companies.title'),
    companyPayments: t('companyAdmin.payments.title'),
    broadcast: t('companyAdmin.broadcast.title'),
    newsFeed: t('admin.newsFeed.title'),
    catalog: t('admin.catalog.heading'),
    listings: t('admin.listings.title'),
    investments: t('admin.investments.title'),
    places: t('admin.places.title'),
    news: t('admin.news.title'),
    auditLog: t('admin.auditLog.title'),
  };
  /**
   * Six INDEPENDENT sections, not one Promise.all.
   *
   * This was a single Promise.all of all six with `load().catch(() => {})` on
   * the effect. Promise.all rejects if any member rejects, so nothing after the
   * await ran and users, payments, broadcasts, leads and cancellations all
   * stayed at their `[]` initial value at once — with the reason thrown away.
   * When admin_users_overview turned out not to exist in the live database, the
   * whole dashboard read as a quiet week. One missing object, five lying
   * sections.
   *
   * Each section now owns its request, its status and its retry, so a failure
   * is scoped to the thing that failed and is visible as an error rather than
   * as emptiness.
   */
  const usersSec = useAsyncSection(() => adminUsers.list(), []);
  const [payFilter, setPayFilter] = useState<PaymentStatusFilter>('pending');
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');
  const paymentsSec = useAsyncSection(
    () => adminPayments.list({ status: payFilter, from: payFrom || undefined, to: payTo || undefined }),
    [payFilter, payFrom, payTo],
  );
  const broadcastsSec = useAsyncSection(() => notifications.broadcasts(), []);
  const leadsSec = useAsyncSection(() => leads.adminList(), []);
  const cancellationsSec = useAsyncSection(() => adminUsers.cancellations(), []);

  const setTier = async (userId: string, tier: PlanTier) => {
    await adminUsers.setTier(userId, tier);
    usersSec.reload();
    await refresh();
  };

  const setRole = async (userId: string, role: 'user' | 'medical_coordinator') => {
    await adminUsers.setRole(userId, role);
    usersSec.reload();
    await refresh();
  };

  const resolvePayment = async (id: string, status: 'verified' | 'rejected') => {
    await adminPayments.resolve(id, status);
    paymentsSec.reload();
    await refresh();
  };
  const [pendingPayment, setPendingPayment] = useState<{ id: string; status: 'verified' | 'rejected'; email: string } | null>(null);

  const publish = async () => {
    if (!news.trim()) return;
    await notifications.publish(news.trim());
    setNews('');
    broadcastsSec.reload();
  };
  const [confirmPublish, setConfirmPublish] = useState(false);

  // Stats summarise the users section, so they can only be as trustworthy as it
  // is: while it is loading or failed they show "—" rather than 0. A dashboard
  // headline reading "0 users" because a fetch failed is the same defect this
  // whole commit exists to remove, just in larger type.
  const usersData = usersSec.status === 'ready' ? usersSec.data : null;
  const sumOf = (pick: (u: AdminUser) => number | null): string => {
    if (!usersData) return '—';
    let total = 0;
    for (const u of usersData) {
      const v = pick(u);
      if (v == null) return '—'; // an unreadable source must not read as zero
      total += v;
    }
    return String(total);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold text-navy">{t('admin.title')}</h1>
      </div>

      {/*
        One page, one section on screen at a time — chosen from this sidebar —
        instead of every section stacked into a single long, mixed scroll.
        The sidebar is the FIRST flex child, so in RTL (Arabic/Farsi) it sits
        on the right, and in LTR (English/Russian) on the left: the
        reading-start side either way.
      */}
      <div className="mt-6 flex flex-col md:flex-row gap-6 items-start">
        <nav
          aria-label={t('admin.title')}
          className="w-full md:w-60 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-24"
        >
          {FLAT_TABS.slice(0, 2).map((tab) => (
            <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={TAB_ICON[tab]} label={TAB_LABEL[tab]} />
          ))}

          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.id) || group.tabs.includes(activeTab);
            return (
              <div key={group.id} className="shrink-0 md:shrink-0 flex md:flex-col gap-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className="shrink-0 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors text-start text-navy/70 hover:bg-cream"
                >
                  <AppIcon name={group.icon} className="w-4 h-4 shrink-0" />
                  {t(group.labelKey)}
                  <AppIcon name="chevron-down" className={`w-3.5 h-3.5 shrink-0 ms-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="flex flex-row md:flex-col gap-1 md:ms-4 md:ps-2 md:border-s md:border-cream-dark">
                    {group.tabs.map((tab) => (
                      <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={TAB_ICON[tab]} label={TAB_LABEL[tab]} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {FLAT_TABS.slice(2).map((tab) => (
            <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={TAB_ICON[tab]} label={TAB_LABEL[tab]} />
          ))}

          {/* Medical stays a separate page on purpose: it has its own
              permission (medical coordinators who are not admins), so it
              can't fold into a page gated to admins only. It used to sit as
              a floating button in the header above, next to whichever tab
              happened to be open — which read as if it belonged to THAT
              tab (e.g. "Places"). It's a Link, not a button, because it's a
              real route change, not a ?tab= switch like the others — but it
              renders in the same list, same styling, so it reads as one more
              section rather than a stray control. */}
          <Link
            to="/admin/medical"
            className="shrink-0 md:shrink-0 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors text-start text-navy/70 hover:bg-cream md:mt-1 md:border-t md:border-cream-dark md:pt-3.5"
          >
            <AppIcon name="heart-pulse" className="w-4 h-4 shrink-0" />
            {t('medical.admin.navLink')}
          </Link>

          {/* Additive discovery link to the new Control Center. Appended AFTER
              every existing entry (never reordering them) and shown only when
              the feature flag is on, so the classic sidebar is unchanged by
              default. */}
          {isControlCenterEnabled() && (
            <Link
              to="/admin/control-center"
              className="shrink-0 md:shrink-0 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors text-start text-brand-red hover:bg-cream md:mt-1"
            >
              <AppIcon name="layers" className="w-4 h-4 shrink-0" />
              Control Center
            </Link>
          )}
        </nav>

        <div className="flex-1 min-w-0 w-full">
          {activeTab === 'overview' && (
            <>
              {/* at-a-glance stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  ['statUsers', usersData ? String(usersData.length) : '—', 'users'],
                  ['statPaying', usersData ? String(usersData.filter((u) => u.tier !== 'free').length) : '—', 'star'],
                  ['statBookings', sumOf((u) => u.bookings), 'calendar'],
                  ['statLeads', sumOf((u) => u.leads), 'mail'],
                ] as const).map(([key, value, icon]) => (
                  <div key={key} className="card p-4">
                    <div className="flex items-center gap-2 text-navy/60 text-xs font-semibold">
                      <AppIcon name={icon as never} className="w-3.5 h-3.5" />
                      {t(`admin.users.${key}`)}
                    </div>
                    <p className="mt-1 text-2xl font-extrabold text-navy" dir="ltr">{value}</p>
                  </div>
                ))}
              </div>

              {/* Work waiting on the admin, above everything else. Nothing
                  notifies us out of band, so unhandled requests have to be
                  the first thing on the overview tab. Renders nothing when
                  the queue is empty. */}
              <AdminNewRequests />
            </>
          )}

          {/* bookings: merged in from what used to be the separate
              /admin/bookings page (and its own top-nav link) */}
          {activeTab === 'bookings' && <AdminBookingsPanel />}

          {/* incoming service-catalog requests */}
          {activeTab === 'serviceRequests' && <ServiceRequestsManager />}

          {/* payment verification + history */}
          {activeTab === 'payments' && (
            <div className="card p-6">
              <h2 className="font-bold text-navy">{t('admin.payments.title')}</h2>

              {/* status + date filters: the pending queue alone had no way to
                  see revenue, review a dispute, or trace a referral commission */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(['pending', 'verified', 'rejected', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPayFilter(s)}
                    aria-pressed={payFilter === s}
                    className={`rounded-full px-3 min-h-[36px] text-xs font-bold border transition-colors ${
                      payFilter === s ? 'bg-navy text-white border-navy' : 'bg-white text-navy/70 border-cream-dark'
                    }`}
                  >
                    {t(`admin.payments.filter.${s}`)}
                  </button>
                ))}
                <label className="ms-auto flex items-center gap-1 text-xs text-navy/70">
                  {t('admin.payments.from')}
                  <input type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} className="input h-9 text-xs" />
                </label>
                <label className="flex items-center gap-1 text-xs text-navy/70">
                  {t('admin.payments.to')}
                  <input type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} className="input h-9 text-xs" />
                </label>
              </div>

              <SectionState
                section={paymentsSec}
                title={t('admin.payments.title')}
                isEmpty={(d) => d.payments.length === 0}
                empty={<p className="mt-3 text-sm text-gray-500">{t('admin.payments.empty')}</p>}
              >
                {({ payments: rows, totalVerifiedTl }) => (
                <>
                {payFilter !== 'pending' && (
                  <p className="mt-3 text-sm font-semibold text-navy">
                    {t('admin.payments.total')}: <span dir="ltr">{totalVerifiedTl.toLocaleString()} {t('common.tl')}</span>
                  </p>
                )}
                <ul className="mt-4 flex flex-col gap-3">
                  {rows.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-3 text-sm">
                      <span className="font-semibold text-navy">
                        <RevealField masked={maskEmail(p.email)} full={p.email} className="break-all" onReveal={() => logPiiReveal('payment', p.id)} />
                      </span>
                      <span className="rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-navy">
                        {t(`pricing.${p.tier}.name`)} / {t(`common.${p.billing}`)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t('admin.payments.method')}: {t(`checkout.tabs.${p.method}`)} ·{' '}
                        <span dir="ltr">{p.amount.toLocaleString()} {t('common.tl')}</span> ·{' '}
                        <span dir="ltr">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </span>
                      {p.status !== 'pending' && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            p.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-brand-red/10 text-brand-red'
                          }`}
                        >
                          {t(`admin.payments.filter.${p.status}`)}
                        </span>
                      )}
                      {p.hasReceipt && (
                        <button
                          type="button"
                          onClick={() => adminPayments.openReceipt(p.id)}
                          className="btn-secondary h-9 px-3 text-xs"
                        >
                          <AppIcon name="paperclip" className="w-3.5 h-3.5" />
                          {t('admin.payments.receipt')}
                        </button>
                      )}
                      {p.status === 'pending' && (
                        <span className="ms-auto flex gap-2">
                          <button onClick={() => setPendingPayment({ id: p.id, status: 'verified', email: p.email })} className="btn-primary h-9 px-3 text-xs">
                            <AppIcon name="check" className="w-3.5 h-3.5" />
                            {t('admin.payments.verify')}
                          </button>
                          <button onClick={() => setPendingPayment({ id: p.id, status: 'rejected', email: p.email })} className="btn-danger h-9 px-3 text-xs">
                            <AppIcon name="x" className="w-3.5 h-3.5" />
                            {t('admin.payments.reject')}
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                </>
                )}
              </SectionState>
              {pendingPayment && (
                <ConfirmActionModal
                  title={pendingPayment.status === 'verified' ? t('admin.payments.verify') : t('admin.payments.reject')}
                  record={pendingPayment.email}
                  currentStatus={t('admin.payments.filter.pending')}
                  expectedResult={t(`admin.payments.filter.${pendingPayment.status}`)}
                  reversible={false}
                  notifiesCustomer={false}
                  onClose={() => setPendingPayment(null)}
                  onConfirm={() => {
                    resolvePayment(pendingPayment.id, pendingPayment.status);
                    setPendingPayment(null);
                  }}
                />
              )}
            </div>
          )}

          {/* Bank / crypto / gateway details, editable without SQL. Reports
              what a customer actually sees, so a placeholder can never sit
              live and unnoticed again. */}
          {activeTab === 'paymentSettings' && <PaymentSettingsPanel />}

          {/* currency rates: the daily FX sync plus every manual-only pair
              (USD/SYP), all through one per-pair override + audit trail */}
          {activeTab === 'rates' && <FxRatesPanel />}

          {/* who changed what — tier/role changes, payment resolve, PII
              reveal, content deletes, news publish */}
          {activeTab === 'auditLog' && <AdminAuditLog />}

          {/* users + tier control. The referral columns (clicks / signups /
              earned) are gone with the RPC: referral_clicks stores only a
              code and carries no user_id, so per-user attribution is not
              derivable from the tables the browser can read. Showing zeros
              there would be a guess presented as a fact. */}
          {activeTab === 'users' && (
            <div className="card p-6 overflow-x-auto">
              <h2 className="font-bold text-navy">{t('admin.users.title')}</h2>
              <SectionState
                section={usersSec}
                title={t('admin.users.title')}
                empty={<p className="mt-3 text-sm text-gray-500">{t('admin.users.title')} — 0</p>}
              >
                {(rows) => (
                  // Measured, not guessed: the five columns need ~574px in fa,
                  // ru and en alike (the email cell alone is 233px), so a
                  // smaller min-width would squeeze columns rather than
                  // scroll. fa 572px, ru 574px.
                  <table className="mt-4 w-full text-sm min-w-[600px] sm:min-w-[700px]">
                    <thead>
                      <tr className="text-xs text-navy/60 border-b border-cream-dark">
                        <th className="text-start py-2">{t('admin.users.user')}</th>
                        <th className="text-start py-2">{t('admin.users.joined')}</th>
                        <th className="text-center py-2">{t('admin.users.bookings')}</th>
                        <th className="text-center py-2">{t('admin.users.leads')}</th>
                        <th className="text-start py-2">{t('admin.users.tier')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((u) => (
                        <UserRow key={u.id} user={u} onSetTier={setTier} onSetRole={setRole} />
                      ))}
                    </tbody>
                  </table>
                )}
              </SectionState>
            </div>
          )}

          {/* subscription cancellations */}
          {activeTab === 'cancellations' && (
            <div className="card p-6">
              <h2 className="font-bold text-navy">{t('admin.cancellations.title')}</h2>
              <SectionState
                section={cancellationsSec}
                title={t('admin.cancellations.title')}
                empty={<p className="mt-3 text-sm text-gray-500">{t('admin.cancellations.empty')}</p>}
              >
                {(rows) => (
                <ul className="mt-4 flex flex-col gap-3">
                  {rows.map((c) => (
                    <li key={c.userId} className="rounded-xl bg-cream px-4 py-3 text-sm flex flex-col gap-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-navy">
                          {t(`pricing.${c.tier}.name`)}
                        </span>
                        <span className="ms-auto text-xs text-gray-500">
                          {new Date(c.expiresAt).toLocaleDateString(i18n.language)}
                        </span>
                      </div>
                      {c.reason && <p className="font-semibold text-navy break-words">{c.reason}</p>}
                      {c.comment && <p className="text-gray-500 break-words">{c.comment}</p>}
                    </li>
                  ))}
                </ul>
                )}
              </SectionState>
            </div>
          )}

          {/* service request leads (P1-3) */}
          {activeTab === 'leads' && (
            <div className="card p-6">
              <h2 className="font-bold text-navy">{t('admin.leads.title')}</h2>
              <SectionState
                section={leadsSec}
                title={t('admin.leads.title')}
                empty={<p className="mt-3 text-sm text-gray-500">{t('admin.leads.empty')}</p>}
              >
                {(rows) => (
                <ul className="mt-4 flex flex-col gap-2">
                  {rows.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-2.5 text-sm">
                      <span className="rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-navy">
                        {t(`leads.kind.${l.kind}`)}
                      </span>
                      <span className="font-semibold text-navy break-anywhere">{l.item}</span>
                      {l.userEmail && (
                        <span className="text-xs text-gray-500">
                          <RevealField masked={maskEmail(l.userEmail)} full={l.userEmail} className="break-all" onReveal={() => logPiiReveal('lead', l.id)} />
                        </span>
                      )}
                      <span className="ms-auto text-xs text-gray-500">
                        {new Date(l.createdAt).toLocaleString(i18n.language)}
                      </span>
                    </li>
                  ))}
                </ul>
                )}
              </SectionState>
            </div>
          )}

          {/* B2B companies: directory, subscriptions */}
          {activeTab === 'companies' && <AdminCompaniesManager />}

          {/* B2B companies: subscription payments */}
          {activeTab === 'companyPayments' && <AdminCompanyPaymentsManager />}

          {/* B2B companies: broadcast leads/responses */}
          {activeTab === 'broadcast' && <AdminBroadcastManager />}

          {/* public news feed shown on the home page (mirrors the Telegram channel) */}
          {activeTab === 'newsFeed' && <NewsFeedManager />}

          {/* editable services catalog (add / edit text / hide) */}
          {activeTab === 'catalog' && <AdminServicesManager />}

          {/* content management: real-estate listings */}
          {activeTab === 'listings' && <ListingsManager />}

          {/* content management: investment opportunities */}
          {activeTab === 'investments' && <InvestmentsManager />}

          {/* content management: map services */}
          {activeTab === 'places' && <PlacesManager />}

          {/* global news signals (site-wide broadcast notifications) */}
          {activeTab === 'news' && (
            <div className="card p-6">
              <h2 className="font-bold text-navy">{t('admin.news.title')}</h2>
              <div className="mt-3 flex gap-2">
                <input className="input" placeholder={t('admin.news.placeholder')} value={news} onChange={(e) => setNews(e.target.value)} />
                <button onClick={() => news.trim() && setConfirmPublish(true)} className="btn-primary px-5">
                  <AppIcon name="megaphone" className="w-4 h-4" />
                  {t('admin.news.publish')}
                </button>
              </div>
              {confirmPublish && (
                <ConfirmActionModal
                  title={t('admin.news.publish')}
                  record={news}
                  expectedResult={t('admin.news.publish')}
                  reversible={false}
                  notifiesCustomer
                  onClose={() => setConfirmPublish(false)}
                  onConfirm={() => {
                    publish();
                    setConfirmPublish(false);
                  }}
                />
              )}
              <SectionState
                section={broadcastsSec}
                title={t('admin.news.title')}
                empty={<p className="mt-3 text-sm text-gray-500">{t('admin.news.empty')}</p>}
              >
                {(rows) => (
                <ul className="mt-4 flex flex-col gap-2">
                  {rows.map((b) => (
                    <li key={b.id} className="rounded-xl bg-cream px-4 py-2.5 text-sm text-navy flex gap-2 items-start">
                      <AppIcon name="megaphone" className="w-4 h-4 mt-0.5 shrink-0 text-navy/70" />
                      <span className="flex-1">{b.customText}</span>
                      <span className="text-xs text-gray-500">{new Date(b.createdAt).toLocaleDateString(i18n.language)}</span>
                    </li>
                  ))}
                </ul>
                )}
              </SectionState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Admin() {
  return (
    <RequireAdmin>
      <AdminInner />
    </RequireAdmin>
  );
}
