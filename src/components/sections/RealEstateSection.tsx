import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { AppIcon } from '../AppIcon';
import { ListingCard } from '../realestate/ListingCard';
import { BANNERS } from '../../lib/images';

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

  useEffect(() => {
    listingsApi
      .list()
      .then((rows) => setFeatured(rows.filter((l) => (l.listingType ?? 'sale') === 'sale').slice(0, 3)))
      .catch(() => {});
  }, []);

  if (featured.length === 0) return null;

  return (
    <section className={className ?? `mx-auto max-w-6xl px-4 ${compact ? 'py-8' : 'py-14'}`}>
      <Link
        to="/real-estate"
        className="relative flex items-center gap-4 overflow-hidden rounded-card px-5 py-5 sm:px-7 shadow-card hover:shadow-cardHover transition-shadow"
      >
        <img src={BANNERS.realEstate} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute inset-0 bg-gradient-to-r from-navy-dark via-navy/90 to-navy/40" />
        <span className="relative flex-1 min-w-0 text-white">
          <span className="block text-xl sm:text-2xl font-extrabold">{t('realEstate.home.title')}</span>
          <span className="mt-1 block text-sm text-white/80">{t('realEstate.home.body')}</span>
          <span className="mt-2.5 flex flex-wrap gap-2">
            {(['citizenship', 'invest', 'filters'] as const).map((k) => (
              <span key={k} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-xs font-semibold">
                {t(`realEstate.home.tag.${k}`)}
              </span>
            ))}
          </span>
        </span>
        <span className="relative hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-btn bg-white px-4 h-11 font-bold text-navy">
          {t('realEstate.home.cta')}
          <AppIcon name="arrow-right" className="w-4 h-4 dir-arrow" />
        </span>
      </Link>

      <div className="mt-7 flex items-baseline gap-3 flex-wrap">
        <h2 className="section-title">{t('realEstate.home.featured')}</h2>
        <span className="text-sm text-gray-500">{t('realEstate.home.featuredBody')}</span>
        <div className="flex-1" />
        <Link to="/real-estate" className="text-sm font-bold text-navy inline-flex items-center gap-1">
          {t('common.viewAll')}
          <AppIcon name="arrow-right" className="w-3.5 h-3.5 dir-arrow" />
        </Link>
      </div>

      {compact ? (
        // Horizontal, swipeable rail — same fix as NewsSection: without a
        // grid-cols-1 fallback below `sm`, the featured cards stacked into a
        // long vertical block on mobile instead of scrolling sideways.
        <ul
          className="mt-4 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-px-5 -mx-5 px-5 sm:-mx-1 sm:px-1 stagger"
          style={{ scrollbarWidth: 'thin' }}
        >
          {featured.map((l, i) => (
            <li key={l.id} className="shrink-0 snap-start w-[78vw] max-w-[300px] sm:w-72">
              <ListingCard listing={l} index={i} to={`/real-estate/${l.id}`} />
            </li>
          ))}
        </ul>
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
