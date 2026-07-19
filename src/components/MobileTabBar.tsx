import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';

/** Same inline copy the Mobile* screens use for their bars (kept identical). */
const COPY: Record<string, { home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

/**
 * The standard 5-tab mobile bottom bar — the same markup every Mobile* screen
 * draws inline. Use this on pages that serve phones but aren't Mobile*-specific
 * (e.g. the signed-in personal home), so navigation never disappears.
 */
export function MobileTabBar() {
  const { i18n } = useTranslation();
  const { user } = useApp();
  const location = useLocation();
  const c = COPY[(i18n.language || 'en').split('-')[0]] ?? COPY.en;

  const tabs: { to: string; icon: IconName; label: string }[] = [
    { to: '/', icon: 'home', label: c.home },
    { to: '/premium', icon: 'message-circle', label: c.chat },
    { to: '/map', icon: 'map', label: c.map },
    { to: '/services', icon: 'layers', label: c.services },
    { to: user ? '/profile' : '/auth', icon: 'user', label: c.profile },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
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
  );
}
