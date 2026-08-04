import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminPayments, adminRates, adminUsers, leads, notifications } from '../lib/api';
import type { PaymentStatusFilter } from '../lib/api';
import type { AdminUser, Booking, Lead, PaymentRequest, PlanTier, Profile } from '../lib/types';
import { RequireAdmin } from '../components/Gates';
import { useApp } from '../context/AppContext';
import { AppIcon } from '../components/AppIcon';
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
import { SectionState } from '../components/SectionState';
import { RequestStatusPill } from '../components/RequestStatusPill';
import { useAsyncSection } from '../hooks/useAsyncSection';

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
            <span>
              <span className="font-semibold text-navy inline-flex items-center gap-1.5 group-hover:underline">
                {u.name}
                {u.isAdmin && <AppIcon name="shield-check" className="w-3.5 h-3.5 text-brand-red" />}
              </span>
              <span className="block text-xs text-gray-500 break-all">{u.email}</span>
            </span>
          </button>
        </td>
        <td className="py-2.5 text-gray-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString(i18n.language)}</td>
        {/* "—" means that table could not be read. It is NOT zero. */}
        <td className="py-2.5 text-center font-semibold text-navy" dir="ltr">{u.bookings ?? '—'}</td>
        <td className="py-2.5 text-center font-semibold text-navy" dir="ltr">{u.leads ?? '—'}</td>
        <td className="py-2.5">
          <select
            className="input !h-9 !w-auto text-xs"
            value={u.tier}
            onChange={(e) => onSetTier(u.id, e.target.value as PlanTier)}
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
                  onClick={() => onSetRole(u.id, u.isMedicalCoordinator ? 'user' : 'medical_coordinator')}
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
    </>
  );
}

function AdminInner() {
  const { t, i18n } = useTranslation();
  const { refresh } = useApp();
  const [news, setNews] = useState('');
  // USD/TRY and EUR/TRY moved to fx_rates (daily sync + FxRatesPanel). Only the
  // Syrian pound is still hand-set here, because no free feed prices it reliably.
  const [syp, setSyp] = useState('');
  const [ratesSaved, setRatesSaved] = useState(false);

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
  const ratesSec = useAsyncSection(() => adminRates.get(), []);

  // The SYP input is seeded from the rates section once it lands, and only when
  // untouched — so a reload can never overwrite what the admin is typing.
  const loadedRates = ratesSec.status === 'ready' ? ratesSec.data : null;
  const ratesUpdatedAt = loadedRates?.updatedAt ?? null;
  useEffect(() => {
    if (loadedRates) setSyp(loadedRates.sypusd != null ? String(loadedRates.sypusd) : '');
  }, [loadedRates]);

  const saveRates = async () => {
    const s = Number(syp);
    if (!(s > 0)) return;
    // The legacy settings.rates row now carries only sypusd; usd/eur are passed
    // as 0 and ignored — the live pairs come from fx_rates.
    await adminRates.set(0, 0, s);
    setRatesSaved(true);
    setTimeout(() => setRatesSaved(false), 2000);
    ratesSec.reload();
  };

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

  const publish = async () => {
    if (!news.trim()) return;
    await notifications.publish(news.trim());
    setNews('');
    broadcastsSec.reload();
  };

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold text-navy">{t('admin.title')}</h1>
        <div className="flex items-center gap-2">
          <Link to="/admin/medical" className="btn-secondary h-9 px-4 text-xs">
            <AppIcon name="heart-pulse" className="w-3.5 h-3.5" />
            {t('medical.admin.navLink')}
          </Link>
          <Link to="/admin/bookings" className="btn-primary h-9 px-4 text-xs">
            <AppIcon name="calendar" className="w-3.5 h-3.5" />
            {t('nav.bookings')}
          </Link>
        </div>
      </div>

      {/* at-a-glance stats */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Work waiting on the admin, above everything else. Nothing notifies us
          out of band, so unhandled requests have to be the first thing on the
          page rather than buried under users/listings/places/payments.
          Renders nothing when the queue is empty. */}
      <AdminNewRequests />

      {/* Daily FX sync: health, per-pair override with reason, audit trail.
          Replaced the old free-text rates card, which wrote an unaudited
          override into settings.rates with no reason and no history. */}
      <FxRatesPanel />

      {/* Bank / crypto / gateway details, editable without SQL. Each group
          reports what a customer actually sees, so a placeholder can never sit
          live and unnoticed again. */}
      <PaymentSettingsPanel />

      {/* USD/SYP stays hand-set: free FX feeds report a stale or wrong Syrian
          pound, so there is no provider to sync it from. */}
      <div className="card p-6 mt-5">
        <h2 className="font-bold text-navy flex items-center gap-2">
          <AppIcon name="trending-up" className="w-4 h-4" />
          {t('admin.rates.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t('admin.rates.body')}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-navy/70">
            USD/SYP
            <input type="number" step="any" className="input w-full sm:!w-36 mt-1" value={syp} onChange={(e) => setSyp(e.target.value)} dir="ltr" placeholder={t('admin.rates.sypHint')} />
          </label>
          <button onClick={saveRates} className="btn-primary h-11 px-5">
            <AppIcon name={ratesSaved ? 'check' : 'save'} className="w-4 h-4" />
            {ratesSaved ? t('admin.rates.saved') : t('admin.rates.save')}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {ratesUpdatedAt
            ? t('admin.rates.updated', { date: new Date(ratesUpdatedAt).toLocaleString(i18n.language) })
            : t('admin.rates.usingLive')}
        </p>
      </div>

      {/* users + tier control. The referral columns (clicks / signups / earned)
          are gone with the RPC: referral_clicks stores only a code and carries
          no user_id, so per-user attribution is not derivable from the tables
          the browser can read. Showing zeros there would be a guess presented
          as a fact. */}
      <div className="card p-6 mt-5 overflow-x-auto">
        <h2 className="font-bold text-navy">{t('admin.users.title')}</h2>
        <SectionState
          section={usersSec}
          title={t('admin.users.title')}
          empty={<p className="mt-3 text-sm text-gray-500">{t('admin.users.title')} — 0</p>}
        >
          {(rows) => (
            // Measured, not guessed: the five columns need ~574px in fa, ru and
            // en alike (the email cell alone is 233px), so a smaller min-width
            // would squeeze columns rather than scroll. fa 572px, ru 574px.
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

      {/* subscription cancellations */}
      <div className="card p-6 mt-5">
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

      {/* payment verification + history */}
      <div className="card p-6 mt-5">
        <h2 className="font-bold text-navy">{t('admin.payments.title')}</h2>

        {/* status + date filters: the pending queue alone had no way to see
            revenue, review a dispute, or trace a referral commission */}
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
                <span className="font-semibold text-navy break-all">{p.email}</span>
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
                    <button onClick={() => resolvePayment(p.id, 'verified')} className="btn-primary h-9 px-3 text-xs">
                      <AppIcon name="check" className="w-3.5 h-3.5" />
                      {t('admin.payments.verify')}
                    </button>
                    <button onClick={() => resolvePayment(p.id, 'rejected')} className="btn-danger h-9 px-3 text-xs">
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
      </div>

      {/* service request leads (P1-3) */}
      <div className="card p-6 mt-5">
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
                <span className="text-xs text-gray-500 break-all">{l.userEmail}</span>
                <span className="ms-auto text-xs text-gray-500">
                  {new Date(l.createdAt).toLocaleString(i18n.language)}
                </span>
              </li>
            ))}
          </ul>
          )}
        </SectionState>
      </div>

      {/* incoming service-catalog requests */}
      <ServiceRequestsManager />

      {/* B2B companies: directory, subscriptions, broadcast leads/responses */}
      <AdminCompaniesManager />
      <AdminCompanyPaymentsManager />
      <AdminBroadcastManager />

      {/* public news feed shown on the home page (mirrors the Telegram channel) */}
      <NewsFeedManager />

      {/* editable services catalog (add / edit text / hide) */}
      <AdminServicesManager />

      {/* content management: real-estate listings + map services */}
      <ListingsManager />
      <InvestmentsManager />
      <PlacesManager />

      {/* global news signals */}
      <div className="card p-6 mt-5">
        <h2 className="font-bold text-navy">{t('admin.news.title')}</h2>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder={t('admin.news.placeholder')} value={news} onChange={(e) => setNews(e.target.value)} />
          <button onClick={publish} className="btn-primary px-5">
            <AppIcon name="megaphone" className="w-4 h-4" />
            {t('admin.news.publish')}
          </button>
        </div>
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
