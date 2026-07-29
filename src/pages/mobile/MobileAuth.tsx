import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { auth as authApi } from '../../lib/api';
import { AppIcon } from '../../components/AppIcon';
import { stashPostAuthRedirect } from '../../lib/authRedirect';

const ERROR_KEYS: Record<string, string> = {
  user_not_found: 'auth.errors.userNotFound',
  wrong_password: 'auth.errors.wrongPassword',
  email_exists: 'auth.errors.emailExists',
  weak_password: 'auth.errors.weakPassword',
  bad_email: 'auth.errors.generic',
};

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; modeTabs: string; continueHome: string }> = {
  en: { back: 'Back to home', modeTabs: 'Sign in or create an account', continueHome: 'Continue to home' },
  ar: { back: 'العودة إلى الرئيسية', modeTabs: 'تسجيل الدخول أو إنشاء حساب', continueHome: 'المتابعة إلى الرئيسية' },
  fa: { back: 'بازگشت به صفحه اصلی', modeTabs: 'ورود یا ساخت حساب', continueHome: 'ادامه به صفحه اصلی' },
  ru: { back: 'На главную', modeTabs: 'Вход или регистрация', continueHome: 'Продолжить' },
};

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  const letters = (trimmed.match(/\p{L}/gu) ?? []).length;
  return trimmed.length >= 3 && letters >= 2;
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function MobileAuth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const { user, login, register, googleSignIn, signOut } = useApp();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const copy = mobileCopy[lang] ?? mobileCopy.en;

  const switchMode = (next: 'signin' | 'register') => {
    setMode(next);
    setForgot(false);
    setError(null);
    setNameError(null);
    setNotice(null);
  };

  async function submitForgot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await authApi.requestPasswordReset(email);
      setNotice('auth.reset.sent');
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(code === 'rate_limited' ? 'auth.reset.rateLimited' : 'auth.errors.generic');
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      if (from) stashPostAuthRedirect(from);
      // Supabase OAuth full-page redirect — nothing else runs client-side on success.
      await googleSignIn();
    } catch {
      setError('auth.errors.generic');
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'register' && !isValidName(name)) {
      setNameError('common.nameInvalid');
      return;
    }
    setNameError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await login(email, password);
        navigate(from ?? '/');
      } else {
        const result = await register(email, password, name);
        if (result?.needsConfirmation) {
          setNotice('auth.checkEmail');
          setMode('signin');
        } else {
          navigate(from ?? '/');
        }
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError((code && ERROR_KEYS[code]) || 'auth.errors.generic');
    } finally {
      setBusy(false);
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={() => navigate('/')}
      aria-label={copy.back}
      className="relative -ms-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
    >
      <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
    </button>
  );

  // ── Already signed in ────────────────────────────────────────────────
  if (user) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="flex min-h-dvh flex-col bg-cream">
        <header className="relative shrink-0 overflow-hidden rounded-b-[28px] bg-navy px-6 pb-9 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 end-0 select-none text-[11rem] font-bold leading-none text-white/5">ر</span>
          {backButton}
        </header>
        <main className="flex flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-7">
          <div className="card animate-pop p-7 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="check-circle" className="h-6 w-6 text-white" />
            </div>
            <p className="mt-4 text-sm text-navy/60">{t('auth.signedInAs')}</p>
            <p className="mt-1 break-all text-lg font-bold text-navy">{user.email}</p>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-7">
            <button type="button" onClick={() => navigate('/')} className="btn btn-primary h-[52px] w-full text-base">
              {copy.continueHome}
            </button>
            <button type="button" onClick={() => signOut()} className="btn btn-ghost h-[52px] w-full text-base">
              {t('common.signOut')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Auth form ────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex min-h-dvh flex-col bg-cream">
      {/* Navy hero */}
      <header className="relative shrink-0 overflow-hidden rounded-b-[28px] bg-navy px-6 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 end-0 select-none text-[11.5rem] font-bold leading-none text-white/5">ر</span>
        {backButton}
        <div className="relative mt-5 animate-fade-up">
          <h1 className="text-[26px] font-extrabold leading-tight text-white">
            {t(forgot ? 'auth.reset.title' : mode === 'signin' ? 'auth.title' : 'auth.registerTitle')}
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
            {t(forgot ? 'auth.reset.subtitle' : mode === 'signin' ? 'auth.subtitle' : 'auth.registerSubtitle')}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-6">
        {/* Segmented mode control */}
        {!forgot && (
        <div role="tablist" aria-label={copy.modeTabs} className="flex shrink-0 gap-1 rounded-btn bg-cream-dark p-1">
          {(['signin', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`h-[46px] flex-1 rounded-[9px] text-[15px] font-bold transition-all ${
                mode === m ? 'bg-white text-navy shadow-sm' : 'text-navy/50'
              }`}
            >
              {t(m === 'signin' ? 'common.signIn' : 'common.register')}
            </button>
          ))}
        </div>
        )}

        {/* Notice / error banners */}
        {notice && (
          <div className="mt-4 flex animate-pop items-start gap-2.5 rounded-btn bg-brand-blue px-3.5 py-3 text-[13.5px] font-medium leading-relaxed text-navy">
            <AppIcon name="check-circle" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{t(notice)}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="mt-4 flex animate-pop items-start gap-2.5 rounded-btn border border-brand-red/20 bg-brand-red/10 px-3.5 py-3 text-[13.5px] font-medium leading-relaxed text-brand-red">
            <AppIcon name="alert-triangle" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{t(error)}</span>
          </div>
        )}

        {forgot ? (
          <form onSubmit={submitForgot} noValidate className="mt-[18px] flex flex-col gap-3.5">
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] font-bold text-navy">
                {t('common.email')}
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input h-[50px] w-full text-base"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary mt-1 h-[52px] w-full text-base disabled:opacity-70"
            >
              {busy ? (
                <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/35 border-t-white" />
              ) : (
                t('auth.reset.send')
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setForgot(false);
                setError(null);
                setNotice(null);
              }}
              className="mt-1 text-center text-sm font-bold text-navy underline-offset-2 active:underline"
            >
              {t('auth.reset.backToSignIn')}
            </button>
          </form>
        ) : (
        <form onSubmit={submit} noValidate className="mt-[18px] flex flex-col gap-3.5">
          {mode === 'register' && (
            <div className="animate-fade-up">
              <label htmlFor="auth-name" className="mb-1.5 block text-[13px] font-bold text-navy">
                {t('common.name')}
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                className={`input h-[50px] w-full text-base ${nameError ? 'border-brand-red/60' : ''}`}
              />
              {nameError && (
                <p className="mt-1.5 animate-pop text-[13px] font-medium text-brand-red">{t(nameError)}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-[13px] font-bold text-navy">
              {t('common.email')}
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input h-[50px] w-full text-base"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-[13px] font-bold text-navy">
              {t('common.password')}
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input h-[50px] w-full text-base"
            />
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setForgot(true);
                  setError(null);
                  setNotice(null);
                }}
                className="mt-2 text-[13px] font-bold text-navy/70 underline-offset-2 active:underline"
              >
                {t('auth.forgot')}
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary mt-1 h-[52px] w-full text-base disabled:opacity-70"
          >
            {busy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/35 border-t-white" />
            ) : (
              t(mode === 'signin' ? 'common.signIn' : 'common.register')
            )}
          </button>
        </form>
        )}

        {!forgot && (
          <>
            <div aria-hidden="true" className="my-[18px] flex items-center gap-3">
              <span className="h-px flex-1 bg-navy/10" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-navy/40">{t('auth.or')}</span>
              <span className="h-px flex-1 bg-navy/10" />
            </div>

            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
              className="btn btn-secondary h-[52px] w-full gap-2.5 text-[15px] disabled:opacity-70"
            >
              <GoogleIcon />
              {t('auth.google')}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
