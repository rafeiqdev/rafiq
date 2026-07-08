import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { LanguageSelector } from './components/LanguageSelector';
import { OnboardingModal } from './components/OnboardingModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { referrals } from './lib/api';
import { Home } from './pages/Home';

// P3-7: secondary routes are lazy-loaded to keep the initial bundle small
const Auth = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Auth })));
const Pricing = lazy(() => import('./pages/Pricing').then((m) => ({ default: m.Pricing })));
const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })));
const Smart = lazy(() => import('./pages/Smart').then((m) => ({ default: m.Smart })));
const Premium = lazy(() => import('./pages/Premium').then((m) => ({ default: m.Premium })));
const HelpRequest = lazy(() => import('./pages/HelpRequest').then((m) => ({ default: m.HelpRequest })));
const Services = lazy(() => import('./pages/Services').then((m) => ({ default: m.Services })));
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const Referrals = lazy(() => import('./pages/Referrals').then((m) => ({ default: m.Referrals })));
const Residency = lazy(() => import('./pages/Residency').then((m) => ({ default: m.Residency })));
const RealEstate = lazy(() => import('./pages/RealEstate').then((m) => ({ default: m.RealEstate })));
const HealthTourism = lazy(() => import('./pages/HealthTourism').then((m) => ({ default: m.HealthTourism })));
const Tricks = lazy(() => import('./pages/Tricks').then((m) => ({ default: m.Tricks })));
const Hub = lazy(() => import('./pages/Hub').then((m) => ({ default: m.Hub })));
const HubDetail = lazy(() => import('./pages/Hub').then((m) => ({ default: m.HubDetail })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const Notifications = lazy(() => import('./pages/Notifications').then((m) => ({ default: m.Notifications })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const AdminBookings = lazy(() => import('./pages/AdminBookings').then((m) => ({ default: m.AdminBookings })));
const CompanyRegister = lazy(() => import('./pages/company/CompanyRegister').then((m) => ({ default: m.CompanyRegister })));
const CompanyDashboard = lazy(() => import('./pages/company/CompanyDashboard').then((m) => ({ default: m.CompanyDashboard })));
const CompanyProfileEdit = lazy(() => import('./pages/company/CompanyProfileEdit').then((m) => ({ default: m.CompanyProfileEdit })));
const CompanyBilling = lazy(() => import('./pages/company/CompanyBilling').then((m) => ({ default: m.CompanyBilling })));
const CompanyPublic = lazy(() => import('./pages/CompanyPublic').then((m) => ({ default: m.CompanyPublic })));
const MyRequests = lazy(() => import('./pages/MyRequests').then((m) => ({ default: m.MyRequests })));
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

function Shell() {
  const { langSelected, onboarded } = useApp();

  if (!langSelected) return <LanguageSelector />;

  return (
    <>
      <ReferralQueryCapture />
      {!onboarded && <OnboardingModal />}
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/smart" element={<Smart />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/chat" element={<Premium />} />
            <Route path="/help" element={<HelpRequest />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:slug" element={<GuidePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/residency" element={<Residency />} />
            <Route path="/real-estate" element={<RealEstate />} />
            <Route path="/health-tourism" element={<HealthTourism />} />
            <Route path="/tricks" element={<Tricks />} />
            <Route path="/hub" element={<Hub />} />
            <Route path="/hub/:slug" element={<HubDetail />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/requests" element={<MyRequests />} />
            <Route path="/companies/:id" element={<CompanyPublic />} />
            <Route path="/company" element={<CompanyDashboard />} />
            <Route path="/company/register" element={<CompanyRegister />} />
            <Route path="/company/profile" element={<CompanyProfileEdit />} />
            <Route path="/company/billing" element={<CompanyBilling />} />
            <Route path="/notifications" element={<Notifications />} />
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
