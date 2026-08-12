import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { servicePayments, serviceOffers } from '../lib/api';
import { AppIcon } from './AppIcon';
import type { ServiceOffer, ServicePayment } from '../lib/types';

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
  const [lightbox, setLightbox] = useState<string | null>(null);

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

      {offer.details && <p className="mt-2 text-sm text-navy/70 break-anywhere whitespace-pre-line">{offer.details}</p>}

      {offer.imagePaths.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offer.imagePaths.map((url, idx) => (
            <button key={idx} type="button" onClick={() => setLightbox(url)} className="shrink-0">
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

      {lightbox && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setLightbox(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
