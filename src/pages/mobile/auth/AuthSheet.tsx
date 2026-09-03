import React from 'react';
import { GoogleLogo } from './icons';
import type { AppLanguage } from './KineticHeader';

export type SheetTheme = 'rafiq-navy' | 'cream';

interface AuthSheetProps {
  language: AppLanguage;
  theme: SheetTheme;
  googleBusy?: boolean;
  onSignInWithGoogle?: () => void;
  onSignUp?: () => void;
  onLogIn?: () => void;
}

const LOCALIZED_TEXTS: Record<
  AppLanguage,
  { continueGoogle: string; signUp: string; logIn: string; connecting: string }
> = {
  en: {
    continueGoogle: 'Continue with Google',
    signUp: 'Sign up',
    logIn: 'Log in',
    connecting: 'Connecting...',
  },
  ar: {
    continueGoogle: 'المتابعة باستخدام Google',
    signUp: 'إنشاء حساب',
    logIn: 'تسجيل الدخول',
    connecting: 'جاري الاتصال...',
  },
  ru: {
    continueGoogle: 'Войти через Google',
    signUp: 'Регистрация',
    logIn: 'Вход',
    connecting: 'Подключение...',
  },
  fa: {
    continueGoogle: 'ورود با Google',
    signUp: 'ثبت‌نام',
    logIn: 'ورود به حساب',
    connecting: 'در حال اتصال...',
  },
};

export const AuthSheet: React.FC<AuthSheetProps> = ({
  language,
  theme,
  googleBusy = false,
  onSignInWithGoogle,
  onSignUp,
  onLogIn,
}) => {
  const isRtl = language === 'ar' || language === 'fa';
  const texts = LOCALIZED_TEXTS[language] || LOCALIZED_TEXTS.en;

  const c =
    theme === 'cream'
      ? {
          sheetBg: '#F5F2E6',
          googleBtnBg: '#FFFFFF',
          googleBtnText: '#09245E',
          googleBtnBorder: '1px solid rgba(9, 36, 94, 0.12)',
          signUpBtnBg: '#09245E',
          signUpBtnText: '#FFFFFF',
          logInBtnBg: 'rgba(9, 36, 94, 0.04)',
          logInBtnBorder: '1px solid rgba(9, 36, 94, 0.18)',
          logInBtnText: '#09245E',
          spinnerTrack: 'rgba(9,36,94,0.2)',
          spinnerHead: '#09245E',
        }
      : {
          sheetBg: '#09245E',
          googleBtnBg: 'rgba(255, 255, 255, 0.12)',
          googleBtnText: '#FFFFFF',
          googleBtnBorder: 'none',
          signUpBtnBg: 'rgba(255, 255, 255, 0.18)',
          signUpBtnText: '#FFFFFF',
          logInBtnBg: 'rgba(255, 255, 255, 0.06)',
          logInBtnBorder: '1px solid rgba(255, 255, 255, 0.22)',
          logInBtnText: '#FFFFFF',
          spinnerTrack: 'rgba(255,255,255,0.2)',
          spinnerHead: '#FFFFFF',
        };

  const baseBtn: React.CSSProperties = {
    width: '100%',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    padding: '0 16px',
    boxSizing: 'border-box',
    transition: 'all 0.18s var(--spring-snappy)',
  };

  return (
    <div
      className="auth-sheet-container"
      style={{
        borderTopLeftRadius: '28px',
        borderTopRightRadius: '28px',
        padding: '20px 14px calc(env(safe-area-inset-bottom, 0px) + 24px) 14px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: c.sheetBg,
        direction: isRtl ? 'rtl' : 'ltr',
        transition: 'background-color 0.25s var(--spring-default)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {/* Continue with Google */}
        <button
          type="button"
          className="apple-press"
          disabled={googleBusy}
          onClick={onSignInWithGoogle}
          style={{
            ...baseBtn,
            backgroundColor: c.googleBtnBg,
            color: c.googleBtnText,
            border: c.googleBtnBorder,
            opacity: googleBusy ? 0.75 : 1,
          }}
        >
          {googleBusy ? (
            <div
              style={{
                width: '18px',
                height: '18px',
                border: `2px solid ${c.spinnerTrack}`,
                borderTopColor: c.spinnerHead,
                borderRadius: '50%',
                animation: 'rvSpin 0.6s linear infinite',
              }}
            />
          ) : (
            <GoogleLogo size={18} />
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {googleBusy ? texts.connecting : texts.continueGoogle}
          </span>
        </button>

        {/* Sign up */}
        <button
          type="button"
          className="apple-press"
          disabled={googleBusy}
          onClick={onSignUp}
          style={{
            ...baseBtn,
            backgroundColor: c.signUpBtnBg,
            color: c.signUpBtnText,
            border: 'none',
            opacity: googleBusy ? 0.75 : 1,
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>{texts.signUp}</span>
        </button>

        {/* Log in */}
        <button
          type="button"
          className="apple-press login-button-frame"
          disabled={googleBusy}
          onClick={onLogIn}
          style={{
            ...baseBtn,
            backgroundColor: c.logInBtnBg,
            color: c.logInBtnText,
            border: c.logInBtnBorder,
            transition: 'all 0.15s ease',
            opacity: googleBusy ? 0.75 : 1,
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>{texts.logIn}</span>
        </button>
      </div>
    </div>
  );
};
