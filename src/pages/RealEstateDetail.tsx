import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../lib/api';
import type { Listing } from '../lib/types';
import { AppIcon } from '../components/AppIcon';
import { LISTING_PHOTOS } from '../lib/images';
import { usePageMeta } from '../lib/seo';
import { CitizenshipBadge, ListingCard } from '../components/realestate/ListingCard';
import { DescriptionBox } from '../components/realestate/DescriptionBox';
import {
  LISTING_SERVICES,
  ListingTrustNote,
  ServiceRow,
  useListingService,
} from '../components/realestate/ListingServices';

function photosOf(l: Listing, index = 0): string[] {
  const imgs = (l.images?.length ? l.images : [l.image].filter(Boolean)) as string[];
  return imgs.length ? imgs : [LISTING_PHOTOS[index % LISTING_PHOTOS.length]];
}

const CHIP = 'inline-flex items-center rounded-full bg-cream-dark text-navy/80 text-xs font-semibold px-3 py-1';

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-btn bg-cream px-3 py-2">
      <span className="block text-[11px] font-semibold text-gray-500">{label}</span>
      <b className="text-sm text-navy" dir="ltr">{value}</b>
    </div>
  );
}

export function RealEstateDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [visiblePhotos, setVisiblePhotos] = useState(8);

  useEffect(() => {
    listingsApi
      .list()
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const listing = useMemo(() => all.find((l) => l.id === id) ?? null, [all, id]);
  const index = listing ? all.indexOf(listing) : 0;
  const photos = listing ? photosOf(listing, index) : [];
  const { sent, busy, request } = useListingService(listing);

  // Similar = same district first, then anything else in the same price band.
  const similar = useMemo(() => {
    if (!listing) return [];
    return all
      .filter((l) => l.id !== listing.id && (l.listingType ?? 'sale') === (listing.listingType ?? 'sale'))
      .sort((a, b) => {
        const aScore = (a.district === listing.district ? 0 : 1) + Math.abs(a.priceUsd - listing.priceUsd) / 1e7;
        const bScore = (b.district === listing.district ? 0 : 1) + Math.abs(b.priceUsd - listing.priceUsd) / 1e7;
        return aScore - bScore;
      })
      .slice(0, 2);
  }, [all, listing]);

  usePageMeta({
    title: listing ? `${listing.district} — ${t('realEstate.title')}` : t('realEstate.title'),
    description: listing?.description ?? t('realEstate.subtitle'),
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="card h-96 animate-pulse bg-cream-dark/40" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <AppIcon name="building" className="w-12 h-12 mx-auto text-navy/25" />
        <h1 className="mt-4 text-xl font-extrabold text-navy">{t('realEstate.detail.missingTitle')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('realEstate.detail.missingBody')}</p>
        <Link to="/real-estate" className="btn-primary mt-6">{t('realEstate.detail.backToList')}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
        <Link to="/real-estate" className="hover:text-navy">{t('realEstate.title')}</Link>
        <AppIcon name="arrow-right" className="w-3 h-3 dir-arrow" />
        <span className="font-bold text-navy">{listing.district} · {listing.rooms}</span>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.65fr_1fr] items-start">
        <div>
          <div className="card overflow-hidden">
            <div className="relative">
              <img
                src={photos[active]}
                alt={listing.district}
                width={1200}
                height={675}
                className="w-full h-52 sm:h-72 max-h-[60vh] object-cover bg-navy-50"
              />
              <span className="absolute top-3 end-3">
                <CitizenshipBadge listing={listing} />
              </span>
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {photos.slice(0, visiblePhotos).map((u, i) => (
                  <button
                    key={u}
                    onClick={() => setActive(i)}
                    aria-label={t('realEstate.detail.photo', { n: i + 1 })}
                    className={`shrink-0 w-[70px] h-14 rounded-btn overflow-hidden border-2 ${i === active ? 'border-navy' : 'border-transparent'}`}
                  >
                    <img
                      src={u}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={70}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {visiblePhotos < photos.length && (
                  <button
                    onClick={() => setVisiblePhotos((v) => v + 16)}
                    className="shrink-0 rounded-btn bg-cream px-3 h-14 text-xs font-bold text-navy whitespace-nowrap"
                  >
                    {t('realEstate.detail.morePhotos', { count: photos.length - visiblePhotos })}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card p-5 mt-5">
            <div className="flex justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-extrabold text-navy">{listing.district}</h1>
                <p className="text-sm text-gray-500">{t(`realEstate.tabs.${listing.listingType ?? 'sale'}`)}</p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-extrabold text-navy" dir="ltr">${listing.priceUsd.toLocaleString()}</p>
                <p className="text-sm text-gray-500" dir="ltr">
                  ≈ {Math.round(listing.priceUsd / Math.max(1, listing.m2)).toLocaleString()} $/m²
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Spec label={t('realEstate.rooms')} value={listing.rooms} />
              <Spec label={t('realEstate.filters.area')} value={`${listing.m2} m²`} />
              {listing.bathrooms ? <Spec label={t('realEstate.bathLabel')} value={String(listing.bathrooms)} /> : null}
              {listing.floor ? (
                <Spec label={t('realEstate.floor')} value={listing.totalFloors ? `${listing.floor} / ${listing.totalFloors}` : String(listing.floor)} />
              ) : null}
              {listing.buildStatus ? <Spec label={t('realEstate.status')} value={t(`realEstate.build.${listing.buildStatus}`)} /> : null}
              {listing.yieldPct ? <Spec label={t('realEstate.yieldLabel')} value={`${listing.yieldPct}%`} /> : null}
            </div>

            {(listing.furnished || (listing.amenities?.length ?? 0) > 0) && (
              <div className="mt-4 pt-4 border-t border-cream-dark flex flex-wrap gap-2">
                {listing.furnished && <span className={CHIP}>{t('realEstate.amenity.furnished')}</span>}
                {(listing.amenities ?? [])
                  .filter((a) => a !== 'furnished')
                  .map((a) => (
                    <span key={a} className={CHIP}>{t(`realEstate.amenity.${a}`, { defaultValue: a })}</span>
                  ))}
              </div>
            )}

            <DescriptionBox text={listing.description} />

            {listing.updatedAt && (
              <p className="mt-4 text-xs text-gray-400">
                {t('realEstate.detail.lastUpdate', { date: new Date(listing.updatedAt).toLocaleDateString() })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card p-5">
            <h2 className="font-bold text-navy">{t('realEstate.detail.interestedTitle')}</h2>
            <p className="mt-1 text-xs text-gray-500">{t('realEstate.detail.interestedBody')}</p>
            <button
              onClick={() => request('details')}
              disabled={sent.details || busy === 'details'}
              className="btn-primary w-full mt-4 disabled:opacity-60"
            >
              {sent.details && <AppIcon name="check" className="w-4 h-4" />}
              {sent.details ? t('realEstate.requested') : t('realEstate.cta')}
            </button>
            <div className="mt-3">
              <ListingTrustNote />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-navy">{t('realEstate.services.title')}</h2>
            <p className="mt-1 mb-3 text-xs text-gray-500">{t('realEstate.services.body')}</p>
            <div className="flex flex-col gap-2.5">
              {LISTING_SERVICES.map((s) => (
                <ServiceRow
                  key={s.key}
                  serviceKey={s.key}
                  icon={s.icon}
                  sent={!!sent[s.key]}
                  busy={busy === s.key}
                  onClick={() => request(s.key)}
                />
              ))}
            </div>
            <Link to="/premium" className="btn-gold w-full mt-4">
              <AppIcon name="message-circle" className="w-4 h-4" />
              {t('realEstate.services.advisor')}
            </Link>
          </div>

          {similar.length > 0 && (
            <div>
              <h2 className="font-bold text-navy mb-3">{t('realEstate.detail.similar')}</h2>
              <div className="grid gap-4">
                {similar.map((l, i) => (
                  <ListingCard key={l.id} listing={l} index={i} to={`/real-estate/${l.id}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
