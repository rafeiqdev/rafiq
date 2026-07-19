import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useJourney, journeyDesc, journeyTitle } from '../hooks/useJourney';
import { errorMessageKey } from '../lib/errors';
import { bookings as bookingsApi, notifications as notificationsApi } from '../lib/api';
import { SERVICES, pickText } from '../data/services';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { MobileTabBar } from '../components/MobileTabBar';
import { useIsMobile } from '../hooks/useIsMobile';
import type { AppNotification, Booking, JourneyItem } from '../lib/types';

/** The three tracked renewal dates on the profile, soonest first. */
const RENEWAL_KEYS = ['residence', 'insurance', 'passport'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Neutral card for the authenticated product surface (white + light blue). */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>{children}</section>;
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

function TaskRow({ item, isNext }: { item: JourneyItem; isNext: boolean }) {
  const { t } = useTranslation();
  const done = item.status === 'done';
  return (
    <li className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isNext ? 'border-navy bg-brand-blue' : 'border-gray-200 bg-white'}`}>
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
          done ? 'bg-navy text-white' : 'border-2 border-gray-300 text-transparent'
        }`}
        aria-hidden
      >
        <AppIcon name="check" className="w-3.5 h-3.5" />
      </span>
      <span className={`flex-1 min-w-0 text-sm font-semibold break-words ${done ? 'text-navy/50 line-through' : 'text-navy'}`}>
        {journeyTitle(t, item)}
      </span>
      {isNext && !done && (
        <span className="text-[10px] font-bold text-navy bg-white border border-navy/30 rounded-full px-2 py-0.5 shrink-0">
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

  useEffect(() => {
    document.title = `${t('dash.journeyTitle')} — ${t('common.appName')}`;
  }, [t]);

  // Secondary panels — each loads independently and simply stays hidden on
  // failure, so they can never take the dashboard down with them.
  useEffect(() => {
    if (!user) return;
    bookingsApi.mine().then((b) => setMyBookings(b.slice(0, 3))).catch(() => {});
    notificationsApi.list().then((n) => setNotifs(n.filter((x) => !x.read).slice(0, 3))).catch(() => {});
  }, [user]);

  // ---- session still resolving ----------------------------------------------
  // Painting the guest card here first would flash it at signed-in users.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-32" role="status" aria-busy>
        <div className="w-10 h-10 rounded-full border-4 border-cream-dark border-t-navy animate-spin" />
      </div>
    );
  }

  // On phones this page is chrome-free (Layout hides header/footer for "/"),
  // so it must draw the standard bottom tab bar itself — on EVERY state, or
  // navigation would vanish whenever a state card is up.
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

  // No "onboarding incomplete" branch here on purpose: every route that mounts
  // this page goes through RequireOnboarded (or HomeGate for "/"), which
  // replaces into /onboarding first. Re-checking here would only re-introduce a
  // second onboarding prompt on the dashboard.

  if (state === 'loading') return withBar(<Skeleton />);

  if (state === 'error') {
    return withBar(
      <StateCard
        icon="alert-triangle"
        title={t('dash.errorTitle')}
        /* category-accurate, sanitized copy — never raw Supabase details */
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
  // services tied to the user's own journey items (reuses the catalog, no copies)
  const relatedServices = items
    .map((i) => SERVICES.find((s) => s.id === i.relatedServiceId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .slice(0, 3);

  // upcoming renewals from the profile, soonest (or most overdue) first
  const renewals = RENEWAL_KEYS
    .map((key) => ({ key, date: profile.renewals[key] }))
    .filter((r): r is { key: (typeof RENEWAL_KEYS)[number]; date: string } => Boolean(r.date))
    .map((r) => ({ ...r, days: Math.ceil((new Date(r.date).getTime() - Date.now()) / DAY_MS) }))
    .sort((a, b) => a.days - b.days);

  return withBar(
    <div className={`mx-auto max-w-3xl px-4 py-8 ${isMobile ? 'pb-28' : ''}`}>
      {/* header */}
      <header className="flex items-center gap-3">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-navy text-white font-extrabold shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            (firstName[0] ?? 'R').toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-navy truncate">{t('dash.greeting', { name: firstName })}</h1>
          {situationLabel && <p className="text-sm text-gray-500 truncate">{situationLabel}</p>}
        </div>
      </header>

      {/* مسيرتي */}
      <Panel className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-extrabold text-navy">{t('dash.journeyTitle')}</h2>
          <span className="text-2xl font-extrabold text-navy" dir="ltr">
            {progress.percent}%
          </span>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-navy transition-all duration-500" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>{t('dash.doneOf', { done: progress.done, total: progress.total })}</span>
          <span>{t('dash.remaining', { count: progress.remaining })}</span>
        </div>
        <Link to="/journey" className="btn-primary w-full mt-4 min-h-[44px]">
          {t('dash.continueCta')}
          <DirArrow />
        </Link>
      </Panel>

      {/* next step */}
      {next && (
        <Panel className="mt-4 border-navy/30 bg-brand-blue/40">
          <p className="text-xs font-bold uppercase tracking-wide text-navy/60">{t('dash.nextTitle')}</p>
          <h3 className="mt-1 font-extrabold text-navy">{journeyTitle(t, next)}</h3>
          <p className="mt-1 text-sm text-navy/70">{journeyDesc(t, next)}</p>
          <Link to={next.relatedRoute || '/journey'} className="btn-primary mt-4 min-h-[44px]">
            {t('journeyPage.openService')}
            <DirArrow />
          </Link>
        </Panel>
      )}

      {/* checklist preview (max 3) */}
      <Panel className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-navy">{t('dash.journeyTitle')}</h2>
          <Link to="/journey" className="text-sm font-semibold text-navy hover:underline">
            {t('dash.viewAll')}
          </Link>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {items.slice(0, 3).map((i) => (
            <TaskRow key={i.id} item={i} isNext={next?.id === i.id} />
          ))}
        </ul>
      </Panel>

      {/* upcoming renewals (only when the user has tracked any dates) */}
      {renewals.length > 0 && (
        <Panel className="mt-4">
          <h2 className="font-extrabold text-navy">{t('dash.renewalsTitle')}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {renewals.map((r) => (
              <li
                key={r.key}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  r.days <= 0 ? 'border-brand-red/40 bg-brand-red/5' : r.days <= 30 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
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
        </Panel>
      )}

      {/* latest bookings */}
      {myBookings.length > 0 && (
        <Panel className="mt-4">
          <h2 className="font-extrabold text-navy">{t('dash.bookingsTitle')}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {myBookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <AppIcon name="calendar" className="w-4 h-4 shrink-0 text-navy/60" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{b.problemSummary}</p>
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

      {/* unread notifications */}
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

      {/* services tied to the journey */}
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

      {/* guides */}
      <Panel className="mt-4">
        <h2 className="font-extrabold text-navy">{t('dash.guides')}</h2>
        <Link to="/hub" className="btn-secondary mt-3 min-h-[44px]">
          {t('nav.hub')}
          <DirArrow />
        </Link>
      </Panel>
    </div>
  );
}
