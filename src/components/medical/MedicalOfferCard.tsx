import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { medicalOffers, medicalPayments } from '../../lib/api';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { SectionState } from '../../components/SectionState';
import { track } from '../../lib/analytics';
import type { MedicalOffer, MedicalPayment } from '../../lib/types';

/**
 * One offer, pre- or post-payment. The center identity is never fetched until
 * a verified payment exists for this exact offer (server-enforced by
 * get_offer_center() — this component just reflects that, it does not decide it).
 *
 * "Pay" redirects to a real checkout page (api/payments/medical-pay.ts) that
 * only ever completes by delivering a signed webhook — there is no
 * client-side or admin path that can mark this offer paid.
 */
export function MedicalOfferCard({ offer, payment }: { offer: MedicalOffer; payment: MedicalPayment | undefined }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const verified = payment?.status === 'verified';
  const center = useAsyncSection(
    () => (verified ? medicalOffers.getCenter(offer.id) : Promise.resolve(null)),
    [offer.id, verified],
  );

  const payableAmount = Math.round((offer.totalPrice * offer.bookingPercentage) / 100 * 100) / 100;
  const expired = offer.expiresAt ? new Date(offer.expiresAt) < new Date() : false;
  const returnPath = typeof window !== 'undefined' ? window.location.pathname : '/requests';

  const startPayment = async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await medicalPayments.createSession(offer.id);
      track('payment_submitted', { target: 'medical', meta: { offer_id: offer.id } });
      // Real redirect to the checkout page — no local "pending" simulation.
      // The page the customer lands back on re-reads status from the server.
      window.location.href = `${res.payUrl}&return=${encodeURIComponent(returnPath)}`;
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const resumeUrl = payment ? medicalPayments.resumeUrl(payment, returnPath) : null;

  return (
    <div className="rounded-xl border border-cream-dark bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-navy text-sm">{offer.treatmentPlan}</p>
        <span className="font-extrabold text-navy shrink-0" dir="ltr">{offer.totalPrice.toLocaleString()} {offer.currency}</span>
      </div>

      {offer.included.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {offer.included.map((i, idx) => (
            <span key={idx} className="rounded-full bg-green-50 text-green-700 text-[11px] px-2 py-0.5">✓ {i}</span>
          ))}
        </div>
      )}
      {offer.excluded.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {offer.excluded.map((i, idx) => (
            <span key={idx} className="rounded-full bg-brand-red/10 text-brand-red text-[11px] px-2 py-0.5">✕ {i}</span>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-navy/60">
        {offer.sessionsOrDays && <p>{t('medical.offer.sessions')}: {offer.sessionsOrDays}</p>}
        {offer.expiresAt && <p className={expired ? 'text-brand-red font-semibold' : ''}>{t('medical.offer.expires')}: {new Date(offer.expiresAt).toLocaleDateString()}</p>}
        <p>{t('medical.offer.bookingPercentage')}: {offer.bookingPercentage}%</p>
        <p className="font-semibold text-navy" dir="ltr">{t('medical.offer.payable')}: {payableAmount.toLocaleString()} {offer.currency}</p>
      </div>

      {/* Center identity — only ever rendered once verified is true */}
      {verified && (
        <SectionState
          section={center}
          title={t('medical.offer.center.title')}
          isEmpty={(d) => !d}
          empty={<p className="mt-3 text-xs text-navy/50">{t('medical.offer.center.pending')}</p>}
        >
          {(c) => c && (
            <div className="mt-3 rounded-lg bg-cream p-3 text-xs text-navy/80 flex flex-col gap-1">
              <p className="font-bold text-navy">{c.centerName}</p>
              {c.doctorName && <p>{t('medical.offer.center.doctor')}: {c.doctorName}</p>}
              {c.address && <p>{c.address}</p>}
              {c.phone && <p dir="ltr">{c.phone}</p>}
              {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-navy underline">{c.website}</a>}
              {c.appointmentDetails && <p className="mt-1 font-semibold">{c.appointmentDetails}</p>}
            </div>
          )}
        </SectionState>
      )}

      {!verified && payment?.status === 'pending' && (
        <a href={resumeUrl ?? undefined} className="btn-primary w-full mt-3 !h-10 text-sm text-center">
          {t('medical.offer.resumePayment')}
        </a>
      )}

      {!verified && payment?.status === 'rejected' && (
        <p className="mt-3 text-xs text-brand-red">{t('medical.offer.paymentRejected')}</p>
      )}

      {(payment?.status === 'refund_requested' || payment?.status === 'refunded') && (
        <p className="mt-3 text-xs text-navy/60">{t(`medical.payment.status.${payment.status}`)}</p>
      )}

      {!verified && !payment && !expired && offer.status === 'sent' && (
        <>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="btn-primary w-full mt-3 !h-10 text-sm">
              {t('medical.offer.payCta')}
            </button>
          ) : (
            <div className="mt-3 rounded-lg bg-cream p-3">
              <p className="text-xs text-navy/70">{t('medical.offer.refundPolicy')}</p>
              <label className="mt-2 flex items-start gap-2 text-xs text-navy/70">
                <input type="checkbox" className="mt-0.5" checked={acceptedPolicy} onChange={(e) => setAcceptedPolicy(e.target.checked)} />
                {t('medical.offer.acceptPolicy')}
              </label>
              {error && <p className="mt-2 text-xs text-brand-red">{t('medical.offer.paymentError')}</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirming(false)} className="btn-secondary flex-1 !h-9 text-xs">{t('common.cancel')}</button>
                <button onClick={startPayment} disabled={!acceptedPolicy || busy} className="btn-primary flex-1 !h-9 text-xs disabled:opacity-50">
                  {busy ? t('medical.offer.confirming') : t('medical.offer.confirm')}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-navy/40">{t('medical.offer.securePaymentNote')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
