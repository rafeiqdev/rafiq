import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import type { AsyncSection } from '../../hooks/useAsyncSection';

/**
 * Renders the three outcomes an admin section can have, so no caller can
 * accidentally collapse two of them into one.
 *
 * The rule this exists to enforce: AN ERROR IS NEVER AN EMPTY LIST. A section
 * that failed to load looks identical to a section with nothing in it unless
 * something forces them apart, and on a dashboard "nothing in it" reads as
 * "quiet day" — which is how a missing RPC blanked five sections of /admin
 * without anyone noticing.
 *
 * The error branch names WHICH section failed (the caller passes its own
 * heading) and retries just that one, without reloading the page.
 */
export function SectionState<T>({
  section,
  title,
  isEmpty,
  empty,
  children,
}: {
  section: AsyncSection<T>;
  /** Already-translated section heading, so the error says what broke. */
  title: string;
  isEmpty?: (data: T) => boolean;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();

  if (section.status === 'loading') {
    return (
      <p className="mt-3 text-sm text-gray-500" aria-busy="true">
        {t('common.loading')}
      </p>
    );
  }

  if (section.status === 'error') {
    return (
      <div className="mt-3" role="alert">
        <p className="flex items-start gap-2 text-sm font-semibold text-brand-red">
          <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {title} — {t('common.error')}
          </span>
        </p>
        <button onClick={section.reload} className="btn-secondary mt-3 min-h-[44px] px-4 text-sm">
          {t('chat.retry')}
        </button>
      </div>
    );
  }

  const data = section.data as T;
  if (data == null || (isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0)) {
    return <>{empty}</>;
  }
  return <>{children(data)}</>;
}
