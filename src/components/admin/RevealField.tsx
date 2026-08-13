import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Shows a masked value by default with a click-to-reveal toggle — for PII in admin lists. */
export function RevealField({ masked, full, className = '' }: { masked: string; full: string; className?: string }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((v) => !v);
      }}
      className={`inline-flex items-center gap-1 text-start hover:underline ${className}`}
      title={revealed ? t('admin.hide') : t('admin.reveal')}
    >
      {revealed ? full : masked}
    </button>
  );
}
