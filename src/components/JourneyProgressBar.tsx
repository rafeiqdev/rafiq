import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useJourney } from '../hooks/useJourney';
import { AppIcon } from './AppIcon';

const MILESTONES = [25, 50, 75, 100] as const;

/**
 * Compact, self-contained progress summary for the "مسيرتي" journey —
 * shows a smoothly animated bar plus positive copy the moment a milestone
 * threshold is crossed. Renders nothing for guests or once there's no
 * journey to show (loading/error/empty), so it's safe to drop at the top of
 * any signed-in page without extra gating from the caller.
 */
export function JourneyProgressBar() {
  const { t } = useTranslation();
  const { user } = useApp();
  const { state, progress, items } = useJourney();

  // Start at 0 and animate up to the real value on mount/update, so the fill
  // is always a visible transition rather than appearing already-full.
  const [displayPercent, setDisplayPercent] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDisplayPercent(progress.percent));
    return () => cancelAnimationFrame(id);
  }, [progress.percent]);

  if (!user || state !== 'ready' || items.length === 0) return null;

  const milestone = [...MILESTONES].reverse().find((m) => progress.percent >= m);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6" role="status" aria-live="polite">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-navy">{t('journeyProgressBar.title')}</h2>
          <span className="text-lg font-extrabold text-navy" dir="ltr">
            {progress.percent}%
          </span>
        </div>
        <div className="mt-2.5 h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-navy transition-[width] duration-700 ease-out"
            style={{ width: `${displayPercent}%` }}
          />
        </div>
        {milestone && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <AppIcon name="check-circle" className="w-3.5 h-3.5 shrink-0" />
            {t(`journeyProgressBar.milestones.${milestone}`)}
          </p>
        )}
      </div>
    </div>
  );
}
