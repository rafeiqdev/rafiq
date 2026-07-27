import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { bookings, documents, leads } from '../../lib/api';
import type { Booking, Lead, StoredDocument } from '../../lib/types';
import { pickCity } from '../../data/turkeyCities';
import { AppIcon } from '../../components/AppIcon';
import { RequireAuth } from '../../components/Gates';
import { SiteImage } from '../../components/SiteImage';
import { ISTANBUL } from '../../lib/images';
import { MobileTabBar } from '../../components/MobileTabBar';

// ── helpers (verbatim from desktop ProfilePage.tsx) ──
function isoToDisplay(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}
function displayToIso(v: string): string | undefined {
  const digits = v.replace(/\D/g, '').slice(0, 8); // DDMMYYYY
  if (digits.length < 8) return undefined;
  const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8);
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
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/** Controlled DD/MM/YYYY field — reformats with "/" separators on every keystroke. */
function RenewalDateInput({
  iso,
  label,
  onChangeIso,
}: {
  iso?: string;
  label: string;
  onChangeIso: (iso: string | undefined) => void;
}) {
  const [text, setText] = useState(() => isoToDisplay(iso));

  useEffect(() => {
    setText(isoToDisplay(iso));
  }, [iso]);

  return (
    <input
      type="text"
      inputMode="numeric"
      dir="ltr"
      placeholder="DD/MM/YYYY"
      value={text}
      onChange={(e) => {
        const formatted = formatDateInput(e.target.value);
        setText(formatted);
        onChangeIso(displayToIso(formatted));
      }}
      aria-label={label}
      className="input mt-2.5 h-12 w-full text-[15px]"
    />
  );
}

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

function MobileProfileInner() {
  const { t, i18n } = useTranslation();
  const { user, profile, updateProfile, signOut } = useApp();
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [showAllPipeline, setShowAllPipeline] = useState(false);

  useEffect(() => {
    if (!user) return;
    documents.list().then(setDocs).catch(() => {});
    bookings.mine().then(setMyBookings).catch(() => {});
    leads.mine().then(setMyLeads).catch(() => {});
  }, [user]);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

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
    setDocs(await documents.list());
  };

  const renewalRows = (['residence', 'insurance', 'passport'] as const).map((k) => ({
    key: k, date: profile.renewals[k], days: daysUntil(profile.renewals[k]),
  }));

  // Show only the first 2 transactions by default — a handful of bookings/
  // leads used to render as one long, heavy-looking list on every visit.
  const pipelineTotal = myBookings.length + myLeads.length;
  const visibleBookings = showAllPipeline ? myBookings : myBookings.slice(0, 2);
  const visibleLeads = showAllPipeline ? myLeads : myLeads.slice(0, Math.max(0, 2 - visibleBookings.length));
  const hasMorePipeline = !showAllPipeline && pipelineTotal > 2;

  const statRows = [
    { label: t('account.situation'), value: profile.situation ? t(`situationStatus.${profile.situation}`) : t('account.notSet') },
    { label: t('account.city'), value: profile.city ? pickCity(profile.city, i18n.language) : t('account.notSet') },
    { label: t('account.onboardingStatus'), value: user?.onboardingCompleted ? t('account.completed') : t('account.notCompleted') },
  ];

  const personaRows = [
    { label: t('profile.persona.path'), value: profile.path ? t(`onboarding.q1.${profile.path}.title`) : '—' },
    { label: t('profile.persona.reason'), value: profile.reason ? t(`onboarding.q2.${profile.reason}.title`) : '—' },
    { label: t('profile.persona.family'), value: profile.family ? t(`common.${profile.family}`) : '—' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Tab-root header: real photo, heavy navy overlay (identity, not hero) ── */}
        <header className="relative animate-fade-in overflow-hidden rounded-b-[28px] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {/* SiteImage's own root is `relative` — it must be positioned by a wrapper,
              exactly as PageHero does it, or the photo drops into the flow. */}
          <div className="absolute inset-0">
            <SiteImage src={ISTANBUL.bosphorus} alt="" className="h-full w-full" />
          </div>
          <div className="absolute inset-0 bg-navy/85" aria-hidden />
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <div className="relative flex items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-white">{t('profile.title')}</h1>
            <button
              onClick={() => signOut()}
              className="min-h-[44px] rounded-btn border border-white/35 px-4 text-[13px] font-semibold text-white transition-colors active:bg-white/15"
            >
              {t('common.signOut')}
            </button>
          </div>
          <div className="animate-fade-up relative mt-4 flex items-center gap-3.5">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-[60px] w-[60px] shrink-0 rounded-full border-2 border-white/35 object-cover" />
            ) : (
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-2 border-white/35 bg-white/15 text-2xl font-extrabold text-white">
                {(user?.name?.[0] ?? 'R').toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold text-white">{user?.name}</p>
              <p className="mt-0.5 break-all text-start text-[12.5px] text-white/70" dir="ltr">{user?.email}</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4 px-5 pt-5">
          {/* ── 2. Account summary ── */}
          <section className="card animate-fade-up p-5">
            <div className="flex flex-col gap-2.5">
              {statRows.map((r) => (
                <div key={r.label} className="flex min-h-9 items-center justify-between gap-3">
                  <span className="shrink-0 text-[12.5px] text-navy/55">{r.label}</span>
                  <span className="min-w-0 text-end text-[13.5px] font-bold text-navy">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link to="/journey" className="btn-primary flex min-h-[50px] w-full text-[14.5px]">
                <AppIcon name="check-circle" className="h-[17px] w-[17px]" />
                {t('account.myJourney')}
              </Link>
              <Link to="/onboarding?edit=1" className="btn-secondary flex min-h-[50px] w-full text-[14.5px]">
                <AppIcon name="pencil" className="h-4 w-4" />
                {t('account.editAnswers')}
              </Link>
            </div>
            <p className="mt-3.5 text-center text-xs text-navy/50">
              <Link to="/terms" className="underline">{t('nav.terms')}</Link>
              {' · '}
              <Link to="/privacy" className="underline">{t('nav.privacy')}</Link>
            </p>
          </section>

          {/* ── 3. Persona ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('profile.persona.title')}</h2>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {personaRows.map((r) => (
                <div key={r.label} className="flex min-h-8 items-center justify-between gap-3">
                  <span className="shrink-0 text-[12.5px] text-navy/55">{r.label}</span>
                  <span className="min-w-0 text-end text-[13.5px] font-bold text-navy">{r.value}</span>
                </div>
              ))}
            </div>
            {/* Was a "wipe the answers and re-open the modal" trigger; it now
                leads to the same /onboarding page, pre-filled. */}
            <Link to="/onboarding?edit=1" className="btn-secondary mt-4 flex min-h-[50px] w-full text-[14.5px]">
              <AppIcon name="pencil" className="h-4 w-4" />
              {t('profile.persona.edit')}
            </Link>
          </section>

          {/* ── 4. Checklist ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('profile.checklist.title')}</h2>
            <p className="mt-1.5 text-[12.5px] text-navy/55">
              {t('profile.checklist.progress', { done, total: hasItems.length })}
            </p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-cream-dark">
              <div
                className="h-full rounded-full bg-navy transition-all"
                style={{ width: `${(done / hasItems.length) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex flex-col">
              {hasItems.map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => updateProfile({ has: { ...profile.has, [k]: !v } })}
                  className="flex min-h-[52px] w-full items-center gap-3 border-b border-cream-dark/60 px-1 text-start transition-colors last:border-b-0 active:bg-cream"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] ${
                      v ? 'bg-navy' : 'border-2 border-navy/35'
                    }`}
                  >
                    {v && <AppIcon name="check" className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <span className={`min-w-0 text-sm font-semibold ${v ? 'text-navy/60 line-through' : 'text-navy'}`}>
                    {t(`onboarding.q3.${k}.title`)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ── 5. Renewal tracker ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('profile.renewals.title')}</h2>
            <div className="mt-3.5 flex flex-col gap-4">
              {renewalRows.map((r, i) => (
                <div key={r.key} className={i < renewalRows.length - 1 ? 'border-b border-cream-dark pb-4' : ''}>
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-[13.5px] font-bold text-navy">{t(`profile.renewals.${r.key}`)}</span>
                    <span
                      className={`min-w-0 text-end text-xs font-bold ${
                        !r.date
                          ? 'text-navy/45'
                          : (r.days ?? 0) < 0
                            ? 'text-brand-red'
                            : (r.days ?? 0) < 30
                              ? 'text-amber-700'
                              : 'text-green-700'
                      }`}
                    >
                      {!r.date
                        ? t('profile.renewals.noDate')
                        : (r.days ?? 0) < 0
                          ? t('profile.renewals.expired')
                          : `${t('profile.renewals.daysLeft', { count: r.days ?? 0 })} · ${new Date(r.date).toLocaleDateString(i18n.language)}`}
                    </span>
                  </div>
                  <RenewalDateInput
                    iso={r.date}
                    label={t('profile.renewals.set')}
                    onChangeIso={(iso) => updateProfile({ renewals: { ...profile.renewals, [r.key]: iso } })}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── 6. Document locker ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('profile.locker.title')}</h2>
            {docs.length === 0 ? (
              <p className="mt-3 text-[13px] text-gray-500">{t('profile.locker.empty')}</p>
            ) : (
              <div className="mt-3.5 flex flex-col gap-2.5">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-btn border border-cream-dark bg-cream px-3.5 py-3">
                    <AppIcon name="file-text" className="h-[18px] w-[18px] shrink-0 text-navy/60" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-navy">{d.name}</p>
                      <p className="mt-px text-[11.5px] text-navy/50">{new Date(d.uploadedAt).toLocaleDateString(i18n.language)}</p>
                    </div>
                    <button
                      onClick={() => documents.open(d.id)}
                      className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] bg-brand-blue px-3 text-xs font-bold text-navy"
                    >
                      <AppIcon name="download" className="h-3.5 w-3.5" />
                      {t('profile.locker.download')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="btn-primary mt-3.5 flex min-h-[50px] w-full cursor-pointer text-[14.5px]">
              <AppIcon name="upload" className="h-[17px] w-[17px]" />
              {t('profile.locker.upload')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
          </section>

          {/* ── 7. Pipeline ── */}
          <section className="card animate-fade-up p-5">
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="text-[15px] font-extrabold text-navy">{t('profile.pipeline.title')}</h2>
              <Link to="/requests" className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] bg-brand-blue px-3 text-xs font-bold text-navy">
                <AppIcon name="inbox" className="h-3.5 w-3.5" />
                {t('nav.myRequests')}
              </Link>
            </div>
            {myBookings.length === 0 && myLeads.length === 0 ? (
              <p className="mt-3 text-[13px] text-gray-500">{t('profile.pipeline.empty')}</p>
            ) : (
              <>
                <div className="mt-3.5 flex flex-col gap-2.5">
                  {visibleBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 rounded-btn border border-cream-dark bg-cream px-3.5 py-3">
                      <AppIcon name="calendar" className="h-[18px] w-[18px] shrink-0 text-navy/60" />
                      <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-navy">{b.problemSummary}</p>
                      <span className="shrink-0 rounded-full bg-brand-blue px-2.5 py-0.5 text-[10.5px] font-bold text-navy">
                        {t(`adminBookings.statuses.${b.status}`)}
                      </span>
                    </div>
                  ))}
                  {visibleLeads.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 rounded-btn border border-cream-dark bg-cream px-3.5 py-3">
                      <AppIcon name="mail" className="h-[18px] w-[18px] shrink-0 text-navy/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-navy">
                          {t(`leads.kind.${l.kind}`)} — {l.item}
                        </p>
                        <p className="mt-px text-[11.5px] text-navy/50">{new Date(l.createdAt).toLocaleDateString(i18n.language)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMorePipeline && (
                  <button
                    type="button"
                    onClick={() => setShowAllPipeline(true)}
                    className="btn btn-secondary mt-3 min-h-[48px] w-full text-[13.5px]"
                  >
                    {t('common.viewAll')} ({pipelineTotal - 2}+)
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}

export function MobileProfilePage() {
  return (
    <RequireAuth>
      <MobileProfileInner />
    </RequireAuth>
  );
}
