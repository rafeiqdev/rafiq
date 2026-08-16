import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { bookings, documents, leads } from '../lib/api';
import type { Booking, Lead, StoredDocument } from '../lib/types';
import { RequireAuth } from '../components/Gates';
import { AppIcon } from '../components/AppIcon';
import { ActivityCard } from '../components/ActivityCard';
import { SectionState } from '../components/SectionState';
import { DataPrivacySecurityCard } from '../components/DataPrivacySecurityCard';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { pickCity } from '../data/turkeyCities';

function isoToDisplay(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}
function displayToIso(v: string): string | undefined {
  const digits = v.replace(/\D/g, '').slice(0, 8); // DDMMYYYY
  if (digits.length < 8) return undefined;
  const d = digits.slice(0,2), m = digits.slice(2,4), y = digits.slice(4,8);
  const dt = new Date(`${y}-${m}-${d}`);
  return isNaN(dt.getTime()) ? undefined : `${y}-${m}-${d}`;
}
// Inserts "/" after the day and month segments as the user types, so raw
// digits never sit on screen as one undifferentiated number.
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8); // DDMMYYYY
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `/${digits.slice(4, 8)}`;
  return out;
}

/** Controlled DD/MM/YYYY field — reformats with "/" separators on every keystroke. */
function RenewalDateInput({
  iso,
  label,
  onChangeIso,
  className = 'input w-full sm:w-auto !h-9 text-xs shrink-0',
}: {
  iso?: string;
  label: string;
  onChangeIso: (iso: string | undefined) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(iso));

  useEffect(() => {
    setText(isoToDisplay(iso));
  }, [iso]);

  return (
    <input
      type="text" inputMode="numeric" dir="ltr"
      className={className}
      placeholder="DD/MM/YYYY"
      value={text}
      onChange={(e) => {
        const formatted = formatDateInput(e.target.value);
        setText(formatted);
        onChangeIso(displayToIso(formatted));
      }}
      aria-label={label}
    />
  );
}

const RENEWAL_ICON: Record<'residence' | 'insurance' | 'passport', 'id-card' | 'heart-pulse' | 'plane'> = {
  residence: 'id-card',
  insurance: 'heart-pulse',
  passport: 'plane',
};

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// Past ~2 months a raw day count stops being readable at a glance ("612 days
// left") — switch to the coarsest unit that keeps the number small.
function renewalPeriod(days: number): { count: number; key: 'profile.renewals.daysLeft' | 'profile.renewals.monthsLeft' | 'profile.renewals.yearsLeft' } {
  if (days >= 365) return { count: Math.round(days / 365), key: 'profile.renewals.yearsLeft' };
  if (days >= 60) return { count: Math.round(days / 30), key: 'profile.renewals.monthsLeft' };
  return { count: days, key: 'profile.renewals.daysLeft' };
}

function ProfileInner() {
  const { t, i18n } = useTranslation();
  const { user, profile, updateProfile, signOut } = useApp();
  // Bookings, leads and requests now live inside <ActivityCard />, each as its
  // own independent section. What is left here is the document locker, which
  // had the same defect: useState([]) plus .catch(() => {}) asserted an empty
  // locker on first paint and again on any failure — including the
  // not_authenticated that commit 5 made these reads throw.
  const docsSec = useAsyncSection<StoredDocument[]>(() => documents.list(), []);
  const docs = docsSec.status === 'ready' ? (docsSec.data ?? []) : [];

  const hasItems = [
    ['turkishPhone', profile.has.turkishPhone],
    ['taxNumber', profile.has.taxNumber],
    ['residencePermit', profile.has.residencePermit],
    ['bankAccount', profile.has.bankAccount],
  ] as const;
  const done = hasItems.filter(([, v]) => v).length;

  const upload = async (file?: File) => {
    if (!user || !file) return;
    await documents.upload(file);
    docsSec.reload();
  };

  const renewalRows = (['residence', 'insurance', 'passport'] as const).map((k) => ({
    key: k,
    date: profile.renewals[k],
    days: daysUntil(profile.renewals[k]),
  }));
  const renewalsWithDates = renewalRows.filter((r) => r.date);
  const urgentRenewal = renewalsWithDates.length
    ? renewalsWithDates.reduce((a, b) => ((a.days ?? Infinity) < (b.days ?? Infinity) ? a : b))
    : null;
  const [selectedRenewal, setSelectedRenewal] = useState<typeof renewalRows[number]['key']>(
    () => urgentRenewal?.key ?? renewalRows[0].key,
  );
  const [renewalsUrgentOnly, setRenewalsUrgentOnly] = useState(false);
  const selectedRenewalRow = renewalRows.find((r) => r.key === selectedRenewal) ?? renewalRows[0];
  const visibleRenewalRows = renewalRows.filter(
    (r) => !renewalsUrgentOnly || !r.date || (r.days !== null && r.days < 60),
  );


  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold text-navy">{t('profile.title')}</h1>
        <button onClick={() => signOut()} className="btn-secondary h-9 px-3 text-xs min-h-[44px]">
          {t('common.signOut')}
        </button>
      </div>

      {/* account summary — real data only (no fake documents/balances) */}
      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-12 h-12 rounded-full bg-navy text-white font-extrabold shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.name?.[0] ?? 'R').toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-navy truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 break-all" dir="ltr">{user?.email}</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">{t('account.situation')}</dt>
            <dd className="font-semibold text-navy">
              {profile.situation ? t(`situationStatus.${profile.situation}`) : t('account.notSet')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">{t('account.city')}</dt>
            <dd className="font-semibold text-navy">
              {profile.city ? pickCity(profile.city, i18n.language) : t('account.notSet')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">{t('account.onboardingStatus')}</dt>
            <dd className="font-semibold text-navy">
              {user?.onboardingCompleted ? t('account.completed') : t('account.notCompleted')}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/journey" className="btn-primary min-h-[44px] px-4 text-sm">
            <AppIcon name="check-circle" className="w-4 h-4" />
            {t('account.myJourney')}
          </Link>
          <Link to="/wallet" className="btn-secondary min-h-[44px] px-4 text-sm font-bold text-navy">
            <AppIcon name="sparkles" className="w-4 h-4 text-sand" />
            {t('wallet.title')}
          </Link>
          <Link to="/referrals" className="btn-secondary min-h-[44px] px-4 text-sm font-bold text-navy">
            <AppIcon name="users" className="w-4 h-4 text-navy/70" />
            {t('referrals.title')}
          </Link>
          <Link to="/onboarding?edit=1" className="btn-secondary min-h-[44px] px-4 text-sm">
            <AppIcon name="pencil" className="w-4 h-4" />
            {t('account.editAnswers')}
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
          <Link to="/wallet" className="hover:text-navy hover:underline font-bold text-sand">{t('wallet.title')}</Link>
          <Link to="/referrals" className="hover:text-navy hover:underline">{t('referrals.title')}</Link>
          <Link to="/terms" className="hover:text-navy hover:underline">{t('nav.terms')}</Link>
          <Link to="/privacy" className="hover:text-navy hover:underline">{t('nav.privacy')}</Link>
        </div>
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {/* persona */}
        <div className="card p-5 sm:p-6">
          <h2 className="font-bold text-navy">{t('profile.persona.title')}</h2>
          <dl className="mt-3 text-sm flex flex-col gap-2">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500 min-w-0">{t('profile.persona.path')}</dt>
              <dd className="font-semibold text-navy text-end min-w-0 break-words">{profile.path ? t(`onboarding.q1.${profile.path}.title`) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500 min-w-0">{t('profile.persona.reason')}</dt>
              <dd className="font-semibold text-navy text-end min-w-0 break-words">{profile.reason ? t(`onboarding.q2.${profile.reason}.title`) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500 min-w-0">{t('profile.persona.family')}</dt>
              <dd className="font-semibold text-navy text-end min-w-0 break-words">{profile.family ? t(`common.${profile.family}`) : '—'}</dd>
            </div>
          </dl>
          {/* Was a "wipe the answers and re-open the modal" trigger; it now
              leads to the same /onboarding page, pre-filled. */}
          <Link to="/onboarding?edit=1" className="btn-secondary w-full mt-4">
            <AppIcon name="pencil" className="w-4 h-4" />
            {t('profile.persona.edit')}
          </Link>
        </div>

        {/* checklist */}
        <div className="card p-5 sm:p-6">
          <h2 className="font-bold text-navy">{t('profile.checklist.title')}</h2>
          <p className="mt-1 text-xs text-navy/60">{t('profile.checklist.progress', { done, total: hasItems.length })}</p>
          <div className="mt-2 h-2 rounded-full bg-cream-dark overflow-hidden">
            <div className="h-full bg-navy transition-all" style={{ width: `${(done / hasItems.length) * 100}%` }} />
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {hasItems.map(([k, v]) => (
              <li key={k}>
                <button
                  onClick={() => updateProfile({ has: { ...profile.has, [k]: !v } })}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-cream text-start"
                >
                  <span
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                      v ? 'bg-navy border-navy text-white' : 'border-navy/40 text-transparent'
                    }`}
                  >
                    <AppIcon name="check" className="w-3 h-3" />
                  </span>
                  <span className={`text-sm ${v ? 'text-navy/60 line-through' : 'text-navy'}`}>
                    {t(`onboarding.q3.${k}.title`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* renewal tracker — id target for /profile#renewals deep links (e.g. the
            dashboard's "add a date" invite, which used to just land on /profile
            with no way to tell the user where to look). Glass-on-gradient look
            requested by the user (Pinterest reference), recolored to the site's
            own navy/gold-black brand tokens instead of the reference's pink. */}
        <div id="renewals" className="relative overflow-hidden rounded-3xl p-5 sm:p-6 scroll-mt-20 shadow-cardHover bg-gradient-to-br from-navy-dark via-navy to-navy-light">
          <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 -right-8 w-48 h-48 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            {/* segmented toggle */}
            <div className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 p-1">
              <button
                onClick={() => setRenewalsUrgentOnly(false)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${!renewalsUrgentOnly ? 'bg-white text-navy shadow' : 'text-white/80'}`}
              >
                {t('profile.renewals.all')}
              </button>
              <button
                onClick={() => setRenewalsUrgentOnly(true)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${renewalsUrgentOnly ? 'bg-white text-navy shadow' : 'text-white/80'}`}
              >
                {t('profile.renewals.urgent')}
              </button>
            </div>

            {/* headline — most urgent renewal */}
            <div className="mt-6">
              {urgentRenewal ? (
                <>
                  {(() => {
                    const expired = urgentRenewal.days !== null && urgentRenewal.days < 0;
                    const period = renewalPeriod(urgentRenewal.days ?? 0);
                    return (
                      <>
                        <div className="flex items-end justify-between gap-3">
                          <p className="text-xl sm:text-2xl font-black text-white leading-none drop-shadow-sm truncate">
                            {t(`profile.renewals.${urgentRenewal.key}`)}
                          </p>
                          <p className="text-4xl sm:text-5xl font-black text-white leading-none drop-shadow-sm shrink-0">
                            {expired ? '—' : period.count}
                          </p>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-white/80">
                          {expired ? t('profile.renewals.expired') : t(period.key, { count: period.count })}
                          {' · '}
                          {new Date(urgentRenewal.date!).toLocaleDateString(i18n.language)}
                        </p>
                      </>
                    );
                  })()}
                </>
              ) : (
                <p className="text-xl sm:text-2xl font-black text-white leading-none drop-shadow-sm">
                  {t('profile.renewals.title')}
                </p>
              )}
            </div>

            {/* item row */}
            <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
              {visibleRenewalRows.map((r) => {
                const active = r.key === selectedRenewal;
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelectedRenewal(r.key)}
                    className={`flex flex-col items-center gap-1.5 shrink-0 rounded-2xl px-3 py-2 transition ${
                      active ? 'bg-white/95 shadow-md' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-9 h-9 rounded-full ${
                        active ? 'bg-gold text-white' : 'bg-white/20 text-white'
                      }`}
                    >
                      <AppIcon name={RENEWAL_ICON[r.key]} className="w-4 h-4" />
                    </span>
                    <span className={`text-[11px] font-bold whitespace-nowrap ${active ? 'text-navy' : 'text-white'}`}>
                      {t(`profile.renewals.${r.key}`)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* edit selected renewal's date */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label className="flex-1 flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 px-3 h-11 min-w-0">
                <AppIcon name="pencil" className="w-4 h-4 text-white/80 shrink-0" />
                <RenewalDateInput
                  key={selectedRenewalRow.key}
                  iso={selectedRenewalRow.date}
                  label={t('profile.renewals.set')}
                  onChangeIso={(iso) => updateProfile({ renewals: { ...profile.renewals, [selectedRenewalRow.key]: iso } })}
                  className="w-full bg-transparent text-sm font-semibold text-white placeholder-white/60 outline-none"
                />
              </label>
              <span
                className={`shrink-0 rounded-full px-3.5 h-9 flex items-center justify-center text-xs font-bold ${
                  !selectedRenewalRow.date
                    ? 'bg-white/20 text-white'
                    : selectedRenewalRow.days !== null && selectedRenewalRow.days < 0
                    ? 'bg-white text-brand-red'
                    : selectedRenewalRow.days !== null && selectedRenewalRow.days < 30
                    ? 'bg-white text-amber-600'
                    : 'bg-white text-green-700'
                }`}
              >
                {!selectedRenewalRow.date
                  ? t('profile.renewals.noDate')
                  : selectedRenewalRow.days !== null && selectedRenewalRow.days < 0
                  ? t('profile.renewals.expired')
                  : t(renewalPeriod(selectedRenewalRow.days ?? 0).key, { count: renewalPeriod(selectedRenewalRow.days ?? 0).count })}
              </span>
            </div>
          </div>
        </div>

        {/* document locker — id target for /profile#locker deep links */}
        <div id="locker" className="card p-5 sm:p-6 scroll-mt-20">
          <h2 className="font-bold text-navy">{t('profile.locker.title')}</h2>
          <SectionState
            section={docsSec}
            title={t('profile.locker.title')}
            empty={<p className="mt-3 text-sm text-gray-500">{t('profile.locker.empty')}</p>}
          >
            {(docs) => (
            <ul className="mt-3 flex flex-col gap-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                  <AppIcon name="file-text" className="w-4 h-4 shrink-0 text-navy/70" />
                  <span className="font-semibold text-navy flex-1 min-w-0 truncate">{d.name}</span>
                  <span className="hidden sm:inline text-xs text-gray-500 shrink-0">
                    {t('profile.locker.uploadedAt')} {new Date(d.uploadedAt).toLocaleDateString(i18n.language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => documents.open(d.id)}
                    className="btn-secondary h-8 px-3 text-xs shrink-0"
                  >
                    <AppIcon name="download" className="w-3.5 h-3.5" />
                    {t('profile.locker.download')}
                  </button>
                </li>
              ))}
            </ul>
            )}
          </SectionState>
          <label className="btn-primary w-full mt-4 cursor-pointer">
            <AppIcon name="upload" className="w-4 h-4" />
            {t('profile.locker.upload')}
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
        </div>

        <DataPrivacySecurityCard />
      </div>

      {/* Unified activity: bookings + leads + service requests, three
          independent sections. A service request could never appear here
          before — the card read two of the three tables a customer's activity
          lives in, and told them "nothing yet" regardless. */}
      <div className="card p-5 sm:p-6 mt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-navy">{t('profile.pipeline.title')}</h2>
          <Link to="/requests" className="btn-secondary h-8 px-3 text-xs shrink-0">
            <AppIcon name="inbox" className="w-3.5 h-3.5" />
            {t('nav.myRequests')}
          </Link>
        </div>
        <ActivityCard />
      </div>
    </div>
  );
}

export function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
