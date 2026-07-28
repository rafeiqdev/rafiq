import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, auth as authApi } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { AppIcon } from '../components/AppIcon';

const ERROR_KEYS: Record<string, string> = {
  weak_password: 'auth.errors.weakPassword',
  reset_expired: 'auth.reset.expired',
  rate_limited: 'auth.reset.rateLimited',
};

/**
 * Lands here from the recovery email. supabase-js (detectSessionInUrl) turns
 * the link's hash into a session in the background, so the session is not
 * necessarily there yet on first render — wait for the auth event before
 * declaring the link dead.
 */
type LinkState = 'checking' | 'ready' | 'expired';

export function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLinkState('expired');
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setLinkState('ready');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session) setLinkState('ready');
    });
    // If the hash was consumed already (expired/used link) no event ever
    // arrives — give detectSessionInUrl a moment, then call it dead.
    const timer = setTimeout(() => {
      if (!cancelled) setLinkState((s) => (s === 'checking' ? 'expired' : s));
    }, 4000);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const submit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('auth.reset.mismatch');
      return;
    }
    setBusy(true);
    try {
      await authApi.updatePassword(password);
      setDone(true);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'reset_expired') setLinkState('expired');
      else setError(ERROR_KEYS[code] ?? 'auth.errors.generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <div className="flex justify-center">
          <Logo size={64} />
        </div>

        {done ? (
          <div className="text-center">
            <p role="status" className="mt-6 rounded-xl bg-brand-blue/60 text-navy text-sm px-3 py-2 flex items-center gap-2">
              <AppIcon name="check-circle" className="w-4 h-4 shrink-0" />
              {t('auth.reset.done')}
            </p>
            <button onClick={() => navigate('/home', { replace: true })} className="btn-primary w-full mt-6">
              {t('auth.reset.continue')}
            </button>
          </div>
        ) : linkState === 'expired' ? (
          <div className="text-center">
            <h1 className="mt-4 text-2xl font-extrabold text-navy">{t('auth.reset.expiredTitle')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('auth.reset.expired')}</p>
            <Link to="/auth" className="btn-primary w-full mt-6">
              {t('auth.reset.requestAgain')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-extrabold text-navy text-center">{t('auth.reset.newTitle')}</h1>
            <p className="mt-2 text-sm text-gray-500 text-center">{t('auth.reset.newSubtitle')}</p>
            <form
              className="mt-6 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className="text-xs font-semibold text-navy/70">
                {t('auth.reset.newPassword')}
                <input
                  className="input mt-1"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="text-xs font-semibold text-navy/70">
                {t('auth.reset.confirmPassword')}
                <input
                  className="input mt-1"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              {error && (
                <p role="alert" className="amber-note flex items-center gap-2">
                  <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                  {t(error)}
                </p>
              )}
              <button type="submit" disabled={busy || linkState === 'checking'} className="btn-primary w-full disabled:opacity-60">
                {t('auth.reset.save')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
