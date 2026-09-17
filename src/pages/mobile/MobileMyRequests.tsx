import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerRequests, reviews, serviceOffers, servicePayments } from '../../lib/api';
import type { CompanyResponse, CustomerRequest } from '../../lib/types';
import { pickArea } from '../../data/istanbulAreas';
import { localizeServiceTitle } from '../../data/services';
import { useApp } from '../../context/AppContext';
import { AppIcon, BackArrow } from '../../components/AppIcon';
import { RafiqLoader } from '../../components/RafiqLoader';
import { RequireAuth } from '../../components/Gates';
import { MedicalRequestsPanel } from '../../components/medical/MedicalRequestsPanel';
import { Modal } from '../../components/Modal';
import { ReviewStars, StarRatingInput } from '../../components/ReviewStars';
import { MobileTabBar } from '../../components/MobileTabBar';
import { RequestStatusPill } from '../../components/RequestStatusPill';
import { SectionState } from '../../components/SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { ServiceOfferCard } from '../../components/ServiceOfferCard';
import { ServiceRequestModal } from '../../components/ServiceRequestModal';
import { CASE_FILE_DIVIDER } from '../../lib/bookingSummary';
import { track } from '../../lib/analytics';

// Admin WhatsApp number (international, no "+"). Same placeholder guard as
// the desktop page — the row-level WhatsApp button only renders once a real
// number is configured.
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

/** Same defensive message rendering as the desktop page — see MyRequests.tsx. */
const MESSAGE_PREVIEW_LEN = 220;
export function humanMessage(raw: string): { preview: string; full: string; truncated: boolean } {
  const prose = raw.split(CASE_FILE_DIVIDER)[0].trim();
  if (prose.length <= MESSAGE_PREVIEW_LEN) return { preview: prose, full: prose, truncated: false };
  return { preview: `${prose.slice(0, MESSAGE_PREVIEW_LEN).trimEnd()}…`, full: prose, truncated: true };
}

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

function ReviewModal({
  companyId, companyName, leadId, onDone, onClose,
}: {
  companyId: string; companyName: string; leadId: string; onDone: () => void; onClose: () => void;
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
      <div className="card p-5">
        <h2 id="review-title" className="text-center text-[17px] font-extrabold text-navy">{t('reviews.leaveTitle')}</h2>
        <p className="mt-1 text-center text-[13px] text-gray-500">{companyName}</p>
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
          <div className="amber-note mt-3 flex items-center gap-2 text-xs">
            <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0" />
            {t('reviews.error')}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2.5">
          <button onClick={submit} disabled={busy} className="btn-primary flex min-h-[50px] w-full text-[14.5px] disabled:opacity-60">
            {busy ? t('reviews.submitting') : t('reviews.submit')}
          </button>
          <button onClick={onClose} className="btn-secondary flex min-h-[50px] w-full text-[14.5px]">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * One request card: status pill + date, service title (tapping it expands the
 * full details inline), area, a small stage sub-line, then the pill buttons.
 * Styled on the Rafiq identity system (.card / .btn-*) — no off-brand blues.
 */
function RequestRow({ req, onReordered }: { req: CustomerRequest; onReordered: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);
  /** "Order again" opens the SAME order form, pre-filled — not the services list. */
  const [reordering, setReordering] = useState(false);

  const statusKey = req.status === 'new' ? 'pending' : req.status;
  const finished = statusKey === 'done' || statusKey === 'rejected';

  const waMessage = t('requests.reassurance.waMessage', {
    id: req.id,
    service: localizeServiceTitle(req.serviceTitle, lang),
  });
  const waHref = WA_ENABLED ? `https://wa.me/${WA}?text=${encodeURIComponent(waMessage)}` : null;

  // Rows predating the service_id column (or non-catalog requests) cannot
  // reopen their exact form — they keep the old fallback to /services.
  const reorderSource = req.serviceId
    ? { id: req.serviceId, title: req.serviceTitle, category: req.category, type: req.serviceType }
    : null;

  return (
    <section className="card card-hover p-5">
      <p className="flex items-center justify-between gap-2">
        <RequestStatusPill status={req.status} />
        <span className="shrink-0 text-xs text-navy/50">{new Date(req.createdAt).toLocaleDateString(lang)}</span>
      </p>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mt-2.5 block w-full text-start"
      >
        <span className="text-[17px] font-extrabold leading-snug text-navy line-clamp-2">
          {localizeServiceTitle(req.serviceTitle, lang)}
        </span>
      </button>

      {req.area && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-navy/55">
          <AppIcon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
          {pickArea(req.area, lang)}
        </p>
      )}

      {statusKey !== 'rejected' && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-navy/70">
          <AppIcon name={statusKey === 'done' ? 'star' : 'clock'} className="h-3.5 w-3.5 shrink-0" />
          {statusKey === 'done' ? t('requests.leaveReview') : t('requests.reassurance.sla')}
        </p>
      )}

      <div className="mt-4 flex gap-2.5 border-t border-cream-dark pt-4">
        <Link
          to={`/requests/${req.id}/offer`}
          className="btn-primary min-h-[48px] flex-1 text-[15px]"
        >
          {t('requests.detailsCta')}
        </Link>
        {finished ? (
          reorderSource ? (
            <button
              type="button"
              onClick={() => setReordering(true)}
              className="btn-ghost min-h-[48px] flex-1 text-[15px]"
            >
              {t('requests.orderAgain')}
            </button>
          ) : (
            <Link
              to="/services"
              className="btn-ghost min-h-[48px] flex-1 text-[15px]"
            >
              {t('requests.orderAgain')}
            </Link>
          )
        ) : (
          waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('whatsapp_clicked', { target: 'requests_row_mobile', meta: { request_id: req.id } })}
              className="btn-whatsapp min-h-[48px] flex-1 text-[15px]"
            >
              <AppIcon name="message-circle" className="h-4 w-4 shrink-0" />
              {t('requests.whatsappCta')}
            </a>
          )
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-cream-dark pt-4">
          <MobileRequestOffers req={req} />
        </div>
      )}

      {reordering && reorderSource && (
        <ServiceRequestModal
          source={reorderSource}
          initial={{
            area: req.area,
            message: req.message ? humanMessage(req.message).full : null,
          }}
          onClose={() => {
            setReordering(false);
            // The new request lands at the top of this same list.
            onReordered();
          }}
        />
      )}
    </section>
  );
}

/**
 * The offers panel, mounted only while the row is open — the same shape as the
 * desktop RequestOffers. Conditional mounting IS the lazy load, so no "have I
 * loaded yet" flag is needed, and the old `.catch(() => setResponses([]))` is
 * gone: a failed offers fetch used to render exactly as "no offers", telling a
 * customer no company wants their work when the connection had simply dropped.
 */
function MobileRequestOffers({ req }: { req: CustomerRequest }) {
  const { t } = useTranslation();
  const [reviewing, setReviewing] = useState<{ companyId: string; companyName: string } | null>(null);
  const [messageExpanded, setMessageExpanded] = useState(false);
  const [chooseError, setChooseError] = useState(false);
  const offers = useAsyncSection<CompanyResponse[]>(() => customerRequests.responses(req.id), [req.id]);
  const adminOffers = useAsyncSection(
    () => Promise.all([serviceOffers.listForRequest(req.id), servicePayments.forRequest(req.id)]),
    [req.id],
  );

  const choose = async (responseId: string) => {
    setChooseError(false);
    try {
      await customerRequests.choose(responseId);
      offers.reload();
    } catch {
      // Same silent-failure fix as the desktop page: a dropped promise left the
      // customer tapping a button that appeared to do nothing.
      setChooseError(true);
    }
  };

  const msg = req.message ? humanMessage(req.message) : null;

  return (
    <>
      {msg && (
        <p className="mb-3 text-[13px] text-navy/70 break-anywhere">
          “{messageExpanded ? msg.full : msg.preview}”
          {msg.truncated && (
            <button
              type="button"
              onClick={() => setMessageExpanded((v) => !v)}
              className="ms-1.5 text-[12px] font-bold text-navy underline"
            >
              {messageExpanded ? t('requests.showLess') : t('requests.showMore')}
            </button>
          )}
        </p>
      )}

      <SectionState section={adminOffers} title={t('serviceOffer.title')} empty={null} isEmpty={([offerList]) => offerList.length === 0}>
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
        loading={<p className="text-[13px] text-gray-500">{t('common.loading')}</p>}
        /* Zero offers renders NOTHING about offers — identical for a direct and
           a broadcast request. */
        empty={null}
      >
        {(responses) => (
            <>
              <p className="text-[13px] font-extrabold text-navy">
                {t('requests.responsesTitle', { count: responses.length })}
              </p>
              <p className="mb-3 mt-0.5 text-[11.5px] text-navy/50">{t('requests.capped')}</p>
              {chooseError && (
                <p role="alert" className="amber-note mb-3 flex items-center gap-2 text-[12px]">
                  <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0" />
                  {t('requests.chooseError')}
                </p>
              )}
              <div className="flex flex-col gap-3">
                {responses.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-[14px] border p-3.5 ${
                      r.chosen ? 'border-navy bg-brand-blue/40' : 'border-cream-dark bg-cream'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <Link to={`/companies/${r.companyId}`} className="text-sm font-extrabold text-navy underline">
                        {r.companyName}
                      </Link>
                      {r.quote != null && (
                        <span className="shrink-0 text-base font-extrabold text-navy" dir="ltr">
                          {r.quote.toLocaleString()} {t('common.tl')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <ReviewStars rating={r.rating} count={r.reviews} />
                    </div>
                    {r.message && (
                      <p className="break-anywhere mt-2.5 text-[12.5px] leading-relaxed text-gray-600">{r.message}</p>
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
                  </div>
                ))}
              </div>
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

function MobileMyRequestsInner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useApp();
  const [query, setQuery] = useState('');
  // The empty state below may only ever mean "the fetch succeeded and returned
  // zero rows". It used to also mean "the fetch failed".
  const requests = useAsyncSection<CustomerRequest[]>(() => customerRequests.allMine(), []);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;
  void user;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* Frosted header: back + title, then an iOS-style search field.
            Search only filters the list — no "Refine", per the owner's choice.
            The bottom tab bar stays the product's own. */}
        <header className="sticky top-0 z-20 border-b border-navy/10 bg-white/85 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center gap-3 px-4 pb-3 pt-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={mc.back}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy active:bg-navy/15"
            >
              <BackArrow className="h-5 w-5" />
            </button>
            <h1 className="flex-1 text-[22px] font-extrabold leading-tight text-navy">
              {t('requests.title')}
            </h1>
          </div>
          <div className="px-4 pb-3">
            <div className="flex h-11 items-center gap-2 rounded-full bg-navy/[0.05] px-4">
              <AppIcon name="search" className="h-5 w-5 shrink-0 text-navy/40" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('requests.searchPh')}
                aria-label={t('requests.searchPh')}
                className="flex-1 bg-transparent text-navy outline-none placeholder:text-navy/40"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('requests.clearSearch')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-navy/50 active:bg-navy/10"
                >
                  <AppIcon name="x" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        <SectionState
          section={requests}
          title={t('requests.title')}
          loading={<RafiqLoader size="sm" className="min-h-[50vh]" />}
          empty={
            <div className="px-4 pt-6">
              <div className="card p-10 text-center">
                <div className="icon-chip mx-auto">
                  <AppIcon name="inbox" className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm text-navy/60">{t('requests.empty')}</p>
                <Link to="/services" className="btn-primary mt-5 min-h-[50px] w-full text-[15px]">
                  {t('requests.browseServices')}
                </Link>
              </div>
            </div>
          }
        >
          {(rows) => {
            const q = query.trim().toLowerCase();
            const visible = q
              ? rows.filter(
                (r) =>
                  localizeServiceTitle(r.serviceTitle, i18n.language).toLowerCase().includes(q) ||
                  r.id.toLowerCase().includes(q),
              )
              : rows;
            if (visible.length === 0) {
              return (
                <div className="px-4 pt-10 text-center">
                  <p className="text-sm text-navy/60">{t('requests.noResults')}</p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="btn-ghost mx-auto mt-4 min-h-[48px] px-6 text-[15px]"
                  >
                    {t('requests.clearSearch')}
                  </button>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-4 px-4 pt-5">
                {visible.map((req) => (
                  <RequestRow key={req.id} req={req} onReordered={requests.reload} />
                ))}
              </div>
            );
          }}
        </SectionState>

        <div className="px-4 pt-5">
          <MedicalRequestsPanel />
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}

export function MobileMyRequests() {
  return (
    <RequireAuth>
      <MobileMyRequestsInner />
    </RequireAuth>
  );
}
