import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { AppIcon, DirArrow } from './AppIcon';

/**
 * Neutral placeholder shown while the session is still being restored.
 * Without it every guard would paint its wall on the first frame and then
 * swap to the real page a moment later — the flash users reported.
 */
function GatePending() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center" aria-busy>
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-gold" />
    </div>
  );
}

/** Sign-in wall for auth-gated routes. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, authLoading } = useApp();
  if (authLoading) return <GatePending />;
  if (user) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="card p-8">
        <div className="icon-chip mx-auto">
          <AppIcon name="lock" className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-navy">{t('gates.authRequired.title')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('gates.authRequired.body')}</p>
        <Link to="/auth" className="btn-primary w-full mt-6">
          {t('gates.authRequired.cta')}
        </Link>
      </div>
    </div>
  );
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

/** Up-sell shield for Pro/Elite features. */
export function UpsellGate({
  titleKey,
  bodyKey,
  ctaKey,
  children,
  blurredPreview,
}: {
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  children?: ReactNode;
  blurredPreview?: ReactNode;
}) {
  const { t } = useTranslation();
  const { tier, user, authLoading } = useApp();
  // `tier` defaults to 'free', so a paying user would see the up-sell flash
  // before their subscription loads.
  if (authLoading) return <GatePending />;
  // Admins pass without a subscription: they have to be able to QA paid
  // features, and the database already encodes exactly this (RLS on places is
  // `has_pro() or is_admin()`). Without it an admin is walled out of the very
  // pages they administer.
  const allowed = tier === 'pro' || tier === 'elite' || Boolean(user?.isAdmin);
  if (allowed) return <>{children}</>;

  return (
    <div className="relative">
      {blurredPreview && (
        <div className="pointer-events-none select-none blur-md opacity-60" aria-hidden>
          {blurredPreview}
        </div>
      )}
      <div className={blurredPreview ? 'absolute inset-0 flex items-center justify-center' : 'py-16'}>
        <div className="card p-8 max-w-md mx-auto text-center shadow-cardHover">
          <div className="icon-chip mx-auto">
            <AppIcon name="sparkles" className="w-6 h-6" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold text-navy">{t(titleKey)}</h2>
          <p className="mt-2 text-sm text-gray-500">{t(bodyKey)}</p>
          <Link to="/pricing" className="btn-primary w-full mt-6">
            {t(ctaKey)}
            <DirArrow />
          </Link>
        </div>
      </div>
    </div>
  );
}
