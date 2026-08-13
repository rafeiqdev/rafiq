import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { bookings, leads, serviceRequests } from '../lib/api';
import { Logo } from './Logo';
import { LangSwitcher } from './LangSwitcher';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';
import { NotificationBell } from './NotificationBell';
import { TopRatesBar } from './TopRatesBar';
import { SiteFooter } from './SiteFooter';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFallbackMeta, useSiteWideSeo } from '../lib/seo';
import { useTrackPageViews } from '../lib/analytics';
import { ConsentBanner } from './ConsentBanner';
import { EmergencyLegalFAB } from './EmergencyLegalFAB';
import { WhatsAppButton } from './WhatsAppButton';

// Routes with a dedicated mobile screen (src/pages/mobile/*) that draws its
// own full-bleed header/nav — on phones we skip the desktop ticker+header+
// footer chrome entirely for these so the mobile screen isn't sandwiched
// between bars it wasn't designed for. Add a path here whenever a new
// Mobile* page is wired in.
const MOBILE_CHROME_FREE_ROUTES = new Set(['/auth', '/', '/premium', '/chat', '/help', '/services', '/map', '/referrals', '/real-estate', '/health-tourism', '/tricks', '/profile', '/requests', '/notifications']);

// Dropping the desktop chrome on phones also dropped the footer, so the terms /
// privacy / refund block and the language switcher were unreachable from every
// mobile screen. These are the chrome-free routes that DO scroll normally, so a
// footer can be appended to them; the app-shell screens (/auth, /premium,
// /chat, /map, /help) are fixed-height flex layouts that own
// the whole viewport and must stay footer-free.
const MOBILE_FOOTER_ROUTES = new Set([
  '/',
  '/services',
  '/tricks',
  '/real-estate',
  '/health-tourism',
  '/referrals',
  '/profile',
  '/requests',
  '/notifications',
]);

interface NavItem {
  to: string;
  key: string;
  icon: IconName;
}

// "الاستشارة الذكية" (/smart) was first dropped from the nav and then removed
// as a route entirely — it duplicated the AI assistant and its dashboard
// already lives on Home + Profile. Smart.tsx / MobileSmart.tsx are kept on disk
// (unrouted) because the profile-completeness ring may be reused later.
//
// P-simplify1: main bar trimmed from 5 to 4 items — grouped into the
// "استكشف/الخدمات" dropdown below instead of parallel top-level nav items.
// The "الأدلة" (/hub) guide center has since been removed entirely.
const NAV: NavItem[] = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/premium', key: 'nav.premium', icon: 'message-circle' },
  { to: '/map', key: 'nav.map', icon: 'map' },
];

const SERVICE_LINKS: NavItem[] = [
  { to: '/services', key: 'nav.allServices', icon: 'layers' },
  { to: '/tricks', key: 'nav.tricks', icon: 'lightbulb' },
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
        className="px-3 py-2.5 rounded-lg text-sm font-medium text-navy/85 hover:text-navy hover:bg-cream"
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
  const { t } = useTranslation();
  const { user, tier } = useApp();
  const location = useLocation();
  const isMobile = useIsMobile();
  const hideChrome =
    isMobile &&
    (MOBILE_CHROME_FREE_ROUTES.has(location.pathname) ||
      location.pathname.startsWith('/services/'));
  const showMobileFooter =
    hideChrome &&
    (MOBILE_FOOTER_ROUTES.has(location.pathname) ||
      location.pathname.startsWith('/services/'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBookings, setNewBookings] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  // Bookings, service requests and leads are all surfaced inside /admin now
  // (bookings as a tab, not a separate page), so one badge sums all three;
  // the aria-label carries the requests/leads breakdown for anyone who needs it.
  const newOnAdmin = newRequests + newLeads + newBookings;

  // canonical + og:url/og:locale + hreflang — applies to every public route
  // nested under this layout, updates on every route/language change.
  useSiteWideSeo();

  // page_view on every route change — desktop and mobile alike, since both
  // render through this same Layout. No-ops until analytics consent is granted.
  useTrackPageViews();

  // The admin's only signal that work has arrived. There is no email or push:
  // if a queue has no badge here, nobody learns about it until someone opens
  // /admin and scrolls. All three inbound queues are counted for that reason.
  useEffect(() => {
    if (!user?.isAdmin) {
      setNewBookings(0);
      setNewRequests(0);
      setNewLeads(0);
      return;
    }
    bookings.newCount().then(setNewBookings).catch(() => {});
    serviceRequests.newCount().then(setNewRequests).catch(() => {});
    leads.newCount().then(setNewLeads).catch(() => {});
  }, [user]);

  // P3-6: generic, per-language document title + meta description — the
  // fallback for any route that doesn't set its own via usePageMeta() (or one
  // of the pre-existing per-page effects in Journey/MapPage/Onboarding/
  // UserHome). Steps aside automatically when a page already claimed these —
  // see useFallbackMeta's doc comment in src/lib/seo.ts for why that matters.
  useFallbackMeta(`${t('common.appName')} — ${t('common.tagline')}`, t('home.heroSubtitle'));

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
      {!hideChrome && <TopRatesBar />}
      {!hideChrome && (
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-cream-dark">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-2 sm:gap-4">
          <Link to="/" className="flex items-center shrink-0" aria-label={t('common.appName')}>
            <Logo size={30} />
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ms-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-blue text-navy font-semibold' : 'text-navy/85 hover:text-navy hover:bg-cream'
                  }`
                }
              >
                {t(n.key)}
              </NavLink>
            ))}
            <ServicesMenu />
            {user && (
              <>
                <NavLink
                  to="/home"
                  className={({ isActive }) =>
                    `px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-brand-blue text-navy font-semibold' : 'text-navy/85 hover:text-navy hover:bg-cream'
                    }`
                  }
                >
                  {t('nav.dashboard')}
                </NavLink>
                <NavLink
                  to="/journey"
                  className={({ isActive }) =>
                    `px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-brand-blue text-navy font-semibold' : 'text-navy/85 hover:text-navy hover:bg-cream'
                    }`
                  }
                >
                  {t('nav.myJourney')}
                </NavLink>
              </>
            )}
            {user?.isCompany && (
              <NavLink to="/company" className="px-3 py-2.5 rounded-lg text-sm font-medium text-navy/85 hover:text-navy hover:bg-cream">
                {t('nav.companyPortal')}
              </NavLink>
            )}
            {/* Bookings used to be its own top-nav link/page. It's now a tab
                inside /admin's sidebar, so a single "لوحة التحكم" link is the
                only admin entry point here — the badge folds bookings,
                requests and leads into one number. */}
            {user?.isAdmin && (
              <NavLink
                to="/admin"
                className="relative px-3 py-2.5 rounded-lg text-sm font-medium text-brand-red hover:bg-cream"
                aria-label={
                  newOnAdmin > 0
                    ? t('nav.adminQueue', { requests: newRequests, leads: newLeads })
                    : t('nav.admin')
                }
              >
                {t('nav.admin')}
                {newOnAdmin > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 min-w-5 h-5 px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
                    {newOnAdmin}
                  </span>
                )}
              </NavLink>
            )}
            {/* Medical coordinators aren't admins and RequireAdmin blocks them
                from /admin entirely, so without this they'd have no
                discoverable path to /admin/medical at all. Admins reach it
                from the link inside /admin instead, so it's not duplicated
                here for them. */}
            {!user?.isAdmin && user?.isMedicalCoordinator && (
              <NavLink to="/admin/medical" className="px-3 py-2.5 rounded-lg text-sm font-medium text-brand-red hover:bg-cream">
                {t('medical.admin.navLink')}
              </NavLink>
            )}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            {/* the bell leads to /notifications, which needs a session — for a
                guest it was a dead button */}
            {user && <NotificationBell size={36} />}
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

            <p className="mt-4 mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-navy/70">
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
              {user && (
                <>
                  <MobileTile to="/home" icon="home" label={t('nav.dashboard')} onNavigate={closeMenu} />
                  <MobileTile to="/journey" icon="check-circle" label={t('nav.myJourney')} onNavigate={closeMenu} />
                </>
              )}
              {user && <MobileTile to="/requests" icon="inbox" label={t('nav.myRequests')} onNavigate={closeMenu} />}
              {user?.isCompany ? (
                <MobileTile to="/company" icon="briefcase" label={t('nav.companyPortal')} onNavigate={closeMenu} />
              ) : (
                <MobileTile to="/company/register" icon="briefcase" label={t('nav.forCompanies')} onNavigate={closeMenu} />
              )}
              {user?.isAdmin && (
                <MobileTile
                  to="/admin"
                  icon="shield-check"
                  label={t('nav.admin')}
                  danger
                  badge={newOnAdmin}
                  onNavigate={closeMenu}
                />
              )}
              {!user?.isAdmin && user?.isMedicalCoordinator && (
                <MobileTile
                  to="/admin/medical"
                  icon="heart-pulse"
                  label={t('medical.admin.navLink')}
                  danger
                  onNavigate={closeMenu}
                />
              )}
            </div>
          </nav>
        )}
      </header>
      )}

      <main className="flex-1">
        {/* keyed by pathname so the entrance animation replays on every navigation */}
        <div key={location.pathname} className="route-fade">
          <Outlet />
        </div>
      </main>


      {!hideChrome && <SiteFooter />}
      {showMobileFooter && <SiteFooter variant="mobile" />}
      {/* The app-shell routes (/auth /premium /chat /map /help) have neither
          header nor footer on phones — without this a visitor landing on
          /auth in the wrong language had NO way to change it.
          Pinned to the TOP corner, not the bottom: several of these screens
          (/premium's chat composer, /map's search bar, /help's submit button)
          own a fixed bar at the bottom of the viewport, and a bottom-anchored
          switcher sat directly on top of it. */}
      {/* z-[60]: must stay clickable above the consent banner (z-50) — a
          first-time visitor in the wrong language has both on screen at once */}
      {hideChrome && !showMobileFooter && (
        <div className="fixed z-[60] end-4 top-[calc(env(safe-area-inset-top)+0.75rem)] rounded-btn bg-white/95 shadow-card">
          <LangSwitcher />
        </div>
      )}
      <EmergencyLegalFAB />
      <WhatsAppButton />
      <ConsentBanner />
    </div>
  );
}
