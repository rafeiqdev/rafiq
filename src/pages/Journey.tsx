import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useJourney, journeyDesc, journeyTitle } from '../hooks/useJourney';
import { errorMessageKey } from '../lib/errors';
import { useApp } from '../context/AppContext';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { OfficialSourceBadge } from '../components/OfficialSourceBadge';
import { JourneyProgressBar } from '../components/JourneyProgressBar';
import { RafiqLoader } from '../components/RafiqLoader';
import { JOURNEY_TASK_KEYS, journeyProgress, nextJourneyItem } from '../lib/types';
import type { JourneyItem, JourneyStatus } from '../lib/types';
import { usePageMeta } from '../lib/seo';

/** Sample steps for the logged-out preview — same task keys as the real journey,
 *  with a plausible in-progress mix so the "next step" highlight has something
 *  to point at. Never touches the network or a real account. */
function sampleGuestItems(): JourneyItem[] {
  const doneKeys = new Set(['turkishPhone', 'taxNumber']);
  return JOURNEY_TASK_KEYS.map((key, i) => ({
    id: `guest-${key}`,
    taskKey: key,
    titleAr: '',
    status: (doneKeys.has(key) ? 'done' : 'todo') as JourneyStatus,
    sort: i,
  }));
}

function TaskCard({ item, isNext, onToggle }: { item: JourneyItem; isNext: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const done = item.status === 'done';
  const title = journeyTitle(t, item);
  // contextual label — never the generic "وضع علامة منجز"
  const label = done ? t('journeyPage.markTodo', { task: title }) : t('journeyPage.markDone', { task: title });

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        isNext && !done ? 'border-navy bg-brand-blue' : 'border-gray-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={done}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-white
                   hover:border-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
      >
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center ${
            done ? 'bg-navy text-white' : 'border-2 border-gray-300 text-transparent'
          }`}
        >
          <AppIcon name="check" className="w-3.5 h-3.5" />
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={`font-bold break-words ${done ? 'text-navy/50 line-through' : 'text-navy'}`}>{title}</h3>
          {isNext && !done && (
            <span className="text-[10px] font-bold text-navy bg-white border border-navy/30 rounded-full px-2 py-0.5">
              {t('journeyPage.nextLabel')}
            </span>
          )}
          {done && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
              <AppIcon name="check-circle" className="w-3.5 h-3.5" />
              {t('common.done')}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 break-words">{journeyDesc(t, item)}</p>
        {!done && (
          <OfficialSourceBadge taskKey={item.taskKey} serviceId={item.relatedServiceId ?? undefined} className="mt-2" />
        )}
        {item.relatedRoute && !done && (
          <Link to={item.relatedRoute} className="btn-secondary mt-3 min-h-[44px] !h-auto py-2 text-xs">
            {t('journeyPage.openService')}
            <DirArrow className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </li>
  );
}

function JourneyInner() {
  const { t } = useTranslation();
  const { items, state, errorCategory, progress, next, reload, toggle } = useJourney();

  usePageMeta({
    title: `${t('journeyPage.title')} — ${t('common.appName')}`,
    description: t('journeyPage.subtitle'),
  });

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 animate-pulse" role="status" aria-live="polite">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="mt-6 h-28 rounded-2xl bg-gray-100" />
        <div className="mt-4 h-20 rounded-xl bg-gray-100" />
        <div className="mt-3 h-20 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <span className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-brand-blue text-navy">
            <AppIcon name="alert-triangle" className="w-6 h-6" />
          </span>
          {/* category-accurate, sanitized copy — never raw Supabase details */}
          <p className="mt-4 text-sm text-gray-600">{t(errorMessageKey(errorCategory ?? 'unknown_error'))}</p>
          <button onClick={reload} className="btn-primary w-full mt-6 min-h-[44px]">
            {t('journeyPage.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'empty' || items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <span className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-brand-blue text-navy">
            <AppIcon name="inbox" className="w-6 h-6" />
          </span>
          <p className="mt-4 text-sm text-gray-600">{t('journeyPage.empty')}</p>
          <button onClick={reload} className="btn-primary w-full mt-6 min-h-[44px]">
            {t('journeyPage.emptyCta')}
          </button>
        </div>
      </div>
    );
  }

  const todo = items.filter((i) => i.status === 'todo');
  const done = items.filter((i) => i.status === 'done');

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('journeyPage.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('journeyPage.subtitle')}</p>

      {/* summary */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-navy">{t('journeyPage.overall')}</h2>
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
        {next && (
          <p className="mt-3 text-sm text-navy">
            <span className="font-bold">{t('journeyPage.nextLabel')}: </span>
            {journeyTitle(t, next)}
          </p>
        )}
      </section>

      {todo.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy/50">{t('journeyPage.todoSection')}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {todo.map((i) => (
              <TaskCard key={i.id} item={i} isNext={next?.id === i.id} onToggle={() => toggle(i)} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy/50">{t('journeyPage.doneSection')}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {done.map((i) => (
              <TaskCard key={i.id} item={i} isNext={false} onToggle={() => toggle(i)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Logged-out preview: same layout as the real journey, fully interactive
 * (steps can be toggled to see how it feels), but nothing is persisted —
 * a banner + CTA invite the guest to sign up once they've tried it.
 */
function GuestJourneyInner() {
  const { t } = useTranslation();
  const [items, setItems] = useState<JourneyItem[]>(sampleGuestItems);

  usePageMeta({
    title: `${t('journeyPage.title')} — ${t('common.appName')}`,
    description: t('journeyPage.subtitle'),
  });

  const toggle = (item: JourneyItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: i.status === 'done' ? 'todo' : 'done' } : i)),
    );
  };

  const progress = journeyProgress(items);
  const next = nextJourneyItem(items);
  const todo = items.filter((i) => i.status === 'todo');
  const done = items.filter((i) => i.status === 'done');
  const authState = { from: '/journey' };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-navy/20 bg-brand-blue/60 p-4 flex items-center gap-3 flex-wrap">
        <span className="icon-chip !w-10 !h-10 shrink-0">
          <AppIcon name="compass" className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-bold text-navy">{t('journeyPage.guest.bannerTitle')}</p>
          <p className="text-xs text-navy/70">{t('journeyPage.guest.bannerBody')}</p>
        </div>
        <Link to="/auth" state={authState} className="btn-primary shrink-0 !h-10 !min-h-0 px-4 text-sm">
          {t('journeyPage.guest.cta')}
          <DirArrow className="w-3.5 h-3.5" />
        </Link>
      </div>

      <h1 className="mt-6 text-2xl font-extrabold text-navy">{t('journeyPage.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('journeyPage.subtitle')}</p>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-navy">{t('journeyPage.overall')}</h2>
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
        {next && (
          <p className="mt-3 text-sm text-navy">
            <span className="font-bold">{t('journeyPage.nextLabel')}: </span>
            {journeyTitle(t, next)}
          </p>
        )}
      </section>

      {todo.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy/50">{t('journeyPage.todoSection')}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {todo.map((i) => (
              <TaskCard key={i.id} item={i} isNext={next?.id === i.id} onToggle={() => toggle(i)} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy/50">{t('journeyPage.doneSection')}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {done.map((i) => (
              <TaskCard key={i.id} item={i} isNext={false} onToggle={() => toggle(i)} />
            ))}
          </ul>
        </section>
      )}

      <Link to="/auth" state={authState} className="btn-primary w-full mt-8 min-h-[48px]">
        {t('journeyPage.guest.cta')}
        <DirArrow className="w-4 h-4" />
      </Link>
    </div>
  );
}

export function Journey() {
  const { user, authLoading, onboardingCompleted } = useApp();
  if (authLoading) {
    return (
      <div className="mx-auto max-w-md px-4 text-center" aria-busy>
        <RafiqLoader size="sm" className="min-h-[60vh]" />
      </div>
    );
  }
  if (!user) return <GuestJourneyInner />;
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return (
    <>
      <JourneyProgressBar />
      <JourneyInner />
    </>
  );
}
