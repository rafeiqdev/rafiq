import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { RafiqOfficialLogo, AppleBackChevron } from './icons';
import type { AppLanguage } from './KineticHeader';

export type AuthFormMode = 'login' | 'signup';

export interface AuthSubmitData {
  mode: AuthFormMode;
  email: string;
  password: string;
  name: string;
  phone: string;
}

interface AuthFormScreenProps {
  mode: AuthFormMode;
  language: AppLanguage;
  busy?: boolean;
  errorText?: string | null;
  noticeText?: string | null;
  onBack: () => void;
  onSwitchMode: (newMode: AuthFormMode) => void;
  onSubmit: (data: AuthSubmitData) => void;
  onForgot: (email: string) => void;
}

const FORM_TEXTS: Record<
  AppLanguage,
  {
    loginTitle: string;
    signupTitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    continueBtn: string;
    forgotPassword: string;
    noAccount: string;
    signUpLink: string;
    haveAccount: string;
    logInLink: string;
  }
> = {
  ar: {
    loginTitle: 'تسجيل الدخول إلى رفيق',
    signupTitle: 'إنشاء حسابك في رفيق',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    nameLabel: 'الاسم الكامل',
    namePlaceholder: 'محمد الأحمد',
    phoneLabel: 'رقم الهاتف',
    phonePlaceholder: '5XX XXX XXXX',
    continueBtn: 'متابعة',
    forgotPassword: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    signUpLink: 'إنشاء حساب',
    haveAccount: 'لديك حساب بالفعل؟',
    logInLink: 'تسجيل الدخول',
  },
  en: {
    loginTitle: 'Log in to Rafiq',
    signupTitle: 'Create your account',
    emailLabel: 'Email',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    nameLabel: 'Full name',
    namePlaceholder: 'Alex Smith',
    phoneLabel: 'Phone number',
    phonePlaceholder: '5XX XXX XXXX',
    continueBtn: 'Continue',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    signUpLink: 'Sign up',
    haveAccount: 'Already have an account?',
    logInLink: 'Log in',
  },
  ru: {
    loginTitle: 'Вход в Rafiq',
    signupTitle: 'Создайте аккаунт',
    emailLabel: 'Email',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Пароль',
    passwordPlaceholder: 'Введите пароль',
    nameLabel: 'Полное имя',
    namePlaceholder: 'Алексей Смирнов',
    phoneLabel: 'Номер телефона',
    phonePlaceholder: '5XX XXX XXXX',
    continueBtn: 'Продолжить',
    forgotPassword: 'Забыли пароль?',
    noAccount: 'Нет аккаунта?',
    signUpLink: 'Зарегистрироваться',
    haveAccount: 'Уже есть аккаунт?',
    logInLink: 'Войти',
  },
  fa: {
    loginTitle: 'ورود به رفیق',
    signupTitle: 'ساخت حساب کاربری رفیق',
    emailLabel: 'ایمیل',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'رمز عبور',
    passwordPlaceholder: 'رمز عبور را وارد کنید',
    nameLabel: 'نام و نام خانوادگی',
    namePlaceholder: 'محمد احمدی',
    phoneLabel: 'شماره تلفن',
    phonePlaceholder: '5XX XXX XXXX',
    continueBtn: 'ادامه',
    forgotPassword: 'فراموشی رمز عبور؟',
    noAccount: 'حساب کاربری ندارید؟',
    signUpLink: 'ثبت‌نام',
    haveAccount: 'قبلاً ثبت‌نام کرده‌اید؟',
    logInLink: 'ورود به حساب',
  },
};

const navBtnStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '50%',
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#1E293B',
  cursor: 'pointer',
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
  transition: 'all 0.15s ease',
};

const fieldBoxStyle = (isRtl: boolean): React.CSSProperties => ({
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  border: '1px solid #E2E8F0',
  padding: '7px 12px',
  display: 'flex',
  flexDirection: 'column',
  textAlign: isRtl ? 'right' : 'left',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
});

const labelStyle = (isRtl: boolean): React.CSSProperties => ({
  fontSize: '11px',
  fontWeight: 500,
  color: '#64748B',
  marginBottom: '1px',
  textAlign: isRtl ? 'right' : 'left',
});

const inputStyle = (isRtl: boolean): React.CSSProperties => ({
  border: 'none',
  outline: 'none',
  fontSize: '13.5px',
  color: '#09245E',
  backgroundColor: 'transparent',
  padding: '2px 0',
  fontFamily: 'inherit',
  textAlign: isRtl ? 'right' : 'left',
  direction: isRtl ? 'rtl' : 'ltr',
  width: '100%',
});

export const AuthFormScreen: React.FC<AuthFormScreenProps> = ({
  mode,
  language,
  busy = false,
  errorText,
  noticeText,
  onBack,
  onSwitchMode,
  onSubmit,
  onForgot,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isRtl = language === 'ar' || language === 'fa';
  const t = FORM_TEXTS[language] || FORM_TEXTS.ar;

  const fontFamily =
    language === 'ar'
      ? 'var(--font-arabic)'
      : language === 'fa'
      ? 'var(--font-persian)'
      : language === 'ru'
      ? 'var(--font-russian)'
      : 'var(--font-english)';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    onSubmit({ mode, email, password, name, phone });
  };

  const navBar = (
    <button type="button" className="apple-press" onClick={onBack} aria-label="Back" style={navBtnStyle}>
      <AppleBackChevron isRtl={isRtl} size={16} />
    </button>
  );

  return (
    <div
      className="auth-form-screen no-scrollbar"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#FAF8F0',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        direction: isRtl ? 'rtl' : 'ltr',
        fontFamily,
        overflowY: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Top nav: back + close (order follows RTL/LTR automatically) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 18px 8px 18px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {navBar}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '4px 22px 28px 22px',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RafiqOfficialLogo width={58} height={26} color="#09245E" />
        </div>

        <h2
          style={{
            fontSize: '17px',
            fontWeight: 600,
            color: '#09245E',
            margin: '0 0 20px 0',
            textAlign: 'center',
            letterSpacing: isRtl ? '0' : '-0.015em',
            lineHeight: 1.3,
          }}
        >
          {mode === 'login' ? t.loginTitle : t.signupTitle}
        </h2>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signup' && (
            <div style={fieldBoxStyle(isRtl)}>
              <label style={labelStyle(isRtl)}>{t.nameLabel}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                autoComplete="name"
                required
                style={inputStyle(isRtl)}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div style={fieldBoxStyle(isRtl)}>
              <label style={labelStyle(isRtl)}>{t.phoneLabel}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#09245E',
                    backgroundColor: 'rgba(9, 36, 94, 0.05)',
                    padding: '3px 7px',
                    borderRadius: '6px',
                    flexShrink: 0,
                    direction: 'ltr',
                  }}
                >
                  <svg width="15" height="10" viewBox="0 0 1200 800" style={{ borderRadius: '2px', display: 'inline-block' }}>
                    <rect width="1200" height="800" fill="#E30A17" />
                    <circle cx="425" cy="400" r="200" fill="#ffffff" />
                    <circle cx="475" cy="400" r="160" fill="#E30A17" />
                    <polygon points="583.33,400 706.66,440.06 630.43,335.21 630.43,464.78 706.66,359.93" fill="#ffffff" />
                  </svg>
                  <span>+90</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  autoComplete="tel"
                  style={{ ...inputStyle(isRtl), flex: 1 }}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div style={fieldBoxStyle(isRtl)}>
            <label style={labelStyle(isRtl)}>{t.emailLabel}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              inputMode="email"
              required
              style={inputStyle(isRtl)}
            />
          </div>

          {/* Password */}
          <div style={fieldBoxStyle(isRtl)}>
            <label style={labelStyle(isRtl)}>{t.passwordLabel}</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                style={{ ...inputStyle(isRtl), flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Notice / error banners */}
          {noticeText && (
            <div
              role="status"
              style={{
                backgroundColor: 'rgba(9, 36, 94, 0.06)',
                color: '#09245E',
                borderRadius: '10px',
                padding: '9px 12px',
                fontSize: '12.5px',
                fontWeight: 500,
                lineHeight: 1.5,
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              {noticeText}
            </div>
          )}
          {errorText && (
            <div
              role="alert"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                color: '#B91C1C',
                border: '1px solid rgba(220, 38, 38, 0.18)',
                borderRadius: '10px',
                padding: '9px 12px',
                fontSize: '12.5px',
                fontWeight: 500,
                lineHeight: 1.5,
                textAlign: isRtl ? 'right' : 'left',
              }}
            >
              {errorText}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="apple-press"
            disabled={busy}
            style={{
              width: '100%',
              height: '44px',
              borderRadius: '22px',
              backgroundColor: '#09245E',
              color: '#FFFFFF',
              fontSize: '14.5px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(9, 36, 94, 0.22)',
              transition: 'all 0.15s ease',
              opacity: busy ? 0.8 : 1,
            }}
          >
            {busy ? (
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'rvSpin 0.6s linear infinite',
                }}
              />
            ) : (
              t.continueBtn
            )}
          </button>

          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <button
                type="button"
                className="apple-press"
                onClick={() => onForgot(email)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontFamily: 'inherit',
                }}
              >
                {t.forgotPassword}
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12.5px', color: '#64748B' }}>
            {mode === 'login' ? (
              <span>
                {t.noAccount}{' '}
                <button
                  type="button"
                  onClick={() => onSwitchMode('signup')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#09245E',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '0 3px',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.signUpLink}
                </button>
              </span>
            ) : (
              <span>
                {t.haveAccount}{' '}
                <button
                  type="button"
                  onClick={() => onSwitchMode('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#09245E',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '0 3px',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.logInLink}
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
