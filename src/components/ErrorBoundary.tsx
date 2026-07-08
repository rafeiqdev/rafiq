import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';
import { Logo } from './Logo';

interface State {
  hasError: boolean;
}

/** P2-1: render errors show a friendly branded fallback instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const t = i18n.t.bind(i18n);
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="card p-10 max-w-md text-center">
          <div className="flex justify-center">
            <Logo size={72} />
          </div>
          <h1 className="mt-5 text-xl font-extrabold text-navy">{t('errors.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('errors.body')}</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full mt-6">
            {t('errors.reload')}
          </button>
        </div>
      </div>
    );
  }
}
