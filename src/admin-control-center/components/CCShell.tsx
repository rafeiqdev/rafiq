import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcon';
import { useCC } from '../i18n';
import { CC_SECTIONS } from '../sections';

/**
 * The Control Center chrome: its own header, an internal section sidebar, a
 * breadcrumb, and a clear "back to classic Admin" link. Independent of the
 * classic /admin layout on purpose — it neither restyles nor reuses that page's
 * shell, so nothing about /admin changes.
 *
 * Direction (RTL/LTR) follows the app language: the sidebar is the first flex
 * child, so it sits on the reading-start side either way, matching the classic
 * Admin's own convention.
 */
export function CCShell({
  activeSection,
  onSelect,
  children,
}: {
  activeSection: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const { cc, dir } = useCC();
  const activeLabel = CC_SECTIONS.find((s) => s.id === activeSection)?.labelKey ?? 'section.overview';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8" dir={dir}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-dark pb-5">
        <div className="min-w-0">
          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-navy/50">
            <Link to="/admin" className="hover:text-navy hover:underline">{cc('breadcrumb.admin')}</Link>
            <AppIcon name={dir === 'rtl' ? 'chevron-left' : 'chevron-right'} className="h-3 w-3" />
            <span className="text-navy/70">{cc('breadcrumb.controlCenter')}</span>
          </nav>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-navy">
            <AppIcon name="layers" className="h-6 w-6 text-brand-red" />
            {cc('title')}
          </h1>
          <p className="mt-1 text-sm text-navy/60">{cc('subtitle')}</p>
        </div>
        <Link
          to="/admin"
          className="btn-secondary inline-flex h-10 shrink-0 items-center gap-2 px-4 text-sm"
        >
          <AppIcon name={dir === 'rtl' ? 'arrow-right' : 'arrow-left'} className="h-4 w-4" />
          {cc('nav.backToAdmin')}
        </Link>
      </header>

      <div className="mt-6 flex flex-col items-start gap-6 md:flex-row">
        {/* Internal sidebar */}
        <nav
          aria-label={cc('title')}
          className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto pb-1 md:sticky md:top-24 md:w-64 md:flex-col md:overflow-visible md:pb-0"
        >
          {CC_SECTIONS.map((s) => {
            const active = s.id === activeSection;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition-colors ${
                  active ? 'bg-navy text-white' : 'text-navy/70 hover:bg-cream'
                }`}
              >
                <AppIcon name={s.icon} className="h-4 w-4 shrink-0" />
                {cc(s.labelKey)}
                {!s.implemented && (
                  <span className={`ms-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-cream-dark text-navy/50'}`}>
                    ···
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Section body */}
        <main className="w-full min-w-0 flex-1" aria-label={cc(activeLabel)}>
          {children}
        </main>
      </div>
    </div>
  );
}
