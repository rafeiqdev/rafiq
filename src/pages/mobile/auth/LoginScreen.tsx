import React from 'react';
import { RafiqOfficialLogo } from './icons';
import { KineticHeader } from './KineticHeader';
import { AuthSheet } from './AuthSheet';
import { AuthFormScreen } from './AuthFormScreen';
import type { AuthSubmitData } from './AuthFormScreen';
import type { SheetTheme } from './AuthSheet';
import type { AppLanguage } from './KineticHeader';

export type ScreenViewMode = 'welcome' | 'login' | 'signup';

interface LoginScreenProps {
  language: AppLanguage;
  sheetTheme?: SheetTheme;
  headlineColor?: string;
  backgroundColor?: string;
  activeScreen: ScreenViewMode;
  googleBusy?: boolean;
  formBusy?: boolean;
  errorText?: string | null;
  noticeText?: string | null;
  onScreenChange: (screen: ScreenViewMode) => void;
  onClose: () => void;
  onGoogle: () => void;
  onSubmit: (data: AuthSubmitData) => void;
  onForgot: (email: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  language,
  sheetTheme = 'rafiq-navy',
  headlineColor = '#09245E',
  backgroundColor = '#FAF8F0',
  activeScreen,
  googleBusy = false,
  formBusy = false,
  errorText,
  noticeText,
  onScreenChange,
  onClose,
  onGoogle,
  onSubmit,
  onForgot,
}) => {
  const isForm = activeScreen === 'login' || activeScreen === 'signup';

  return (
    <div
      className="rafiq-auth-v2 login-screen-surface"
      style={{
        position: 'relative',
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
    >
      {/* Form screens (login / sign up) overlay the welcome screen */}
      {isForm && (
        <div
          className="sheet-subview-enter"
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 30 }}
        >
          <AuthFormScreen
            mode={activeScreen === 'signup' ? 'signup' : 'login'}
            language={language}
            busy={formBusy}
            errorText={errorText}
            noticeText={noticeText}
            onBack={() => onScreenChange('welcome')}
            onSwitchMode={(m) => onScreenChange(m)}
            onSubmit={onSubmit}
            onForgot={onForgot}
          />
        </div>
      )}

      {/* Welcome header: tap the logo to return home. The close/X corner is left
          free for the app-shell language switcher (Layout renders it fixed there). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 20px 0 20px',
          zIndex: 20,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          aria-label="Home"
          className="apple-press"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RafiqOfficialLogo width={68} height={28} color={headlineColor} />
        </button>
      </div>

      {/* Kinetic typography */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '0 12px',
          boxSizing: 'border-box',
        }}
      >
        <KineticHeader language={language} customColor={headlineColor} />
      </div>

      {/* Bottom auth sheet */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <AuthSheet
          language={language}
          theme={sheetTheme}
          googleBusy={googleBusy}
          onSignUp={() => onScreenChange('signup')}
          onLogIn={() => onScreenChange('login')}
          onSignInWithGoogle={onGoogle}
        />
      </div>
    </div>
  );
};
