import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useJourney, journeyDesc, journeyTitle } from '../hooks/useJourney';
import { errorMessageKey } from '../lib/errors';
import { shortSummary } from '../lib/bookingSummary';
import { bookings as bookingsApi, notifications as notificationsApi, documents as documentsApi } from '../lib/api';
import { SERVICES, pickText } from '../data/services';
import { pickCity } from '../data/turkeyCities';
import { JOURNEY_TASK_KEYS } from '../lib/types';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { MobileTabBar } from '../components/MobileTabBar';
import { NewsSection } from '../components/sections/NewsSection';
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

/** Icons for the onboarding-answer chips, by journey task key. */
const HAS_ICONS: Record<JourneyTaskKey, IconName> = {
  turkishPhone: 'smartphone',
  taxNumber: 'receipt',
  residencePermit: 'id-card',
  bankAccount: 'landmark',
};

/** Neutral card for the authenticated product surface (white + hairline). */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>{children}</section>;
}

/**
 * Dashed "invitation" panel. Replaces the old pattern of hiding a section when
 * it has no rows: an empty locker used to render nothing at all, which left the
 * first-session dashboard looking broken rather than new. Same slot, different
 * content, one action.
 */
function InvitePanel({
  icon,
  title,
  body,
  ctaLabel,
  ctaTo,
  className = '',
}: {
  icon: IconName;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-dashed border-navy/25 bg-white/50 p-5 ${className}`}>
      <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-cream-dark text-navy/70">
        <AppIcon name={icon} className="w-5 h-5" />
      </span>
      <h2 className="mt-3 font-extrabold text-navy">{title}</h2>
      <p className="mt-1 text-sm text-gray-500 leading-relaxed">{body}</p>
      <Link to={ctaTo} className="btn-ghost w-full mt-4 min-h-[44px]">
        {ctaLabel}
      </Link>
    </section>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-8">
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
    <li className={`flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0 ${done || isNext ? '' : 'opacity-60'}`}>
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[11px] font-bold tabular-nums ${
          done || isNext ? 'bg-navy text-white' : 'border-2 border-gray-200 text-gray-400'
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
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [docs, setDocs] = useState<StoredDocument[] | null>(null);

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

  const relatedServices = items
    .map((i) => SERVICES.find((s) => s.id === i.relatedServiceId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .slice(0, 3);

  const renewals = RENEWAL_KEYS
    .map((key) => ({ key, date: profile.renewals[key] }))
    .filter((r): r is { key: (typeof RENEWAL_KEYS)[number]; date: string } => Boolean(r.date))
    .map((r) => ({ ...r, days: Math.ceil((new Date(r.date).getTime() - Date.now()) / DAY_MS) }))
    .sort((a, b) => a.days - b.days);

  const started = progress.done > 0;

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
        <NotificationBell size={38} className="shrink-0" />
      </header>

      {/* ── proof that the onboarding answers produced something ── */}
      {hasRecap && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-navy/[0.03] px-4 py-3">
          <AppIcon name="sparkles" className="w-4 h-4 text-navy/40 shrink-0" aria-hidden />
          <span className="text-xs font-semibold text-gray-500">{t('dash.recapTitle')}</span>
          {situationLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-navy">
              {situationLabel}
            </span>
          )}
          {cityLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-navy">
              <AppIcon name="map-pin" className="w-3.5 h-3.5" aria-hidden />
              {cityLabel}
            </span>
          )}
          {answeredHas.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
            >
              <AppIcon name={HAS_ICONS[k]} className="w-3.5 h-3.5" aria-hidden />
              {t(`journeyTasks.${k}.title`)}
            </span>
          ))}
          <Link to="/onboarding" className="ms-auto text-xs font-semibold text-navy/60 hover:text-navy">
            {t('dash.editAnswers')}
          </Link>
        </div>
      )}

      {/* ── the single next action ── */}
      {next && (
        <section className="relative mt-4 overflow-hidden rounded-2xl bg-navy p-6 text-white">
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
            <div className="mt-5 flex border-t border-white/15 pt-4">
              {nextFacts.map((f, i) => (
                <div key={f.label} className={`flex-1 ${i ? 'border-s border-white/15 ps-4' : ''}`}>
                  <b className="block text-lg font-bold">{f.value}</b>
                  <span className="text-[11px] text-white/60">{f.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={next.relatedRoute || '/journey'} className="btn bg-white text-navy hover:bg-brand-blue min-h-[44px]">
              {t('journeyPage.openService')}
              <DirArrow />
            </Link>
            <Link to="/premium" className="btn border border-white/30 text-white hover:bg-white/10 min-h-[44px]">
              <AppIcon name="message-circle" className="w-4 h-4" />
              {t('dash.askAboutStep')}
            </Link>
          </div>
        </section>
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
          <Link to="/residency" className="btn-ghost mt-4 min-h-[44px]">
            {t('dash.cityCta')}
            <DirArrow />
          </Link>
        </Panel>
      )}

      {/* ── the whole road, not a 3-item preview ── */}
      <Panel className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-navy">{t('dash.roadTitle')}</h2>
          <Link to="/journey" className="text-sm font-semibold text-navy/60 hover:text-navy">
            {t('dash.stepsCount', { count: progress.total })}
          </Link>
        </div>
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
      </Panel>

      {/* ── what happens now: the new user's real question is "and then?" ── */}
      <Panel className="mt-4">
        <h2 className="font-extrabold text-navy">{t('dash.whatNowTitle')}</h2>
        <ul className="mt-3 flex flex-col">
          {NEXT_ROWS.map((k) => (
            <li key={k} className="flex gap-4 py-3 border-t border-gray-100 first:border-t-0">
              <span className="w-20 shrink-0 text-xs font-semibold text-gray-400 pt-0.5">
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
                      : 'border-gray-200 bg-white'
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
          <Link to="/profile" className="btn-ghost w-full mt-4 min-h-[44px]">
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
          ctaTo="/profile"
        />
      )}

      {/* ── document locker: real count, or the invitation to start it ── */}
      {docs !== null &&
        (docs.length > 0 ? (
          <Panel className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-extrabold text-navy">{t('dash.lockerTitle')}</h2>
              <span className="text-sm font-semibold text-gray-500 tabular-nums">{docs.length}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {docs.slice(0, 3).map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <AppIcon name="file-text" className="w-4 h-4 shrink-0 text-navy/60" />
                  <span className="flex-1 min-w-0 text-sm font-semibold text-navy truncate">{d.name}</span>
                </li>
              ))}
            </ul>
            <Link to="/profile" className="btn-ghost w-full mt-4 min-h-[44px]">
              {t('dash.lockerManage')}
            </Link>
          </Panel>
        ) : (
          <InvitePanel
            className="mt-4"
            icon="upload"
            title={t('dash.noDocsTitle')}
            body={t('dash.noDocsBody')}
            ctaLabel={t('dash.noDocsCta')}
            ctaTo="/profile"
          />
        ))}

      {/* ── the free expert call: the strongest offer, and it needs no data ── */}
      <InvitePanel
        className="mt-4"
        icon="message-circle"
        title={t('dash.freeCallTitle')}
        body={t('dash.freeCallBody')}
        ctaLabel={t('dash.freeCallCta')}
        ctaTo="/help"
      />

      {/* ── everything below only renders once there is something real ── */}
      {myBookings.length > 0 && (
        <Panel className="mt-4">
          <h2 className="font-extrabold text-navy">{t('dash.bookingsTitle')}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {myBookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
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
              <li key={n.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-red shrink-0" aria-hidden />
                <p className="flex-1 min-w-0 text-sm text-navy break-words">
                  {n.key === 'custom' ? n.customText : t(`notifications.${n.key}.title`)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {relatedServices.length > 0 && (
        <Panel className="mt-4">
          <h2 className="font-extrabold text-navy">{t('dash.services')}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {relatedServices.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/services?q=${encodeURIComponent(pickText(s.title, lang))}`}
                  className="block h-full rounded-xl border border-gray-200 bg-white p-3 hover:border-navy/40 transition-colors"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-blue text-navy">
                    <AppIcon name={s.icon} className="w-4 h-4" />
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-navy break-words">{pickText(s.title, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="mt-4">
        <h2 className="font-extrabold text-navy">{t('dash.guides')}</h2>
        <Link to="/hub" className="btn-secondary mt-3 min-h-[44px]">
          {t('nav.hub')}
          <DirArrow />
        </Link>
      </Panel>

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
