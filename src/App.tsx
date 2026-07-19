import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { LanguageSelector } from './components/LanguageSelector';
import { RequireOnboarded } from './components/Gates';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { referrals } from './lib/api';
import { Home } from './pages/Home';
import { useIsMobile } from './hooks/useIsMobile';

// P3-7: secondary routes are lazy-loaded to keep the initial bundle small
const Auth = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Auth })));
// Dedicated mobile screens (phone viewports) — same route, different component.
// See mobile-prompts/ for the design prompts used to generate these.
const MobileAuth = lazy(() => import('./pages/mobile/MobileAuth').then((m) => ({ default: m.MobileAuth })));
const MobileHome = lazy(() => import('./pages/mobile/MobileHome').then((m) => ({ default: m.MobileHome })));
const MobilePricing = lazy(() => import('./pages/mobile/MobilePricing').then((m) => ({ default: m.MobilePricing })));
const Pricing = lazy(() => import('./pages/Pricing').then((m) => ({ default: m.Pricing })));
const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })));
const MobileCheckout = lazy(() => import('./pages/mobile/MobileCheckout').then((m) => ({ default: m.MobileCheckout })));
const Smart = lazy(() => import('./pages/Smart').then((m) => ({ default: m.Smart })));
const MobileSmart = lazy(() => import('./pages/mobile/MobileSmart').then((m) => ({ default: m.MobileSmart })));
const Premium = lazy(() => import('./pages/Premium').then((m) => ({ default: m.Premium })));
const MobilePremium = lazy(() => import('./pages/mobile/MobilePremium').then((m) => ({ default: m.MobilePremium })));
const HelpRequest = lazy(() => import('./pages/HelpRequest').then((m) => ({ default: m.HelpRequest })));
const MobileHelpRequest = lazy(() => import('./pages/mobile/MobileHelpRequest').then((m) => ({ default: m.MobileHelpRequest })));
const Services = lazy(() => import('./pages/Services').then((m) => ({ default: m.Services })));
const MobileServices = lazy(() => import('./pages/mobile/MobileServices').then((m) => ({ default: m.MobileServices })));
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));
const MobileGuidePage = lazy(() => import('./pages/mobile/MobileGuidePage').then((m) => ({ default: m.MobileGuidePage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const MobileMapPage = lazy(() => import('./pages/mobile/MobileMapPage').then((m) => ({ default: m.MobileMapPage })));
const Referrals = lazy(() => import('./pages/Referrals').then((m) => ({ default: m.Referrals })));
const MobileReferrals = lazy(() => import('./pages/mobile/MobileReferrals').then((m) => ({ default: m.MobileReferrals })));
const Residency = lazy(() => import('./pages/Residency').then((m) => ({ default: m.Residency })));
const MobileResidency = lazy(() => import('./pages/mobile/MobileResidency').then((m) => ({ default: m.MobileResidency })));
const RealEstate = lazy(() => import('./pages/RealEstate').then((m) => ({ default: m.RealEstate })));
const MobileRealEstate = lazy(() => import('./pages/mobile/MobileRealEstate').then((m) => ({ default: m.MobileRealEstate })));
const HealthTourism = lazy(() => import('./pages/HealthTourism').then((m) => ({ default: m.HealthTourism })));
const MobileHealthTourism = lazy(() => import('./pages/mobile/MobileHealthTourism').then((m) => ({ default: m.MobileHealthTourism })));
const Tricks = lazy(() => import('./pages/Tricks').then((m) => ({ default: m.Tricks })));
const MobileTricks = lazy(() => import('./pages/mobile/MobileTricks').then((m) => ({ default: m.MobileTricks })));
const Hub = lazy(() => import('./pages/Hub').then((m) => ({ default: m.Hub })));
const MobileHub = lazy(() => import('./pages/mobile/MobileHub').then((m) => ({ default: m.MobileHub })));
const HubDetail = lazy(() => import('./pages/Hub').then((m) => ({ default: m.HubDetail })));
const MobileHubDetail = lazy(() => import('./pages/mobile/MobileHubDetail').then((m) => ({ default: m.MobileHubDetail })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const MobileProfilePage = lazy(() => import('./pages/mobile/MobileProfilePage').then((m) => ({ default: m.MobileProfilePage })));
const Notifications = lazy(() => import('./pages/Notifications').then((m) => ({ default: m.Notifications })));
const MobileNotifications = lazy(() => import('./pages/mobile/MobileNotifications').then((m) => ({ default: m.MobileNotifications })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const AdminBookings = lazy(() => import('./pages/AdminBookings').then((m) => ({ default: m.AdminBookings })));
const CompanyRegister = lazy(() => import('./pages/company/CompanyRegister').then((m) => ({ default: m.CompanyRegister })));
const CompanyDashboard = lazy(() => import('./pages/company/CompanyDashboard').then((m) => ({ default: m.CompanyDashboard })));
const CompanyProfileEdit = lazy(() => import('./pages/company/CompanyProfileEdit').then((m) => ({ default: m.CompanyProfileEdit })));
const CompanyBilling = lazy(() => import('./pages/company/CompanyBilling').then((m) => ({ default: m.CompanyBilling })));
const CompanyPublic = lazy(() => import('./pages/CompanyPublic').then((m) => ({ default: m.CompanyPublic })));
const MyRequests = lazy(() => import('./pages/MyRequests').then((m) => ({ default: m.MyRequests })));
const MobileMyRequests = lazy(() => import('./pages/mobile/MobileMyRequests').then((m) => ({ default: m.MobileMyRequests })));
// User identity slice: onboarding → personalized home → "مسيرتي"
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const UserHome = lazy(() => import('./pages/UserHome').then((m) => ({ default: m.UserHome })));
const Journey = lazy(() => import('./pages/Journey').then((m) => ({ default: m.Journey })));
const Legal = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Legal })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

function Spinner() {
  return (
    <div className="flex items-center justify-center py-32" role="status" aria-live="polite">
      <div className="w-10 h-10 rounded-full border-4 border-cream-dark border-t-navy animate-spin" />
    </div>
  );
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
  if (authLoading) return <Spinner />;
  if (user) return onboardingCompleted ? <UserHome /> : <Navigate to="/onboarding" replace />;
  return isMobile ? <MobileHome /> : <Home />;
}

function Shell() {
  const { langSelected } = useApp();
  const isMobile = useIsMobile();

  if (!langSelected) return <LanguageSelector />;

  return (
    <>
      <ReferralQueryCapture />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomeGate isMobile={isMobile} />} />
            <Route path="/auth" element={isMobile ? <MobileAuth /> : <Auth />} />
            <Route path="/pricing" element={isMobile ? <MobilePricing /> : <Pricing />} />
            <Route path="/checkout" element={isMobile ? <MobileCheckout /> : <Checkout />} />
            <Route path="/smart" element={isMobile ? <MobileSmart /> : <Smart />} />
            <Route path="/premium" element={isMobile ? <MobilePremium /> : <Premium />} />
            <Route path="/chat" element={isMobile ? <MobilePremium /> : <Premium />} />
            <Route path="/help" element={isMobile ? <MobileHelpRequest /> : <HelpRequest />} />
            <Route path="/services" element={isMobile ? <MobileServices /> : <Services />} />
            <Route path="/services/:slug" element={isMobile ? <MobileGuidePage /> : <GuidePage />} />
            <Route path="/map" element={isMobile ? <MobileMapPage /> : <MapPage />} />
            <Route path="/referrals" element={isMobile ? <MobileReferrals /> : <Referrals />} />
            <Route path="/residency" element={isMobile ? <MobileResidency /> : <Residency />} />
            <Route path="/real-estate" element={isMobile ? <MobileRealEstate /> : <RealEstate />} />
            <Route path="/health-tourism" element={isMobile ? <MobileHealthTourism /> : <HealthTourism />} />
            <Route path="/tricks" element={isMobile ? <MobileTricks /> : <Tricks />} />
            <Route path="/hub" element={isMobile ? <MobileHub /> : <Hub />} />
            <Route path="/hub/:slug" element={isMobile ? <MobileHubDetail /> : <HubDetail />} />
            {/* The authenticated product surface: every one of these routes
                sends an unfinished user to /onboarding before it renders. */}
            <Route
              path="/profile"
              element={<RequireOnboarded>{isMobile ? <MobileProfilePage /> : <ProfilePage />}</RequireOnboarded>}
            />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<RequireOnboarded><UserHome /></RequireOnboarded>} />
            <Route path="/journey" element={<RequireOnboarded><Journey /></RequireOnboarded>} />
            {/* "حسابي" reuses the existing profile page — no duplicate account system */}
            <Route path="/account" element={<RequireOnboarded><ProfilePage /></RequireOnboarded>} />
            <Route path="/requests" element={isMobile ? <MobileMyRequests /> : <MyRequests />} />
            <Route path="/companies/:id" element={<CompanyPublic />} />
            <Route path="/company" element={<CompanyDashboard />} />
            <Route path="/company/register" element={<CompanyRegister />} />
            <Route path="/company/profile" element={<CompanyProfileEdit />} />
            <Route path="/company/billing" element={<CompanyBilling />} />
            <Route path="/notifications" element={isMobile ? <MobileNotifications /> : <Notifications />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/bookings" element={<AdminBookings />} />
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
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Shell />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
