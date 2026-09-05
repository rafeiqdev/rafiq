import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';
import { Logo } from './Logo';

interface State {
  hasError: boolean;
  error?: Error;
}

/** P2-1: render errors show a friendly branded fallback instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const t = i18n.t.bind(i18n);
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="card p-10 max-w-lg text-center">
          <div className="flex justify-center">
            <Logo size={72} />
          </div>
          <h1 className="mt-5 text-xl font-extrabold text-navy">{t('errors.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('errors.body')}</p>
          {this.state.error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg text-start overflow-auto max-h-60 font-mono whitespace-pre-wrap" dir="ltr">
              <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
              {this.state.error.stack && (
                <p className="mt-1 text-[11px] opacity-75">{this.state.error.stack.split('\n').slice(0, 5).join('\n')}</p>
              )}
            </div>
          )}
          <button onClick={() => window.location.reload()} className="btn-primary w-full mt-6">
            {t('errors.reload')}
          </button>
        </div>
      </div>
    );
  }
}
