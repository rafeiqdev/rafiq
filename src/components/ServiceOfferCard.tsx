import { useEffect, useState } from 'react';
import type { TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { servicePayments, serviceOffers } from '../lib/api';
import { AppIcon } from './AppIcon';
import { Modal } from './Modal';
import type { ServiceOffer, ServicePayment } from '../lib/types';

/** How far (px) a swipe must travel before it counts as a page change, not a tap. */
const SWIPE_THRESHOLD = 40;

/**
 * Full-size viewer for an offer's photos — prev/next arrows, left/right
 * arrow keys, and touch swipe, all moving through the same `photos` array.
 * Built on the shared Modal (portal, focus trap, Escape-to-close) like
 * realestate/PhotoLightbox, kept as its own small copy since offer photos
 * have no thumbnail-CDN transform to reuse from that one.
 */
function OfferPhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(index);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => setActive(index), [index]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [photos.length]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      // Swipe right (dx > 0) = previous photo in a left-to-right reading gesture.
      setActive((i) => (dx > 0 ? (i - 1 + photos.length) % photos.length : (i + 1) % photos.length));
    }
    setTouchStartX(null);
  };

  return (
    <Modal onClose={onClose} labelId="offer-photo-lightbox-title" maxWidth="max-w-3xl">
      <h2 id="offer-photo-lightbox-title" className="sr-only">{t('serviceOffer.title')}</h2>
      <div
        className="relative flex items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photos[active]}
          alt={t('realEstate.detail.photo', { n: active + 1 })}
          className="max-h-[80vh] w-auto max-w-full touch-pan-y select-none rounded-card object-contain bg-navy-900"
          draggable={false}
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((i) => (i - 1 + photos.length) % photos.length)}
              aria-label={t('realEstate.detail.prevPhoto')}
              className="absolute start-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-navy shadow-card hover:bg-white"
            >
              <AppIcon name="chevron-left" className="w-5 h-5 dir-arrow" />
            </button>
            <button
              type="button"
              onClick={() => setActive((i) => (i + 1) % photos.length)}
              aria-label={t('realEstate.detail.nextPhoto')}
              className="absolute end-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-navy shadow-card hover:bg-white"
            >
              <AppIcon name="chevron-right" className="w-5 h-5 dir-arrow" />
            </button>
            <span className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-navy/70 px-3 py-1 text-xs font-bold text-white" dir="ltr">
              {active + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * One admin-sent price offer on a regular ("طلباتي") service request — price,
 * details, photos, and a real pay-or-reject decision. Sibling of
 * MedicalOfferCard, deliberately simpler: no booking-percentage deposit (full
 * price, once), no hidden-identity reveal, and a reject path medical doesn't
 * have (see supabase/migrations/20260812_service_offers.sql header).
 *
 * "Pay" redirects to a real checkout page (api/payments/service-pay.ts) that
 * only ever completes by delivering a signed webhook — there is no
 * client-side or admin path that can mark this offer paid.
 */
export function ServiceOfferCard({
  offer,
  payment,
  onChanged,
}: {
  offer: ServiceOffer;
  payment: ServicePayment | undefined;
  /** refetch offers/payments after a reject or a payment attempt starts */
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const verified = payment?.status === 'verified';
  const expired = offer.expiresAt ? new Date(offer.expiresAt) < new Date() : false;
  const returnPath = typeof window !== 'undefined' ? window.location.pathname : '/requests';
  const resumeUrl = payment ? servicePayments.resumeUrl(payment, returnPath) : null;

  const startPayment = async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await servicePayments.createSession(offer.id);
      window.location.href = `${res.payUrl}&return=${encodeURIComponent(returnPath)}`;
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const rejectOffer = async () => {
    setBusy(true);
    setError(false);
    try {
      await serviceOffers.reject(offer.id);
      onChanged();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-cream-dark bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-navy/50 uppercase">{t('serviceOffer.title')}</p>
        <span className="font-extrabold text-navy shrink-0" dir="ltr">{offer.price.toLocaleString()} {offer.currency}</span>
      </div>

      {offer.details && (
        <div className="mt-2">
          <p className="text-sm text-navy/70 break-anywhere whitespace-pre-line line-clamp-2">{offer.details}</p>
          {(offer.details.length > 140 || offer.details.split('\n').length > 2) && (
            <Link
              to={`/requests/${offer.requestId}/offer`}
              className="mt-1 inline-block text-xs font-bold text-navy hover:underline"
            >
              {t('requests.openOfferPage')}
            </Link>
          )}
        </div>
      )}

      {offer.imagePaths.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offer.imagePaths.map((url, idx) => (
            <button key={idx} type="button" onClick={() => setLightboxIndex(idx)} className="shrink-0">
              <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-cream-dark" />
            </button>
          ))}
        </div>
      )}

      {offer.expiresAt && (
        <p className={`mt-2 text-xs ${expired ? 'text-brand-red font-semibold' : 'text-navy/50'}`}>
          {t('serviceOffer.expires')}: {new Date(offer.expiresAt).toLocaleDateString()}
        </p>
      )}

      {offer.status === 'rejected' && (
        <p className="mt-3 text-xs font-semibold text-navy/50">{t('serviceOffer.youRejected')}</p>
      )}
      {offer.status === 'expired' && (
        <p className="mt-3 text-xs font-semibold text-navy/50">{t('serviceOffer.offerExpired')}</p>
      )}
      {offer.status === 'superseded' && (
        <p className="mt-3 text-xs font-semibold text-navy/50">{t('serviceOffer.superseded')}</p>
      )}

      {verified && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green-700">
          <AppIcon name="check-circle" className="w-4 h-4" />
          {t('serviceOffer.paid')}
        </p>
      )}

      {!verified && payment?.status === 'pending' && (
        <a href={resumeUrl ?? undefined} className="btn-primary w-full mt-3 !h-10 text-sm text-center">
          {t('serviceOffer.resumePayment')}
        </a>
      )}

      {!verified && payment?.status === 'rejected' && (
        <p className="mt-3 text-xs text-brand-red">{t('serviceOffer.paymentRejected')}</p>
      )}

      {error && <p className="mt-2 text-xs text-brand-red">{t('serviceOffer.error')}</p>}

      {!verified && !payment && !expired && offer.status === 'sent' && (
        <>
          {!rejecting ? (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setRejecting(true)} disabled={busy} className="btn-secondary flex-1 !h-10 text-sm disabled:opacity-50">
                {t('serviceOffer.reject')}
              </button>
              <button onClick={startPayment} disabled={busy} className="btn-primary flex-1 !h-10 text-sm disabled:opacity-50">
                {busy ? t('serviceOffer.starting') : t('serviceOffer.payCta')}
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-cream p-3">
              <p className="text-xs text-navy/70">{t('serviceOffer.rejectConfirm')}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setRejecting(false)} className="btn-secondary flex-1 !h-9 text-xs">{t('common.cancel')}</button>
                <button onClick={rejectOffer} disabled={busy} className="btn-danger flex-1 !h-9 text-xs disabled:opacity-50">
                  {busy ? t('serviceOffer.rejecting') : t('serviceOffer.rejectConfirmBtn')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {lightboxIndex != null && (
        <OfferPhotoLightbox
          photos={offer.imagePaths}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
