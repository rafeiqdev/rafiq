import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { notifications } from '../lib/api';
import type { AppNotification } from '../lib/types';
import { AppIcon } from '../components/AppIcon';
import { RafiqLoaderScreen } from '../components/RafiqLoader';

/** Admins embed a deadline in a broadcast's free text as `[[deadline:YYYY-MM-DD]]`
 *  or `[[deadline:YYYY-MM-DD|Label]]`. Any custom notification carrying this tag
 *  is treated as an urgent legal deadline (residency appointment, tax payment, ...). */
const DEADLINE_TAG = /\[\[deadline:(\d{4}-\d{2}-\d{2})(?:\|([^\]]+))?\]\]/;

const REQUEST_UPDATE_KEYS = new Set([
  'paymentPending', 'paymentVerified', 'bookingNew', 'bookingConfirmed', 'adminNewBooking',
  'leadReceived', 'adminNewPayment', 'adminNewLead', 'bookingDone', 'bookingCancelled',
  'paymentRejected', 'requestAccepted', 'requestDone', 'requestRejected',
]);

type Tab = 'urgent' | 'updates' | 'news';

interface Deadline {
  date: Date;
  label?: string;
  daysLeft: number;
}

function parseDeadline(text?: string): Deadline | null {
  if (!text) return null;
  const m = text.match(DEADLINE_TAG);
  if (!m) return null;
  const date = new Date(`${m[1]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((date.getTime() - startOfToday.getTime()) / 86_400_000);
  return { date, label: m[2]?.trim(), daysLeft };
}

function stripDeadlineTag(text: string): string {
  return text.replace(DEADLINE_TAG, '').trim();
}

function tabOf(n: AppNotification): Tab {
  if (n.key === 'custom') return parseDeadline(n.customText) ? 'urgent' : 'news';
  if (n.key === 'welcome') return 'news';
  if (REQUEST_UPDATE_KEYS.has(n.key)) return 'updates';
  return 'updates';
}

function Countdown({ daysLeft }: { daysLeft: number }) {
  const { t } = useTranslation();
  const urgent = daysLeft <= 3;
  const text =
    daysLeft < 0
      ? t('notifications.countdown.overdue', { count: Math.abs(daysLeft) })
      : daysLeft === 0
        ? t('notifications.countdown.dueToday')
        : daysLeft === 1
          ? t('notifications.countdown.oneDayLeft')
          : t('notifications.countdown.daysLeft', { count: daysLeft });

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        urgent ? 'bg-brand-red text-white' : 'bg-amber-100 text-amber-800'
      }`}
    >
      <AppIcon name="hourglass" className="w-3 h-3" />
      {text}
    </span>
  );
}

export function Notifications() {
  const { t, i18n } = useTranslation();
  const { user, authLoading, refresh } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);

  const load = () => notifications.list().then(setItems).catch(() => setItems([]));

  useEffect(() => {
    if (user) load();
    else setItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markAll = async () => {
    await notifications.markAllRead();
    await load();
    await refresh();
  };

  const grouped = useMemo(() => {
    const urgent: AppNotification[] = [];
    const updates: AppNotification[] = [];
    const news: AppNotification[] = [];
    for (const n of items) {
      (tabOf(n) === 'urgent' ? urgent : tabOf(n) === 'updates' ? updates : news).push(n);
    }
    urgent.sort((a, b) => (parseDeadline(a.customText)?.daysLeft ?? 0) - (parseDeadline(b.customText)?.daysLeft ?? 0));
    return { urgent, updates, news };
  }, [items]);

  const activeTab: Tab = tab ?? (grouped.urgent.length > 0 ? 'urgent' : grouped.updates.length > 0 ? 'updates' : 'news');
  const activeItems = grouped[activeTab];

  if (authLoading) {
    return <RafiqLoaderScreen />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-navy">{t('notifications.title')}</h1>
        <div className="card p-10 mt-6 text-center">
          <div className="icon-chip mx-auto">
            <AppIcon name="lock" className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm text-gray-500">{t('gates.authRequired.body')}</p>
          <Link to="/auth" className="btn-primary mt-6">
            {t('gates.authRequired.cta')}
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'urgent', label: t('notifications.tabs.urgent'), count: grouped.urgent.length },
    { key: 'updates', label: t('notifications.tabs.updates'), count: grouped.updates.length },
    { key: 'news', label: t('notifications.tabs.news'), count: grouped.news.length },
  ];

  const emptyKey = activeTab === 'urgent' ? 'emptyUrgent' : activeTab === 'updates' ? 'emptyUpdates' : 'emptyNews';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy min-w-0 break-words">{t('notifications.title')}</h1>
        {items.some((n) => !n.read) && (
          <button onClick={markAll} className="btn-secondary h-9 px-3 text-xs shrink-0 whitespace-nowrap">
            {t('notifications.markAll')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-10 mt-6 text-center">
          <div className="icon-chip mx-auto">
            <AppIcon name="inbox" className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm text-gray-500">{t('notifications.empty')}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-2 border-b border-gray-200">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition-colors ${
                  activeTab === tb.key ? 'text-navy border-b-2 border-brand-red' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tb.key === 'urgent' && <AppIcon name="alert-triangle" className="w-3.5 h-3.5" />}
                {tb.label}
                {tb.count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-bold ${
                      tb.key === 'urgent' ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tb.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeItems.length === 0 ? (
            <div className="card p-10 mt-6 text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name={activeTab === 'urgent' ? 'alert-triangle' : 'inbox'} className="w-6 h-6" />
              </div>
              <p className="mt-4 text-sm text-gray-500">{t(`notifications.${emptyKey}`)}</p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {activeItems.map((n) => {
                const deadline = n.key === 'custom' ? parseDeadline(n.customText) : null;
                const isUrgent = activeTab === 'urgent' && !!deadline;
                return (
                  <li
                    key={n.id}
                    className={`card p-4 flex gap-3 ${n.read ? 'opacity-60' : ''} ${
                      isUrgent ? 'border-2 border-brand-red' : ''
                    }`}
                  >
                    <span className={`icon-chip !w-10 !h-10 ${isUrgent ? '!bg-brand-red/10 !text-brand-red' : ''}`}>
                      <AppIcon
                        name={isUrgent ? 'alert-triangle' : n.key === 'custom' ? 'megaphone' : 'bell'}
                        className="w-4 h-4"
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      {isUrgent && (
                        <span className="inline-block mb-1 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          {t('notifications.tabs.urgent')}
                        </span>
                      )}
                      {n.key === 'custom' ? (
                        <p className="text-sm font-semibold text-navy break-anywhere">
                          {deadline?.label || stripDeadlineTag(n.customText ?? '')}
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-navy break-anywhere">{t(`notifications.${n.key}.title`)}</p>
                          <p className="mt-0.5 text-sm text-gray-500 break-anywhere">{t(`notifications.${n.key}.body`)}</p>
                        </>
                      )}
                      {deadline && (
                        <div className="mt-2">
                          <Countdown daysLeft={deadline.daysLeft} />
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">{new Date(n.createdAt).toLocaleString(i18n.language)}</p>
                    </div>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-brand-red shrink-0 mt-1" />}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
