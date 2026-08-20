import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerRequests, reviews, serviceOffers, servicePayments } from '../../lib/api';
import type { CompanyResponse, CustomerRequest } from '../../lib/types';
import { humanMessage } from '../../lib/bookingSummary';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { SectionState } from '../SectionState';
import { AppIcon } from '../AppIcon';
import { Modal } from '../Modal';
import { ReviewStars, StarRatingInput } from '../ReviewStars';
import { ServiceOfferCard } from '../ServiceOfferCard';

/**
 * The offers panel for one service request, shared by the desktop and the
 * mobile "طلباتي".
 *
 * Both pages carried a verbatim copy of this — including the comment
 * explaining why zero offers must render nothing — so a fix to one silently
 * left the other wrong. `compact` is the only difference between them.
 *
 * Conditional mounting by the caller IS the lazy load (useAsyncSection fetches
 * on mount), so no "have I loaded yet" flag is needed. And note there is no
 * `.catch(() => [])` anywhere here: a failed offers fetch used to render
 * exactly as "no offers", which tells a customer that no company wants their
 * work. That is the most damaging false sentence in this product.
 */
function ReviewModal({
  companyId,
  companyName,
  leadId,
  onDone,
  onClose,
}: {
  companyId: string;
  companyName: string;
  leadId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(false);
    try {
      await reviews.create({ companyId, rating, text: text.trim() || undefined, leadId });
      onDone();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="review-title" maxWidth="max-w-sm">
      <div className="card p-5 sm:p-6">
        <h2 id="review-title" className="text-center text-[17px] font-extrabold text-navy sm:text-start sm:text-lg">
          {t('reviews.leaveTitle')}
        </h2>
        <p className="mt-1 text-center text-[13px] text-gray-500 sm:text-start">{companyName}</p>
        <p className="mb-1.5 mt-4 text-[12.5px] font-bold text-navy">{t('reviews.ratingLabel')}</p>
        <StarRatingInput value={rating} onChange={setRating} />
        <label className="mb-1.5 mt-4 block text-[12.5px] font-bold text-navy">
          {t('reviews.text')}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('reviews.textPh')}
            rows={3}
            className="input mt-1.5 w-full resize-y text-[15px] font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="amber-note mt-3 flex items-center gap-2 text-xs">
            <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0" />
            {t('reviews.error')}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            onClick={submit}
            disabled={busy}
            className="btn-primary flex min-h-[50px] flex-1 text-[14.5px] disabled:opacity-60"
          >
            {busy ? t('reviews.submitting') : t('reviews.submit')}
          </button>
          <button onClick={onClose} className="btn-secondary flex min-h-[50px] flex-1 text-[14.5px]">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function RequestOffersPanel({ req, compact = false }: { req: CustomerRequest; compact?: boolean }) {
  const { t } = useTranslation();
  const [reviewing, setReviewing] = useState<{ companyId: string; companyName: string } | null>(null);
  const [messageExpanded, setMessageExpanded] = useState(false);
  const offers = useAsyncSection<CompanyResponse[]>(() => customerRequests.responses(req.id), [req.id]);
  const adminOffers = useAsyncSection(
    () => Promise.all([serviceOffers.listForRequest(req.id), servicePayments.forRequest(req.id)]),
    [req.id],
  );

  const choose = async (responseId: string) => {
    await customerRequests.choose(responseId);
    offers.reload();
  };

  const msg = req.message ? humanMessage(req.message) : null;
  const body = compact ? 'text-[13px]' : 'text-sm';

  return (
    <>
      {msg && (
        <p className={`mb-3 text-navy/70 break-anywhere ${body}`}>
          “{messageExpanded ? msg.full : msg.preview}”
          {msg.truncated && (
            <button
              type="button"
              onClick={() => setMessageExpanded((v) => !v)}
              className="ms-1.5 text-xs font-bold text-navy underline"
            >
              {messageExpanded ? t('requests.showLess') : t('requests.showMore')}
            </button>
          )}
        </p>
      )}

      {/* The admin's own price offer(s) on this request — separate from the
          multi-company marketplace responses below. Only the most recent
          non-superseded offer is actionable; older ones are history. */}
      <SectionState
        section={adminOffers}
        title={t('serviceOffer.title')}
        empty={null}
        isEmpty={([offerList]) => offerList.length === 0}
      >
        {([offerList, payments]) => (
          <div className="mb-3 flex flex-col gap-2.5">
            {offerList.map((o) => (
              <ServiceOfferCard
                key={o.id}
                offer={o}
                payment={payments.find((p) => p.offerId === o.id)}
                onChanged={adminOffers.reload}
              />
            ))}
          </div>
        )}
      </SectionState>

      <SectionState
        section={offers}
        title={t('requests.title')}
        loading={<p className={`text-gray-500 ${body}`}>{t('common.loading')}</p>}
        /* Zero offers renders NOTHING about offers. The old copy promised
           "companies nearby will respond soon", which is false for a direct
           request and disclosed which kind it was. Identical either way. */
        empty={null}
      >
        {(responses) => (
          <>
            <p className={`font-extrabold text-navy/70 ${compact ? 'text-[13px]' : 'text-xs'}`}>
              {t('requests.responsesTitle', { count: responses.length })}
            </p>
            <p className="mb-3 mt-0.5 text-[11.5px] text-navy/50">{t('requests.capped')}</p>
            <ul className="flex flex-col gap-3">
              {responses.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-[14px] border p-3.5 ${
                    r.chosen ? 'border-navy bg-brand-blue/40' : 'border-cream-dark bg-cream'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <Link to={`/companies/${r.companyId}`} className="font-extrabold text-navy hover:underline">
                      {r.companyName}
                    </Link>
                    {r.quote != null && (
                      <span className="shrink-0 font-extrabold text-navy" dir="ltr">
                        {r.quote.toLocaleString()} {t('common.tl')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <ReviewStars rating={r.rating} count={r.reviews} />
                  </div>
                  {r.message && (
                    <p className={`break-anywhere mt-2.5 leading-relaxed text-gray-600 ${body}`}>{r.message}</p>
                  )}
                  {r.chosen ? (
                    <>
                      <p className="mt-3 flex items-center gap-1.5 text-[13px] font-extrabold text-green-700">
                        <AppIcon name="check-circle" className="h-4 w-4 shrink-0" />
                        {t('requests.chosen')}
                      </p>
                      <button
                        onClick={() => setReviewing({ companyId: r.companyId, companyName: r.companyName })}
                        className="btn-secondary mt-2.5 flex min-h-[48px] w-full text-[13.5px]"
                      >
                        <AppIcon name="star" className="h-[15px] w-[15px]" />
                        {t('requests.leaveReview')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => choose(r.id)}
                      className="btn-primary mt-3 flex min-h-[48px] w-full text-[13.5px] transition-transform active:scale-[0.98]"
                    >
                      {t('requests.choose')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionState>

      {reviewing && (
        <ReviewModal
          companyId={reviewing.companyId}
          companyName={reviewing.companyName}
          leadId={req.id}
          onDone={offers.reload}
          onClose={() => setReviewing(null)}
        />
      )}
    </>
  );
}
