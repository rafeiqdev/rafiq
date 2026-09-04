import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { placeSearch } from '../../lib/api';
import type { GooglePlaceResult, PlaceOverlay } from '../../lib/types';
import { Modal } from '../Modal';
import { AppIcon, DirArrow } from '../AppIcon';
import type { IconName } from '../AppIcon';
import { PlaceThumb } from './PlaceThumb';

/** Google's own deep link when available; a coordinate query is the fallback. */
function directionsUrl(p: GooglePlaceResult): string {
  if (p.mapsUri) return p.mapsUri;
  if (p.lat !== null && p.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&destination_place_id=${encodeURIComponent(p.placeId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`;
}

/** Prettify Google's machine type ("art_gallery" → "Art gallery") for the subtitle. */
function prettyType(type: string | null): string | null {
  if (!type) return null;
  const s = type.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tailwind can't see runtime class strings, so map the pill count to a static one. */
const PILL_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

/**
 * The place detail sheet — laid out to the supplied Apple-Maps place card:
 * a drag-handle sheet, big title + subtitle, a row of pill actions, a compact
 * stats strip (hours · rating · type), then the hero photo.
 *
 * Two deliberate departures from the reference, both about honesty:
 *   • We hold ONE Google photo, not a gallery, so the hero is a single image
 *     (a branded placeholder when Google returned none) — never faked tiles.
 *   • Apple's "About / Wikipedia" block is replaced by Rafiq's OWN trust block:
 *     verification status and review date come from our table, never Google.
 *     A place with no overlay renders an explicit "not reviewed yet" — silence
 *     must not read as endorsement.
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
  const [copied, setCopied] = useState(false);
  const photo = placeSearch.photoUrl(place.photoRef, 900);
  const verified = overlay?.verifiedStatus === 'verified';
  const typeLabel = prettyType(place.primaryType);

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

  // The pill row, built from what this place actually has. Directions and Save
  // are always there; Call and Website appear only when their data exists — so
  // the row is 2–4 wide and the grid stays even.
  const pills: {
    key: string;
    icon: IconName;
    label: string;
    href?: string;
    onClick?: () => void;
    primary?: boolean;
    active?: boolean;
  }[] = [
    {
      key: 'directions',
      icon: 'navigation',
      label: t('map.directory.directions'),
      href: directionsUrl(place),
      primary: true,
    },
  ];
  if (place.phone) {
    pills.push({
      key: 'call',
      icon: 'phone',
      label: t('map.callNow'),
      href: `tel:${place.phone.replace(/\s/g, '')}`,
    });
  }
  if (place.websiteUri) {
    pills.push({ key: 'website', icon: 'globe', label: t('map.card.website'), href: place.websiteUri });
  }
  pills.push({
    key: 'save',
    icon: 'bookmark',
    label: t(saved ? 'map.saved' : 'map.save'),
    onClick: onToggleSave,
    active: saved,
  });
  const cols = PILL_COLS[Math.min(pills.length, 4)] ?? 'grid-cols-4';

  return (
    <Modal onClose={onClose} labelId="place-card-title" maxWidth="max-w-md" mobileSheet showClose={false}>
      <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-[90vh] md:rounded-3xl">
        {/* header: drag handle + share/close, floating over the scroll area */}
        <div className="relative shrink-0 pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-gray-300" />
          <div className="absolute end-3 top-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={share}
              aria-label={t('map.share')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-navy transition-colors hover:bg-gray-200"
            >
              <AppIcon name="share-2" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-navy transition-colors hover:bg-gray-200"
            >
              <AppIcon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-2">
          {/* title + subtitle */}
          <h2 id="place-card-title" className="pe-20 text-2xl font-extrabold leading-tight text-navy">
            {place.name}
          </h2>
          {(typeLabel || place.address) && (
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-gray-500">
              <span className="truncate">
                {[typeLabel, place.address].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}

          {/* pill actions — light-blue chips, one filled primary (Directions) */}
          <div className={`mt-4 grid gap-2 ${cols}`}>
            {pills.map((p) => {
              const cls = `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-extrabold transition-colors ${
                p.primary
                  ? 'bg-navy text-white shadow-sm hover:bg-navy-light'
                  : p.active
                    ? 'bg-navy text-white hover:bg-navy-light'
                    : 'bg-brand-blue text-navy hover:bg-brand-blue/70'
              }`;
              const inner = (
                <>
                  <AppIcon name={p.icon} className={`h-5 w-5 ${p.active ? 'fill-white' : ''}`} />
                  <span>{p.label}</span>
                </>
              );
              return p.href ? (
                <a
                  key={p.key}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                >
                  {inner}
                </a>
              ) : (
                <button key={p.key} type="button" onClick={p.onClick} aria-pressed={p.active} className={cls}>
                  {inner}
                </button>
              );
            })}
          </div>

          {/* stats strip — hours · rating · type, mirroring the reference row */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200 bg-gray-50/80 text-center rtl:divide-x-reverse">
            <div className="px-1 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {t('map.card.hours')}
              </p>
              <p
                className={`mt-0.5 truncate text-[13px] font-extrabold ${
                  place.openNow === true
                    ? 'text-emerald-600'
                    : place.openNow === false
                      ? 'text-brand-red'
                      : 'text-navy'
                }`}
              >
                {place.openNow === true
                  ? t('map.openNow')
                  : place.openNow === false
                    ? t('map.closedNow')
                    : '—'}
              </p>
            </div>
            <div className="px-1 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {place.ratingCount !== null
                  ? t('map.card.reviewsCount', { count: place.ratingCount })
                  : t('map.card.rating')}
              </p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[13px] font-extrabold text-amber-600">
                {place.rating !== null ? (
                  <>
                    <AppIcon name="star" className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span dir="ltr">{place.rating.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-navy">—</span>
                )}
              </p>
            </div>
            <div className="px-1 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {t('map.card.category')}
              </p>
              <p className="mt-0.5 truncate text-[13px] font-extrabold text-navy">{typeLabel ?? '—'}</p>
            </div>
          </div>

          {/* hero photo (single — we hold one Google image, not a gallery) */}
          <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-100">
            <PlaceThumb name={place.name} photo={photo} size="lg" />
          </div>

          {/* Rafiq trust block — our data, standing in for the reference's About */}
          <div
            className={`mt-4 rounded-2xl border p-3.5 ${
              overlay?.recommended
                ? 'border-gold-dark/40 bg-gold-soft'
                : verified
                  ? 'border-green-600/30 bg-green-50'
                  : 'border-gray-200 bg-cream'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-extrabold text-navy">
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

          {/* details: phone spelled out, hours, address with copy */}
          <div className="mt-4 space-y-2 text-xs text-navy/80">
            {place.phone && (
              <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
                <AppIcon name="phone" className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                <a href={`tel:${place.phone.replace(/\s/g, '')}`} className="font-medium hover:underline" dir="ltr">
                  {place.phone}
                </a>
              </div>
            )}

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

          <button onClick={requestHelp} className="btn-secondary mt-4 min-h-[44px] w-full text-xs">
            <AppIcon name="hand-helping" className="h-4 w-4" />
            {t('map.requestHelp')}
            <DirArrow />
          </button>

          <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] font-medium text-gray-400">
            {t('map.sourceGoogle')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
