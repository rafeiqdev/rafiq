import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { ApiError, auth as authApi, profileApi } from '../../lib/api';
import { stashPostAuthRedirect } from '../../lib/authRedirect';
import { LoginScreen, type ScreenViewMode } from './auth/LoginScreen';
import type { AppLanguage } from './auth/KineticHeader';
import type { AuthSubmitData } from './auth/AuthFormScreen';
import './auth/authV2.css';

const ERROR_KEYS: Record<string, string> = {
  user_not_found: 'auth.errors.userNotFound',
  wrong_password: 'auth.errors.wrongPassword',
  email_exists: 'auth.errors.emailExists',
  weak_password: 'auth.errors.weakPassword',
  bad_email: 'auth.errors.generic',
  profile_missing: 'auth.errors.profileMissing',
};

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
const isValidPhone = (s: string) => (s || '').trim().length >= 6;
function isValidName(name: string): boolean {
  const trimmed = (name || '').trim();
  const letters = (trimmed.match(/\p{L}/gu) ?? []).length;
  return trimmed.length >= 3 && letters >= 2;
}

const SUPPORTED: AppLanguage[] = ['en', 'ar', 'ru', 'fa'];

export function MobileAuth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const { user, login, register, googleSignIn, signOut } = useApp();

  const [screen, setScreen] = useState<ScreenViewMode>('welcome');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  const rawLang = (i18n.language || 'en').split('-')[0] as AppLanguage;
  const language: AppLanguage = SUPPORTED.includes(rawLang) ? rawLang : 'en';
  const isRTL = language === 'ar' || language === 'fa';

  const resetMessages = () => {
    setErrorKey(null);
    setNoticeKey(null);
  };

  const changeScreen = (next: ScreenViewMode) => {
    resetMessages();
    setScreen(next);
  };

  const goHome = () => navigate('/');

  async function handleGoogle() {
    resetMessages();
    setGoogleBusy(true);
    try {
      if (from) stashPostAuthRedirect(from);
      // Supabase OAuth full-page redirect — nothing else runs on success.
      await googleSignIn();
    } catch {
      setErrorKey('auth.errors.generic');
      setGoogleBusy(false);
    }
  }

  async function handleForgot(email: string) {
    resetMessages();
    if (!isValidEmail(email)) {
      setErrorKey('auth.errors.generic');
      return;
    }
    setFormBusy(true);
    try {
      await authApi.requestPasswordReset(email);
      setNoticeKey('auth.reset.sent');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setErrorKey(code === 'rate_limited' ? 'auth.reset.rateLimited' : 'auth.errors.generic');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleSubmit(data: AuthSubmitData) {
    resetMessages();

    if (!isValidEmail(data.email)) {
      setErrorKey('auth.errors.generic');
      return;
    }
    if (data.mode === 'signup') {
      if (!isValidName(data.name)) {
        setErrorKey('common.nameInvalid');
        return;
      }
      if (!isValidPhone(data.phone)) {
        setErrorKey('auth.errors.generic');
        return;
      }
    }

    setFormBusy(true);
    try {
      if (data.mode === 'login') {
        await login(data.email, data.password);
        navigate(from ?? '/', { replace: true });
      } else {
        const result = await register(data.email, data.password, data.name);
        if (result?.needsConfirmation) {
          setNoticeKey('auth.checkEmail');
          setScreen('login');
        } else {
          await profileApi.setPhone(data.phone).catch(() => {});
          navigate(from ?? '/', { replace: true });
        }
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setErrorKey((code && ERROR_KEYS[code]) || 'auth.errors.generic');
    } finally {
      setFormBusy(false);
    }
  }

  // ── Already signed in ────────────────────────────────────────────────
  if (user) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-cream px-6">
        <div className="card w-full max-w-sm animate-pop p-7 text-center">
          <p className="text-sm text-navy/60">{t('auth.signedInAs')}</p>
          <p className="mt-1 break-all text-lg font-bold text-navy">{user.email}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={goHome} className="btn btn-primary h-[52px] w-full text-base">
              {t('auth.continue')}
            </button>
            <button type="button" onClick={() => signOut()} className="btn btn-ghost h-[52px] w-full text-base">
              {t('common.signOut')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Redesigned welcome + auth ────────────────────────────────────────
  return (
    <LoginScreen
      language={language}
      sheetTheme="rafiq-navy"
      activeScreen={screen}
      googleBusy={googleBusy}
      formBusy={formBusy}
      errorText={errorKey ? t(errorKey) : null}
      noticeText={noticeKey ? t(noticeKey) : null}
      onScreenChange={changeScreen}
      onClose={goHome}
      onGoogle={handleGoogle}
      onSubmit={handleSubmit}
      onForgot={handleForgot}
    />
  );
}
