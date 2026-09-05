import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerRequests, reviews, serviceOffers, servicePayments } from '../lib/api';
import { RequestStatusPill } from '../components/RequestStatusPill';
import { SectionState } from '../components/SectionState';
import { useAsyncSection } from '../hooks/useAsyncSection';
import type { CompanyResponse, CustomerRequest } from '../lib/types';
import { pickArea } from '../data/istanbulAreas';
import { localizeServiceTitle } from '../data/services';
import { RequireAuth } from '../components/Gates';
import { MedicalRequestsPanel } from '../components/medical/MedicalRequestsPanel';
import { ReviewStars, StarRatingInput } from '../components/ReviewStars';
import { Modal } from '../components/Modal';
import { AppIcon } from '../components/AppIcon';
import { RafiqLoader } from '../components/RafiqLoader';
import { ServiceOfferCard } from '../components/ServiceOfferCard';
import { OrderTracking } from '@/components/ui/order-tracking';
import { CASE_FILE_DIVIDER } from '../lib/bookingSummary';
import { track } from '../lib/analytics';

/**
 * Some request messages carry a machine-readable block after a divider (the
 * same CASE_FILE_DIVIDER bookings use) or are simply far longer than a
 * "طلباتي" row should render inline. Neither belongs in a one-line preview:
 * this keeps the human sentence, drops anything past the divider, and offers
 * an explicit expand for a genuinely long note instead of dumping it raw.
 */
const MESSAGE_PREVIEW_LEN = 220;
export function humanMessage(raw: string): { preview: string; full: string; truncated: boolean } {
  const prose = raw.split(CASE_FILE_DIVIDER)[0].trim();
  if (prose.length <= MESSAGE_PREVIEW_LEN) return { preview: prose, full: prose, truncated: false };
  return { preview: `${prose.slice(0, MESSAGE_PREVIEW_LEN).trimEnd()}…`, full: prose, truncated: true };
}

// Admin WhatsApp number (international, no "+"). Same placeholder guard as
// ServiceRequestModal / WhatsAppButton — the escalation link only renders
// once a real number is configured.
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

/** Ordered steps of the customer-visible timeline. 'rejected' has no place on
 *  a forward-moving line, so it is handled separately by the caller. */
const TIMELINE_STEPS = ['pending', 'accepted', 'done'] as const;

/**
 * Reassurance banner for a request still awaiting resolution: a live status
 * timeline, the response-time guarantee, and a 1-click WhatsApp escalation
 * pre-filled with this request's id so the admin can find it instantly.
 *
 * Only shown for pending/accepted requests — a done or rejected request has
 * nothing left to be reassured about.
 */
function ReassuranceBanner({ req }: { req: CustomerRequest }) {
  const { t, i18n } = useTranslation();
  const key = req.status === 'new' ? 'pending' : req.status;
  const stepIndex = TIMELINE_STEPS.indexOf(key as (typeof TIMELINE_STEPS)[number]);
  // Only pending/accepted are "active" — done and rejected have nothing left
  // to guarantee a response time on.
  if (stepIndex < 0 || stepIndex === TIMELINE_STEPS.length - 1) return null;

  const waMessage = t('requests.reassurance.waMessage', { id: req.id, service: localizeServiceTitle(req.serviceTitle, i18n.language) });
  const waHref = WA_ENABLED ? `https://wa.me/${WA}?text=${encodeURIComponent(waMessage)}` : null;

  // Feed the shared OrderTracking timeline with this request's real progress:
  // reached steps (up to and including the current one) render as completed
  // checks, the rest as pending. Only the "placed" step has a real timestamp —
  // the later steps have not happened yet — so it carries the created date.
  const trackingSteps = TIMELINE_STEPS.map((step, i) => ({
    name: t(`requests.reassurance.timeline.${step}`),
    timestamp: i === 0 ? new Date(req.createdAt).toLocaleDateString(i18n.language) : '',
    isCompleted: i <= stepIndex,
  }));

  return (
    <div className="mt-3 rounded-xl border border-navy/10 bg-brand-blue/30 p-3">
      <OrderTracking steps={trackingSteps} aria-label={t('requests.title')} />

      <div className="mt-1 flex items-center justify-between gap-2 flex-wrap border-t border-navy/10 pt-3">
        <p className="text-xs font-bold text-navy inline-flex items-center gap-1.5">
          <AppIcon name="clock" className="w-3.5 h-3.5 shrink-0" />
          {t('requests.reassurance.sla')}
        </p>
        <div className="flex items-center gap-2 ms-auto flex-wrap">
          <Link
            to={`/requests/${req.id}/offer`}
            className="btn-primary !h-8 px-3 text-xs inline-flex items-center gap-1.5 font-bold shadow-sm"
          >
            <AppIcon name="file-text" className="w-3.5 h-3.5" />
            {t('requests.openOfferPage')}
          </Link>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('whatsapp_clicked', { target: 'requests_escalation', meta: { request_id: req.id } })}
              className="btn-secondary !h-8 px-3 text-xs"
            >
              <AppIcon name="message-circle" className="w-3.5 h-3.5" />
              {t('requests.reassurance.escalate')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ companyId, companyName, leadId, onClose, onDone }: { companyId: string; companyName: string; leadId: string; onClose: () => void; onDone: () => void }) {
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
      <div className="card p-6">
        <h2 id="review-title" className="text-lg font-extrabold text-navy">{t('reviews.leaveTitle')}</h2>
        <p className="mt-1 text-sm text-navy/60">{companyName}</p>
        <p className="mt-4 text-xs font-semibold text-navy/70">{t('reviews.ratingLabel')}</p>
        <div className="mt-2"><StarRatingInput value={rating} onChange={setRating} /></div>
        <label className="block text-xs font-semibold text-navy/70 mt-4">
          {t('reviews.text')}
          <textarea className="input mt-1.5 min-h-[88px] py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('reviews.textPh')} />
        </label>
        {error && (
          <p role="alert" className="amber-note mt-3 flex items-center gap-2">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            {t('reviews.error')}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
            {busy ? t('reviews.submitting') : t('reviews.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The offers panel, mounted only while the row is open.
 *
 * Conditional mounting IS the lazy load — useAsyncSection fetches when it
 * mounts — so this needs no extra "have I loaded yet" flag. It also means the
 * old `.catch(() => setResponses([]))` is gone: a failed offers fetch used to
 * render exactly as "no offers", which tells a customer that no company wants
 * their work. That is the most damaging false sentence in this product, and it
 * is now an error with a retry.
 */
function RequestOffers({ req }: { req: CustomerRequest }) {
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

  return (
    <>
      {msg && (
        <p className="text-sm text-navy/70 break-anywhere mb-3">
          “{messageExpanded ? msg.full : msg.preview}”
          {msg.truncated && (
            <button
              type="button"
              onClick={() => setMessageExpanded((v) => !v)}
              className="ms-1.5 text-xs font-semibold text-navy underline"
            >
              {messageExpanded ? t('requests.showLess') : t('requests.showMore')}
            </button>
          )}
        </p>
      )}

      {/* The admin's own price offer(s) on this request — separate from the
          multi-company marketplace responses below. Only the most recent
          non-superseded offer is actionable; older ones are history. */}
      <SectionState section={adminOffers} title={t('serviceOffer.title')} empty={null} isEmpty={([offerList]) => offerList.length === 0}>
        {([offerList, payments]) => (
          <div className="mb-3 flex flex-col gap-2">
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
        loading={<p className="text-sm text-gray-500">{t('common.loading')}</p>}
        /* Zero offers renders NOTHING about offers. The old copy promised
           "companies nearby will respond soon", which is false for a direct
           request and disclosed which kind it was. Identical either way. */
        empty={null}
      >
        {(responses) => (
            <>
              <p className="text-xs font-bold text-navy/60 mb-2">{t('requests.responsesTitle', { count: responses.length })}</p>
              <p className="text-[11px] text-navy/40 mb-3">{t('requests.capped')}</p>
              <ul className="flex flex-col gap-3">
                {responses.map((r) => (
                  <li key={r.id} className={`rounded-xl border px-4 py-3 ${r.chosen ? 'border-navy bg-brand-blue/40' : 'border-cream-dark bg-cream'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/companies/${r.companyId}`} className="font-semibold text-navy hover:underline">{r.companyName}</Link>
                      <ReviewStars rating={r.rating} count={r.reviews} />
                      {r.quote != null && <span className="ms-auto font-extrabold text-navy" dir="ltr">{r.quote.toLocaleString()} {t('common.tl')}</span>}
                    </div>
                    {r.message && <p className="mt-2 text-sm text-navy/70 break-anywhere">{r.message}</p>}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {r.chosen ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                            <AppIcon name="check-circle" className="w-4 h-4" />
                            {t('requests.chosen')}
                          </span>
                          <button onClick={() => setReviewing({ companyId: r.companyId, companyName: r.companyName })} className="btn-secondary !h-8 px-3 text-xs ms-auto">
                            <AppIcon name="star" className="w-3.5 h-3.5" />
                            {t('requests.leaveReview')}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => choose(r.id)} className="btn-primary !h-9 px-4 text-xs ms-auto">{t('requests.choose')}</button>
                      )}
                    </div>
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
          onClose={() => setReviewing(null)}
          onDone={offers.reload}
        />
      )}
    </>
  );
}

function RequestRow({ req }: { req: CustomerRequest }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 flex items-center gap-3 text-start" aria-expanded={open}>
          <AppIcon name="arrow-right" className={`w-3.5 h-3.5 text-navy/40 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="flex-1 min-w-0">
            <span className="font-semibold text-navy block">{localizeServiceTitle(req.serviceTitle, lang)}</span>
            <span className="text-xs text-navy/50 inline-flex items-center gap-2 flex-wrap">
              {req.area && (<span className="inline-flex items-center gap-1"><AppIcon name="map-pin" className="w-3 h-3" />{pickArea(req.area, lang)}</span>)}
              <span>{new Date(req.createdAt).toLocaleDateString(i18n.language)}</span>
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/requests/${req.id}/offer`}
            className="btn-secondary !h-8 px-2.5 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-cream-dark shadow-sm"
          >
            <AppIcon name="file-text" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('requests.openOfferPage')}</span>
          </Link>
          <RequestStatusPill status={req.status} />
        </div>
      </div>

      <ReassuranceBanner req={req} />

      {open && (
        <div className="mt-4 border-t border-cream-dark pt-4">
          <RequestOffers req={req} />
        </div>
      )}
    </li>
  );
}

function MyRequestsInner() {
  const { t } = useTranslation();
  // The empty state below may only ever mean "the fetch succeeded and returned
  // zero rows". It used to also mean "the fetch failed", because the load was
  // `.catch(() => setRows([]))` — so a network hiccup told a customer their
  // case did not exist, on the one page built to prove it did.
  const requests = useAsyncSection<CustomerRequest[]>(() => customerRequests.allMine(), []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('requests.title')}</h1>
      <p className="mt-2 text-sm text-navy/60">{t('requests.subtitle')}</p>

      <SectionState
        section={requests}
        title={t('requests.title')}
        loading={<RafiqLoader size="sm" className="min-h-[50vh]" />}
        empty={
          <div className="card p-8 mt-6 text-center">
            <div className="icon-chip mx-auto"><AppIcon name="inbox" className="w-6 h-6" /></div>
            <p className="mt-4 text-sm text-navy/60">{t('requests.empty')}</p>
            <Link to="/services" className="btn-primary mt-6">{t('requests.browseServices')}</Link>
          </div>
        }
      >
        {(rows) => (
          <ul className="mt-6 flex flex-col gap-3">
            {rows.map((r) => <RequestRow key={r.id} req={r} />)}
          </ul>
        )}
      </SectionState>

      <MedicalRequestsPanel />
    </div>
  );
}

export function MyRequests() {
  return (
    <RequireAuth>
      <MyRequestsInner />
    </RequireAuth>
  );
}
