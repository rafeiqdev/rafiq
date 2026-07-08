import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { bookings } from '../lib/api';
import { Logo } from './Logo';
import { LangSwitcher } from './LangSwitcher';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';
import { TopRatesBar } from './TopRatesBar';

interface NavItem {
  to: string;
  key: string;
  icon: IconName;
}

// "الاستشارة الذكية" (/smart) was dropped from the nav — it duplicated the AI
// assistant and its dashboard already lives on Home + Profile.
const NAV: NavItem[] = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/premium', key: 'nav.premium', icon: 'message-circle' },
  { to: '/map', key: 'nav.map', icon: 'map' },
  { to: '/hub', key: 'nav.hub', icon: 'compass' },
  { to: '/pricing', key: 'nav.pricing', icon: 'credit-card' },
];

const SERVICE_LINKS: NavItem[] = [
  { to: '/services', key: 'nav.allServices', icon: 'layers' },
  { to: '/tricks', key: 'nav.tricks', icon: 'lightbulb' },
  { to: '/residency', key: 'nav.residency', icon: 'id-card' },
  { to: '/real-estate', key: 'nav.realEstate', icon: 'building' },
  { to: '/health-tourism', key: 'nav.health', icon: 'heart-pulse' },
  { to: '/referrals', key: 'nav.referrals', icon: 'gift' },
];

/** A tappable nav tile for the mobile menu grid (icon + label, side by side). */
function MobileTile({
  to,
  icon,
  label,
  onNavigate,
  danger,
  badge,
}: {
  to: string;
  icon: IconName;
  label: string;
  onNavigate: () => void;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
          isActive
            ? 'border-navy bg-brand-blue text-navy'
            : danger
              ? 'border-cream-dark text-brand-red hover:bg-cream'
              : 'border-cream-dark text-navy/75 hover:bg-cream'
        }`
      }
    >
      <span className="w-7 h-7 rounded-lg bg-cream flex items-center justify-center shrink-0">
        <AppIcon name={icon} className="w-4 h-4" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
      {badge ? (
        <span className="absolute top-1 end-1 min-w-4 h-4 px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function ServicesMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-3 py-2 rounded-lg text-sm font-medium text-navy/70 hover:text-navy hover:bg-cream"
      >
        {t('nav.services')} ▾
      </button>
      {open && (
        <div role="menu" className="absolute start-0 mt-2 w-48 card p-1 z-40">
          {SERVICE_LINKS.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-navy/80 hover:bg-brand-blue hover:text-navy"
            >
              {t(s.key)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, tier, unread } = useApp();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBookings, setNewBookings] = useState(0);

  useEffect(() => {
    if (user?.isAdmin) bookings.newCount().then(setNewBookings).catch(() => {});
    else setNewBookings(0);
  }, [user]);

  // P3-6: per-language document title + meta description
  useEffect(() => {
    document.title = `${t('common.appName')} — ${t('common.tagline')}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('home.heroSubtitle'));
  }, [t, i18n.language]);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // While the menu is open, dismiss it on a click/tap OUTSIDE the header (so the
  // page never feels stuck behind it). NOTE: do NOT close on scroll — a tiny
  // drag while tapping the toggle was closing it instantly ("won't open").
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest('header')) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col">
      <TopRatesBar />
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-cream-dark">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-2 sm:gap-4">
          <Link to="/" className="flex items-center shrink-0">
            <Logo size={30} />
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ms-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-blue text-navy font-semibold' : 'text-navy/70 hover:text-navy hover:bg-cream'
                  }`
                }
              >
                {t(n.key)}
              </NavLink>
            ))}
            <ServicesMenu />
            {user?.isCompany && (
              <NavLink to="/company" className="px-3 py-2 rounded-lg text-sm font-medium text-navy/70 hover:text-navy hover:bg-cream">
                {t('nav.companyPortal')}
              </NavLink>
            )}
            {user?.isAdmin && (
              <>
                <NavLink to="/admin" className="px-3 py-2 rounded-lg text-sm font-medium text-brand-red hover:bg-cream">
                  {t('nav.admin')}
                </NavLink>
                <NavLink to="/admin/bookings" className="relative px-3 py-2 rounded-lg text-sm font-medium text-brand-red hover:bg-cream">
                  {t('nav.bookings')}
                  {newBookings > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 min-w-5 h-5 px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
                      {newBookings}
                    </span>
                  )}
                </NavLink>
              </>
            )}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <Link to="/notifications" className="relative icon-chip !w-9 !h-9" aria-label={t('nav.notifications')}>
              <AppIcon name="bell" className="w-[18px] h-[18px]" />
              {unread > 0 && (
                <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
                  {unread}
                </span>
              )}
            </Link>
            <LangSwitcher />
            {user ? (
              <Link to="/profile" className="btn-secondary h-9 px-3 text-xs shrink-0" aria-label={t('nav.profile')}>
                <AppIcon name="user" className="w-3.5 h-3.5" />
                <span className="hidden sm:inline max-w-[140px] truncate">
                  {user.name.split(' ')[0]} · {tier === 'free' ? t('common.free') : t(`pricing.${tier}.name`)}
                </span>
              </Link>
            ) : (
              <Link to="/auth" className="btn-primary h-9 px-3 text-xs shrink-0 hidden sm:inline-flex">
                {t('common.signIn')}
              </Link>
            )}
            <button
              className="lg:hidden btn-secondary h-9 px-3 text-xs"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t('nav.menu')}
              aria-expanded={menuOpen}
            >
              <AppIcon name="menu" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t border-cream-dark bg-white px-4 py-4 animate-menu-in max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((n) => (
                <MobileTile key={n.to} to={n.to} icon={n.icon} label={t(n.key)} onNavigate={closeMenu} />
              ))}
            </div>

            <p className="mt-4 mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-navy/40">
              {t('nav.services')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_LINKS.map((s) => (
                <MobileTile key={s.to} to={s.to} icon={s.icon} label={t(s.key)} onNavigate={closeMenu} />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {user ? (
                <MobileTile to="/profile" icon="user" label={t('nav.profile')} onNavigate={closeMenu} />
              ) : (
                <MobileTile to="/auth" icon="lock" label={t('common.signIn')} onNavigate={closeMenu} />
              )}
              {user && <MobileTile to="/requests" icon="inbox" label={t('nav.myRequests')} onNavigate={closeMenu} />}
              {user?.isCompany ? (
                <MobileTile to="/company" icon="briefcase" label={t('nav.companyPortal')} onNavigate={closeMenu} />
              ) : (
                <MobileTile to="/company/register" icon="briefcase" label={t('nav.forCompanies')} onNavigate={closeMenu} />
              )}
              {user?.isAdmin && (
                <>
                  <MobileTile to="/admin" icon="shield-check" label={t('nav.admin')} danger onNavigate={closeMenu} />
                  <MobileTile
                    to="/admin/bookings"
                    icon="calendar"
                    label={t('nav.bookings')}
                    danger
                    badge={newBookings}
                    onNavigate={closeMenu}
                  />
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* keyed by pathname so the entrance animation replays on every navigation */}
        <div key={location.pathname} className="route-fade">
          <Outlet />
        </div>
      </main>


      <footer className="bg-navy text-white/80 mt-16">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center">
              <Logo size={34} variant="white" />
            </div>
            <p className="mt-3 text-sm">{t('common.tagline')}</p>
            <p className="mt-2 text-xs text-white/70">{t('footer.disclaimer')}</p>
          </div>
          <nav className="text-sm flex flex-col">
            {SERVICE_LINKS.map((s) => (
              <Link key={s.to} to={s.to} className="py-2 hover:text-white">
                {t(s.key)}
              </Link>
            ))}
            <Link to="/company/register" className="py-2 hover:text-white">
              {t('nav.forCompanies')}
            </Link>
          </nav>
          <nav className="text-sm flex flex-col">
            <Link to="/terms" className="py-2 hover:text-white">{t('nav.terms')}</Link>
            <Link to="/privacy" className="py-2 hover:text-white">{t('nav.privacy')}</Link>
            <Link to="/refund" className="py-2 hover:text-white">{t('nav.refund')}</Link>
          </nav>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/70">
          © {new Date().getFullYear()} {t('common.appName')} — {t('footer.rights')}
        </div>
      </footer>
    </div>
  );
}
