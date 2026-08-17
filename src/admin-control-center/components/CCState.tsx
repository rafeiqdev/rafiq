import type { ReactNode } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { AsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';

/**
 * Control Center section wrapper — renders exactly one of loading / error /
 * empty / ready, so the three failure-vs-emptiness outcomes can never be
 * collapsed. Mirrors the classic Admin's SectionState but uses the module-local
 * i18n so the Control Center stays self-contained. An error NEVER reads as an
 * empty list; the error branch names the section and retries just that card.
 */
export function CCState<T>({
  section,
  title,
  isEmpty,
  empty,
  children,
}: {
  section: AsyncSection<T>;
  title: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { cc } = useCC();

  if (section.status === 'loading') {
    return (
      <p className="mt-2 text-sm text-navy/50" aria-busy="true">
        {cc('state.loading')}
      </p>
    );
  }

  if (section.status === 'error') {
    return (
      <div className="mt-2" role="alert">
        <p className="flex items-start gap-2 text-sm font-semibold text-brand-red">
          <AppIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{title} — {cc('state.error')}</span>
        </p>
        <button onClick={section.reload} className="btn-secondary mt-3 min-h-[44px] px-4 text-sm">
          {cc('state.retry')}
        </button>
      </div>
    );
  }

  const data = section.data as T;
  if (data == null || (isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0)) {
    return <>{empty ?? <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>}</>;
  }
  return <>{children(data)}</>;
}
