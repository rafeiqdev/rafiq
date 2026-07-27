import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, leads, listings as listingsApi } from '../../lib/api';
import type { Listing } from '../../lib/types';
import { useApp } from '../../context/AppContext';
import { AppIcon } from '../../components/AppIcon';
import { Modal } from '../../components/Modal';
import { PageHero } from '../../components/PageHero';
import { BANNERS, LISTING_PHOTOS } from '../../lib/images';
import { SITE_URL, usePageMeta } from '../../lib/seo';
import { MobileTabBar } from '../../components/MobileTabBar';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

/** Layered photo fallback: listing image → curated photo (by index) → gradient. */
function ListingImage({ listing, index }: { listing: Listing; index: number }) {
  const sources = [listing.image, LISTING_PHOTOS[index % LISTING_PHOTOS.length]].filter(Boolean) as string[];
  const [srcIdx, setSrcIdx] = useState(0);
  const src = sources[srcIdx];
  return (
    <div className="img-zoom relative h-44">
      {src ? (
        <img
          src={src}
          alt={listing.district}
          loading="lazy"
          decoding="async"
          onError={() => setSrcIdx((i) => i + 1)}
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-navy to-navy-light">
          <AppIcon name="building" className="h-14 w-14 text-white/40" />
        </div>
      )}
    </div>
  );
}

const CHIP = 'inline-flex items-center gap-1 rounded-full bg-cream-dark text-navy/80 text-xs font-semibold px-3 py-1.5';

function imagesOf(l: Listing, index = 0): string[] {
  const imgs = (l.images && l.images.length ? l.images : [l.image].filter(Boolean)) as string[];
  return imgs.length ? imgs : [LISTING_PHOTOS[index % LISTING_PHOTOS.length]];
}

/** Full detail bottom-sheet: gallery + specs + description + request. */
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
      <div className="card max-h-[88vh] overflow-y-auto overflow-hidden">
        <div className="relative">
          <img src={imgs[active]} alt={listing.district} className="h-64 w-full object-cover" />
          {listing.citizenship && (
            <span className="absolute end-3 top-3 rounded-full bg-brand-red px-3 py-1 text-xs font-bold text-white">
              {t('realEstate.citizenshipBadge')}
            </span>
          )}
        </div>
        {imgs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {imgs.map((u, i) => (
              <button
                key={u}
                onClick={() => setActive(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? 'border-navy' : 'border-transparent'}`}
              >
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="listing-detail" className="text-xl font-extrabold text-navy">{listing.district}</h2>
            <p className="text-xl font-extrabold text-navy" dir="ltr">${listing.priceUsd.toLocaleString()}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={CHIP}><AppIcon name="building" className="h-3.5 w-3.5" /> {listing.rooms}</span>
            <span className={CHIP} dir="ltr">{listing.m2} m²</span>
            {listing.bathrooms ? <span className={CHIP}>{t('realEstate.bathrooms', { count: listing.bathrooms })}</span> : null}
            {listing.furnished ? <span className={CHIP}>{t('realEstate.furnished')}</span> : null}
          </div>
          {listing.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-600">{listing.description}</p>
          )}
          <button
            onClick={onRequest}
            disabled={requested}
            className="btn-primary mt-5 flex min-h-[48px] w-full disabled:opacity-60"
          >
            {requested && <AppIcon name="check" className="h-4 w-4" />}
            {requested ? t('realEstate.requested') : t('realEstate.cta')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function MobileRealEstate() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Listing | null>(null);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

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
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Photo-hero header (editorial-content variant, no fake status bar) ── */}
        <div className="relative animate-fade-in overflow-hidden rounded-b-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors active:bg-white/30"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <PageHero
            image={BANNERS.realEstate}
            title={t('realEstate.title')}
            subtitle={t('realEstate.subtitle')}
            height="min-h-[15rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        <div className="flex flex-col gap-4 px-5 pt-5">
          {/* ── Legal-verification note (informational, brand-blue) ── */}
          <div className="flex animate-fade-up items-start gap-2.5 rounded-xl bg-brand-blue px-4 py-3 text-sm text-navy">
            <AppIcon name="shield-check" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('realEstate.note')}</span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card h-80 animate-pulse bg-cream-dark/40" />
              ))}
            </div>
          ) : (
            <div className="stagger flex flex-col gap-4">
              {listings.map((l, i) => (
                <div
                  key={l.id}
                  onClick={() => setDetail(l)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDetail(l)}
                  className="card card-hover flex animate-fade-up cursor-pointer flex-col overflow-hidden"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <div className="relative">
                    <ListingImage listing={l} index={i} />
                    {l.citizenship && (
                      <span className="absolute end-3 top-3 rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold text-white">
                        {t('realEstate.citizenshipBadge')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col p-4">
                    <h2 className="text-base font-extrabold text-navy">{l.district}</h2>
                    <p className="mt-1.5 text-[13px] text-gray-500" dir="ltr">
                      {l.rooms} · {l.m2} {t('realEstate.perM2')}
                      {l.bathrooms ? ` · ${l.bathrooms} 🚿` : ''}
                    </p>
                    <p className="mt-2 text-lg font-extrabold text-navy" dir="ltr">
                      ${l.priceUsd.toLocaleString()}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-navy/60">
                      {t('realEstate.viewDetails')}
                      <AppIcon name="arrow-right" className="dir-arrow h-3 w-3" />
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        request(l);
                      }}
                      disabled={requested[l.id]}
                      className="btn-primary mt-4 flex min-h-[48px] w-full disabled:opacity-60"
                    >
                      {requested[l.id] && <AppIcon name="check" className="h-4 w-4" />}
                      {requested[l.id] ? t('realEstate.requested') : t('realEstate.cta')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MobileTabBar />

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
