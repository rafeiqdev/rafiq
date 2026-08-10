import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { RequireAuth, RequireOnboarded } from './components/Gates';
import { ChatRedirect } from './components/LegacyRedirects';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { RafiqLoaderScreen } from './components/RafiqLoader';
import { referrals } from './lib/api';
import { popPostAuthRedirect } from './lib/authRedirect';
import { DEFAULT_LANG, langFromPath } from './i18n';
import { Home } from './pages/Home';
import { useIsMobile } from './hooks/useIsMobile';

/**
 * lazy() with stale-deploy recovery.
 *
 * Every deployment renames the hashed JS chunks. A tab opened before a deploy
 * still holds the OLD manifest, so navigating to a not-yet-visited page
 * requests a chunk that no longer exists — "تعذّر تحميل الصفحة" on every
 * navigation until the user thinks to refresh. With several deploys a day this
 * hit users constantly.
 *
 * Recovery: reload the page ONCE (fetching the new manifest). The
 * sessionStorage guard stops a reload loop when the failure is real (offline);
 * a successful load clears it so the next deploy gets its own single retry.
 */
const CHUNK_RELOAD_KEY = 'rafiq_chunk_reloaded';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own constraint
function lazyPage<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().then(
      (m) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return m;
      },
      (e: unknown) => {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          // never resolves — the reload replaces the document
          return new Promise<{ default: T }>(() => {});
        }
        throw e;
      },
    ),
  );
}

// P3-7: secondary routes are lazy-loaded to keep the initial bundle small
const Auth = lazyPage(() => import('./pages/Auth').then((m) => ({ default: m.Auth })));
// Dedicated mobile screens (phone viewports) — same route, different component.
// See mobile-prompts/ for the design prompts used to generate these.
const MobileAuth = lazyPage(() => import('./pages/mobile/MobileAuth').then((m) => ({ default: m.MobileAuth })));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const MobileHome = lazyPage(() => import('./pages/mobile/MobileHome').then((m) => ({ default: m.MobileHome })));
const Premium = lazyPage(() => import('./pages/Premium').then((m) => ({ default: m.Premium })));
const MobilePremium = lazyPage(() => import('./pages/mobile/MobilePremium').then((m) => ({ default: m.MobilePremium })));
const HelpRequest = lazyPage(() => import('./pages/HelpRequest').then((m) => ({ default: m.HelpRequest })));
const MobileHelpRequest = lazyPage(() => import('./pages/mobile/MobileHelpRequest').then((m) => ({ default: m.MobileHelpRequest })));
const Services = lazyPage(() => import('./pages/Services').then((m) => ({ default: m.Services })));
const MobileServices = lazyPage(() => import('./pages/mobile/MobileServices').then((m) => ({ default: m.MobileServices })));
const MapPage = lazyPage(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const MobileMapPage = lazyPage(() => import('./pages/mobile/MobileMapPage').then((m) => ({ default: m.MobileMapPage })));
const Referrals = lazyPage(() => import('./pages/Referrals').then((m) => ({ default: m.Referrals })));
const MobileReferrals = lazyPage(() => import('./pages/mobile/MobileReferrals').then((m) => ({ default: m.MobileReferrals })));
const RealEstate = lazyPage(() => import('./pages/RealEstate').then((m) => ({ default: m.RealEstate })));
const MobileRealEstate = lazyPage(() => import('./pages/mobile/MobileRealEstate').then((m) => ({ default: m.MobileRealEstate })));
const RealEstateDetail = lazyPage(() => import('./pages/RealEstateDetail').then((m) => ({ default: m.RealEstateDetail })));
const MobileRealEstateDetail = lazyPage(() => import('./pages/mobile/MobileRealEstateDetail').then((m) => ({ default: m.MobileRealEstateDetail })));
const MobileListingServices = lazyPage(() => import('./pages/mobile/MobileListingServices').then((m) => ({ default: m.MobileListingServices })));
const RealEstateInvestments = lazyPage(() => import('./pages/RealEstateInvestments').then((m) => ({ default: m.RealEstateInvestments })));
const InvestmentDetail = lazyPage(() => import('./pages/InvestmentDetail').then((m) => ({ default: m.InvestmentDetail })));
const HealthTourism = lazyPage(() => import('./pages/HealthTourism').then((m) => ({ default: m.HealthTourism })));
const MobileHealthTourism = lazyPage(() =>
  import('./pages/mobile/MobileHealthTourism').then((m) => ({ default: m.MobileHealthTourism })),
);
const MedicalRequest = lazyPage(() => import('./pages/MedicalRequest').then((m) => ({ default: m.MedicalRequest })));
const Tricks = lazyPage(() => import('./pages/Tricks').then((m) => ({ default: m.Tricks })));
const MobileTricks = lazyPage(() => import('./pages/mobile/MobileTricks').then((m) => ({ default: m.MobileTricks })));
const TrickDetail = lazyPage(() => import('./pages/TrickDetail').then((m) => ({ default: m.TrickDetail })));
const MobileTrickDetail = lazyPage(() =>
  import('./pages/mobile/MobileTrickDetail').then((m) => ({ default: m.MobileTrickDetail })),
);
const ProfilePage = lazyPage(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const MobileProfilePage = lazyPage(() => import('./pages/mobile/MobileProfilePage').then((m) => ({ default: m.MobileProfilePage })));
const Notifications = lazyPage(() => import('./pages/Notifications').then((m) => ({ default: m.Notifications })));
const MobileNotifications = lazyPage(() => import('./pages/mobile/MobileNotifications').then((m) => ({ default: m.MobileNotifications })));
const Admin = lazyPage(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const AdminMedical = lazyPage(() => import('./pages/AdminMedical').then((m) => ({ default: m.AdminMedical })));
const CompanyRegister = lazyPage(() => import('./pages/company/CompanyRegister').then((m) => ({ default: m.CompanyRegister })));
const CompanyDashboard = lazyPage(() => import('./pages/company/CompanyDashboard').then((m) => ({ default: m.CompanyDashboard })));
const CompanyProfileEdit = lazyPage(() => import('./pages/company/CompanyProfileEdit').then((m) => ({ default: m.CompanyProfileEdit })));
const CompanyBilling = lazyPage(() => import('./pages/company/CompanyBilling').then((m) => ({ default: m.CompanyBilling })));
const CompanyPublic = lazyPage(() => import('./pages/CompanyPublic').then((m) => ({ default: m.CompanyPublic })));
const MyRequests = lazyPage(() => import('./pages/MyRequests').then((m) => ({ default: m.MyRequests })));
const MobileMyRequests = lazyPage(() => import('./pages/mobile/MobileMyRequests').then((m) => ({ default: m.MobileMyRequests })));
// User identity slice: onboarding → personalized home → "مسيرتي"
const Onboarding = lazyPage(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const UserHome = lazyPage(() => import('./pages/UserHome').then((m) => ({ default: m.UserHome })));
const Journey = lazyPage(() => import('./pages/Journey').then((m) => ({ default: m.Journey })));
const News = lazyPage(() => import('./pages/News').then((m) => ({ default: m.News })));
const NewsArticle = lazyPage(() => import('./pages/NewsArticle').then((m) => ({ default: m.NewsArticle })));
const Legal = lazyPage(() => import('./pages/Legal').then((m) => ({ default: m.Legal })));
const NotFound = lazyPage(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

/**
 * The app-wide waiting state: route chunks, the session gate, /r/:code.
 *
 * `chromeless` because the Suspense fallback sits OUTSIDE <Layout> — while a
 * chunk downloads there is no header on screen, so the mark centres on the
 * whole viewport. HomeGate is the exception: it renders inside Layout.
 */
function Spinner({ chromeless = true }: { chromeless?: boolean }) {
  return <RafiqLoaderScreen chromeless={chromeless} />;
}

/** /r/:code — capture the referral, record the click, then land on home. */
function ReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (code) {
      localStorage.setItem('rafiq_ref', code.toUpperCase());
      referrals.click(code).catch(() => {});
    }
    navigate('/', { replace: true });
  }, [code, navigate]);
  return <Spinner />;
}

/** ?r=CODE on any landing URL also attributes the referral. */
function ReferralQueryCapture() {
  const [params] = useSearchParams();
  useEffect(() => {
    const code = params.get('r');
    if (code && localStorage.getItem('rafiq_ref') !== code.toUpperCase()) {
      localStorage.setItem('rafiq_ref', code.toUpperCase());
      referrals.click(code).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * "/" is two different products: the marketing page for guests, the personal
 * dashboard (tasks + suggestions) for signed-in users — same URL, like most
 * consumer apps. While the session resolves we show the spinner, never the
 * guest page (avoids flashing marketing at a signed-in user), and a signed-in
 * user who hasn't finished onboarding is replaced into /onboarding before the
 * dashboard mounts — it must never render behind the questionnaire.
 */
function HomeGate({ isMobile }: { isMobile: boolean }) {
  const { user, authLoading, onboardingCompleted } = useApp();
  const navigate = useNavigate();

  // Google sign-in is a full-page redirect, so a page that sent the guest to
  // /auth (e.g. /map) stashed its path here rather than in router state — an
  // effect (not the render body) reads it, so it survives StrictMode's
  // double-render in dev.
  useEffect(() => {
    if (!user || !onboardingCompleted) return;
    const pending = popPostAuthRedirect();
    if (pending) navigate(pending, { replace: true });
  }, [user, onboardingCompleted, navigate]);

  if (authLoading) return <Spinner chromeless={false} />;
  if (user) return onboardingCompleted ? <UserHome /> : <Navigate to="/onboarding" replace />;
  return isMobile ? <MobileHome /> : <Home />;
}

/**
 * Shown when the session is valid but the account is unusable (profile_missing).
 *
 * This has to pre-empt the router. The OAuth return path has no form to render
 * an error on, so without this screen a Google user whose profile row is
 * missing is dropped silently onto the guest home page — signed in as far as
 * Supabase is concerned, signed out as far as the app is concerned, with
 * nothing on screen to explain it. Signing out is offered because it is the one
 * action that reliably clears the bad session.
 */
function AuthErrorScreen({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="card p-10 max-w-md text-center" role="alert">
        <h1 className="text-xl font-extrabold text-navy">{t('auth.errors.profileMissingTitle')}</h1>
        <p className="mt-3 text-sm text-gray-600">{t('auth.errors.profileMissing')}</p>
        <button onClick={onSignOut} className="btn-secondary w-full mt-6">
          {t('common.signOut')}
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { authError, signOut } = useApp();
  const isMobile = useIsMobile();

  // The full-screen language gate is gone on purpose: a first-time visitor
  // used to see four buttons and no product. The language now comes from the
  // URL segment (Accept-Language decided it at the edge — see vercel.json),
  // and the header/footer switchers remain one tap away.
  if (authError === 'profile_missing') return <AuthErrorScreen onSignOut={signOut} />;

  return (
    <>
      <ReferralQueryCapture />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomeGate isMobile={isMobile} />} />
            <Route path="/auth" element={isMobile ? <MobileAuth /> : <Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/premium" element={isMobile ? <MobilePremium /> : <Premium />} />
            {/* Legacy alias — redirects, query string intact. See LegacyRedirects.tsx */}
            <Route path="/chat" element={<ChatRedirect />} />
            <Route path="/help" element={isMobile ? <MobileHelpRequest /> : <HelpRequest />} />
            <Route path="/services" element={isMobile ? <MobileServices /> : <Services />} />
            <Route path="/map" element={isMobile ? <MobileMapPage /> : <MapPage />} />
            <Route path="/referrals" element={isMobile ? <MobileReferrals /> : <Referrals />} />
            <Route path="/real-estate" element={isMobile ? <MobileRealEstate /> : <RealEstate />} />
            {/* `investments` is declared before `:id` so the literal path wins
                over the dynamic listing route. */}
            <Route path="/real-estate/investments" element={<RealEstateInvestments />} />
            <Route path="/real-estate/investments/:slug" element={<InvestmentDetail />} />
            <Route path="/real-estate/:id" element={isMobile ? <MobileRealEstateDetail /> : <RealEstateDetail />} />
            <Route
              path="/real-estate/:id/services"
              element={isMobile ? <MobileListingServices /> : <RealEstateDetail />}
            />
            <Route path="/health-tourism" element={isMobile ? <MobileHealthTourism /> : <HealthTourism />} />
            <Route path="/medical-request" element={<RequireAuth><MedicalRequest /></RequireAuth>} />
            <Route path="/tricks" element={isMobile ? <MobileTricks /> : <Tricks />} />
            <Route path="/tricks/:id" element={isMobile ? <MobileTrickDetail /> : <TrickDetail />} />
            {/* one column/grid either way — a single component serves both breakpoints */}
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<NewsArticle />} />
            {/* The authenticated product surface: every one of these routes
                sends an unfinished user to /onboarding before it renders. */}
            <Route
              path="/profile"
              element={<RequireOnboarded>{isMobile ? <MobileProfilePage /> : <ProfilePage />}</RequireOnboarded>}
            />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<RequireOnboarded><UserHome /></RequireOnboarded>} />
            <Route path="/journey" element={<RequireOnboarded><Journey /></RequireOnboarded>} />
            {/* "حسابي" is /profile. It used to mount ProfilePage a second time,
                which meant phones got the DESKTOP page here (the isMobile branch
                was only on /profile) — so this redirects instead of duplicating. */}
            <Route path="/account" element={<Navigate to="/profile" replace />} />
            <Route path="/requests" element={isMobile ? <MobileMyRequests /> : <MyRequests />} />
            <Route path="/companies/:id" element={<CompanyPublic />} />
            <Route path="/company" element={<CompanyDashboard />} />
            <Route path="/company/register" element={<CompanyRegister />} />
            <Route path="/company/profile" element={<CompanyProfileEdit />} />
            <Route path="/company/billing" element={<CompanyBilling />} />
            <Route path="/notifications" element={isMobile ? <MobileNotifications /> : <Notifications />} />
            <Route path="/admin" element={<Admin />} />
            {/* Bookings moved from its own page/top-nav link into a tab
                inside /admin — old links/bookmarks still land on it. */}
            <Route path="/admin/bookings" element={<Navigate to="/admin?tab=bookings" replace />} />
            <Route path="/admin/medical" element={<AdminMedical />} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="/refund" element={<Legal doc="refund" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  // The language segment is the router's basename, so every existing Link and
  // navigate() stays language-relative for free (/services -> /ru/services on
  // the Russian site). main.tsx guarantees the prefix exists before mount;
  // switching language navigates to the other prefix (see setLanguage), which
  // remounts the router with the new basename.
  const lang = langFromPath(window.location.pathname) ?? DEFAULT_LANG;
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter basename={`/${lang}`}>
          <ScrollToTop />
          <Shell />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
