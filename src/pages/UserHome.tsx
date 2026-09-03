import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useJourney, journeyDesc, journeyTitle } from '../hooks/useJourney';
import { errorMessageKey } from '../lib/errors';
import { shortSummary } from '../lib/bookingSummary';
import { bookings as bookingsApi, notifications as notificationsApi, documents as documentsApi } from '../lib/api';
import { pickText } from '../data/services';
import { recommendedServiceIds } from '../data/serviceRecommend';
import { useCatalog } from '../data/catalogStore';
import { pickCity } from '../data/turkeyCities';
import { JOURNEY_TASK_KEYS } from '../lib/types';
import { Home, Layers, Building2, HeartPulse, Map } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ExpandableServiceCard } from '../components/ExpandableServiceCard';
import { NavBar } from '../components/ui/tubelight-navbar';
import { MobileTabBar } from '../components/MobileTabBar';
import { NewsSection } from '../components/sections/NewsSection';
import { RealEstateSection } from '../components/sections/RealEstateSection';
import { NotificationBell } from '../components/NotificationBell';
import { RafiqLoaderScreen } from '../components/RafiqLoader';
import { useIsMobile } from '../hooks/useIsMobile';
import type { AppNotification, Booking, JourneyItem, JourneyTaskKey, StoredDocument } from '../lib/types';
import { usePageMeta } from '../lib/seo';

/** The three tracked renewal dates on the profile, soonest first. */
const RENEWAL_KEYS = ['residence', 'insurance', 'passport'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The three "what happens now" rows — pure copy, no data behind them. */
const NEXT_ROWS = ['soon', 'week', 'after'] as const;

// Direct links to the main destinations, rendered as the "tubelight" <NavBar>
// (see components/ui/tubelight-navbar). PHONES ONLY — see the isMobile gate at
// the render site. On desktop these same destinations all live in Layout's top
// header (Home / Services / Real Estate / Medical Tourism / Map), so drawing the
// row again there was a duplicate second bar; phones hide that header for '/',
// so this row is their only in-page path to the sections.
//
// On phones the MobileTabBar already carries both "الرئيسية"/Home (leftmost
// tab) and "الخدمات"/Services along the bottom, so repeating either up here is
// pure duplication — items flagged `inMobileTabBar` are dropped. Home used to
// be kept deliberately, but that meant the lamp highlighted "Home" while
// already sitting on the home page — a "you are here" pointing at itself, with
// no way to actually leave via this row. Net phone set: Real Estate / Medical
// Tourism / Map / Services. /map MUST stay because signed-in users lose it from
// the bottom bar (that slot becomes "Requests"). The breakpoint is
// useIsMobile()'s 768px, which is also where <NavBar> switches labels→icons.
//
// Icons are lucide components (what <NavBar> expects); labels reuse existing
// home.quickLinks.* / nav.* copy so all four languages are covered.
const QUICK_NAV: { to: string; icon: LucideIcon; labelKey: string; inMobileTabBar?: boolean }[] = [
  { to: '/', icon: Home, labelKey: 'nav.home', inMobileTabBar: true },
  { to: '/services', icon: Layers, labelKey: 'home.quickLinks.allServices' },
  { to: '/real-estate', icon: Building2, labelKey: 'home.quickLinks.realEstate' },
  { to: '/health-tourism', icon: HeartPulse, labelKey: 'home.quickLinks.health' },
  { to: '/map', icon: Map, labelKey: 'home.quickLinks.map' },
];

/** Icons for the onboarding-answer chips, by journey task key. */
const HAS_ICONS: Record<JourneyTaskKey, IconName> = {
  turkishPhone: 'smartphone',
  taxNumber: 'receipt',
  residencePermit: 'id-card',
  bankAccount: 'landmark',
};

/** Neutral card for the authenticated product surface — uses the shared `.card` token
    so the signed-in dashboard matches quick links, BlockCard, and the rest of the app. */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card p-5 ${className}`}>{children}</section>;
}

/**
 * Dashed "invitation" panel. Replaces the old pattern of hiding a section when
 * it has no rows: an empty locker used to render nothing at all, which left the
 * first-session dashboard looking broken rather than new. Same slot, different
 * content, one action.
 *
 * `decoration` is an optional purely-visual overlay (see DateReminderGlyph)
 * rendered `absolute` so it never affects the card's height; when present the
 * text column reserves end-side padding so long translations don't run under it.
 */
function InvitePanel({
  icon,
  iconFilled = false,
  title,
  body,
  ctaLabel,
  ctaTo,
  className = '',
  decoration,
}: {
  icon: IconName;
  iconFilled?: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  className?: string;
  decoration?: React.ReactNode;
}) {
  return (
    <section className={`card border-dashed border-navy/25 bg-white/50 p-5 relative overflow-hidden ${className}`}>
      {decoration}
      <div className={decoration ? 'pe-24 sm:pe-44' : ''}>
        <span
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${
            iconFilled ? 'bg-brand-blue text-navy' : 'bg-cream-dark text-navy/70'
          }`}
        >
          <AppIcon name={icon} className="w-5 h-5" fill={iconFilled ? 'currentColor' : undefined} />
        </span>
        <h2 className="mt-3 font-extrabold text-navy">{title}</h2>
        <p className="mt-1 text-sm text-gray-500 leading-relaxed">{body}</p>
      </div>
      <Link to={ctaTo} className="btn-ghost w-full mt-4 min-h-[44px]">
        {ctaLabel}
      </Link>
    </section>
  );
}

/**
 * Decorative "reminds you 60 and 30 days ahead" illustration for the dates
 * invite card only — two overlapping calendar cards with a checkmark badge,
 * connected to a dot by a dashed line. Purely visual (aria-hidden), absolute
 * positioned at the inline-end corner so it sits top-right in LTR and
 * top-left in RTL automatically, and never adds to the card's height.
 */
function DateReminderGlyph() {
  return (
    <svg
      viewBox="0 0 170 112"
      aria-hidden
      className="pointer-events-none absolute top-3 end-3 w-24 sm:top-4 sm:end-4 sm:w-40"
    >
      <circle cx="8" cy="66" r="3" fill="#efeadb" stroke="#1a3a6b" strokeOpacity="0.25" />
      <path d="M14 66 L66 33" stroke="#1a3a6b" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />

      {/* back calendar: 60 */}
      <rect x="70" y="6" width="60" height="68" rx="10" fill="#faf8f0" stroke="#1a3a6b" strokeOpacity="0.3" />
      <path d="M70 24 H130" stroke="#1a3a6b" strokeOpacity="0.2" />
      <rect x="82" y="0" width="5" height="14" rx="2.5" fill="#1a3a6b" fillOpacity="0.45" />
      <rect x="113" y="0" width="5" height="14" rx="2.5" fill="#1a3a6b" fillOpacity="0.45" />
      <text x="100" y="56" textAnchor="middle" fontSize="24" fontWeight="800" fill="#1a3a6b">
        60
      </text>

      {/* front calendar: 30 */}
      <rect x="98" y="34" width="60" height="68" rx="10" fill="#ffffff" stroke="#1a3a6b" strokeOpacity="0.35" />
      <path d="M98 52 H158" stroke="#1a3a6b" strokeOpacity="0.2" />
      <rect x="110" y="28" width="5" height="14" rx="2.5" fill="#1a3a6b" fillOpacity="0.45" />
      <rect x="141" y="28" width="5" height="14" rx="2.5" fill="#1a3a6b" fillOpacity="0.45" />
      <text x="128" y="84" textAnchor="middle" fontSize="24" fontWeight="800" fill="#1a3a6b">
        30
      </text>

      {/* check badge */}
      <circle cx="150" cy="96" r="10" fill="#faf8f0" stroke="#1a3a6b" strokeOpacity="0.25" />
      <path
        d="M145.5 96 L148.5 99 L154.5 92.5"
        stroke="#1a3a6b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function StateCard({
  icon,
  title,
  body,
  ctaLabel,
  ctaTo,
  onCta,
}: {
  icon: 'user' | 'inbox' | 'alert-triangle' | 'lock';
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo?: string;
  onCta?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="card p-8">
        <span className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-brand-blue text-navy">
          <AppIcon name={icon} className="w-6 h-6" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-navy">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{body}</p>
        {ctaTo ? (
          <Link to={ctaTo} className="btn-primary w-full mt-6 min-h-[44px]">
            {ctaLabel}
          </Link>
        ) : (
          <button onClick={onCta} className="btn-primary w-full mt-6 min-h-[44px]">
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-pulse" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-28 rounded bg-gray-100" />
        </div>
      </div>
      <div className="mt-6 h-36 rounded-2xl bg-gray-100" />
      <div className="mt-4 h-24 rounded-2xl bg-gray-100" />
      <div className="mt-4 h-40 rounded-2xl bg-gray-100" />
    </div>
  );
}

/**
 * One row of the full roadmap. Every step is listed — including the ones still
 * far away — because seeing the whole path is what makes a brand-new user trust
 * that there IS a path. Steps the user already had when they answered onboarding
 * carry a "from your answers" badge, so the head start reads as credit for what
 * they told us rather than as progress they can't account for.
 */
function RoadRow({
  item,
  index,
  isNext,
  fromAnswers,
}: {
  item: JourneyItem;
  index: number;
  isNext: boolean;
  fromAnswers: boolean;
}) {
  const { t } = useTranslation();
  const done = item.status === 'done';
  return (
    <li className={`flex items-center gap-3 py-3 border-t border-cream-dark first:border-t-0 ${done || isNext ? '' : 'opacity-60'}`}>
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[11px] font-bold tabular-nums ${
          done || isNext ? 'bg-navy text-white' : 'border-2 border-cream-dark text-navy/40'
        }`}
        aria-hidden
      >
        {done ? <AppIcon name="check" className="w-3.5 h-3.5" /> : index + 1}
      </span>
      <span className={`flex-1 min-w-0 text-sm break-words ${done ? 'text-navy/50' : isNext ? 'font-semibold text-navy' : 'text-navy/80'}`}>
        {journeyTitle(t, item)}
      </span>
      {fromAnswers && (
        <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
          {t('dash.fromAnswers')}
        </span>
      )}
      {isNext && !fromAnswers && (
        <span className="shrink-0 text-[10px] font-bold text-navy bg-brand-blue rounded-full px-2 py-0.5">
          {t('journeyPage.nextLabel')}
        </span>
      )}
    </li>
  );
}

export function UserHome() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isMobile = useIsMobile();
  const { user, authLoading, profile } = useApp();
  const { items, state, errorCategory, progress, next, reload } = useJourney();
  // Live catalog, not the bundled SERVICES array: an admin's card image, edited
  // title or hidden flag has to reach this dashboard too, otherwise the same
  // service looks different here than on /services.
  const { services: catalogServices, categories: catalogCategories } = useCatalog();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [docs, setDocs] = useState<StoredDocument[] | null>(null);
  const [showAllRecap, setShowAllRecap] = useState(false);
  const [roadExpanded, setRoadExpanded] = useState(false);

  usePageMeta({
    title: `${t('dash.journeyTitle')} — ${t('common.appName')}`,
    description: t('journeyPage.subtitle'),
  });

  // Secondary panels — each loads independently and simply stays hidden on
  // failure, so they can never take the dashboard down with them. `docs` starts
  // as null (unknown) so the locker invite doesn't flash before the fetch lands.
  useEffect(() => {
    if (!user) return;
    bookingsApi.mine().then((b) => setMyBookings(b.slice(0, 3))).catch(() => {});
    notificationsApi.list().then((n) => setNotifs(n.filter((x) => !x.read).slice(0, 3))).catch(() => {});
    documentsApi.list().then(setDocs).catch(() => setDocs(null));
  }, [user]);

  // ---- session still resolving ----------------------------------------------
  if (authLoading) {
    return <RafiqLoaderScreen />;
  }

  const withBar = (node: React.ReactNode) => (
    <>
      {node}
      {isMobile && <MobileTabBar />}
    </>
  );

  // ---- signed out -----------------------------------------------------------
  if (!user) {
    return withBar(
      <StateCard
        icon="lock"
        title={t('dash.guestTitle')}
        body={t('dash.guestBody')}
        ctaLabel={t('dash.guestCta')}
        ctaTo="/auth"
      />,
    );
  }

  if (state === 'loading') return withBar(<Skeleton />);

  if (state === 'error') {
    return withBar(
      <StateCard
        icon="alert-triangle"
        title={t('dash.errorTitle')}
        body={t(errorMessageKey(errorCategory ?? 'unknown_error'))}
        ctaLabel={t('dash.retry')}
        onCta={reload}
      />,
    );
  }

  if (state === 'empty') {
    return withBar(
      <StateCard
        icon="inbox"
        title={t('dash.emptyTitle')}
        body={t('dash.emptyBody')}
        ctaLabel={t('dash.emptyCta')}
        onCta={reload}
      />,
    );
  }

  const firstName = (user.name || '').split(' ')[0];
  const situationLabel = profile.situation ? t(`situationStatus.${profile.situation}`) : '';
  const cityLabel = profile.city ? pickCity(profile.city, lang) : '';

  // The onboarding answers, rendered back as chips. Without this the user has
  // no evidence the four questions produced anything — the single worst thing
  // that can happen right after a questionnaire.
  const answeredHas = JOURNEY_TASK_KEYS.filter((k) => profile.has[k]);
  const hasRecap = Boolean(profile.situation || cityLabel || answeredHas.length);

  const recapChips = [
    situationLabel
      ? {
          key: 'situation',
          node: (
            <span key="situation" className="inline-flex items-center gap-1.5 rounded-full border border-cream-dark bg-white px-3 py-1 text-xs font-semibold text-navy">
              {situationLabel}
            </span>
          ),
        }
      : null,
    cityLabel
      ? {
          key: 'city',
          node: (
            <span key="city" className="inline-flex items-center gap-1.5 rounded-full border border-cream-dark bg-white px-3 py-1 text-xs font-semibold text-navy">
              <AppIcon name="map-pin" className="w-3.5 h-3.5" aria-hidden />
              {cityLabel}
            </span>
          ),
        }
      : null,
    ...answeredHas.map((k) => ({
      key: k,
      node: (
        <span
          key={k}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
        >
          <AppIcon name={HAS_ICONS[k]} className="w-3.5 h-3.5" aria-hidden />
          {t(`journeyTasks.${k}.title`)}
        </span>
      ),
    })),
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  // A step counts as "credited from your answers" when onboarding pre-marked it.
  const isFromAnswers = (item: JourneyItem) =>
    item.status === 'done' &&
    (JOURNEY_TASK_KEYS as readonly string[]).includes(item.taskKey) &&
    profile.has[item.taskKey as JourneyTaskKey];

  // Facts under the anchor block are editorial per task key; a server-defined
  // task with no copy simply renders no facts rather than empty boxes.
  const nextDuration = next ? t(`journeyTasks.${next.taskKey}.duration`, { defaultValue: '' }) : '';
  const nextCost = next ? t(`journeyTasks.${next.taskKey}.cost`, { defaultValue: '' }) : '';
  const nextFacts = next
    ? [
        nextDuration ? { label: t('dash.factDuration'), value: nextDuration } : null,
        nextCost ? { label: t('dash.factCost'), value: nextCost } : null,
        { label: t('dash.factRemaining'), value: String(progress.remaining) },
      ].filter((f): f is { label: string; value: string } => Boolean(f))
    : [];

  // The city-aware "before you sign a lease" tip points at one specific
  // service (notarized rental contracts), not the whole catalogue.
  const rentalContractService = catalogServices.find((s) => s.id === 're-contracts');
  const cityTipHref = rentalContractService
    ? `/services?q=${encodeURIComponent(pickText(rentalContractService.title, lang))}`
    : '/services';

  // Which services to feature. The answer-driven matcher (serviceRecommend.ts)
  // is preferred whenever it has an opinion — a student, today — because it maps
  // the onboarding answers to the catalog directly. It falls back to the
  // journey-derived services (an item's relatedServiceId) for everyone else, so
  // no persona loses its rail. Both go through the live catalog, so a hidden or
  // renamed card behaves the same here as on /services.
  const recommendedServices = recommendedServiceIds(profile)
    .map((id) => catalogServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const journeyServices = items
    .map((i) => catalogServices.find((s) => s.id === i.relatedServiceId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  // Was capped to 3 and rendered near the very bottom of the dashboard, so a
  // user who signed in specifically to find "my service" had to scroll past the
  // journey road, renewals and the document locker to reach three cards. The
  // rail now sits directly under the single next action (see below) and shows
  // up to 6 — enough to actually cover a persona's needs without a full browse.
  const relatedServices = (recommendedServices.length > 0 ? recommendedServices : journeyServices).slice(0, 6);

  const renewals = RENEWAL_KEYS
    .map((key) => ({ key, date: profile.renewals[key] }))
    .filter((r): r is { key: (typeof RENEWAL_KEYS)[number]; date: string } => Boolean(r.date))
    .map((r) => ({ ...r, days: Math.ceil((new Date(r.date).getTime() - Date.now()) / DAY_MS) }))
    .sort((a, b) => a.days - b.days);

  const started = progress.done > 0;
  const roadComplete = progress.total > 0 && progress.done === progress.total;

  return withBar(
    <div className={`mx-auto max-w-3xl px-4 py-8 ${isMobile ? 'pb-28' : ''}`}>
      {/* header */}
      <header className="flex items-start gap-3">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-navy text-white font-extrabold shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            (firstName[0] ?? 'R').toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-navy truncate">{t('dash.greeting', { name: firstName })}</h1>
          {(situationLabel || cityLabel) && (
            <p className="text-sm text-gray-500 truncate">
              {[situationLabel, cityLabel].filter(Boolean).join(' · ')}
            </p>
          )}
          {/* Progress reads as a promise, not a failure, before the first step:
              "0%" on a first visit is discouraging and says nothing. */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-cream-dark overflow-hidden">
              <div className="h-full bg-navy transition-all duration-700" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {started
                ? t('dash.doneOf', { done: progress.done, total: progress.total })
                : t('dash.stepsWaiting', { count: progress.total })}
            </span>
          </div>
        </div>
        {/* Bell is desktop-chrome on the signed-in dashboard: the top site
            header (Layout) already carries a NotificationBell there, so a second
            one here was a visible duplicate. On phones the Layout header is
            hidden for '/', so this stays the ONLY bell — hence isMobile-gated. */}
        {isMobile && <NotificationBell size={38} className="shrink-0" />}
      </header>

      {/* ── quick nav: the "tubelight" pill. Phones only. On desktop this row
          duplicated the top site nav (Home / Services / Real Estate / Medical
          Tourism / Map all live in Layout's header there), so it's dropped;
          phones hide that header for '/', so the row is their only in-page way
          to reach the sections. Home is dropped on phones too (it's already
          the leftmost tab in the bottom MobileTabBar) — see QUICK_NAV. ── */}
      {isMobile && (
        <NavBar
          variant="inline"
          className="mt-4"
          items={QUICK_NAV.filter((q) => !q.inMobileTabBar).map((q) => ({
            name: t(q.labelKey),
            url: q.to,
            icon: q.icon,
          }))}
        />
      )}

      {/* ── proof that the onboarding answers produced something ──
          Capped to 3 chips by default (was showing up to 6 — situation, city
          + 4 has-items — and the card grew tall/wrapped on narrow phones).
          The rest sit behind a "show more" toggle instead of being cut. */}
      {hasRecap && (
        <div className="mt-5 rounded-card border border-cream-dark bg-navy/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <AppIcon name="sparkles" className="w-4 h-4 text-navy/40 shrink-0" aria-hidden />
            <span className="text-xs font-semibold text-navy/60">{t('dash.recapTitle')}</span>
            {(showAllRecap ? recapChips : recapChips.slice(0, 3)).map((chip) => chip.node)}
            {recapChips.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllRecap((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-cream-dark bg-white px-3 py-1 text-xs font-semibold text-navy/60 hover:text-navy"
              >
                {showAllRecap ? t('dash.recapShowLess') : t('dash.recapShowMore', { count: recapChips.length - 3 })}
              </button>
            )}
            <Link to="/onboarding?edit=1" className="ms-auto text-xs font-semibold text-navy/60 hover:text-navy">
              {t('dash.editAnswers')}
            </Link>
          </div>
        </div>
      )}

      {/* ── the single next action ── */}
      {next && (
        <section className="relative mt-4 overflow-hidden rounded-card bg-navy p-5 text-white">
          <span
            className="pointer-events-none absolute -top-24 -end-20 h-72 w-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,.09), transparent 62%)' }}
            aria-hidden
          />
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            {started ? t('dash.nextTitle') : t('dash.startHere')}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold leading-snug">{journeyTitle(t, next)}</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">{journeyDesc(t, next)}</p>

          {nextFacts.length > 0 && (
            <div className="mt-4 flex border-t border-white/15 pt-3">
              {nextFacts.map((f, i) => (
                <div key={f.label} className={`flex-1 ${i ? 'border-s border-white/15 ps-4' : ''}`}>
                  <b className="block text-lg font-bold">{f.value}</b>
                  <span className="text-[11px] text-white/60">{f.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Equal-width (flex-1), not content-sized: two unevenly-sized
              buttons left a big dead gap after the short one on narrow
              screens, and "اسأل رفيق..." alone was wide enough to force a
              wrap to a second row. Both read as "too big / too much empty
              space" from the same root cause. */}
          <div className="mt-4 flex gap-2">
            <Link
              to={next.relatedRoute || '/journey'}
              className="btn h-auto min-h-[44px] flex-1 whitespace-normal px-3 text-center bg-white text-navy hover:bg-brand-blue"
            >
              {t('journeyPage.openService')}
              <DirArrow />
            </Link>
            <Link
              to={`/premium?step=${encodeURIComponent(next.taskKey)}`}
              className="btn h-auto min-h-[44px] flex-1 gap-1.5 whitespace-normal px-3 text-center border border-white/30 text-white hover:bg-white/10"
            >
              <AppIcon name="message-circle" className="w-4 h-4 shrink-0" />
              {t('dash.askAboutStep')}
            </Link>
          </div>
        </section>
      )}

      {/* ── "خدمات تهمّك": the services matched to the onboarding answers.
          Deliberately placed HIGH — right under the single next action — so a
          user who signed in to find their service sees it without scrolling
          past the journey road, renewals and the document locker. Compact→
          detail expandable card, ported 1:1 from the user's mockup (see
          ExpandableServiceCard.tsx/.css). ── */}
      {relatedServices.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-gray-900">{t('dash.services')}</h2>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-md px-1.5 py-0.5">
                {relatedServices.length}
              </span>
            </div>
            <Link to="/services" aria-label={t('nav.allServices')} className="text-lg leading-none text-gray-400 hover:text-gray-600">
              +
            </Link>
          </div>

          <ul className="mt-3.5 flex flex-col gap-3">
            {relatedServices.map((s, i) => {
              const category = catalogCategories.find((c) => c.id === s.category);
              return (
                <li key={s.id}>
                  <ExpandableServiceCard service={s} index={i} categoryTitle={category ? pickText(category.title, lang) : ''} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── city-aware note: we know where they live, so use it ── */}
      {cityLabel && (
        <Panel className="mt-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-cream-dark text-navy/70 shrink-0">
              <AppIcon name="map-pin" className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-extrabold text-navy">{t('dash.cityTitle', { city: cityLabel })}</h2>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{t('dash.cityBody')}</p>
            </div>
          </div>
          {/* Was a generic /services link — landed on the full unfiltered
              catalogue instead of the notarized-rental-contract service the
              "before you sign a lease" copy above is actually about. Services
              is searched by title text (see Services.tsx), same pattern the
              relatedServices block below already uses. */}
          <Link to={cityTipHref} className="btn-ghost mt-4 min-h-[44px]">
            {t('dash.cityCta')}
            <DirArrow />
          </Link>
        </Panel>
      )}

      {/* ── the whole road, not a 3-item preview — except once every step is
          done, the full list is just a wall of checkmarks nobody needs to
          re-scan. Collapse to a one-line summary behind "show details", styled
          as a compact banner with a "N steps" badge and the trip flat-lay
          photo. The section stays flat-colored (no gradient) on purpose: the
          photo itself carries a baked-in alpha fade on both edges (see the
          journey-complete-flatlay generation), so it blends into whatever's
          behind it with no separate color to keep in sync — a gradient
          section background previously drifted out of step with a flat CSS
          fade overlay and showed as a visible seam. ── */}
      <section className="card relative mt-4 overflow-hidden bg-cream p-4">
        <Link
          to="/journey"
          className="absolute top-3 end-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy/70 shadow-sm hover:bg-white hover:text-navy"
        >
          {t('dash.stepsCount', { count: progress.total })}
        </Link>
        <div className={roadComplete && !roadExpanded ? 'max-w-[60%] sm:max-w-[55%]' : 'pe-16'}>
          <h2 className="font-extrabold text-navy">{t('dash.roadTitle')}</h2>
          {roadComplete && !roadExpanded ? (
            <>
              <p className="mt-1.5 text-sm font-bold text-emerald-700">
                {t('dash.roadAllDone', { count: progress.total })}
              </p>
              <button
                type="button"
                onClick={() => setRoadExpanded(true)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy/60 hover:text-navy"
              >
                {t('dash.roadShowDetails')}
                <AppIcon name="chevron-down" className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">{t('dash.roadBody')}</p>
              <ul className="mt-3 flex flex-col">
                {items.map((item, i) => (
                  <RoadRow
                    key={item.id}
                    item={item}
                    index={i}
                    isNext={next?.id === item.id}
                    fromAnswers={isFromAnswers(item)}
                  />
                ))}
              </ul>
              {roadComplete && (
                <button
                  type="button"
                  onClick={() => setRoadExpanded(false)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy/60 hover:text-navy"
                >
                  {t('dash.roadShowLess')}
                  <AppIcon name="chevron-down" className="w-3.5 h-3.5 rotate-180" />
                </button>
              )}
            </>
          )}
        </div>
        {roadComplete && !roadExpanded && (
          // Plain <img>, not <SiteImage>: that component's wrapper always
          // paints a bg-navy/5 loading placeholder behind the photo, which
          // bled through this photo's baked-in alpha fade and reintroduced
          // the color-mismatch seam we were trying to remove. The photo's
          // own fade degrades fine without SiteImage's fallback machinery.
          <div className="pointer-events-none absolute end-0 top-0 h-full w-[42%] sm:w-[38%] overflow-hidden">
            <img
              src="/img/journey-complete-flatlay.webp"
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </section>

      {/* ── what happens now: the new user's real question is "and then?" ── */}
      <Panel className="mt-4">
        <h2 className="font-extrabold text-navy">{t('dash.whatNowTitle')}</h2>
        <ul className="mt-3 flex flex-col">
          {NEXT_ROWS.map((k) => (
            <li key={k} className="flex gap-4 py-3 border-t border-cream-dark first:border-t-0">
              <span className="w-20 shrink-0 text-xs font-semibold text-navy/40 pt-0.5">
                {t(`dash.whatNow.${k}.when`)}
              </span>
              <span className="min-w-0">
                <b className="block text-sm font-semibold text-navy">{t(`dash.whatNow.${k}.title`)}</b>
                <span className="block text-sm text-gray-500 leading-relaxed">{t(`dash.whatNow.${k}.body`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ── upcoming renewals, or the invitation to set them ── */}
      {renewals.length > 0 ? (
        <Panel className="mt-4">
          <h2 className="font-extrabold text-navy">{t('dash.renewalsTitle')}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {renewals.map((r) => (
              <li
                key={r.key}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  r.days <= 0
                    ? 'border-brand-red/40 bg-brand-red/5'
                    : r.days <= 30
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-cream-dark bg-white'
                }`}
              >
                <AppIcon name={r.days <= 30 ? 'alert-triangle' : 'calendar'} className="w-4 h-4 shrink-0 text-navy/60" />
                <span className="flex-1 min-w-0 text-sm font-semibold text-navy break-words">
                  {t(`dash.renewalLabels.${r.key}`)}
                </span>
                <span className={`text-xs font-bold shrink-0 ${r.days <= 0 ? 'text-brand-red' : 'text-navy/60'}`}>
                  {r.days <= 0 ? t('dash.renewalOverdue') : t('dash.renewalIn', { count: r.days })}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/profile#renewals" className="btn-ghost w-full mt-4 min-h-[44px]">
            {t('dash.renewalsManage')}
          </Link>
        </Panel>
      ) : (
        <InvitePanel
          className="mt-4"
          icon="calendar"
          title={t('dash.noDatesTitle')}
          body={t('dash.noDatesBody')}
          ctaLabel={t('dash.noDatesCta')}
          ctaTo="/profile#renewals"
          decoration={<DateReminderGlyph />}
        />
      )}

      {/* ── document locker: real count, or the invitation to start it ── */}
      {docs !== null &&
        (docs.length > 0 ? (
          <Panel className="mt-4">
            <div className="flex items-center justify-center py-4">
              <span
                className="text-2xl font-extrabold text-navy sm:text-3xl"
                style={{ textShadow: '0 6px 18px rgba(26, 58, 107, 0.35)' }}
              >
                {t('dash.lockerTitle')}
              </span>
            </div>
            <Link to="/profile#locker" className="btn-ghost w-full mt-1 min-h-[44px]">
              {t('dash.lockerManage')}
            </Link>
          </Panel>
        ) : (
          <InvitePanel
            className="mt-4"
            icon="folder"
            iconFilled
            title={t('dash.noDocsTitle')}
            body={t('dash.noDocsBody')}
            ctaLabel={t('dash.noDocsCta')}
            ctaTo="/profile#locker"
          />
        ))}

      {/* ── everything below only renders once there is something real ── */}
      {myBookings.length > 0 && (
        <Panel className="mt-4">
          <h2 className="font-extrabold text-navy">{t('dash.bookingsTitle')}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {myBookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-cream-dark bg-white px-3 py-2.5">
                <AppIcon name="calendar" className="w-4 h-4 shrink-0 text-navy/60" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{shortSummary(b.problemSummary)}</p>
                  <p className="text-xs text-gray-500" dir="ltr">
                    {new Date(b.preferredDatetime).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-navy bg-brand-blue rounded-full px-2 py-0.5 shrink-0">
                  {t(`adminBookings.statuses.${b.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {notifs.length > 0 && (
        <Panel className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-extrabold text-navy">{t('dash.notifTitle')}</h2>
            <Link to="/notifications" className="text-sm font-semibold text-navy hover:underline">
              {t('dash.viewAll')}
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {notifs.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-xl border border-cream-dark bg-white px-3 py-2.5">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-red shrink-0" aria-hidden />
                <p className="flex-1 min-w-0 text-sm text-navy break-words">
                  {n.key === 'custom' ? n.customText : t(`notifications.${n.key}.title`)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* real-estate entry point — was missing here entirely, so signed-in
          users never saw the listings/investments rail that guests get on
          the public home page. Hides itself when there are no listings. */}
      <RealEstateSection compact className="mt-8" />

      {/* latest news (mirrors the Telegram channel; hidden until posts exist) */}
      <NewsSection compact className="mt-8" />

      {/* ادعُ واربح — the page's closing section, right after the guides. */}
      <Panel className="mt-4 border-gold-dark/30 bg-gold-soft/40">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gold-soft text-gold-dark shrink-0">
            <AppIcon name="gift" className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-extrabold text-navy">{t('referrals.title')}</h2>
            <p className="mt-1 text-sm text-navy/70">{t('referrals.subtitle')}</p>
          </div>
        </div>
        <Link to="/referrals" className="btn-primary mt-4 min-h-[44px]">
          {t('dash.referralCta')}
          <DirArrow />
        </Link>
      </Panel>
    </div>
  );
}
