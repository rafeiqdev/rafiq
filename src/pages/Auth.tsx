import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { ApiError } from '../lib/api';
import { Logo } from '../components/Logo';
import { AppIcon } from '../components/AppIcon';

const ERROR_KEYS: Record<string, string> = {
  user_not_found: 'auth.errors.userNotFound',
  wrong_password: 'auth.errors.wrongPassword',
  email_exists: 'auth.errors.emailExists',
  weak_password: 'auth.errors.weakPassword',
  bad_email: 'auth.errors.generic',
};

const isValidName = (s: string) => {
  const v = (s || '').trim();
  return v.length >= 3 && (v.match(/\p{L}/gu)?.length ?? 0) >= 2;
};

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

export function Auth() {
  const { t } = useTranslation();
  const { user, login, register, googleSignIn, signOut } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Google via Supabase OAuth (full-page redirect → back to the app)
  const continueWithGoogle = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await googleSignIn();
      // redirect happens; nothing else runs here on success
    } catch {
      setError('auth.errors.generic');
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setNameError(null);
    if (mode === 'register' && !isValidName(name)) {
      setNameError('common.nameInvalid');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await login(email, password);
        navigate('/');
      } else {
        const { needsConfirmation } = await register(email, password, name);
        if (needsConfirmation) {
          setNotice('auth.checkEmail');
          setMode('signin');
        } else {
          navigate('/');
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? (ERROR_KEYS[e.code] ?? 'auth.errors.generic') : 'auth.errors.generic');
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

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <div className="flex justify-center">
          <Logo size={64} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-navy text-center">
          {mode === 'signin' ? t('auth.title') : t('auth.registerTitle')}
        </h1>
        <p className="mt-2 text-sm text-gray-500 text-center">
          {mode === 'signin' ? t('auth.subtitle') : t('auth.registerSubtitle')}
        </p>

        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={busy}
          className="btn-secondary w-full mt-6 disabled:opacity-60"
        >
          <GoogleMark />
          {t('auth.google')}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
          <div className="flex-1 h-px bg-cream-dark" />
          {t('auth.or')}
          <div className="flex-1 h-px bg-cream-dark" />
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {mode === 'register' && (
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
            <input
              className="input mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="text-xs font-semibold text-navy/70">
            {t('common.password')}
            <input
              className="input mt-1"
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>
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
            {mode === 'signin' ? t('common.signIn') : t('common.register')}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'register' : 'signin');
            setError(null);
            setNameError(null);
            setNotice(null);
          }}
          className="mt-4 w-full text-center text-sm text-navy underline-offset-2 hover:underline"
        >
          {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>
      </div>
    </div>
  );
}
