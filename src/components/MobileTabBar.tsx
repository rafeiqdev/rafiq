import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';

/**
 * Tab labels live HERE, not in src/i18n/locales/*.json, and this is deliberate —
 * do not "fix" it by moving them to nav.*.
 *
 * These strings are constrained by PIXELS, not by language. A tab cell is ~72px
 * wide at 360px viewport with 10px type. "طلباتي" in that cell and
 * "طلباتي المعروضة على الشركات" in the desktop menu are genuinely different
 * strings that happen to mean the same thing; forcing them to share a key
 * guarantees one of the two is wrong forever. nav.* is written for the menu —
 * nav.premium is "المساعد الذكي" (13 chars) where the bar needs "المساعد" (7),
 * and nav.myRequests in Farsi is "درخواست‌های من" (14). Using them here made
 * labels wrap to a second line, so the bar's HEIGHT changed with the interface
 * language — a defect that hits Farsi and Russian users specifically.
 *
 * Keeping them local also means adding a tab touches no locale file.
 */
const COPY: Record<string, { home: string; chat: string; requests: string; map: string; services: string; profile: string }> = {
  en: { home: 'Home', chat: 'AI Chat', requests: 'Requests', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { home: 'الرئيسية', chat: 'المساعد', requests: 'طلباتي', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { home: 'خانه', chat: 'دستیار', requests: 'درخواست‌ها', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { home: 'Главная', chat: 'ИИ-чат', requests: 'Заявки', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

/**
 * The "Requests" label on its own, for MobileHome — the one screen that still
 * draws its bar inline (it belongs to another workstream and could not be
 * consolidated yet). Exported so that screen can match this bar exactly without
 * growing a second copy of the string.
 */
export function tabRequestsLabel(lang: string): string {
  return (COPY[(lang || 'en').split('-')[0]] ?? COPY.en).requests;
}

/**
 * The one mobile bottom bar. Every Mobile* screen renders THIS — it used to be
 * copied inline into fourteen of them, which is how the bar could drift from
 * page to page and why adding a destination meant fourteen edits.
 *
 * WHY "REQUESTS" AND NOT "MAP"
 * A customer who has already submitted something arrives with exactly one
 * question: where is my request. Until now the answer lived two taps deep —
 * inside the hamburger menu, or behind a 32px button on the profile page — and
 * nothing in the product pointed at it. The map is a pre-purchase browsing tool
 * and stays reachable from Home.
 *
 * Signed-out visitors keep Map in that slot: they are by definition
 * pre-purchase, have no requests to look at, and "Requests" would only send them
 * into a sign-in wall. The profile tab already varies on auth this way.
 *
 * FIVE TABS, NOT SIX. Six cells on a 360px phone is ~60px each at 10px type,
 * which is not a design. Our users are older; legibility outranks completeness.
 */
export function MobileTabBar() {
  const { i18n } = useTranslation();
  const { user } = useApp();
  const location = useLocation();
  const c = COPY[(i18n.language || 'en').split('-')[0]] ?? COPY.en;

  const tabs: { to: string; icon: IconName; label: string }[] = [
    { to: '/', icon: 'home', label: c.home },
    { to: '/premium', icon: 'message-circle', label: c.chat },
    user
      ? { to: '/requests', icon: 'inbox', label: c.requests }
      : { to: '/map', icon: 'map', label: c.map },
    { to: '/services', icon: 'layers', label: c.services },
    { to: user ? '/profile' : '/auth', icon: 'user', label: c.profile },
  ];

  return (
    // data-mobile-tabbar: ConsentBanner measures this bar so it can sit on
    // top of it instead of covering it — and so it stays flush with the
    // bottom edge on the screens that have no bar at all.
    <nav data-mobile-tabbar className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark pb-[env(safe-area-inset-bottom,0px)]">
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
              <AppIcon name={tab.icon} className="w-5 h-5 shrink-0" />
              {/* nowrap is load-bearing: every label above is sized to fit one
                  line in a 72px cell, and the bar's height must not depend on
                  the interface language. */}
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
