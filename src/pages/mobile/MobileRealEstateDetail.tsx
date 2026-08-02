import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { AppIcon } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { LISTING_PHOTOS } from '../../lib/images';
import { usePageMeta } from '../../lib/seo';
import { CitizenshipBadge } from '../../components/realestate/ListingCard';
import { DescriptionBox } from '../../components/realestate/DescriptionBox';
import { PhotoLightbox } from '../../components/realestate/PhotoLightbox';
import { ListingTrustNote, useListingService } from '../../components/realestate/ListingServices';

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

export function MobileRealEstateDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

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

  usePageMeta({
    title: listing ? `${listing.district} — ${t('realEstate.title')}` : t('realEstate.title'),
    description: listing?.description ?? t('realEstate.subtitle'),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-cream p-5">
        <div className="card h-80 animate-pulse bg-cream-dark/40" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream px-6 py-20 text-center">
        <AppIcon name="building" className="mx-auto h-12 w-12 text-navy/25" />
        <h1 className="mt-4 text-lg font-extrabold text-navy">{t('realEstate.detail.missingTitle')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('realEstate.detail.missingBody')}</p>
        <Link to="/real-estate" className="btn-primary mt-6">{t('realEstate.detail.backToList')}</Link>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      {/* the price bar is pinned, so leave room for it plus the tab bar */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+160px)]">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={t('realEstate.detail.photo', { n: photo + 1 })}
            className="block w-full"
          >
            <img
              src={photos[photo]}
              alt={listing.district}
              width={800}
              height={450}
              className="h-44 w-full max-h-[38vh] object-cover bg-navy-50"
            />
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-navy backdrop-blur"
          >
            <AppIcon name="arrow-left" className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <span className="absolute end-4 top-[calc(env(safe-area-inset-top)+0.75rem)]">
            <CitizenshipBadge listing={listing} />
          </span>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => setPhoto((p) => (p + 1) % photos.length)}
              className="absolute bottom-3 end-4 rounded-full bg-navy/70 px-3 py-1 text-[11px] font-bold text-white"
              dir="ltr"
            >
              {photo + 1} / {photos.length}
            </button>
          )}
        </div>

        {lightboxOpen && (
          <PhotoLightbox
            photos={photos}
            index={photo}
            alt={listing.district}
            onClose={() => setLightboxOpen(false)}
          />
        )}

        <div className="flex flex-col gap-4 px-5 pt-4">
          <div>
            <h1 className="text-lg font-extrabold text-navy">{listing.district}</h1>
            <p className="text-xs text-gray-500">{t(`realEstate.tabs.${listing.listingType ?? 'sale'}`)}</p>
            <p className="mt-1.5 text-2xl font-extrabold text-navy" dir="ltr">${listing.priceUsd.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Spec label={t('realEstate.rooms')} value={listing.rooms} />
            <Spec label={t('realEstate.filters.area')} value={`${listing.m2} m²`} />
            {listing.bathrooms ? <Spec label={t('realEstate.bathLabel')} value={String(listing.bathrooms)} /> : null}
            {listing.floor ? (
              <Spec label={t('realEstate.floor')} value={listing.totalFloors ? `${listing.floor} / ${listing.totalFloors}` : String(listing.floor)} />
            ) : null}
            {listing.buildStatus ? <Spec label={t('realEstate.status')} value={t(`realEstate.build.${listing.buildStatus}`)} /> : null}
            {listing.yieldPct ? <Spec label={t('realEstate.yieldLabel')} value={`${listing.yieldPct}%`} /> : null}
          </div>

          {/* Services live on their own screen: four full rows here would push
              the description and the price bar off a phone viewport. */}
          <Link
            to={`/real-estate/${listing.id}/services`}
            className="flex items-center gap-3 rounded-card bg-navy px-4 py-3.5 text-white shadow-card"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-white/15">
              <AppIcon name="briefcase" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{t('realEstate.services.title')}</b>
              <small className="block truncate text-xs text-white/75">{t('realEstate.services.short')}</small>
            </span>
            <AppIcon name="arrow-right" className="h-4 w-4 shrink-0 dir-arrow" />
          </Link>

          {(listing.furnished || (listing.amenities?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-2">
              {listing.furnished && <span className={CHIP}>{t('realEstate.amenity.furnished')}</span>}
              {(listing.amenities ?? [])
                .filter((a) => a !== 'furnished')
                .map((a) => (
                  <span key={a} className={CHIP}>{t(`realEstate.amenity.${a}`, { defaultValue: a })}</span>
                ))}
            </div>
          )}

          <DescriptionBox listing={listing} />

          <ListingTrustNote />

          {listing.updatedAt && (
            <p className="text-xs text-gray-400">
              {t('realEstate.detail.lastUpdate', { date: new Date(listing.updatedAt).toLocaleDateString() })}
            </p>
          )}
        </div>
      </div>

      {/* pinned price + primary action */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-20 flex items-center gap-3 border-t border-cream-dark bg-white px-4 py-3">
        <div className="min-w-0">
          <b className="block text-lg font-extrabold text-navy" dir="ltr">${listing.priceUsd.toLocaleString()}</b>
          <small className="block text-[11px] text-gray-500" dir="ltr">{listing.rooms} · {listing.m2} m²</small>
        </div>
        <button
          onClick={() => request('details')}
          disabled={sent.details || busy === 'details'}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {sent.details && <AppIcon name="check" className="h-4 w-4" />}
          {sent.details ? t('realEstate.requested') : t('realEstate.cta')}
        </button>
      </div>

      <MobileTabBar />
    </div>
  );
}
