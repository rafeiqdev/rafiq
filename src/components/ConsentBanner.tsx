import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConsent, setConsent } from '../lib/analytics';
import { AppIcon } from './AppIcon';

/**
 * KVKK/GDPR consent banner. Nothing is collected before a choice is made here
 * — analytics.track() itself refuses to enqueue anything while getConsent()
 * is null, so this component only needs to record the choice, not gate
 * anything by itself.
 *
 * Built for elderly users on request: large (>=44px) tap targets, plain
 * one-sentence copy, both buttons the same visual weight — declining is not
 * shrunk, greyed out, or hidden behind a second click the way a dark pattern
 * would do it.
 */
export function ConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => getConsent() === null);

  // In case consent was already decided in another tab while this one was open.
  useEffect(() => {
    if (getConsent() !== null) setVisible(false);
  }, []);

  if (!visible) return null;

  const choose = (state: 'granted' | 'declined') => {
    setConsent(state);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-labelledby="consent-title"
      aria-describedby="consent-body"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-cream-dark bg-white px-4 py-4 shadow-float sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <span className="icon-chip hidden shrink-0 sm:flex">
          <AppIcon name="shield-check" className="w-5 h-5" />
        </span>
        {/* × hides the strip for this session only: no consent is recorded, so
            analytics stays off (track() refuses while getConsent() is null),
            and the banner returns next visit. Dismissing is not deciding. */}
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={t('common.close')}
          className="absolute top-2 end-2 flex h-9 w-9 items-center justify-center rounded-full text-navy/60 hover:bg-cream hover:text-navy sm:static sm:order-last sm:shrink-0"
        >
          <AppIcon name="x" className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p id="consent-title" className="text-sm font-extrabold text-navy">
            {t('consent.title')}
          </p>
          <p id="consent-body" className="mt-1 text-sm leading-relaxed text-gray-600">
            {t('consent.body')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5 sm:w-auto">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="btn-secondary min-h-[44px] flex-1 px-5 text-sm sm:flex-none"
          >
            {t('consent.decline')}
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="btn-primary min-h-[44px] flex-1 px-5 text-sm sm:flex-none"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
