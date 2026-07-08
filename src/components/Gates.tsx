import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { AppIcon, DirArrow } from './AppIcon';

/** Sign-in wall for auth-gated routes. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useApp();
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

/** Admin wall: restricted to admin emails. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useApp();
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
  const { user } = useApp();
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
  const { tier } = useApp();
  const allowed = tier === 'pro' || tier === 'elite';
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
