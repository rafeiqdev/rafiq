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
import { SiteImage } from '../../components/SiteImage';
import { EXPLORE_PHOTOS } from '../../lib/images';
import { MobileTabBar } from '../../components/MobileTabBar';
import { RequestStatusPill } from '../../components/RequestStatusPill';
import { SectionState } from '../../components/SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { ServiceOfferCard } from '../../components/ServiceOfferCard';
import { CASE_FILE_DIVIDER } from '../../lib/bookingSummary';

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

function RequestRow({ req }: { req: CustomerRequest }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <section className="card animate-fade-up overflow-hidden">
      {/* collapsed header — whole row is the tap target */}
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3.5 text-start transition-colors active:bg-cream"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-cream text-navy/60">
          <AppIcon
            name="arrow-right"
            className={`h-[18px] w-[18px] transition-transform ${open ? 'rotate-90' : 'rtl:rotate-180'}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-extrabold leading-snug text-navy">{localizeServiceTitle(req.serviceTitle, lang)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy/55">
            {req.area && (
              <>
                <AppIcon name="map-pin" className="h-3 w-3 shrink-0" />
                {pickArea(req.area, lang)}
                <span>·</span>
              </>
            )}
            {new Date(req.createdAt).toLocaleDateString(i18n.language)}
          </p>
        </div>
        {/* What the admin did with it — the only signal the customer gets that
            anyone has looked at their request. */}
        <RequestStatusPill status={req.status} className="shrink-0" />
      </button>

      {open && (
        <div className="border-t border-cream-dark p-4">
          <Link
            to={`/requests/${req.id}/offer`}
            className="btn-primary mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 text-[13.5px] font-bold shadow-sm"
          >
            <AppIcon name="file-text" className="h-4 w-4" />
            <span>{t('requests.openOfferPage')}</span>
          </Link>
          <MobileRequestOffers req={req} />
        </div>
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
  // The empty state below may only ever mean "the fetch succeeded and returned
  // zero rows". It used to also mean "the fetch failed".
  const requests = useAsyncSection<CustomerRequest[]>(() => customerRequests.allMine(), []);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Sub-screen header: real photo behind heavy navy overlay ── */}
        <header className="relative animate-fade-in overflow-hidden rounded-b-[28px] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {/* SiteImage's root is already `relative` — position it with a wrapper. */}
          <div className="absolute inset-0">
            <SiteImage src={EXPLORE_PHOTOS['/referrals']} alt="" className="h-full w-full" />
          </div>
          <div className="absolute inset-0 bg-navy/85" aria-hidden />
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <BackArrow className="h-6 w-6" />
          </button>
          <div className="animate-fade-up relative mt-3.5">
            <h1 className="text-2xl font-extrabold text-white">{t('requests.title')}</h1>
            <p className="mt-1 text-[13.5px] leading-snug text-white/70">{t('requests.subtitle')}</p>
          </div>
        </header>

        <div className="px-5 pt-5">
          <SectionState
            section={requests}
            title={t('requests.title')}
            loading={<RafiqLoader size="sm" className="min-h-[50vh]" />}
            empty={
              <div className="card animate-pop p-10 text-center">
                <div className="icon-chip mx-auto">
                  <AppIcon name="inbox" className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm text-gray-500">{t('requests.empty')}</p>
                <Link to="/services" className="btn-primary mt-5 flex min-h-[50px] w-full text-[15px]">
                  {t('requests.browseServices')}
                </Link>
              </div>
            }
          >
            {(rows) => (
              <div className="stagger flex flex-col gap-3.5">
                {rows.map((req) => (
                  <RequestRow key={req.id} req={req} />
                ))}
              </div>
            )}
          </SectionState>

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
