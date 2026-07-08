import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customerRequests, reviews } from '../lib/api';
import type { CompanyResponse, CustomerRequest } from '../lib/types';
import { pickArea } from '../data/istanbulAreas';
import { RequireAuth } from '../components/Gates';
import { ReviewStars, StarRatingInput } from '../components/ReviewStars';
import { Modal } from '../components/Modal';
import { AppIcon } from '../components/AppIcon';

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

function RequestRow({ req }: { req: CustomerRequest }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState<CompanyResponse[] | null>(null);
  const [reviewing, setReviewing] = useState<{ companyId: string; companyName: string } | null>(null);

  const load = () => customerRequests.responses(req.id).then(setResponses).catch(() => setResponses([]));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && responses === null) load();
  };

  const choose = async (responseId: string) => {
    await customerRequests.choose(responseId);
    await load();
  };

  return (
    <li className="card p-4">
      <button onClick={toggle} className="w-full flex items-center gap-3 text-start" aria-expanded={open}>
        <AppIcon name="arrow-right" className={`w-3.5 h-3.5 text-navy/40 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-navy block">{req.serviceTitle}</span>
          <span className="text-xs text-navy/50 inline-flex items-center gap-2">
            {req.area && (<span className="inline-flex items-center gap-1"><AppIcon name="map-pin" className="w-3 h-3" />{pickArea(req.area, lang)}</span>)}
            <span>{new Date(req.createdAt).toLocaleDateString(i18n.language)}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-4 border-t border-cream-dark pt-4">
          {responses === null ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : responses.length === 0 ? (
            <p className="text-sm text-gray-500">{t('requests.noResponses')}</p>
          ) : (
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
        </div>
      )}

      {reviewing && (
        <ReviewModal
          companyId={reviewing.companyId}
          companyName={reviewing.companyName}
          leadId={req.id}
          onClose={() => setReviewing(null)}
          onDone={load}
        />
      )}
    </li>
  );
}

function MyRequestsInner() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CustomerRequest[] | null>(null);

  useEffect(() => {
    customerRequests.mine().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('requests.title')}</h1>
      <p className="mt-2 text-sm text-navy/60">{t('requests.subtitle')}</p>

      {rows === null ? (
        <div className="flex items-center justify-center py-20" role="status">
          <div className="w-10 h-10 rounded-full border-4 border-cream-dark border-t-navy animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto"><AppIcon name="inbox" className="w-6 h-6" /></div>
          <p className="mt-4 text-sm text-navy/60">{t('requests.empty')}</p>
          <Link to="/services" className="btn-primary mt-6">{t('requests.browseServices')}</Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => <RequestRow key={r.id} req={r} />)}
        </ul>
      )}
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
