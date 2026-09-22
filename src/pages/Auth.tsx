import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  // ── Shared visual tokens for the immersive navy sign-in shell ──
  // Inputs/buttons here live on a dark glass card, so they can't reuse the
  // light-surface `.input` / `.btn-*` classes; these are their dark twins.
  const field =
    'w-full h-11 px-4 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/40 text-sm outline-none transition focus:border-white/50 focus:ring-2 focus:ring-white/20 focus:bg-white/[0.14]';
  const labelCls = 'text-xs font-semibold text-white/70';
  const btnPrimary =
    'w-full h-11 rounded-full bg-white text-navy font-semibold text-sm shadow-lg transition hover:bg-cream active:translate-y-px disabled:opacity-60 disabled:pointer-events-none';
  const btnGlass =
    'w-full h-11 rounded-full flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white font-medium text-sm transition hover:bg-white/20 disabled:opacity-60 disabled:pointer-events-none';
  const linkBtn =
    'text-xs text-white/70 underline-offset-2 hover:text-white hover:underline transition';

  // Soft brand-navy glows behind the card — the "stunning" depth of the shell.
  const backdrop = (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-navy-light/40 blur-3xl" />
      <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-navy/60 blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-navy-light/20 blur-3xl" />
    </div>
  );

  const shell = 'relative min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-navy-dark via-navy to-navy-dark px-4 py-16';
  const card =
    'relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.03] backdrop-blur-xl shadow-2xl p-8';
  const logoBadge = (
    <div className="flex justify-center mb-5">
      <div className="inline-flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 px-5 py-3 shadow-lg">
        <Logo size={30} variant="white" />
      </div>
    </div>
  );

  if (user) {
    return (
      <div className={shell}>
        {backdrop}
        <div className={`${card} text-center`}>
          {logoBadge}
          <p className="text-sm text-white/60">{t('auth.signedInAs')}</p>
          <p className="mt-1 font-bold text-white break-all">{user.email}</p>
          <button onClick={() => signOut()} className={`${btnGlass} mt-6`}>
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
    <div className={shell}>
      {backdrop}
      <div className={card}>
        {logoBadge}
        <h1 className="text-2xl font-extrabold text-white text-center">{title}</h1>
        <p className="mt-2 text-sm text-white/60 text-center">{subtitle}</p>

        {(step === 'email' || step === 'googleOnly') && (
          <>
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
              className={`${btnGlass} mt-6`}
            >
              <GoogleMark />
              {t('auth.google')}
            </button>

            {step === 'email' && (
              <div className="my-5 flex items-center gap-3 text-xs text-white/40">
                <div className="flex-1 h-px bg-white/15" />
                {t('auth.or')}
                <div className="flex-1 h-px bg-white/15" />
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
            <label className={labelCls}>
              {t('common.email')}
              <input
                className={`${field} mt-1`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-red-500/15 border border-red-400/30 text-red-200 px-3 py-2 text-sm flex items-center gap-2">
                <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                {t(error)}
              </p>
            )}
            <button type="submit" disabled={busy} className={btnPrimary}>
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
              <label className={labelCls}>
                {t('common.name')}
                <input
                  className={`${field} mt-1 ${nameError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
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
                  <span className="mt-1 flex items-center gap-1 text-xs font-normal text-red-300">
                    <AppIcon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" />
                    {t(nameError)}
                  </span>
                )}
              </label>
            )}

            <label className={labelCls}>
              {t('common.email')}
              <input className={`${field} mt-1 opacity-60`} type="email" value={email} disabled />
            </label>

            {step === 'register' && (
              <label className={labelCls}>
                {t('common.phone')}
                <input
                  className={`${field} mt-1`}
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
            )}

            {step !== 'forgot' && (
              <label className={labelCls}>
                {t('common.password')}
                <input
                  className={`${field} mt-1`}
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
                    className="mt-3 [&_span]:!text-white/70"
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
                className={`self-start ${linkBtn}`}
              >
                {t('auth.forgot')}
              </button>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-white/10 border border-white/15 text-white/90 text-sm px-3 py-2 flex items-center gap-2">
                <AppIcon name="mail" className="w-4 h-4 shrink-0" />
                {t(notice)}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-red-500/15 border border-red-400/30 text-red-200 px-3 py-2 text-sm flex items-center gap-2">
                <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                {t(error)}
              </p>
            )}
            <button type="submit" disabled={busy} className={btnPrimary}>
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
            className={`mt-4 w-full text-center ${linkBtn}`}
          >
            {t('auth.reset.backToSignIn')}
          </button>
        )}
        {(step === 'signin' || step === 'register' || step === 'googleOnly') && (
          <button
            onClick={changeEmail}
            className={`mt-4 w-full text-center ${linkBtn}`}
          >
            {t('auth.changeEmail')}
          </button>
        )}
      </div>

      {/* Honest trust line in the reference's "social proof" slot — no invented
          user counts or stock avatars (Rafiq is a real, small brand). */}
      <div className="relative z-10 mt-8 w-full max-w-sm text-center">
        <p className="text-xs leading-relaxed text-white/50">{t('auth.trust')}</p>
      </div>
    </div>
  );
}
