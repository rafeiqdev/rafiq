import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { ApiError, auth as authApi, profileApi } from '../lib/api';
import { Logo } from '../components/Logo';
import { AppIcon } from '../components/AppIcon';
import { stashPostAuthRedirect } from '../lib/authRedirect';
import { PasswordStrength, type PasswordRule } from '../components/ui/password-strength';

/**
 * Where a just-signed-in user lands: onboarding until it's completed, then the
 * personalized home. Reads the fresh session so it can't use stale context.
 */
async function landingRoute(): Promise<string> {
  try {
    const me = await authApi.me();
    return me.user?.onboardingCompleted ? '/home' : '/onboarding';
  } catch {
    return '/home';
  }
}

const ERROR_KEYS: Record<string, string> = {
  user_not_found: 'auth.errors.userNotFound',
  wrong_password: 'auth.errors.wrongPassword',
  email_exists: 'auth.errors.emailExists',
  weak_password: 'auth.errors.weakPassword',
  bad_email: 'auth.errors.generic',
  // Sign-in succeeded at Supabase but the account has no readable profile row.
  // Without this entry the throw fell through to the generic "try again"
  // message, which invited the user into an endless retry loop.
  profile_missing: 'auth.errors.profileMissing',
};

const isValidName = (s: string) => {
  const v = (s || '').trim();
  return v.length >= 3 && (v.match(/\p{L}/gu)?.length ?? 0) >= 2;
};

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const isValidPhone = (s: string) => (s || '').trim().length >= 6;

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z" />
      <path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.8-2.8-.8-4.3s.3-2.9.8-4.3l-7.9-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.3 0-11.6-3.8-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

// 'email' — only the email field + Google button is visible.
// 'signin' / 'register' — resolved by checkEmail() once the address is known.
// 'googleOnly' — the address is registered, but only via Google.
// 'forgot' — reachable from 'signin'.
type Step = 'email' | 'signin' | 'register' | 'googleOnly' | 'forgot';

export function Auth() {
  const { t } = useTranslation();
  const { user, login, register, googleSignIn, signOut } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
    setNameError(null);
  };

  const passwordRules: PasswordRule[] = useMemo(
    () => [
      { id: 'length', label: t('auth.strength.rules.length'), test: (v) => v.length >= 12 },
      {
        id: 'case',
        label: t('auth.strength.rules.case'),
        test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
      },
      { id: 'digit', label: t('auth.strength.rules.digit'), test: (v) => /\d/.test(v) },
      { id: 'symbol', label: t('auth.strength.rules.symbol'), test: (v) => /[!-/:-@[-`{-~]/.test(v) },
    ],
    [t],
  );
  const passwordStrengthLabels = useMemo(
    () => [
      t('auth.strength.labels.empty'),
      t('auth.strength.labels.weak'),
      t('auth.strength.labels.fair'),
      t('auth.strength.labels.good'),
      t('auth.strength.labels.strong'),
    ],
    [t],
  );

  // Google via Supabase OAuth (full-page redirect → back to the app)
  const continueWithGoogle = async () => {
    resetMessages();
    setBusy(true);
    try {
      if (from) stashPostAuthRedirect(from);
      await googleSignIn();
      // redirect happens; nothing else runs here on success
    } catch {
      setError('auth.errors.generic');
      setBusy(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setPassword('');
    resetMessages();
  };

  const submitEmail = async () => {
    resetMessages();
    if (!isValidEmail(email)) {
      setError('auth.errors.generic');
      return;
    }
    setBusy(true);
    try {
      const { exists, providers } = await authApi.checkEmail(email);
      if (!exists) setStep('register');
      else if (providers.includes('email')) setStep('signin');
      else setStep('googleOnly');
    } catch {
      // The check itself is best-effort (e.g. the migration isn't applied
      // yet on this database) — fall back to a plain sign-in attempt rather
      // than blocking the user.
      setStep('signin');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    resetMessages();
    if (step === 'register' && !isValidName(name)) {
      setNameError('common.nameInvalid');
      return;
    }
    if (step === 'register' && !isValidPhone(phone)) {
      setError('auth.errors.generic');
      return;
    }
    setBusy(true);
    try {
      if (step === 'forgot') {
        await authApi.requestPasswordReset(email);
        setNotice('auth.reset.sent');
      } else if (step === 'signin') {
        await login(email, password);
        navigate(from ?? (await landingRoute()), { replace: true });
      } else if (step === 'register') {
        const { needsConfirmation } = await register(email, password, name);
        if (needsConfirmation) {
          setNotice('auth.checkEmail');
          setStep('signin');
        } else {
          await profileApi.setPhone(phone).catch(() => {});
          navigate(from ?? (await landingRoute()), { replace: true });
        }
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (step === 'forgot' && code === 'rate_limited') setError('auth.reset.rateLimited');
      else setError(ERROR_KEYS[code] ?? 'auth.errors.generic');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="card p-8 text-center">
          <Logo size={64} />
          <p className="mt-4 text-sm text-gray-500">{t('auth.signedInAs')}</p>
          <p className="font-bold text-navy break-all">{user.email}</p>
          <button onClick={() => signOut()} className="btn-secondary w-full mt-6">
            {t('common.signOut')}
          </button>
        </div>
      </div>
    );
  }

  const title =
    step === 'signin' ? t('auth.title')
    : step === 'register' ? t('auth.registerTitle')
    : step === 'forgot' ? t('auth.reset.title')
    : t('auth.title');
  const subtitle =
    step === 'signin' ? t('auth.subtitle')
    : step === 'register' ? t('auth.registerSubtitle')
    : step === 'forgot' ? t('auth.reset.subtitle')
    : step === 'googleOnly' ? t('auth.googleOnlyNotice')
    : t('auth.emailSubtitle');

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <div className="flex justify-center">
          <Logo size={64} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-navy text-center">{title}</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">{subtitle}</p>

        {step === 'email' && (
          <Link
            to="/journey"
            className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-btn border-2 border-navy bg-white px-5 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-brand-blue"
          >
            <AppIcon name="compass" className="w-4 h-4" />
            {t('home.guestJourneyCta')}
          </Link>
        )}

        {(step === 'email' || step === 'googleOnly') && (
          <>
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
              className="btn-secondary w-full mt-6 disabled:opacity-60"
            >
              <GoogleMark />
              {t('auth.google')}
            </button>

            {step === 'email' && (
              <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
                <div className="flex-1 h-px bg-cream-dark" />
                {t('auth.or')}
                <div className="flex-1 h-px bg-cream-dark" />
              </div>
            )}
          </>
        )}

        {step === 'email' && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitEmail();
            }}
          >
            <label className="text-xs font-semibold text-navy/70">
              {t('common.email')}
              <input
                className="input mt-1"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </label>
            {error && (
              <p role="alert" className="amber-note flex items-center gap-2">
                <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                {t(error)}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {t('auth.continue')}
            </button>
          </form>
        )}

        {(step === 'signin' || step === 'register' || step === 'forgot') && (
          <form
            className="flex flex-col gap-3 mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {step === 'register' && (
              <label className="text-xs font-semibold text-navy/70">
                {t('common.name')}
                <input
                  className={`input mt-1 ${nameError ? 'border-brand-red ring-1 ring-brand-red' : ''}`}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  autoComplete="name"
                  aria-invalid={!!nameError}
                  autoFocus
                />
                {nameError && (
                  <span className="mt-1 flex items-center gap-1 text-xs font-normal text-brand-red">
                    <AppIcon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" />
                    {t(nameError)}
                  </span>
                )}
              </label>
            )}

            <label className="text-xs font-semibold text-navy/70">
              {t('common.email')}
              <input className="input mt-1 opacity-70" type="email" value={email} disabled />
            </label>

            {step === 'register' && (
              <label className="text-xs font-semibold text-navy/70">
                {t('common.phone')}
                <input
                  className="input mt-1"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
            )}

            {step !== 'forgot' && (
              <label className="text-xs font-semibold text-navy/70">
                {t('common.password')}
                <input
                  className="input mt-1"
                  type="password"
                  required
                  minLength={step === 'register' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={step === 'register' ? 'new-password' : 'current-password'}
                  autoFocus={step === 'signin'}
                />
                {step === 'register' && (
                  <PasswordStrength
                    value={password}
                    rules={passwordRules}
                    labels={passwordStrengthLabels}
                    commonlyGuessedLabel={t('auth.strength.commonlyGuessed')}
                    className="mt-3"
                  />
                )}
              </label>
            )}
            {step === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setStep('forgot');
                  resetMessages();
                }}
                className="self-start text-xs text-navy underline-offset-2 hover:underline"
              >
                {t('auth.forgot')}
              </button>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-brand-blue/60 text-navy text-sm px-3 py-2 flex items-center gap-2">
                <AppIcon name="mail" className="w-4 h-4 shrink-0" />
                {t(notice)}
              </p>
            )}
            {error && (
              <p role="alert" className="amber-note flex items-center gap-2">
                <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                {t(error)}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {step === 'signin' ? t('common.signIn') : step === 'register' ? t('common.register') : t('auth.reset.send')}
            </button>
          </form>
        )}

        {step === 'forgot' && (
          <button
            onClick={() => {
              setStep('signin');
              resetMessages();
            }}
            className="mt-4 w-full text-center text-sm text-navy underline-offset-2 hover:underline"
          >
            {t('auth.reset.backToSignIn')}
          </button>
        )}
        {(step === 'signin' || step === 'register' || step === 'googleOnly') && (
          <button
            onClick={changeEmail}
            className="mt-4 w-full text-center text-sm text-navy underline-offset-2 hover:underline"
          >
            {t('auth.changeEmail')}
          </button>
        )}
      </div>
    </div>
  );
}
