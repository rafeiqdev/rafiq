import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';

/**
 * One failed data source, named, with a retry that refetches only that source.
 *
 * Lived inside ActivityCard; /requests needs exactly the same thing for exactly
 * the same reason, so it moved here rather than being copied. The rule it
 * serves is the one SectionState exists for: AN ERROR IS NEVER AN EMPTY LIST.
 * A list that merges three sources has to be able to say WHICH of them broke,
 * because "you have no requests" is a lie the moment one of them did.
 */
export function SourceError({
  label,
  onRetry,
  compact,
}: {
  label: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mt-3 rounded-xl border border-brand-red/30 px-3.5 py-3">
      <p className={`flex items-start gap-2 font-semibold text-brand-red ${compact ? 'text-[13px]' : 'text-sm'}`}>
        <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          {label} — {t('common.error')}
        </span>
      </p>
      <button onClick={onRetry} className="btn-secondary mt-2 min-h-[44px] px-4 text-xs">
        {t('chat.retry')}
      </button>
    </div>
  );
}
