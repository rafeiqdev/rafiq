import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { notifications } from '../lib/api';
import type { AppNotification } from '../lib/types';
import { AppIcon } from '../components/AppIcon';
import { RafiqLoaderScreen } from '../components/RafiqLoader';

export function Notifications() {
  const { t, i18n } = useTranslation();
  const { user, authLoading, refresh } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);

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
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((n) => (
            <li key={n.id} className={`card p-4 flex gap-3 ${n.read ? 'opacity-60' : ''}`}>
              <span className="icon-chip !w-10 !h-10">
                <AppIcon name={n.key === 'custom' ? 'megaphone' : 'bell'} className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                {n.key === 'custom' ? (
                  <p className="text-sm font-semibold text-navy break-anywhere">{n.customText}</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-navy break-anywhere">{t(`notifications.${n.key}.title`)}</p>
                    <p className="mt-0.5 text-sm text-gray-500 break-anywhere">{t(`notifications.${n.key}.body`)}</p>
                  </>
                )}
                <p className="mt-1 text-xs text-gray-500">{new Date(n.createdAt).toLocaleString(i18n.language)}</p>
              </div>
              {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-brand-red shrink-0 mt-1" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
