import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { notifications } from '../../lib/api';
import type { AppNotification } from '../../lib/types';
import { AppIcon } from '../../components/AppIcon';
import { RafiqLoader } from '../../components/RafiqLoader';
import { SiteImage } from '../../components/SiteImage';
import { ISTANBUL } from '../../lib/images';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

export function MobileNotifications() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;
  const hasUnread = items.some((n) => !n.read);

  const tabs = [
    { to: '/', icon: 'home', label: mc.home },
    { to: '/premium', icon: 'message-circle', label: mc.chat },
    { to: '/map', icon: 'map', label: mc.map },
    { to: '/services', icon: 'layers', label: mc.services },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.profile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Header: real photo behind heavy navy overlay, no fake status bar ── */}
        <header className="relative animate-fade-in overflow-hidden rounded-b-[28px] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {/* SiteImage's root is already `relative` — position it with a wrapper. */}
          <div className="absolute inset-0">
            <SiteImage src={ISTANBUL.mosque} alt="" className="h-full w-full" />
          </div>
          <div className="absolute inset-0 bg-navy/85" aria-hidden />
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div className="animate-fade-up relative mt-3.5 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-white">{t('notifications.title')}</h1>
            {user && hasUnread && (
              <button
                onClick={markAll}
                className="min-h-[44px] shrink-0 rounded-btn border border-white/35 px-4 text-[12.5px] font-semibold text-white transition-colors active:bg-white/15"
              >
                {t('notifications.markAll')}
              </button>
            )}
          </div>
        </header>

        <div className="px-5 pt-5">
          {authLoading ? (
            /* session still resolving — never flash the wall at a signed-in user */
            <RafiqLoader size="sm" className="min-h-[50vh]" />
          ) : !user ? (
            /* signed-out state (this page does NOT use RequireAuth) */
            <div className="card animate-pop p-10 text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="lock" className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-gray-500">{t('gates.authRequired.body')}</p>
              <Link to="/auth" className="btn-primary mt-5 flex min-h-[50px] w-full text-[15px]">
                {t('gates.authRequired.cta')}
              </Link>
            </div>
          ) : items.length === 0 ? (
            <div className="card animate-pop p-10 text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="inbox" className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-gray-500">{t('notifications.empty')}</p>
            </div>
          ) : (
            <div className="stagger flex flex-col gap-3">
              {items.map((n, i) => (
                <div
                  key={n.id}
                  className={`relative flex animate-fade-up items-start gap-3 overflow-hidden rounded-card bg-white p-4 ${
                    n.read
                      ? 'border border-cream-dark opacity-60'
                      : 'border border-navy/25 shadow-md'
                  }`}
                  style={{ '--i': i } as React.CSSProperties}
                >
                  {!n.read && <span aria-hidden className="absolute start-0 top-0 h-full w-1 bg-navy" />}
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      n.read ? 'bg-cream text-navy/50' : 'bg-navy/10 text-navy'
                    }`}
                  >
                    <AppIcon name={n.key === 'custom' ? 'megaphone' : 'bell'} className="h-[19px] w-[19px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {n.key === 'custom' ? (
                      <p className="break-anywhere text-[13.5px] leading-relaxed text-navy">{n.customText}</p>
                    ) : (
                      <>
                        <p className="break-anywhere text-[13.5px] font-extrabold leading-snug text-navy">
                          {t(`notifications.${n.key}.title`)}
                        </p>
                        <p className="break-anywhere mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                          {t(`notifications.${n.key}.body`)}
                        </p>
                      </>
                    )}
                    <p className="mt-1.5 text-[11px] text-navy/45">{new Date(n.createdAt).toLocaleString(i18n.language)}</p>
                  </div>
                  {!n.read && <span className="mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full bg-brand-red" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom tab bar — verbatim from MobileMyRequests.tsx; none active ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active =
              tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.icon}
                to={tab.to}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] pt-2 pb-1.5 ${
                  active ? 'text-navy' : 'text-navy/40'
                }`}
              >
                <AppIcon name={tab.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
