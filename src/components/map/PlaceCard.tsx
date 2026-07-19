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
 * The place detail card.
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
}: {
  place: GooglePlaceResult;
  overlay?: PlaceOverlay;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [imgOk, setImgOk] = useState(true);
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

  return (
    <Modal onClose={onClose} labelId="place-card-title" maxWidth="max-w-lg">
      <div className="rounded-card overflow-hidden bg-white">
        {photo && imgOk ? (
          <img
            src={photo}
            alt=""
            className="h-44 w-full object-cover"
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="h-24 w-full bg-gradient-to-br from-navy to-navy-light" aria-hidden />
        )}

        <div className="p-5">
          <div className="flex items-start gap-3">
            <h2 id="place-card-title" className="flex-1 min-w-0 text-lg font-extrabold text-navy break-words">
              {place.name}
            </h2>
            <button
              onClick={onToggleSave}
              aria-pressed={saved}
              aria-label={t(saved ? 'map.unsave' : 'map.save')}
              className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-full border transition-colors ${
                saved ? 'border-gold-dark bg-gold-soft text-gold-dark' : 'border-gray-200 text-navy/50 hover:border-navy/40'
              }`}
            >
              <AppIcon name="bookmark" className="w-5 h-5" />
            </button>
          </div>

          {/* Rafiq trust block — our data, not Google's */}
          <div
            className={`mt-3 rounded-xl border p-3 ${
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
                className="w-4 h-4 shrink-0"
              />
              {overlay?.recommended
                ? t('map.recommended')
                : verified
                  ? t('map.verified')
                  : t('map.notReviewed')}
            </p>
            {overlay?.recommended && overlay.recommendationReason && (
              <p className="mt-1.5 text-xs text-navy/80 break-words">{overlay.recommendationReason}</p>
            )}
            {!overlay?.recommended && !verified && (
              <p className="mt-1.5 text-xs text-gray-600">{t('map.notReviewedBody')}</p>
            )}
            {reviewedOn && (
              <p className="mt-1.5 text-[11px] text-navy/60">{t('map.lastReviewed', { date: reviewedOn })}</p>
            )}
          </div>

          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            {place.address && (
              <div className="flex items-start gap-2.5">
                <AppIcon name="map-pin" className="mt-0.5 w-4 h-4 shrink-0 text-navy/50" />
                <dd className="min-w-0 break-words text-navy/80">{place.address}</dd>
              </div>
            )}

            {place.rating !== null && (
              <div className="flex items-center gap-2.5">
                <AppIcon name="star" className="w-4 h-4 shrink-0 text-gold-dark" />
                <dd className="text-navy/80" dir="ltr">
                  {place.rating.toFixed(1)}
                  {place.ratingCount !== null && ` (${place.ratingCount})`}
                </dd>
              </div>
            )}

            {place.phone && (
              <div className="flex items-center gap-2.5">
                <AppIcon name="phone" className="w-4 h-4 shrink-0 text-navy/50" />
                <dd>
                  <a href={`tel:${place.phone.replace(/\s/g, '')}`} className="text-navy hover:underline" dir="ltr">
                    {place.phone}
                  </a>
                </dd>
              </div>
            )}

            {place.hours && place.hours.length > 0 && (
              <div className="flex items-start gap-2.5">
                <AppIcon name="clock" className="mt-0.5 w-4 h-4 shrink-0 text-navy/50" />
                <dd className="min-w-0">
                  {place.openNow !== null && (
                    <span className={`text-xs font-bold ${place.openNow ? 'text-green-700' : 'text-brand-red'}`}>
                      {t(place.openNow ? 'map.openNow' : 'map.closedNow')}
                    </span>
                  )}
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-gray-600">
                    {place.hours.map((h) => (
                      <li key={h} className="break-words">
                        {h}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-5 flex flex-col gap-2.5">
            <button onClick={requestHelp} className="btn-primary w-full min-h-[48px]">
              <AppIcon name="hand-helping" className="w-4 h-4" />
              {t('map.requestHelp')}
            </button>
            <a
              href={directionsUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full min-h-[48px]"
            >
              <AppIcon name="navigation" className="w-4 h-4" />
              {t('map.directory.directions')}
              <DirArrow />
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
