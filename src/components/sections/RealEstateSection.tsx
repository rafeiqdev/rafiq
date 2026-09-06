import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { AppIcon } from '../AppIcon';
import { ListingCard } from '../realestate/ListingCard';
import { BANNERS } from '../../lib/images';

// Finger-pixels of continued drag (after damping) needed for a full reveal.
const OVERPULL_MAX = 88;
// Damping applied while actively dragging past the end — matches the
// "rubber band" feel of native pull-to-refresh instead of a 1:1 drag.
const OVERPULL_RUBBER_BAND = 0.55;

/**
 * Real-estate entry point on the home page: one wide short strip plus three
 * featured listings.
 *
 * The whole section hides itself when there are no listings — an empty
 * "featured properties" rail reads as a broken site, and the strip alone
 * would promise a catalogue that is not there yet.
 */
export function RealEstateSection({
  compact = false,
  className,
}: {
  compact?: boolean;
  /** Wrapper override for callers that already provide their own outer
      padding (e.g. UserHome's single-column dashboard) — avoids doubling
      the horizontal padding from the default `mx-auto max-w-6xl px-4`. */
  className?: string;
}) {
  const { t } = useTranslation();
  const [featured, setFeatured] = useState<Listing[]>([]);
  const navigate = useNavigate();
  const railRef = useRef<HTMLUListElement>(null);
  // 0..1 reveal progress for the "keep dragging past the last card to see
  // all listings" affordance below.
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    listingsApi
      .list()
      .then((rows) => setFeatured(rows.filter((l) => (l.listingType ?? 'sale') === 'sale').slice(0, 3)))
      .catch(() => {});
  }, []);

  // Dragging past the last card used to do nothing — the rail just stopped.
  // This turns that dead-end into a "keep pulling to see all listings"
  // gesture: past-the-edge drag distance fills a circular reveal that
  // navigates to /real-estate once fully pulled, and springs back if
  // released early.
  //
  // "Forward" (the finger direction that counts as pulling further into the
  // list) depends on which edge the last card sits at, which flips under
  // RTL: in LTR the last card is at the visual right, reached by dragging
  // left; in RTL it's at the visual left, reached by dragging right. Seeded
  // once per gesture from the container's computed `direction` rather than
  // inferred from `scrollLeft`, whose sign convention for RTL is not
  // consistent enough across browsers to derive it from mid-scroll deltas.
  useEffect(() => {
    const el = railRef.current;
    if (!el || !compact) return;

    const gesture = { lastX: 0, forwardSign: 1, overpull: 0 };

    const atMaxScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 2) return true;
      return max - Math.abs(el.scrollLeft) <= 2;
    };

    const onStart = (e: TouchEvent) => {
      gesture.lastX = e.touches[0].clientX;
      gesture.forwardSign = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
      gesture.overpull = 0;
      setDragging(true);
    };

    const onMove = (e: TouchEvent) => {
      const x = e.touches[0].clientX;
      const dx = gesture.lastX - x; // > 0 means the finger moved toward -x
      gesture.lastX = x;

      if (!atMaxScroll()) {
        if (gesture.overpull > 0) {
          gesture.overpull = 0;
          setPull(0);
        }
        return;
      }

      const forwardDx = dx * gesture.forwardSign;
      if (forwardDx <= 0) {
        gesture.overpull = Math.max(0, gesture.overpull + forwardDx * OVERPULL_RUBBER_BAND);
        setPull(gesture.overpull / OVERPULL_MAX);
        return;
      }

      e.preventDefault();
      gesture.overpull = Math.min(OVERPULL_MAX, gesture.overpull + forwardDx * OVERPULL_RUBBER_BAND);
      setPull(gesture.overpull / OVERPULL_MAX);
    };

    const onEnd = () => {
      setDragging(false);
      if (gesture.overpull >= OVERPULL_MAX) {
        setPull(1);
        navigator.vibrate?.(12);
        window.setTimeout(() => navigate('/real-estate'), 140);
      } else {
        gesture.overpull = 0;
        setPull(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [compact, navigate, featured.length > 0]);

  if (featured.length === 0) return null;

  return (
    <section className={className ?? `mx-auto max-w-6xl px-4 ${compact ? 'py-8' : 'py-14'}`}>
      {/* Trust-first banner: a plain container (not one big link) so the three
          shortcut pills below are real, tappable links to real destinations.
          The previous version rendered them as dead spans — visitors tapped
          and nothing happened. */}
      <div
        className="relative overflow-hidden rounded-card text-white shadow-card"
        style={{ background: 'linear-gradient(135deg,#12305c,#1a3a6b)' }}
      >
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="homeRealEstateCurve" clipPathUnits="objectBoundingBox">
              <path d="M0,0 H1 V0.86 C0.77,0.86 0.63,1 0.46,1 C0.29,1 0.17,0.88 0,0.86 Z" />
            </clipPath>
          </defs>
        </svg>

        {/* Photo band with the same curved bottom edge as the /services and
            /real-estate/investments heroes — title and body sit on the photo,
            everything actionable sits on the navy below it. */}
        <div className="relative" style={{ clipPath: 'url(#homeRealEstateCurve)' }}>
          <img
            src={BANNERS.realEstate}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/55 to-black/30" />
          <div className="relative px-5 sm:px-7 pt-8 sm:pt-10 pb-14 sm:pb-16 text-center">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"
              aria-hidden="true"
            >
              <AppIcon name="shield-check" className="w-5 h-5" />
            </span>
            <span className="mt-3 block text-xl sm:text-2xl font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]">
              {t('realEstate.home.title')}
            </span>
            <span className="mx-auto mt-2 block max-w-xl text-sm text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
              {t('realEstate.home.body')}
            </span>
          </div>
        </div>

        <div className="relative px-5 sm:px-7 pb-5">
          <nav className="flex flex-wrap justify-center gap-2" aria-label={t('realEstate.home.title')}>
            <Link
              to="/real-estate"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              <AppIcon name="shield-check" className="w-3.5 h-3.5" />
              {t('realEstate.home.tag.citizenship')}
            </Link>
            <Link
              to="/real-estate/investments"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              <AppIcon name="trending-up" className="w-3.5 h-3.5" />
              {t('realEstate.home.tag.invest')}
            </Link>
            <Link
              to="/real-estate"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              <AppIcon name="sliders-horizontal" className="w-3.5 h-3.5" />
              {t('realEstate.home.tag.filters')}
            </Link>
          </nav>
          <p className="mx-auto mt-3 flex max-w-2xl items-start justify-center gap-1.5 text-center text-xs leading-snug text-white/75">
            <AppIcon name="lock" className="w-3.5 h-3.5 mt-px shrink-0" />
            {t('realEstate.trustNote')}
          </p>
          <Link
            to="/real-estate"
            className="mx-auto mt-4 flex h-11 w-full max-w-xs items-center justify-center gap-1.5 rounded-btn bg-white font-bold text-navy transition-transform hover:-translate-y-0.5"
          >
            {t('realEstate.home.cta')}
            <AppIcon name="arrow-right" className="w-4 h-4 dir-arrow" />
          </Link>
        </div>
      </div>

      <div className="mt-7 flex items-center gap-3 flex-wrap">
        <h2 className="section-title">{t('realEstate.home.featured')}</h2>
        <span className="text-sm text-gray-500">{t('realEstate.home.featuredBody')}</span>
        <div className="flex-1" />
        <Link
          to="/real-estate"
          className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-sm font-bold text-navy shadow-soft transition-colors hover:bg-navy hover:text-white"
        >
          {t('common.viewAll')}
          <AppIcon name="arrow-right" className="w-3.5 h-3.5 dir-arrow" />
        </Link>
      </div>

      {compact ? (
        // Horizontal, swipeable rail — same fix as NewsSection: without a
        // grid-cols-1 fallback below `sm`, the featured cards stacked into a
        // long vertical block on mobile instead of scrolling sideways.
        <div className="relative mt-4">
          <ul
            ref={railRef}
            className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-px-5 -mx-5 px-5 sm:-mx-1 sm:px-1 stagger"
            style={{ scrollbarWidth: 'thin' }}
          >
            {featured.map((l, i) => (
              <li key={l.id} className="shrink-0 snap-start w-[78vw] max-w-[300px] sm:w-72">
                <ListingCard listing={l} index={i} to={`/real-estate/${l.id}`} />
              </li>
            ))}
          </ul>
          {/* Pull-past-the-end reveal — purely a visual gesture affordance,
              not a tap target (navigation fires from the drag itself). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center pe-3"
            style={{
              opacity: pull,
              transform: `scale(${0.55 + pull * 0.45})`,
              transition: dragging ? 'none' : 'opacity 260ms ease-out, transform 260ms ease-out',
            }}
          >
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-cardHover">
              <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - Math.min(1, pull))}
                />
              </svg>
              <AppIcon name="arrow-right" className="w-5 h-5 dir-arrow" />
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch stagger">
          {featured.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} to={`/real-estate/${l.id}`} />
          ))}
        </div>
      )}
    </section>
  );
}
