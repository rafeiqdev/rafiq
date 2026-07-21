import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, leads, listings as listingsApi } from '../lib/api';
import type { Listing } from '../lib/types';
import { useApp } from '../context/AppContext';
import { AppIcon } from '../components/AppIcon';
import { Modal } from '../components/Modal';
import { PageHero } from '../components/PageHero';
import { BANNERS, LISTING_PHOTOS } from '../lib/images';
import { SITE_URL, usePageMeta } from '../lib/seo';

/**
 * Listing photo with layered fallback: the listing's own image → a curated
 * Istanbul property photo (by index) → the brand gradient. Always shows a photo.
 */
function ListingImage({ listing, index }: { listing: Listing; index: number }) {
  const sources = [listing.image, LISTING_PHOTOS[index % LISTING_PHOTOS.length]].filter(Boolean) as string[];
  const [srcIdx, setSrcIdx] = useState(0);
  const src = sources[srcIdx];
  return (
    <div className="img-zoom relative h-40">
      {src ? (
        <img
          src={src}
          alt={listing.district}
          loading="lazy"
          decoding="async"
          onError={() => setSrcIdx((i) => i + 1)}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
          <AppIcon name="building" className="w-14 h-14 text-white/40" />
        </div>
      )}
    </div>
  );
}

const CHIP = 'inline-flex items-center gap-1 rounded-full bg-cream-dark text-navy/80 text-xs font-semibold px-3 py-1';

function imagesOf(l: Listing, index = 0): string[] {
  const imgs = (l.images && l.images.length ? l.images : [l.image].filter(Boolean)) as string[];
  return imgs.length ? imgs : [LISTING_PHOTOS[index % LISTING_PHOTOS.length]];
}

/** Full detail view for a listing: photo gallery + specs + description + request. */
function ListingDetail({
  listing, index, requested, onRequest, onClose,
}: {
  listing: Listing; index: number; requested: boolean; onRequest: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const imgs = imagesOf(listing, index);
  const [active, setActive] = useState(0);
  return (
    <Modal onClose={onClose} labelId="listing-detail" maxWidth="max-w-2xl">
      <div className="card overflow-hidden max-h-[88vh] overflow-y-auto">
        <div className="relative">
          <img src={imgs[active]} alt={listing.district} className="w-full h-64 sm:h-80 object-cover" />
          {listing.citizenship && (
            <span className="absolute top-3 end-3 rounded-full bg-brand-red text-white text-xs font-bold px-3 py-1">
              {t('realEstate.citizenshipBadge')}
            </span>
          )}
        </div>
        {imgs.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {imgs.map((u, i) => (
              <button
                key={u}
                onClick={() => setActive(i)}
                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${i === active ? 'border-navy' : 'border-transparent'}`}
              >
                <img src={u} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="listing-detail" className="text-xl font-extrabold text-navy">{listing.district}</h2>
            <p className="text-xl font-extrabold text-navy" dir="ltr">${listing.priceUsd.toLocaleString()}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={CHIP}><AppIcon name="building" className="w-3.5 h-3.5" /> {listing.rooms}</span>
            <span className={CHIP} dir="ltr">{listing.m2} m²</span>
            {listing.bathrooms ? <span className={CHIP}>{t('realEstate.bathrooms', { count: listing.bathrooms })}</span> : null}
            {listing.furnished ? <span className={CHIP}>{t('realEstate.furnished')}</span> : null}
          </div>
          {listing.description && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
          )}
          <button onClick={onRequest} disabled={requested} className="btn-primary w-full mt-5 disabled:opacity-60">
            {requested && <AppIcon name="check" className="w-4 h-4" />}
            {requested ? t('realEstate.requested') : t('realEstate.cta')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function RealEstate() {
  const { t } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Listing | null>(null);

  usePageMeta({
    title: `${t('realEstate.title')} — ${t('common.appName')}`,
    description: t('realEstate.subtitle'),
    image: `${SITE_URL}${BANNERS.realEstate}`,
  });

  useEffect(() => {
    listingsApi
      .list()
      .then(setListings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // requests are persisted leads — reflect existing ones after reload
  useEffect(() => {
    if (!user || listings.length === 0) return;
    leads
      .mine()
      .then((mine) => {
        const map: Record<string, boolean> = {};
        for (const l of mine.filter((x) => x.kind === 'realestate')) {
          const match = listings.find((li) => l.item.includes(li.district) && l.item.includes(li.rooms));
          if (match) map[match.id] = true;
        }
        setRequested(map);
      })
      .catch(() => {});
  }, [user, listings]);

  const request = async (l: Listing) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      await leads.create('realestate', `${l.district} ${l.rooms} · $${l.priceUsd.toLocaleString()}`);
      setRequested((r) => ({ ...r, [l.id]: true }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) navigate('/auth');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="animate-fade-in">
        <PageHero image={BANNERS.realEstate} title={t('realEstate.title')} subtitle={t('realEstate.subtitle')} />
      </div>

      <div className="mt-5 rounded-xl bg-brand-blue px-4 py-3 text-sm text-navy flex gap-2 items-start animate-fade-up">
        <AppIcon name="shield-check" className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{t('realEstate.note')}</span>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-80 animate-pulse bg-cream-dark/40" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch stagger">
          {listings.map((l, i) => (
            <div
              key={l.id}
              onClick={() => setDetail(l)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDetail(l)}
              className="card card-hover flex flex-col overflow-hidden cursor-pointer"
              style={{ '--i': i } as React.CSSProperties}
            >
              <ListingImage listing={l} index={i} />
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-navy">{l.district}</h2>
                  {l.citizenship && (
                    <span className="rounded-full bg-brand-red/10 text-brand-red text-[10px] font-bold px-2 py-1">
                      {t('realEstate.citizenshipBadge')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500" dir="ltr">
                  {l.rooms} · {l.m2} {t('realEstate.perM2')}
                  {l.bathrooms ? ` · ${l.bathrooms} 🚿` : ''}
                </p>
                <p className="mt-2 text-lg font-extrabold text-navy" dir="ltr">
                  ${l.priceUsd.toLocaleString()}
                </p>
                <span className="mt-1 text-xs font-semibold text-navy/60 inline-flex items-center gap-1">
                  {t('realEstate.viewDetails')}
                  <AppIcon name="arrow-right" className="w-3 h-3 dir-arrow" />
                </span>
                <div className="flex-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    request(l);
                  }}
                  disabled={requested[l.id]}
                  className="btn-primary w-full mt-4 disabled:opacity-60"
                >
                  {requested[l.id] && <AppIcon name="check" className="w-4 h-4" />}
                  {requested[l.id] ? t('realEstate.requested') : t('realEstate.cta')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <ListingDetail
          listing={detail}
          index={Math.max(0, listings.indexOf(detail))}
          requested={!!requested[detail.id]}
          onRequest={() => request(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
