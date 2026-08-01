import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Listing } from '../../lib/types';
import { LISTING_PHOTOS } from '../../lib/images';
import { AppIcon } from '../AppIcon';

/**
 * Listing photo with a layered fallback: the listing's own cover → a curated
 * Istanbul property photo (picked by index so a grid never repeats the same
 * filler twice in a row) → the brand gradient. A card always shows something.
 */
export function ListingPhoto({ listing, index, className = 'h-44' }: { listing: Listing; index: number; className?: string }) {
  const sources = [
    listing.images?.[0],
    listing.image,
    LISTING_PHOTOS[index % LISTING_PHOTOS.length],
  ].filter(Boolean) as string[];
  const [srcIdx, setSrcIdx] = useState(0);
  const src = sources[srcIdx];

  if (!src) {
    return (
      <div className={`${className} w-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center`}>
        <AppIcon name="building" className="w-12 h-12 text-white/40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={listing.district}
      loading="lazy"
      decoding="async"
      onError={() => setSrcIdx((i) => i + 1)}
      className={`${className} w-full object-cover`}
    />
  );
}

/**
 * The citizenship badge. There are only two states on purpose — "meets the
 * threshold" and "unverified". We never render a negative "not eligible"
 * badge: the underlying data is scraped, so a false there means nobody
 * checked, and telling a buyer a property is ineligible on that basis would
 * be a claim we cannot stand behind.
 */
export function CitizenshipBadge({ listing, small = false }: { listing: Listing; small?: boolean }) {
  const { t } = useTranslation();
  const size = small ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1';
  return listing.citizenship ? (
    <span className={`rounded-full bg-brand-red text-white font-bold ${size}`}>{t('realEstate.citizenshipBadge')}</span>
  ) : (
    <span className={`rounded-full bg-navy/80 text-white font-bold ${size}`}>{t('realEstate.citizenshipUnknown')}</span>
  );
}

const CHIP = 'inline-flex items-center rounded-full bg-cream-dark text-navy/80 text-xs font-semibold px-2.5 py-1';

export function ListingCard({ listing, index, to }: { listing: Listing; index: number; to: string }) {
  const { t } = useTranslation();
  return (
    <Link to={to} className="card card-hover flex flex-col overflow-hidden">
      <div className="img-zoom relative">
        <ListingPhoto listing={listing} index={index} />
        <span className="absolute top-2.5 end-2.5">
          <CitizenshipBadge listing={listing} />
        </span>
        {listing.yieldPct ? (
          <span className="absolute top-2.5 start-2.5 rounded-full bg-white text-navy text-[11px] font-bold px-2.5 py-1" dir="ltr">
            {t('realEstate.yieldBadge', { pct: listing.yieldPct })}
          </span>
        ) : null}
      </div>
      <div className="p-4 flex flex-col flex-1 gap-1.5">
        <h3 className="font-bold text-navy leading-snug">{listing.district}</h3>
        <p className="text-sm text-gray-500" dir="ltr">
          {listing.rooms} · {listing.m2} {t('realEstate.perM2')}
          {listing.bathrooms ? ` · ${listing.bathrooms} ${t('realEstate.bathShort')}` : ''}
        </p>
        <p className="text-lg font-extrabold text-navy" dir="ltr">${listing.priceUsd.toLocaleString()}</p>
        <div className="flex flex-wrap gap-1.5">
          {listing.furnished ? <span className={CHIP}>{t('realEstate.furnished')}</span> : null}
          {listing.buildStatus ? <span className={CHIP}>{t(`realEstate.build.${listing.buildStatus}`)}</span> : null}
        </div>
        <div className="flex-1" />
        <span className="mt-3 text-xs font-bold text-navy/70 inline-flex items-center gap-1">
          {t('realEstate.viewDetails')}
          <AppIcon name="arrow-right" className="w-3 h-3 dir-arrow" />
        </span>
      </div>
    </Link>
  );
}
