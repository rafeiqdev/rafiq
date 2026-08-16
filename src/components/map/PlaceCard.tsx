import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { placeSearch } from '../../lib/api';
import type { GooglePlaceResult, PlaceOverlay } from '../../lib/types';
import { Modal } from '../Modal';
import { AppIcon, DirArrow } from '../AppIcon';

/** Google's own deep link when available; a coordinate query is the fallback. */
function directionsUrl(p: GooglePlaceResult): string {
  if (p.mapsUri) return p.mapsUri;
  if (p.lat !== null && p.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&destination_place_id=${encodeURIComponent(p.placeId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`;
}

/**
 * The place detail sheet, laid out to the supplied design: banner photo with
 * badges, one unmissable Directions CTA, then a call/save/share row.
 *
 * The trust block is the part that matters: Rafiq's verification status and
 * review date come from OUR table, never from Google. A place with no overlay
 * row renders an explicit "not reviewed yet" state — silence must not read as
 * endorsement.
 */
export function PlaceCard({
  place,
  overlay,
  saved,
  onToggleSave,
  onClose,
  onToast,
}: {
  place: GooglePlaceResult;
  overlay?: PlaceOverlay;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
  onToast?: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [imgOk, setImgOk] = useState(true);
  const [copied, setCopied] = useState(false);
  const photo = placeSearch.photoUrl(place.photoRef, 900);
  const verified = overlay?.verifiedStatus === 'verified';

  const reviewedOn = overlay?.lastReviewedAt
    ? new Date(overlay.lastReviewedAt).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  /** Hands the place to the existing help flow instead of inventing a new one. */
  const requestHelp = () => {
    const msg = t('map.helpPrefill', { name: place.name, address: place.address ?? '' });
    navigate(`/help?topic=${encodeURIComponent(place.name)}&note=${encodeURIComponent(msg)}`);
  };

  const copyAddress = async () => {
    if (!place.address || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(place.address);
      setCopied(true);
      onToast?.(t('map.toastAddressCopied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — the address is still on screen to copy by hand */
    }
  };

  const share = async () => {
    const url = directionsUrl(place);
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text: place.address ?? place.name, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        onToast?.(t('map.toastLinkCopied'));
      }
    } catch (e) {
      // A cancelled share sheet is a normal user action, not a failure.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  };

  return (
    <Modal onClose={onClose} labelId="place-card-title" maxWidth="max-w-md" mobileSheet showClose={false}>
      <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-[90vh] md:rounded-3xl">
        {/* banner */}
        <div className="relative h-40 w-full shrink-0 bg-navy">
          {photo && imgOk ? (
            <img
              src={photo}
              alt=""
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-navy to-navy-light" aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />

          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute end-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80"
          >
            <AppIcon name="x" className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-4 bottom-3 flex items-center justify-between gap-2 text-white">
            <div className="flex min-w-0 items-center gap-1.5">
              {overlay?.recommended && (
                <span className="shrink-0 rounded-full bg-gold-dark px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {t('map.recommended')}
                </span>
              )}
              {place.openNow !== null && (
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${
                    place.openNow ? 'bg-emerald-600' : 'bg-brand-red'
                  }`}
                >
                  <AppIcon name="clock" className="h-3 w-3" />
                  {t(place.openNow ? 'map.openNow' : 'map.closedNow')}
                </span>
              )}
            </div>
            {place.rating !== null && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-amber-300" dir="ltr">
                <AppIcon name="star" className="h-3.5 w-3.5 fill-amber-300" />
                {place.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-4">
          <div>
            <h2 id="place-card-title" className="text-lg font-extrabold leading-snug text-navy">
              {place.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600">
              {place.rating !== null && (
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <AppIcon name="star" className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  <span dir="ltr">{place.rating.toFixed(1)}</span>
                  {place.ratingCount !== null && (
                    <span className="font-normal text-gray-400" dir="ltr">
                      ({place.ratingCount})
                    </span>
                  )}
                </span>
              )}
              {place.address && (
                <>
                  <span aria-hidden>·</span>
                  <span className="flex min-w-0 items-center gap-1">
                    <AppIcon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{place.address}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* actions — one unmissable primary, then the secondary row */}
          <div className="space-y-2 pt-1">
            <a
              href={directionsUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl bg-navy px-4 text-xs font-extrabold text-white shadow-md transition-colors hover:bg-navy-light sm:text-sm"
            >
              <AppIcon name="navigation" className="h-4 w-4 shrink-0" />
              <span className="tracking-tight">{t('map.directory.directions')}</span>
            </a>

            <div className="grid grid-cols-3 gap-2">
              {place.phone ? (
                <a
                  href={`tel:${place.phone.replace(/\s/g, '')}`}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-2 text-xs font-bold text-navy transition-colors hover:bg-gray-200"
                >
                  <AppIcon name="phone" className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{t('map.callNow')}</span>
                </a>
              ) : (
                <span className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-2 text-xs font-bold text-gray-400 opacity-60">
                  <AppIcon name="phone" className="h-3.5 w-3.5" />
                  <span>{t('map.callNow')}</span>
                </span>
              )}

              <button
                type="button"
                onClick={onToggleSave}
                aria-pressed={saved}
                className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors ${
                  saved
                    ? 'border border-gold-dark/40 bg-gold-soft text-gold-dark'
                    : 'bg-gray-100 text-navy hover:bg-gray-200'
                }`}
              >
                <AppIcon name="bookmark" className={`h-3.5 w-3.5 ${saved ? 'fill-gold-dark' : ''}`} />
                <span>{t(saved ? 'map.saved' : 'map.save')}</span>
              </button>

              <button
                type="button"
                onClick={share}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-2 text-xs font-bold text-navy transition-colors hover:bg-gray-200"
              >
                <AppIcon name="share-2" className="h-3.5 w-3.5 text-blue-600" />
                <span>{t('map.share')}</span>
              </button>
            </div>
          </div>

          {/* Rafiq trust block — our data, not Google's */}
          <div
            className={`rounded-xl border p-3 ${
              overlay?.recommended
                ? 'border-gold-dark/40 bg-gold-soft'
                : verified
                  ? 'border-green-600/30 bg-green-50'
                  : 'border-gray-200 bg-cream'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-bold text-navy">
              <AppIcon
                name={overlay?.recommended ? 'sparkles' : verified ? 'shield-check' : 'info'}
                className="h-4 w-4 shrink-0"
              />
              {overlay?.recommended ? t('map.recommended') : verified ? t('map.verified') : t('map.notReviewed')}
            </p>
            {overlay?.recommended && overlay.recommendationReason && (
              <p className="mt-1.5 break-words text-xs text-navy/80">{overlay.recommendationReason}</p>
            )}
            {!overlay?.recommended && !verified && (
              <p className="mt-1.5 text-xs text-gray-600">{t('map.notReviewedBody')}</p>
            )}
            {reviewedOn && (
              <p className="mt-1.5 text-[11px] text-navy/60">{t('map.lastReviewed', { date: reviewedOn })}</p>
            )}
          </div>

          {/* details */}
          <div className="space-y-2 text-xs text-navy/80">
            {place.hours && place.hours.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
                <AppIcon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                <ul className="min-w-0 space-y-0.5">
                  {place.hours.map((h) => (
                    <li key={h} className="break-words">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {place.address && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <AppIcon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <span className="truncate font-medium">{place.address}</span>
                </span>
                {navigator.clipboard && (
                  <button
                    type="button"
                    onClick={copyAddress}
                    aria-label={t('map.copyAddress')}
                    title={t('map.copyAddress')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <AppIcon
                      name={copied ? 'check' : 'copy'}
                      className={`h-3.5 w-3.5 ${copied ? 'text-emerald-600' : ''}`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={requestHelp} className="btn-secondary min-h-[44px] w-full text-xs">
            <AppIcon name="hand-helping" className="h-4 w-4" />
            {t('map.requestHelp')}
            <DirArrow />
          </button>

          <p className="border-t border-gray-100 pt-2 text-[11px] font-medium text-gray-400">
            {t('map.sourceGoogle')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
