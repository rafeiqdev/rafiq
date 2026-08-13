import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceRequests, adminServiceOffers, logPiiReveal } from '../lib/api';
import type { ServiceRequest } from '../lib/api';
import { AppIcon } from './AppIcon';
import { SectionState } from './SectionState';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { ConfirmActionModal } from './admin/ConfirmActionModal';
import { RevealField } from './admin/RevealField';
import { maskEmail, maskPhone } from '../lib/format';
import { allowedNext, SERVICE_REQUEST_TRANSITIONS } from '../lib/statusTransitions';

const OFFER_STATUS_STYLE: Record<string, string> = {
  sent: 'bg-brand-blue text-navy',
  rejected: 'bg-brand-red/10 text-brand-red',
  expired: 'bg-cream-dark text-navy/50',
  superseded: 'bg-cream-dark text-navy/50',
};

/**
 * Drag-and-drop (or click-to-browse) multi-image picker for an offer:
 * uploads straight to the public 'service-offer-media' bucket and appends the
 * URL to the list. Same interaction as AdminMedical's ImageUploadField, kept
 * as its own small copy rather than shared — this one is multi-image (an
 * offer can carry several photos), that one is single-image.
 */
function OfferImagesField({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setBusy(true);
    try {
      const urls = await Promise.all(list.map((f) => adminServiceOffers.uploadImage(f)));
      onChange([...value, ...urls]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void pick(e.dataTransfer.files); }}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-3 cursor-pointer transition-colors ${
          dragOver ? 'border-navy bg-cream' : 'border-cream-dark hover:bg-cream/60'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { void pick(e.target.files); e.target.value = ''; }}
        />
        <AppIcon name="camera" className="w-5 h-5 text-navy/40 shrink-0" />
        <p className="text-xs font-semibold text-navy">
          {busy ? t('serviceOffer.admin.uploading') : t('serviceOffer.admin.uploadImages')}
        </p>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((url, idx) => (
            <div key={idx} className="relative">
              <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-cream-dark" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-white"
                aria-label={t('serviceOffer.admin.removeImage')}
              >
                <AppIcon name="x" className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OfferPanel({ requestId, onSent }: { requestId: string; onSent: () => void }) {
  const { t, i18n } = useTranslation();
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('TL');
  const [details, setDetails] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const detail = useAsyncSection(() => adminServiceOffers.detail(requestId), [requestId]);

  const send = async () => {
    if (!price || Number(price) <= 0) return;
    setBusy(true);
    setError(false);
    try {
      await adminServiceOffers.createOffer(requestId, {
        price: Number(price), currency, details: details.trim(), imagePaths: images,
        expiresAt: expires ? new Date(expires).toISOString() : null,
      });
      setPrice(''); setDetails(''); setImages([]); setExpires('');
      detail.reload();
      onSent();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const resolvePayment = async (id: string) => {
    setResolvingId(id);
    setError(false);
    try {
      await adminServiceOffers.resolvePayment(id);
      detail.reload();
    } catch {
      setError(true);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="basis-full border-t border-cream-dark mt-2 pt-3">
      <SectionState section={detail} title={t('serviceOffer.admin.history')} empty={null} isEmpty={(d) => d.offers.length === 0 && d.payments.length === 0}>
        {(d) => (
          <div className="mb-3 flex flex-col gap-2">
            {d.offers.map((o) => {
              const pay = d.payments.find((p) => p.offerId === o.id);
              return (
                <div key={o.id} className="rounded-lg bg-white p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-navy" dir="ltr">{o.price.toLocaleString()} {o.currency}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${OFFER_STATUS_STYLE[o.status] ?? ''}`}>
                      {t(`serviceOffer.admin.offerStatus.${o.status}`)}
                    </span>
                    {pay && (
                      <span className="text-[11px] text-navy/60">
                        {t('serviceOffer.admin.paymentLabel')}: {t(`serviceOffer.admin.paymentStatus.${pay.status}`)}
                        {pay.status === 'pending' && (
                          <button onClick={() => resolvePayment(pay.id)} disabled={resolvingId === pay.id} className="ms-2 font-semibold text-brand-red disabled:opacity-50">
                            {t('serviceOffer.admin.markFailed')}
                          </button>
                        )}
                      </span>
                    )}
                    <span className="text-[10px] text-navy/40">{new Date(o.createdAt).toLocaleDateString(i18n.language)}</span>
                  </div>
                  {o.details && <p className="mt-1 text-navy/70 break-anywhere">{o.details}</p>}
                </div>
              );
            })}
          </div>
        )}
      </SectionState>

      <div className="rounded-lg border border-dashed border-cream-dark p-3 grid gap-2 sm:grid-cols-2">
        <div className="flex gap-2">
          <input className="input !h-9 text-xs" type="number" placeholder={t('serviceOffer.admin.price')} value={price} onChange={(e) => setPrice(e.target.value)} />
          <select className="input !h-9 !w-24 text-xs" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option>TL</option><option>USD</option><option>EUR</option>
          </select>
        </div>
        <input className="input !h-9 text-xs" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        <textarea className="input text-xs min-h-[60px] sm:col-span-2" placeholder={t('serviceOffer.admin.details')} value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="sm:col-span-2">
          <OfferImagesField value={images} onChange={setImages} />
        </div>
        <button onClick={send} disabled={busy || !price} className="btn-primary !h-9 text-xs sm:col-span-2 disabled:opacity-50">
          {busy ? t('serviceOffer.admin.sending') : t('serviceOffer.admin.send')}
        </button>
        {error && <p className="sm:col-span-2 text-xs text-brand-red">{t('common.error')}</p>}
      </div>
    </div>
  );
}

/**
 * Admin panel section: incoming "Request service" submissions from /services.
 *
 * The load was `.catch(() => {})`, so a failed fetch rendered "no requests" —
 * the exact defect AdminNewRequests was built to never commit, three inches
 * above this on the same page. For the admin that is the costliest lie in the
 * product: an empty queue reads as "nobody needs me" while requests sit
 * unanswered. "No requests" may only render after a successful fetch.
 */
export function ServiceRequestsManager() {
  const { t, i18n } = useTranslation();
  const section = useAsyncSection<ServiceRequest[]>(() => serviceRequests.adminList(), []);
  const [offerOpenId, setOfferOpenId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: 'accepted' | 'done' | 'rejected'; title: string } | null>(null);

  const setStatus = async (id: string, status: 'accepted' | 'done' | 'rejected') => {
    await serviceRequests.adminSetStatus(id, status);
    section.reload();
  };

  return (
    // scroll-mt keeps the heading clear of the sticky header when the
    // "and N more" link in AdminNewRequests jumps down here.
    <div id="service-requests" className="card p-6 mt-5 scroll-mt-24">
      <h2 className="font-bold text-navy">{t('admin.serviceRequests.title')}</h2>
      <SectionState
        section={section}
        title={t('admin.serviceRequests.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('admin.serviceRequests.empty')}</p>}
      >
        {(rows) => (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-2.5 text-sm">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                  r.serviceType === 'partner' ? 'bg-gold-soft text-gold-dark' : 'bg-brand-blue text-navy'
                }`}
              >
                {r.serviceType === 'partner' ? t('services.partnerBadge') : t('services.directBadge')}
              </span>
              <span className="font-semibold text-navy">{r.serviceTitle}</span>
              {/* Identity. When the request came from a signed-in account the
                  owning profile is shown, so two requests from one customer are
                  visibly one customer. An anonymous submission has only the
                  typed name, and says so by showing exactly that. */}
              <span className="text-xs text-navy/70 inline-flex items-center gap-1">
                <AppIcon name="user" className="w-3.5 h-3.5" />
                {r.ownerName || r.name}
              </span>
              {r.ownerEmail && (
                <span className="text-[11px] text-navy/50" dir="ltr">
                  <RevealField masked={maskEmail(r.ownerEmail)} full={r.ownerEmail} onReveal={() => logPiiReveal('service_request', r.id)} />
                </span>
              )}
              <span className="text-xs text-navy inline-flex items-center gap-1" dir="ltr">
                <a href={`tel:${r.phone}`} aria-label={r.phone} className="inline-flex">
                  <AppIcon name="message-circle" className="w-3.5 h-3.5" />
                </a>
                <RevealField masked={maskPhone(r.phone)} full={r.phone} onReveal={() => logPiiReveal('service_request', r.id)} />
              </span>
              {r.message && <span className="text-xs text-gray-500 basis-full">“{r.message}”</span>}
              <span className="ms-auto text-xs text-gray-500">{new Date(r.createdAt).toLocaleString(i18n.language)}</span>

              {/* workflow — flips the customer's live screen to "افتح الآن" */}
              <span className="basis-full flex items-center gap-2 flex-wrap pt-1">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    r.status === 'accepted'
                      ? 'bg-green-100 text-green-800'
                      : r.status === 'done'
                        ? 'bg-brand-blue text-navy'
                        : r.status === 'rejected'
                          ? 'bg-brand-red/10 text-brand-red'
                          : 'bg-gold-soft text-gold-dark'
                  }`}
                >
                  {t(`admin.serviceRequests.status.${r.status === 'new' ? 'pending' : r.status}`)}
                </span>
                {allowedNext(SERVICE_REQUEST_TRANSITIONS, r.status).includes('accepted') && (
                  <button
                    onClick={() => setPendingStatus({ id: r.id, status: 'accepted', title: t('admin.serviceRequests.markReady') })}
                    className="btn-primary !h-8 px-3 text-xs"
                  >
                    <AppIcon name="check" className="w-3.5 h-3.5" />
                    {t('admin.serviceRequests.markReady')}
                  </button>
                )}
                {allowedNext(SERVICE_REQUEST_TRANSITIONS, r.status).includes('done') && (
                  <button
                    onClick={() => setPendingStatus({ id: r.id, status: 'done', title: t('admin.serviceRequests.markDone') })}
                    className="btn-secondary !h-8 px-3 text-xs"
                  >
                    {t('admin.serviceRequests.markDone')}
                  </button>
                )}
                {allowedNext(SERVICE_REQUEST_TRANSITIONS, r.status).includes('rejected') && (
                  <button
                    onClick={() => setPendingStatus({ id: r.id, status: 'rejected', title: t('admin.serviceRequests.reject') })}
                    className="btn-danger !h-8 px-3 text-xs"
                  >
                    {t('admin.serviceRequests.reject')}
                  </button>
                )}
                <button
                  onClick={() => setOfferOpenId(offerOpenId === r.id ? null : r.id)}
                  className="btn-secondary !h-8 px-3 text-xs"
                >
                  <AppIcon name="receipt" className="w-3.5 h-3.5" />
                  {t('serviceOffer.admin.toggle')}
                </button>
              </span>

              {offerOpenId === r.id && <OfferPanel requestId={r.id} onSent={section.reload} />}
            </li>
          ))}
        </ul>
        )}
      </SectionState>
      {pendingStatus && (
        <ConfirmActionModal
          title={pendingStatus.title}
          expectedResult={t(`admin.serviceRequests.status.${pendingStatus.status}`)}
          reversible
          notifiesCustomer={pendingStatus.status !== 'accepted'}
          onClose={() => setPendingStatus(null)}
          onConfirm={() => {
            setStatus(pendingStatus.id, pendingStatus.status);
            setPendingStatus(null);
          }}
        />
      )}
    </div>
  );
}
