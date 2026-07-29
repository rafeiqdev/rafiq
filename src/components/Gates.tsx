import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { AppIcon, DirArrow } from './AppIcon';
import { RafiqLoader } from './RafiqLoader';

/**
 * Neutral placeholder shown while the session is still being restored.
 * Without it every guard would paint its wall on the first frame and then
 * swap to the real page a moment later — the flash users reported.
 */
function GatePending() {
  return (
    <div className="mx-auto max-w-md px-4 text-center" aria-busy>
      <RafiqLoader size="sm" className="min-h-[60vh]" />
    </div>
  );
}

/**
 * Sign-in wall for auth-gated routes. A guest is sent straight to /auth
 * (rather than shown an inline "sign in required" card) and Auth.tsx sends
 * them right back here once they're signed in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <GatePending />;
  if (user) return <>{children}</>;
  const from = `${location.pathname}${location.search}`;
  return <Navigate to="/auth" state={{ from }} replace />;
}

/**
 * Onboarding wall for the personalized product surface (/home, /journey,
 * /account, /profile).
 *
 * The single decision point for the whole flow:
 *   auth loading            → neutral placeholder (never a personalized frame)
 *   signed out              → the sign-in wall, NOT a redirect (a guest sent to
 *                             /onboarding would bounce back here forever)
 *   onboarding incomplete   → replace into /onboarding, so Back cannot return
 *                             to the invalid state we just left
 *   onboarding complete     → the page
 *
 * `authLoading` covers the profile too: auth.me() returns session, user and
 * answers in one response, so by the time it clears, completion is known — the
 * caller never paints personalized content on a guess.
 */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { user, authLoading, onboardingCompleted } = useApp();
  if (authLoading) return <GatePending />;
  if (!user) return <RequireAuth>{children}</RequireAuth>;
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Admin wall: restricted to admin emails. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, authLoading } = useApp();
  if (authLoading) return <GatePending />;
  if (user?.isAdmin) return <>{children}</>;
  return (
    <RequireAuth>
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip mx-auto">
            <AppIcon name="shield" className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm font-semibold text-navy">{t('gates.adminOnly')}</p>
        </div>
      </div>
    </RequireAuth>
  );
}

/** Company-portal wall: restricted to the 'company' role (admins pass too). */
export function RequireCompany({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, authLoading } = useApp();
  if (authLoading) return <GatePending />;
  if (user?.isCompany || user?.isAdmin) return <>{children}</>;
  return (
    <RequireAuth>
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip mx-auto">
            <AppIcon name="briefcase" className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-navy">{t('company.gate.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('company.gate.body')}</p>
          <Link to="/company/register" className="btn-primary w-full mt-6">
            {t('company.gate.cta')}
            <DirArrow />
          </Link>
        </div>
      </div>
    </RequireAuth>
  );
}
