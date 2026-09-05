import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getConsent, setConsent } from '../lib/analytics';
import { AppIcon } from './AppIcon';
import { useIsMobile } from '../hooks/useIsMobile';

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
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(() => getConsent() === null);
  // How far to lift the strip so it sits ON TOP OF the bottom tab bar instead
  // of covering it — 0 on the screens that have no bar. See the effect below.
  const [barHeight, setBarHeight] = useState(0);

  // In case consent was already decided in another tab while this one was open.
  useEffect(() => {
    if (getConsent() !== null) setVisible(false);
  }, []);

  // MEASURE the bottom tab bar; never assume it is there.
  //
  // This used to be a hard-coded `bottom: 56px + safe-area`, on the reasoning
  // that "nearly every mobile screen renders MobileTabBar". The signed-out
  // home page does not — and that is the first screen every new visitor sees,
  // i.e. exactly where this banner appears. So the strip floated with 56px of
  // empty page showing underneath it: a box detached from the bottom edge.
  //
  // Both bars (the shared MobileTabBar and MobileHome's inline copy) carry
  // data-mobile-tabbar, so the real height — safe-area inset included — is
  // read off the DOM. No bar, no offset, and the strip meets the bottom edge.
  //
  // Re-measured on navigation, and again shortly after: pages are lazy chunks,
  // so the bar of the page being entered often mounts after this runs.
  useEffect(() => {
    if (!visible) return;
    if (!isMobile) {
      setBarHeight(0);
      return;
    }
    const measure = () => {
      const bar = document.querySelector('[data-mobile-tabbar]');
      setBarHeight(bar ? Math.round(bar.getBoundingClientRect().height) : 0);
    };
    measure();
    const timers = [150, 600].map((ms) => window.setTimeout(measure, ms));
    window.addEventListener('resize', measure);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener('resize', measure);
    };
  }, [visible, isMobile, pathname]);

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
      // Sits flush on the bottom edge, lifted only by the height of a bottom
      // tab bar when the current screen actually draws one (measured above) —
      // the banner has a higher z-index and would otherwise hide that bar
      // completely until dismissed. On its own, the strip must never leave a
      // strip of page visible beneath it.
      style={{ bottom: barHeight ? `${barHeight}px` : 0 }}
      className="fixed inset-x-0 z-50 border-t border-cream-dark bg-white px-4 pt-4 shadow-float sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
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
