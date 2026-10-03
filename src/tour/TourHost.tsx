import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tour, type TourStep } from '../components/ui/product-tour';
import { useIsMobile } from '../hooks/useIsMobile';
import { useApp } from '../context/AppContext';
import type { TourStepDef } from './tours';
import { findTour, hasAnchoredStep, hasSeenTour, isTourBlocked, markTourSeen, resolveSteps, targetSelector } from './tourState';

/** How long the screen gets to settle (lazy page chunk, fonts, images) before
 *  the first attempt. Shorter and the tab bar measures before the layout is
 *  final; longer and the visitor has already started tapping. */
const SETTLE_MS = 900;
/** While blocked (consent strip up, a modal open) or before the page's targets
 *  have mounted, retry at this interval, this many times, then give up for
 *  this visit — the tour must never fire a minute into a session. */
const RETRY_MS = 1000;
const MAX_RETRIES = 20;

/**
 * Mounted once in Layout. On phones, decides whether the current screen owes
 * the visitor a tour, shows it, and offers the «؟» button to replay it.
 * Desktop gets nothing from this component (phase 2).
 */
export function TourHost() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const { authLoading } = useApp();
  const { t, i18n } = useTranslation();

  const tour = useMemo(() => findTour(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<TourStepDef[]>([]);
  // True once this screen has something to point at. The «؟» button is only
  // offered then — a signed-out visitor on /premium sees a sign-in card, not
  // the chat, and a replay button there would open nothing.
  const [available, setAvailable] = useState(false);

  const begin = useCallback(() => {
    if (!tour) return false;
    const present = resolveSteps(tour, document);
    if (!hasAnchoredStep(present)) return false;
    setSteps(present);
    setIndex(0);
    setOpen(true);
    return true;
  }, [tour]);

  // Leaving the screen ends its tour; the next screen decides for itself.
  useEffect(() => {
    setOpen(false);
    setAvailable(false);
  }, [pathname]);

  // Once the screen has settled: find out whether its targets are rendered
  // (→ offer «؟»), and on the first visit to it on this device, start the
  // tour as soon as nothing else owns the viewport.
  useEffect(() => {
    if (!isMobile || !tour || authLoading) return;
    const seen = hasSeenTour(tour.id);
    let cancelled = false;
    let tries = 0;
    let timer: number;
    const attempt = () => {
      if (cancelled) return;
      const anchored = hasAnchoredStep(resolveSteps(tour, document));
      if (anchored) setAvailable(true);
      const done = anchored && (seen || (!isTourBlocked(document) && begin()));
      if (!done && ++tries < MAX_RETRIES) timer = window.setTimeout(attempt, RETRY_MS);
    };
    timer = window.setTimeout(attempt, SETTLE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isMobile, tour, authLoading, begin]);

  const close = useCallback(() => {
    if (tour) markTourSeen(tour.id);
    setOpen(false);
  }, [tour]);

  if (!isMobile || !tour) return null;

  const rtl = i18n.dir() === 'rtl';
  const uiSteps: TourStep[] = steps.map((s) => ({
    target: s.target ? targetSelector(s.target) : undefined,
    title: t(`tour.${tour.id}.${s.key}Title`),
    content: t(`tour.${tour.id}.${s.key}Body`),
    placement: s.placement ?? 'auto',
    padding: 6,
  }));

  // «؟» sits in the end corner, one row below whatever owns the top edge: on
  // the tab screens Layout pins the language switcher there; on the signed-in
  // home Layout's sticky header runs across the top; on the guest landing
  // page a 2.25rem currency ticker plus the hero's own 3.5rem header do
  // (src/pages/Home.tsx scopes its offset variable to its own tree, so the
  // 2.25rem is repeated here rather than read).
  const guestHome = pathname === '/' && !!document.querySelector('[data-tour="home-hero-cta"]');
  const topClass = guestHome
    ? 'top-[calc(2.25rem+3.5rem+0.75rem)]'
    : 'top-[calc(env(safe-area-inset-top)+3.75rem)]';

  return (
    <>
      {available && !open && (
        <button
          type="button"
          onClick={() => begin()}
          aria-label={t('tour.replay')}
          title={t('tour.replay')}
          className={`fixed end-4 ${topClass} z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-cream-dark bg-white/95 text-[17px] font-extrabold text-navy shadow-card active:scale-95`}
        >
          ?
        </button>
      )}
      <Tour
        steps={uiSteps}
        open={open}
        rtl={rtl}
        labels={{
          next: t('tour.next'),
          back: t('tour.back'),
          done: t('tour.done'),
          close: t('tour.close'),
        }}
        index={index}
        onIndexChange={setIndex}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        onFinish={close}
        onSkip={close}
      />
    </>
  );
}
