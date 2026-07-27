import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GuideContent } from '../lib/api';
import { AppIcon } from './AppIcon';
import { track } from '../lib/analytics';

// The only rail this paywall ever offers — hardcoded until there's more than
// one paid tier's worth of gated content.
const OFFERED_TIER = 'pro';

/** Shown when a logged-in non-subscriber opens a Pro guide: 1-step preview + upgrade. */
export function UpgradePaywall({
  slug,
  preview,
  onGetPerson,
}: {
  slug: string;
  preview: GuideContent;
  onGetPerson: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const firstStep = preview.steps?.[0];

  useEffect(() => {
    track('paywall_shown', { target: slug, meta: { tier: OFFERED_TIER } });
  }, [slug]);

  const upgrade = () => {
    track('upgrade_clicked', { target: OFFERED_TIER, meta: { source: slug } });
    navigate('/checkout?plan=pro&billing=monthly');
  };

  return (
    <div className="card p-6 sm:p-8 max-w-2xl mx-auto text-center">
      <div className="icon-chip mx-auto">
        <AppIcon name="sparkles" className="w-6 h-6" />
      </div>
      <h2 className="mt-4 text-xl font-extrabold text-navy">{t('guide.paywall.title')}</h2>
      <p className="mt-2 text-sm text-gray-500">{t('guide.paywall.body')}</p>

      {(preview.problem || firstStep) && (
        <div className="mt-5 text-start rounded-xl bg-cream p-4">
          <p className="text-xs font-bold text-navy/60">{t('guide.previewLabel')}</p>
          {preview.problem && <p className="mt-1 text-sm text-navy">{preview.problem}</p>}
          {firstStep && (
            <div className="mt-3 flex items-start gap-2">
              <span className="icon-chip !w-7 !h-7 text-xs font-bold shrink-0">1</span>
              <p className="text-sm text-navy/80 pt-1">{firstStep}</p>
            </div>
          )}
          {/* blurred teaser of the locked steps */}
          <div className="mt-2 space-y-1.5 select-none blur-sm" aria-hidden>
            <div className="h-3 rounded bg-cream-dark/80 w-5/6" />
            <div className="h-3 rounded bg-cream-dark/80 w-2/3" />
          </div>
        </div>
      )}

      <button onClick={upgrade} className="btn-gold w-full mt-6">
        {t('guide.paywall.upgrade')}
      </button>
      <button onClick={onGetPerson} className="mt-3 w-full text-sm font-semibold text-navy hover:underline">
        {t('guide.paywall.useFree')}
      </button>
    </div>
  );
}
