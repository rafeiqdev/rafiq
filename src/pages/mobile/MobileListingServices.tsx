import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { AppIcon, BackArrow } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { LISTING_PHOTOS } from '../../lib/images';
import { usePageMeta } from '../../lib/seo';
import {
  LISTING_SERVICES,
  ListingTrustNote,
  ServiceRow,
  useListingService,
} from '../../components/realestate/ListingServices';

/**
 * Rafiq's services for one listing, on their own mobile screen.
 *
 * On desktop these sit in a sidebar next to the property. A phone has no
 * sidebar, and stacking four service rows inline pushed the description and
 * the price bar below the fold — so on mobile they get a screen, reached from
 * a single row on the detail page.
 */
export function MobileListingServices() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

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
  const cover = listing
    ? listing.images?.[0] || listing.image || LISTING_PHOTOS[all.indexOf(listing) % LISTING_PHOTOS.length]
    : null;
  const { sent, busy, failed, request } = useListingService(listing);

  usePageMeta({
    title: `${t('realEstate.services.title')} — ${t('common.appName')}`,
    description: t('realEstate.services.body'),
  });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-cream-dark bg-white px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="flex h-9 w-9 items-center justify-center rounded-btn bg-cream-dark text-navy"
          >
            <BackArrow className="h-5 w-5" />
          </button>
          <h1 className="flex-1 font-bold text-navy">{t('realEstate.services.title')}</h1>
        </header>

        <div className="flex flex-col gap-4 px-5 pt-5">
          {loading ? (
            <div className="card h-20 animate-pulse bg-cream-dark/40" />
          ) : !listing ? (
            <div className="card p-8 text-center">
              <h2 className="font-bold text-navy">{t('realEstate.detail.missingTitle')}</h2>
              <Link to="/real-estate" className="btn-primary mt-4">{t('realEstate.detail.backToList')}</Link>
            </div>
          ) : (
            <>
              {/* which property this is about — without it the four rows below
                  are context-free once the user has scrolled a while */}
              <Link to={`/real-estate/${listing.id}`} className="card flex items-center gap-3 p-2.5">
                {cover && <img src={cover} alt="" className="h-14 w-16 shrink-0 rounded-btn object-cover" />}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-navy">{listing.district}</b>
                  <small className="block text-xs text-gray-500" dir="ltr">
                    {listing.rooms} · ${listing.priceUsd.toLocaleString()}
                  </small>
                </span>
                <AppIcon name="arrow-right" className="h-4 w-4 shrink-0 text-navy/30 dir-arrow" />
              </Link>

              <p className="text-sm text-gray-500">{t('realEstate.services.body')}</p>

              <div className="flex flex-col gap-2.5">
                {LISTING_SERVICES.map((s) => (
                  <ServiceRow
                    key={s.key}
                    serviceKey={s.key}
                    icon={s.icon}
                    sent={!!sent[s.key]}
                    busy={busy === s.key}
                    failed={!!failed[s.key]}
                    onClick={() => request(s.key)}
                  />
                ))}
              </div>

              <Link to="/premium" className="btn-gold w-full">
                <AppIcon name="message-circle" className="h-4 w-4" />
                {t('realEstate.services.advisor')}
              </Link>

              <ListingTrustNote />
            </>
          )}
        </div>
      </div>
      <MobileTabBar />
    </div>
  );
}
