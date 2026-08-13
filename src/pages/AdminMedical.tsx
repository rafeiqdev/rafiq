import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { adminMedical, adminMedicalContent, logPiiReveal, medicalContent } from '../lib/api';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { SectionState } from '../components/SectionState';
import { AppIcon } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { RequireMedicalCoordinator } from '../components/Gates';
import { MedicalStatusPill } from '../components/medical/MedicalStatusPill';
import { ConfirmActionModal } from '../components/admin/ConfirmActionModal';
import { RevealField } from '../components/admin/RevealField';
import { maskEmail } from '../lib/format';
import { allowedNext, MEDICAL_REQUEST_TRANSITIONS } from '../lib/statusTransitions';
import type {
  AdminMedicalRequest, MedicalFaq, MedicalHeroSlide, MedicalLandingCard, MedicalOffer, MedicalOptionalServiceType,
  MedicalPageSection, MedicalRequestStatus, MedicalTestimonial,
} from '../lib/types';

const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

const STATUSES: MedicalRequestStatus[] = [
  'pending_review', 'under_review', 'collecting_offers', 'offers_available',
  'awaiting_payment', 'paid', 'booked', 'cancelled',
];
const OPTIONAL_TYPES: MedicalOptionalServiceType[] = ['transport', 'interpreter', 'accommodation', 'companion', 'nursing'];

function NewOfferForm({ requestId, onCreated }: { requestId: string; onCreated: () => void }) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [included, setIncluded] = useState('');
  const [excluded, setExcluded] = useState('');
  const [sessions, setSessions] = useState('');
  const [expires, setExpires] = useState('');
  const [pct, setPct] = useState('20');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!plan.trim() || !price || Number(price) <= 0) return;
    setBusy(true);
    try {
      await adminMedical.createOffer(requestId, {
        treatmentPlan: plan.trim(), totalPrice: Number(price), currency,
        included: included.split('\n').map((s) => s.trim()).filter(Boolean),
        excluded: excluded.split('\n').map((s) => s.trim()).filter(Boolean),
        sessionsOrDays: sessions.trim() || undefined,
        expiresAt: expires ? new Date(expires).toISOString() : null,
        bookingPercentage: Number(pct),
      });
      setPlan(''); setPrice(''); setIncluded(''); setExcluded(''); setSessions(''); setExpires('');
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-cream-dark p-3 mt-2 grid gap-2 sm:grid-cols-2">
      <input className="input !h-9 text-xs sm:col-span-2" placeholder={t('medical.admin.offer.plan')} value={plan} onChange={(e) => setPlan(e.target.value)} />
      <div className="flex gap-2">
        <input className="input !h-9 text-xs" type="number" placeholder={t('medical.admin.offer.price')} value={price} onChange={(e) => setPrice(e.target.value)} />
        <select className="input !h-9 !w-24 text-xs" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option>USD</option><option>TL</option><option>EUR</option>
        </select>
      </div>
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.offer.sessions')} value={sessions} onChange={(e) => setSessions(e.target.value)} />
      <textarea className="input text-xs min-h-[60px]" placeholder={t('medical.admin.offer.included')} value={included} onChange={(e) => setIncluded(e.target.value)} />
      <textarea className="input text-xs min-h-[60px]" placeholder={t('medical.admin.offer.excluded')} value={excluded} onChange={(e) => setExcluded(e.target.value)} />
      <input className="input !h-9 text-xs" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      <label className="text-xs text-navy/60 flex items-center gap-2">
        {t('medical.admin.offer.percentage')}
        <input className="input !h-9 !w-20 text-xs" type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
      </label>
      <button onClick={submit} disabled={busy} className="btn-primary !h-9 text-xs sm:col-span-2 disabled:opacity-50">
        {t('medical.admin.offer.create')}
      </button>
    </div>
  );
}

function OfferCenterForm({ offer }: { offer: MedicalOffer }) {
  const { t } = useTranslation();
  const center = useAsyncSection(() => adminMedical.getCenter(offer.id), [offer.id]);
  const [name, setName] = useState('');
  const [doctor, setDoctor] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [appt, setAppt] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (center.status === 'ready' && !loaded) {
    const c = center.data;
    if (c) {
      setName(c.centerName); setDoctor(c.doctorName); setAddress(c.address);
      setPhone(c.phone); setWebsite(c.website); setMapUrl(c.mapUrl); setAppt(c.appointmentDetails);
    }
    setLoaded(true);
  }

  const save = async () => {
    setBusy(true);
    try {
      await adminMedical.setCenter(offer.id, { centerName: name, doctorName: doctor, address, phone, website, mapUrl, appointmentDetails: appt });
      center.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg bg-cream p-3 mt-2 grid gap-2 sm:grid-cols-2">
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.center.name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.center.doctor')} value={doctor} onChange={(e) => setDoctor(e.target.value)} />
      <input className="input !h-9 text-xs sm:col-span-2" placeholder={t('medical.admin.center.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.center.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.center.website')} value={website} onChange={(e) => setWebsite(e.target.value)} />
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.center.mapUrl')} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} />
      <input className="input !h-9 text-xs" placeholder={t('medical.admin.center.appointment')} value={appt} onChange={(e) => setAppt(e.target.value)} />
      <button onClick={save} disabled={busy} className="btn-secondary !h-9 text-xs sm:col-span-2 disabled:opacity-50">
        {t('medical.admin.center.save')}
      </button>
    </div>
  );
}

function OfferRow({ offer }: { offer: MedicalOffer }) {
  const { t } = useTranslation();
  const [showCenter, setShowCenter] = useState(false);
  return (
    <div className="rounded-lg border border-cream-dark p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">{offer.treatmentPlan}</p>
        <span className="text-xs font-bold text-navy" dir="ltr">{offer.totalPrice.toLocaleString()} {offer.currency} · {offer.bookingPercentage}%</span>
      </div>
      <button onClick={() => setShowCenter((v) => !v)} className="mt-2 text-xs font-semibold text-navy underline">
        {t('medical.admin.center.toggle')}
      </button>
      {showCenter && <OfferCenterForm offer={offer} />}
    </div>
  );
}

function RequestDetail({ req, onChanged }: { req: AdminMedicalRequest; onChanged: () => void }) {
  const { t } = useTranslation();
  const detail = useAsyncSection(() => adminMedical.detail(req.id), [req.id]);
  const [internalNote, setInternalNote] = useState(req.internalNote ?? '');
  const [customerNote, setCustomerNote] = useState(req.customerNote ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MedicalRequestStatus | null>(null);

  const setStatus = async (status: MedicalRequestStatus) => {
    await adminMedical.setStatus(req.id, status);
    onChanged();
    detail.reload();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await adminMedical.setNotes(req.id, { internalNote, customerNote });
    } finally {
      setSavingNotes(false);
    }
  };

  const setOptionalStatus = async (id: string, status: 'confirmed' | 'declined') => {
    await adminMedical.setOptionalServiceStatus(id, status);
    detail.reload();
  };

  const resolvePayment = async (id: string, status: 'rejected' | 'refunded') => {
    await adminMedical.resolvePayment(id, status);
    detail.reload();
  };

  const waText = `${t('medical.admin.waIntro')} #${req.id.slice(0, 8)} — ${req.ownerName ?? req.ownerEmail ?? ''}`;

  return (
    <div className="mt-4 border-t border-cream-dark pt-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="input !h-9 !w-auto text-xs" value={req.status} onChange={(e) => setPendingStatus(e.target.value as MedicalRequestStatus)}>
          <option value={req.status}>{t(`medical.status.${req.status}`)}</option>
          {allowedNext(MEDICAL_REQUEST_TRANSITIONS, req.status).map((s) => (
            <option key={s} value={s}>{t(`medical.status.${s}`)}</option>
          ))}
        </select>
        {pendingStatus && (
          <ConfirmActionModal
            title={t('common.status')}
            record={req.ownerName ?? req.ownerEmail ?? undefined}
            currentStatus={t(`medical.status.${req.status}`)}
            expectedResult={t(`medical.status.${pendingStatus}`)}
            reversible
            notifiesCustomer={false}
            onClose={() => setPendingStatus(null)}
            onConfirm={() => {
              setStatus(pendingStatus);
              setPendingStatus(null);
            }}
          />
        )}
        {WA_ENABLED && (
          <a
            href={`https://wa.me/${WA}?text=${encodeURIComponent(waText)}`}
            target="_blank" rel="noreferrer"
            className="btn-secondary !h-9 px-3 text-xs"
          >
            <AppIcon name="message-circle" className="w-3.5 h-3.5" />
            {t('medical.admin.whatsapp')}
          </a>
        )}
      </div>

      <p className="text-sm text-navy/70 break-anywhere">{req.description}</p>

      <SectionState section={detail} title={t('medical.request.files.label')} empty={<p className="text-xs text-navy/40">{t('medical.admin.noFiles')}</p>} isEmpty={(d) => !d?.files?.length}>
        {(d) => (
          <div className="flex flex-wrap gap-2">
            {(d?.files ?? []).map((f) => (
              <button key={f.id} onClick={() => adminMedical.openFile(f.id, req.id)} className="flex items-center gap-1.5 rounded-lg bg-cream px-3 py-1.5 text-xs hover:bg-cream-dark">
                <AppIcon name="file-text" className="w-3.5 h-3.5" />
                {f.originalFilename}
              </button>
            ))}
          </div>
        )}
      </SectionState>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-navy/60">
          {t('medical.admin.internalNote')}
          <textarea className="input mt-1 text-xs min-h-[70px]" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-navy/60">
          {t('medical.admin.customerNote')}
          <textarea className="input mt-1 text-xs min-h-[70px]" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
        </label>
      </div>
      <button onClick={saveNotes} disabled={savingNotes} className="btn-secondary !h-9 w-fit text-xs disabled:opacity-50">{t('medical.admin.saveNotes')}</button>

      <div>
        <p className="text-xs font-bold text-navy/60 mb-2">{t('medical.offer.title')}</p>
        <SectionState section={detail} title={t('medical.offer.title')} empty={null} isEmpty={(d) => !d?.offers?.length}>
          {(d) => (
            <div className="flex flex-col gap-2">
              {(d?.offers ?? []).map((o) => <OfferRow key={o.id} offer={o} />)}
            </div>
          )}
        </SectionState>
        <NewOfferForm requestId={req.id} onCreated={() => { onChanged(); detail.reload(); }} />
      </div>

      <SectionState section={detail} title={t('medical.optional.title')} empty={null} isEmpty={(d) => !d?.optionalServices?.length}>
        {(d) => (
          <div>
            <p className="text-xs font-bold text-navy/60 mb-2">{t('medical.optional.title')}</p>
            <div className="flex flex-col gap-1.5">
              {(d?.optionalServices ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between text-xs bg-cream rounded-lg px-3 py-2">
                  <span>{t(`medical.optional.types.${o.serviceType}`)} — {t(`medical.optional.status.${o.status}`)}</span>
                  {o.status === 'requested' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => setOptionalStatus(o.id, 'confirmed')} className="text-green-700 font-semibold">{t('medical.admin.confirm')}</button>
                      <button onClick={() => setOptionalStatus(o.id, 'declined')} className="text-brand-red font-semibold">{t('medical.admin.decline')}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionState>

      <SectionState section={detail} title={t('medical.admin.payments')} empty={null} isEmpty={(d) => !d?.payments?.length}>
        {(d) => (
          <div>
            <p className="text-xs font-bold text-navy/60 mb-2">{t('medical.admin.payments')}</p>
            <div className="flex flex-col gap-1.5">
              {(d?.payments ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs bg-cream rounded-lg px-3 py-2">
                  <span dir="ltr">{p.amount.toLocaleString()} {p.currency} — {t(`medical.payment.status.${p.status}`)}</span>
                  {/* No "verify" action exists anywhere in this UI, deliberately — a payment
                      becomes 'verified' ONLY via the signed webhook (api/payments/medical-webhook.ts).
                      Staff may reject an abandoned attempt or record a refund, never grant payment. */}
                  {p.status === 'pending' && (
                    <button onClick={() => resolvePayment(p.id, 'rejected')} className="text-brand-red font-semibold">{t('medical.admin.reject')}</button>
                  )}
                  {p.status === 'refund_requested' && (
                    <button onClick={() => resolvePayment(p.id, 'refunded')} className="text-navy font-semibold">{t('medical.admin.markRefunded')}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionState>
    </div>
  );
}

function RequestsQueue() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useAsyncSection<AdminMedicalRequest[]>(
    () => adminMedical.list({ status: status || undefined, specialty: specialty || undefined, search: search || undefined }),
    [status, specialty, search],
  );
  const newCount = useAsyncSection<number>(() => adminMedical.newCount(), []);

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-extrabold text-navy">{t('medical.admin.queue')}</h2>
        {newCount.status === 'ready' && newCount.data! > 0 && (
          <span className="rounded-full bg-brand-red text-white text-[11px] font-bold px-2 py-0.5">{newCount.data}</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select className="input !h-9 !w-auto text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('medical.admin.filterAllStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`medical.status.${s}`)}</option>)}
        </select>
        <input className="input !h-9 !w-auto text-xs" placeholder={t('medical.admin.filterSpecialty')} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        <input className="input !h-9 !w-auto text-xs" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <SectionState section={rows} title={t('medical.admin.queue')} empty={<p className="mt-4 text-sm text-navy/50">{t('medical.admin.empty')}</p>}>
        {(list) => (
          <ul className="mt-4 flex flex-col gap-2">
            {list.map((r) => (
              <li key={r.id} className="card p-4">
                <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="w-full flex items-center gap-3 text-start" aria-expanded={openId === r.id}>
                  <AppIcon name="arrow-right" className={`w-3.5 h-3.5 text-navy/40 transition-transform ${openId === r.id ? 'rotate-90' : ''}`} />
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-navy block">
                      {r.specialty} —{' '}
                      {r.ownerName ?? (r.ownerEmail ? <RevealField masked={maskEmail(r.ownerEmail)} full={r.ownerEmail} onReveal={() => logPiiReveal('medical_request', r.id)} /> : '—')}
                    </span>
                    <span className="text-xs text-navy/50">{new Date(r.createdAt).toLocaleDateString(i18n.language)} · {r.offersCount} {t('medical.admin.offersCount')}</span>
                  </span>
                  <MedicalStatusPill status={r.status} />
                </button>
                {openId === r.id && <RequestDetail req={r} onChanged={() => { rows.reload(); newCount.reload(); }} />}
              </li>
            ))}
          </ul>
        )}
      </SectionState>
    </div>
  );
}

const EMPTY_LOCALIZED = { ar: '', en: '', fa: '', ru: '' };

interface CatalogItem {
  id: string; slug: string; name: { ar: string; en: string; fa: string; ru: string };
  description: { ar: string; en: string; fa: string; ru: string }; icon: string | null; sort: number; visible: boolean;
}

/**
 * Drag-and-drop (or click-to-browse) image picker: uploads straight to the
 * public 'medical-media' bucket and hands back a URL. Shows a real preview
 * instead of a tiny thumbnail, and an X to clear it — this is the only way
 * a non-technical admin touches images on the landing page, so it has to
 * read as "drop a photo here", not as a form field.
 */
function ImageUploadField({ value, onChange }: { value: string | null; onChange: (url: string) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(true);
    try {
      const url = await adminMedicalContent.uploadImage(file);
      onChange(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void pick(e.dataTransfer.files?.[0]);
      }}
      className={`relative flex items-center gap-3 rounded-xl border-2 border-dashed p-3 cursor-pointer transition-colors ${
        dragOver ? 'border-navy bg-cream' : 'border-cream-dark hover:bg-cream/60'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
      />
      {value ? (
        <img src={value} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-cream-dark" />
      ) : (
        <div className="w-16 h-16 rounded-lg shrink-0 border border-cream-dark bg-cream flex items-center justify-center">
          <AppIcon name="camera" className="w-6 h-6 text-navy/30" />
        </div>
      )}
      <div className="flex-1 min-w-0 text-xs">
        <p className="font-semibold text-navy">{busy ? t('medical.admin.content.uploading') : t('medical.admin.content.uploadImage')}</p>
        {!busy && <p className="text-navy/40 mt-0.5">{t('medical.admin.content.dropImageHint')}</p>}
      </div>
      {value && !busy && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="shrink-0 text-navy/40 hover:text-brand-red"
          aria-label={t('medical.admin.content.remove')}
        >
          <AppIcon name="x" className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * "Type it once, we translate the rest." Shows one input per field in
 * whichever language the admin is currently using the UI in, plus a
 * translate button that fills the other 3 languages via Gemini
 * (api/admin/medical-translate). A collapsed "edit each language by hand"
 * panel underneath still exposes the raw per-language grid for the rare
 * case a translation needs a manual fix — nobody is forced to type the
 * same sentence 4 times just to publish one card.
 */
function TranslatableFields<K extends string>({
  fields, value, onChange,
}: {
  fields: { key: K; label: string; multiline?: boolean }[];
  value: Record<K, { ar: string; en: string; fa: string; ru: string }>;
  onChange: (next: Record<K, { ar: string; en: string; fa: string; ru: string }>) => void;
}) {
  const { t, i18n } = useTranslation();
  const uiLang = (['ar', 'en', 'ru', 'fa'] as const).includes(i18n.language as never) ? (i18n.language as 'ar' | 'en' | 'ru' | 'fa') : 'en';
  const [translating, setTranslating] = useState(false);
  const [manual, setManual] = useState(false);

  const setField = (key: K, lang: 'ar' | 'en' | 'ru' | 'fa', text: string) => {
    onChange({ ...value, [key]: { ...value[key], [lang]: text } });
  };

  const translate = async () => {
    const sourceFields: Record<string, string> = {};
    for (const f of fields) sourceFields[f.key] = value[f.key][uiLang];
    if (!Object.values(sourceFields).some((v) => v.trim())) return;
    setTranslating(true);
    try {
      const result = await adminMedicalContent.translateFields(uiLang, sourceFields);
      const next = { ...value };
      for (const lang of (['ar', 'en', 'ru', 'fa'] as const)) {
        if (lang === uiLang || !result[lang]) continue;
        for (const f of fields) {
          const translated = result[lang]?.[f.key];
          if (translated) next[f.key] = { ...next[f.key], [lang]: translated };
        }
      }
      onChange(next);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {fields.map((f) => (
        f.multiline ? (
          <textarea
            key={f.key}
            className="input text-xs min-h-[60px]"
            placeholder={f.label}
            value={value[f.key][uiLang]}
            onChange={(e) => setField(f.key, uiLang, e.target.value)}
          />
        ) : (
          <input
            key={f.key}
            className="input !h-9 text-xs"
            placeholder={f.label}
            value={value[f.key][uiLang]}
            onChange={(e) => setField(f.key, uiLang, e.target.value)}
          />
        )
      ))}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={translate}
          disabled={translating}
          className="btn-secondary !h-8 text-[11px] disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <AppIcon name="languages" className="w-3.5 h-3.5" />
          {translating ? t('medical.admin.content.translating') : t('medical.admin.content.translate')}
        </button>
        <button type="button" onClick={() => setManual((v) => !v)} className="text-[11px] font-semibold text-navy/50 underline">
          {t('medical.admin.content.manualEdit')}
        </button>
      </div>
      {manual && (
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-cream p-2">
          {fields.map((f) => (
            (['en', 'ar', 'ru', 'fa'] as const).map((l) => (
              <input
                key={`${f.key}-${l}`}
                className="input !h-8 text-xs"
                placeholder={`${f.label} (${l})`}
                value={value[f.key][l]}
                onChange={(e) => setField(f.key, l, e.target.value)}
              />
            ))
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Full CRUD for one localized catalog table — specialties and services share
 * this exact shape, so one editor serves both (parameterized by load/save/delete).
 * A non-technical admin creates, edits, reorders (sort number), publishes
 * (visible toggle) and deletes entirely from this UI — no SQL required.
 */
function CatalogEditor({
  title, load, onSave, onDelete,
}: {
  title: string;
  load: () => Promise<CatalogItem[]>;
  onSave: (item: Partial<CatalogItem> & { slug: string }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const list = useAsyncSection<CatalogItem[]>(load, [load]);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState(EMPTY_LOCALIZED);
  const [adding, setAdding] = useState(false);

  const addNew = async () => {
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!slug) return;
    setAdding(true);
    try {
      await onSave({ slug, name: newName, description: EMPTY_LOCALIZED, icon: null, sort: (list.data?.length ?? 0), visible: true });
      setNewSlug(''); setNewName(EMPTY_LOCALIZED);
      list.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-navy">{title}</h2>
      <SectionState section={list} title={title} empty={<p className="mt-3 text-xs text-navy/40">{t('medical.admin.content.empty')}</p>}>
        {(rows) => (
          <ul className="mt-3 flex flex-col gap-2">
            {[...rows].sort((a, b) => a.sort - b.sort).map((item) => (
              <CatalogRow key={item.id} item={item} onSave={async (v) => { await onSave(v); list.reload(); }} onDelete={async (id) => { await onDelete(id); list.reload(); }} />
            ))}
          </ul>
        )}
      </SectionState>

      <div className="mt-3 rounded-lg border border-dashed border-cream-dark p-3 flex flex-col gap-2">
        <input className="input !h-9 text-xs" placeholder={t('medical.admin.content.newSlug')} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} dir="ltr" />
        <TranslatableFields
          fields={[{ key: 'name', label: t('medical.admin.content.name') }]}
          value={{ name: newName }}
          onChange={(v) => setNewName(v.name)}
        />
        <button onClick={addNew} disabled={adding || !newSlug.trim()} className="btn-primary !h-9 text-xs disabled:opacity-50">
          {t('medical.admin.content.add')}
        </button>
      </div>
    </section>
  );
}

function CatalogRow({ item, onSave, onDelete }: { item: CatalogItem; onSave: (item: CatalogItem) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-navy/40 shrink-0" dir="ltr">{item.slug}</span>
        <label className="flex items-center gap-1.5 text-[11px] ms-auto">
          <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
          {t('medical.admin.content.visible')}
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          {t('medical.admin.content.order')}
          <input type="number" className="input !h-8 !w-16 text-xs" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <TranslatableFields
        fields={[
          { key: 'name', label: t('medical.admin.content.name') },
          { key: 'description', label: t('medical.admin.content.description'), multiline: true },
        ]}
        value={{ name: draft.name, description: draft.description }}
        onChange={(v) => setDraft({ ...draft, name: v.name, description: v.description })}
      />
      <input className="input !h-8 text-xs" placeholder={t('medical.admin.content.icon')} value={draft.icon ?? ''} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} dir="ltr" />
      <div className="flex gap-2">
        <button onClick={save} disabled={!dirty || busy} className="btn-secondary flex-1 !h-8 text-[11px] disabled:opacity-40">{t('medical.admin.content.save')}</button>
        <button onClick={() => setConfirmDelete(true)} className="text-brand-red shrink-0"><AppIcon name="trash" className="w-4 h-4" /></button>
      </div>
      {confirmDelete && (
        <ConfirmActionModal
          title={t('common.delete')}
          record={item.slug}
          expectedResult={t('common.delete')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            onDelete(item.id);
            setConfirmDelete(false);
          }}
        />
      )}
    </li>
  );
}

interface FaqDraft { id?: string; question: { ar: string; en: string; fa: string; ru: string }; answer: { ar: string; en: string; fa: string; ru: string }; sort: number; visible: boolean }

function FaqEditor() {
  const { t } = useTranslation();
  const list = useAsyncSection<MedicalFaq[]>(() => medicalContent.faqs(), []);
  const [newQ, setNewQ] = useState(EMPTY_LOCALIZED);
  const [newA, setNewA] = useState(EMPTY_LOCALIZED);
  const [adding, setAdding] = useState(false);

  const addNew = async () => {
    if (!newQ.en.trim() && !newQ.ar.trim()) return;
    setAdding(true);
    try {
      await adminMedicalContent.saveFaq({ question: newQ, answer: newA, sort: list.data?.length ?? 0, visible: true });
      setNewQ(EMPTY_LOCALIZED); setNewA(EMPTY_LOCALIZED);
      list.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-navy">{t('medical.faq.title')}</h2>
      <SectionState section={list} title={t('medical.faq.title')} empty={<p className="mt-3 text-xs text-navy/40">{t('medical.admin.content.empty')}</p>}>
        {(rows) => (
          <ul className="mt-3 flex flex-col gap-2">
            {[...rows].sort((a, b) => a.sort - b.sort).map((faq) => <FaqRow key={faq.id} faq={faq} onChanged={list.reload} />)}
          </ul>
        )}
      </SectionState>

      <div className="mt-3 rounded-lg border border-dashed border-cream-dark p-3 flex flex-col gap-2">
        <TranslatableFields
          fields={[
            { key: 'question', label: t('medical.admin.content.question') },
            { key: 'answer', label: t('medical.admin.content.answer'), multiline: true },
          ]}
          value={{ question: newQ, answer: newA }}
          onChange={(v) => { setNewQ(v.question); setNewA(v.answer); }}
        />
        <button onClick={addNew} disabled={adding} className="btn-primary !h-9 text-xs disabled:opacity-50">{t('medical.admin.content.add')}</button>
      </div>
    </section>
  );
}

function FaqRow({ faq, onChanged }: { faq: MedicalFaq; onChanged: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FaqDraft>(faq);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(faq);

  const save = async () => {
    setBusy(true);
    try {
      await adminMedicalContent.saveFaq(draft);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!faq.id) return;
    await adminMedicalContent.deleteFaq(faq.id);
    onChanged();
  };

  return (
    <li className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] ms-auto">
          <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
          {t('medical.admin.content.visible')}
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          {t('medical.admin.content.order')}
          <input type="number" className="input !h-8 !w-16 text-xs" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <TranslatableFields
        fields={[
          { key: 'question', label: t('medical.admin.content.question') },
          { key: 'answer', label: t('medical.admin.content.answer'), multiline: true },
        ]}
        value={{ question: draft.question, answer: draft.answer }}
        onChange={(v) => setDraft({ ...draft, question: v.question, answer: v.answer })}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={!dirty || busy} className="btn-secondary flex-1 !h-8 text-[11px] disabled:opacity-40">{t('medical.admin.content.save')}</button>
        <button onClick={() => setConfirmDelete(true)} className="text-brand-red shrink-0"><AppIcon name="trash" className="w-4 h-4" /></button>
      </div>
      {confirmDelete && (
        <ConfirmActionModal
          title={t('common.delete')}
          record={faq.question?.en || faq.question?.ar}
          expectedResult={t('common.delete')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            remove();
            setConfirmDelete(false);
          }}
        />
      )}
    </li>
  );
}

interface TestimonialDraft { id?: string; authorName: string; quote: { ar: string; en: string; fa: string; ru: string }; consentGiven: boolean; status: 'draft' | 'published'; sort: number }

function TestimonialRow({ tst, onChanged }: { tst: MedicalTestimonial; onChanged: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TestimonialDraft>(tst);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'delete' | 'publish' | 'unpublish'>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(tst);

  const save = async (patch: Partial<TestimonialDraft> = {}) => {
    setBusy(true);
    try {
      const next = { ...draft, ...patch };
      setDraft(next);
      await adminMedicalContent.saveTestimonial(next);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!tst.id) return;
    await adminMedicalContent.deleteTestimonial(tst.id);
    onChanged();
  };

  return (
    <li className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input !h-8 text-xs flex-1 min-w-[140px]" value={draft.authorName} onChange={(e) => setDraft({ ...draft, authorName: e.target.value })} />
        <label className="flex items-center gap-1.5 text-[11px]">
          {t('medical.admin.content.order')}
          <input type="number" className="input !h-8 !w-16 text-xs" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <TranslatableFields
        fields={[{ key: 'quote', label: t('medical.admin.content.quote'), multiline: true }]}
        value={{ quote: draft.quote }}
        onChange={(v) => setDraft({ ...draft, quote: v.quote })}
      />
      <label className="flex items-center gap-2 text-xs text-navy/70">
        <input type="checkbox" checked={draft.consentGiven} onChange={(e) => setDraft({ ...draft, consentGiven: e.target.checked })} />
        {t('medical.admin.content.consentCheckbox')}
      </label>
      <p className="text-[11px] text-navy/40">{t(`medical.admin.content.status.${draft.status}`)}</p>
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => save()} disabled={!dirty || busy} className="btn-secondary flex-1 !h-8 text-[11px] disabled:opacity-40">{t('medical.admin.content.save')}</button>
        {draft.status === 'draft'
          ? <button onClick={() => setConfirmAction('publish')} disabled={!draft.consentGiven || busy} className="btn-secondary flex-1 !h-8 text-[11px] disabled:opacity-40">{t('medical.admin.content.publish')}</button>
          : <button onClick={() => setConfirmAction('unpublish')} disabled={busy} className="btn-secondary flex-1 !h-8 text-[11px]">{t('medical.admin.content.unpublish')}</button>}
        <button onClick={() => setConfirmAction('delete')} className="text-brand-red shrink-0"><AppIcon name="trash" className="w-4 h-4" /></button>
      </div>
      {confirmAction && (
        <ConfirmActionModal
          title={confirmAction === 'delete' ? t('common.delete') : t(`medical.admin.content.${confirmAction}`)}
          record={draft.authorName}
          expectedResult={confirmAction === 'delete' ? t('common.delete') : t(`medical.admin.content.${confirmAction}`)}
          reversible={confirmAction !== 'delete'}
          notifiesCustomer={false}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction === 'delete') remove();
            else if (confirmAction === 'publish') save({ status: 'published' });
            else save({ status: 'draft' });
            setConfirmAction(null);
          }}
        />
      )}
    </li>
  );
}

function TestimonialsEditor() {
  const { t } = useTranslation();
  const list = useAsyncSection<MedicalTestimonial[]>(() => adminMedicalContent.listAllTestimonials(), []);
  const [author, setAuthor] = useState('');
  const [quote, setQuote] = useState(EMPTY_LOCALIZED);
  const [consent, setConsent] = useState(false);
  const [adding, setAdding] = useState(false);

  const addNew = async () => {
    if (!author.trim() || !consent) return;
    setAdding(true);
    try {
      await adminMedicalContent.saveTestimonial({ authorName: author.trim(), quote, consentGiven: consent, status: 'draft', sort: list.data?.length ?? 0 });
      setAuthor(''); setQuote(EMPTY_LOCALIZED); setConsent(false);
      list.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-navy">{t('medical.admin.content.testimonials')}</h2>
      <SectionState section={list} title={t('medical.admin.content.testimonials')} empty={<p className="mt-3 text-xs text-navy/40">{t('medical.admin.content.empty')}</p>}>
        {(rows) => (
          <ul className="mt-3 flex flex-col gap-2">
            {[...rows].sort((a, b) => a.sort - b.sort).map((tst) => <TestimonialRow key={tst.id} tst={tst} onChanged={list.reload} />)}
          </ul>
        )}
      </SectionState>

      <div className="mt-3 rounded-lg border border-dashed border-cream-dark p-3 flex flex-col gap-2">
        <input className="input !h-9 text-xs" placeholder={t('medical.admin.content.authorName')} value={author} onChange={(e) => setAuthor(e.target.value)} />
        <TranslatableFields
          fields={[{ key: 'quote', label: t('medical.admin.content.quote'), multiline: true }]}
          value={{ quote }}
          onChange={(v) => setQuote(v.quote)}
        />
        <label className="flex items-center gap-2 text-xs text-navy/70">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          {t('medical.admin.content.consentCheckbox')}
        </label>
        <button onClick={addNew} disabled={adding || !author.trim() || !consent} className="btn-primary !h-9 text-xs disabled:opacity-50">
          {t('medical.admin.content.add')}
        </button>
      </div>
    </section>
  );
}

interface LandingCardDraft {
  id?: string; slug: string; title: { ar: string; en: string; fa: string; ru: string };
  description: { ar: string; en: string; fa: string; ru: string }; imageUrl: string | null; sort: number; visible: boolean;
}

function LandingCardRow({ card, onChanged }: { card: MedicalLandingCard; onChanged: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<LandingCardDraft>(card);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(card);

  const save = async () => {
    setBusy(true);
    try {
      await adminMedicalContent.saveLandingCard(draft);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!card.id) return;
    await adminMedicalContent.deleteLandingCard(card.id);
    onChanged();
  };

  return (
    <li className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-navy/40 shrink-0" dir="ltr">{card.slug}</span>
        <label className="flex items-center gap-1.5 text-[11px] ms-auto">
          <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
          {t('medical.admin.content.visible')}
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          {t('medical.admin.content.order')}
          <input type="number" className="input !h-8 !w-16 text-xs" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <ImageUploadField value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} />
      <TranslatableFields
        fields={[
          { key: 'title', label: t('medical.admin.content.name') },
          { key: 'description', label: t('medical.admin.content.description'), multiline: true },
        ]}
        value={{ title: draft.title, description: draft.description }}
        onChange={(v) => setDraft({ ...draft, title: v.title, description: v.description })}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={!dirty || busy} className="btn-secondary flex-1 !h-8 text-[11px] disabled:opacity-40">{t('medical.admin.content.save')}</button>
        <button onClick={() => setConfirmDelete(true)} className="text-brand-red shrink-0"><AppIcon name="trash" className="w-4 h-4" /></button>
      </div>
      {confirmDelete && (
        <ConfirmActionModal
          title={t('common.delete')}
          record={card.slug}
          expectedResult={t('common.delete')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            remove();
            setConfirmDelete(false);
          }}
        />
      )}
    </li>
  );
}

function LandingCardsEditor() {
  const { t } = useTranslation();
  const list = useAsyncSection<MedicalLandingCard[]>(() => adminMedicalContent.listAllLandingCards(), []);
  const [newSlug, setNewSlug] = useState('');
  const [newFields, setNewFields] = useState<{ title: { ar: string; en: string; fa: string; ru: string }; description: { ar: string; en: string; fa: string; ru: string } }>({ title: EMPTY_LOCALIZED, description: EMPTY_LOCALIZED });
  const [newImage, setNewImage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const addNew = async () => {
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!slug) return;
    setAdding(true);
    try {
      await adminMedicalContent.saveLandingCard({ slug, title: newFields.title, description: newFields.description, imageUrl: newImage, sort: list.data?.length ?? 0, visible: true });
      setNewSlug(''); setNewFields({ title: EMPTY_LOCALIZED, description: EMPTY_LOCALIZED }); setNewImage(null);
      list.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-navy">{t('medical.admin.content.landingCards')}</h2>
      <p className="mt-1 text-xs text-navy/50">{t('medical.admin.content.landingCardsHint')}</p>
      <SectionState section={list} title={t('medical.admin.content.landingCards')} empty={<p className="mt-3 text-xs text-navy/40">{t('medical.admin.content.empty')}</p>}>
        {(rows) => (
          <ul className="mt-3 flex flex-col gap-2">
            {[...rows].sort((a, b) => a.sort - b.sort).map((card) => <LandingCardRow key={card.id} card={card} onChanged={list.reload} />)}
          </ul>
        )}
      </SectionState>

      <div className="mt-3 rounded-lg border border-dashed border-cream-dark p-3 flex flex-col gap-2">
        <input className="input !h-9 text-xs" placeholder={t('medical.admin.content.newSlug')} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} dir="ltr" />
        <ImageUploadField value={newImage} onChange={setNewImage} />
        <TranslatableFields
          fields={[
            { key: 'title', label: t('medical.admin.content.name') },
            { key: 'description', label: t('medical.admin.content.description'), multiline: true },
          ]}
          value={newFields}
          onChange={setNewFields}
        />
        <button onClick={addNew} disabled={adding || !newSlug.trim()} className="btn-primary !h-9 text-xs disabled:opacity-50">
          {t('medical.admin.content.add')}
        </button>
      </div>
    </section>
  );
}

interface HeroSlideDraft { id?: string; imageUrl: string; caption: { ar: string; en: string; fa: string; ru: string }; sort: number; visible: boolean }

function HeroSlideRow({ slide, onChanged }: { slide: MedicalHeroSlide; onChanged: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<HeroSlideDraft>(slide);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(slide);

  const save = async () => {
    setBusy(true);
    try {
      await adminMedicalContent.saveHeroSlide(draft);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!slide.id) return;
    await adminMedicalContent.deleteHeroSlide(slide.id);
    onChanged();
  };

  return (
    <li className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <ImageUploadField value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} />
        <label className="flex items-center gap-1.5 text-[11px] ms-auto">
          <input type="checkbox" checked={draft.visible} onChange={(e) => setDraft({ ...draft, visible: e.target.checked })} />
          {t('medical.admin.content.visible')}
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          {t('medical.admin.content.order')}
          <input type="number" className="input !h-8 !w-16 text-xs" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <TranslatableFields
        fields={[{ key: 'caption', label: t('medical.admin.content.caption') }]}
        value={{ caption: draft.caption }}
        onChange={(v) => setDraft({ ...draft, caption: v.caption })}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={!dirty || busy} className="btn-secondary flex-1 !h-8 text-[11px] disabled:opacity-40">{t('medical.admin.content.save')}</button>
        <button onClick={() => setConfirmDelete(true)} className="text-brand-red shrink-0"><AppIcon name="trash" className="w-4 h-4" /></button>
      </div>
      {confirmDelete && (
        <ConfirmActionModal
          title={t('common.delete')}
          record={draft.caption?.en || draft.caption?.ar}
          expectedResult={t('common.delete')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            remove();
            setConfirmDelete(false);
          }}
        />
      )}
    </li>
  );
}

function HeroSlidesEditor() {
  const { t } = useTranslation();
  const list = useAsyncSection<MedicalHeroSlide[]>(() => adminMedicalContent.listAllHeroSlides(), []);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newCaption, setNewCaption] = useState<{ caption: { ar: string; en: string; fa: string; ru: string } }>({ caption: EMPTY_LOCALIZED });
  const [adding, setAdding] = useState(false);

  const addNew = async () => {
    if (!newImage) return;
    setAdding(true);
    try {
      await adminMedicalContent.saveHeroSlide({ imageUrl: newImage, caption: newCaption.caption, sort: list.data?.length ?? 0, visible: true });
      setNewImage(null); setNewCaption({ caption: EMPTY_LOCALIZED });
      list.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-navy">{t('medical.admin.content.heroSlides')}</h2>
      <SectionState section={list} title={t('medical.admin.content.heroSlides')} empty={<p className="mt-3 text-xs text-navy/40">{t('medical.admin.content.empty')}</p>}>
        {(rows) => (
          <ul className="mt-3 flex flex-col gap-2">
            {[...rows].sort((a, b) => a.sort - b.sort).map((slide) => <HeroSlideRow key={slide.id} slide={slide} onChanged={list.reload} />)}
          </ul>
        )}
      </SectionState>

      <div className="mt-3 rounded-lg border border-dashed border-cream-dark p-3 flex flex-col gap-2">
        <ImageUploadField value={newImage} onChange={setNewImage} />
        <TranslatableFields
          fields={[{ key: 'caption', label: t('medical.admin.content.caption') }]}
          value={newCaption}
          onChange={setNewCaption}
        />
        <button onClick={addNew} disabled={adding || !newImage} className="btn-primary !h-9 text-xs disabled:opacity-50">
          {t('medical.admin.content.add')}
        </button>
      </div>
    </section>
  );
}

const SECTION_KEYS = [
  'hero', 'trust', 'about', 'how_it_works', 'specialties', 'center_evaluation',
  'supporting_services', 'testimonials', 'faq', 'disclaimer', 'final_cta',
];

function SectionsEditor() {
  const { t } = useTranslation();
  const sections = useAsyncSection<MedicalPageSection[]>(() => medicalContent.sections(), []);

  const update = async (key: string, patch: { visible?: boolean; sort?: number }) => {
    const current = sections.data?.find((s) => s.sectionKey === key);
    await adminMedicalContent.setSectionVisibility(key, patch.visible ?? current?.visible ?? true, patch.sort ?? current?.sort);
    sections.reload();
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-navy">{t('medical.admin.content.sections')}</h2>
      <SectionState section={sections} title={t('medical.admin.content.sections')} empty={null}>
        {(rows) => (
          <ul className="mt-3 flex flex-col gap-2">
            {[...rows].sort((a, b) => a.sort - b.sort).map((s) => (
              <li key={s.sectionKey} className="card p-3 flex items-center gap-3">
                <span className="text-sm font-medium text-navy flex-1">{t(`medical.admin.content.sectionNames.${s.sectionKey}`)}</span>
                <label className="flex items-center gap-1.5 text-[11px]">
                  {t('medical.admin.content.order')}
                  <input type="number" className="input !h-8 !w-16 text-xs" defaultValue={s.sort} onBlur={(e) => update(s.sectionKey, { sort: Number(e.target.value) || 0 })} />
                </label>
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input type="checkbox" checked={s.visible} onChange={(e) => update(s.sectionKey, { visible: e.target.checked })} />
                  {t('medical.admin.content.visible')}
                </label>
              </li>
            ))}
          </ul>
        )}
      </SectionState>
    </section>
  );
}

const CONTENT_TABS = ['heroSlides', 'landingCards', 'sections', 'specialties', 'services', 'faq', 'testimonials'] as const;
type ContentTab = (typeof CONTENT_TABS)[number];
const DEFAULT_CONTENT_TAB: ContentTab = 'heroSlides';
function isContentTab(v: string | null): v is ContentTab {
  return !!v && (CONTENT_TABS as readonly string[]).includes(v);
}
const CONTENT_TAB_ICON: Record<ContentTab, IconName> = {
  heroSlides: 'camera',
  landingCards: 'sparkles',
  sections: 'layers',
  specialties: 'stethoscope',
  services: 'briefcase',
  faq: 'info',
  testimonials: 'star',
};

/**
 * One content section visible at a time, chosen from a sidebar — same
 * pattern as /admin's own TABS sidebar — instead of every editor stacked
 * into one long scroll where a new section was easy to miss.
 */
function ContentManager() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('ctab');
  const activeTab: ContentTab = isContentTab(rawTab) ? rawTab : DEFAULT_CONTENT_TAB;
  const setActiveTab = (tab: ContentTab) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === DEFAULT_CONTENT_TAB) next.delete('ctab');
      else next.set('ctab', tab);
      return next;
    });
  };

  const CONTENT_TAB_LABEL: Record<ContentTab, string> = {
    heroSlides: t('medical.admin.content.heroSlides'),
    landingCards: t('medical.admin.content.landingCards'),
    sections: t('medical.admin.content.sections'),
    specialties: t('medical.admin.content.specialties'),
    services: t('medical.admin.content.services'),
    faq: t('medical.faq.title'),
    testimonials: t('medical.admin.content.testimonials'),
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <nav
        aria-label={t('medical.admin.tabContent')}
        className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-24"
      >
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`shrink-0 md:shrink-0 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors text-start ${
              activeTab === tab ? 'bg-navy text-white' : 'text-navy/70 hover:bg-cream'
            }`}
          >
            <AppIcon name={CONTENT_TAB_ICON[tab]} className="w-4 h-4 shrink-0" />
            {CONTENT_TAB_LABEL[tab]}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0 w-full">
        {activeTab === 'heroSlides' && <HeroSlidesEditor />}
        {activeTab === 'landingCards' && <LandingCardsEditor />}
        {activeTab === 'sections' && <SectionsEditor />}
        {activeTab === 'specialties' && (
          <CatalogEditor title={t('medical.admin.content.specialties')} load={() => medicalContent.specialties()} onSave={(v) => adminMedicalContent.saveSpecialty(v)} onDelete={(id) => adminMedicalContent.deleteSpecialty(id)} />
        )}
        {activeTab === 'services' && (
          <CatalogEditor title={t('medical.admin.content.services')} load={() => medicalContent.services()} onSave={(v) => adminMedicalContent.saveService(v)} onDelete={(id) => adminMedicalContent.deleteService(id)} />
        )}
        {activeTab === 'faq' && <FaqEditor />}
        {activeTab === 'testimonials' && <TestimonialsEditor />}
      </div>
    </div>
  );
}

function AdminMedicalInner() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'queue' | 'content'>('queue');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('medical.admin.title')}</h1>
      <div className="mt-4 flex gap-2">
        <button onClick={() => setTab('queue')} className={`btn-secondary !h-9 px-4 text-xs ${tab === 'queue' ? '!bg-navy !text-white' : ''}`}>{t('medical.admin.tabQueue')}</button>
        <button onClick={() => setTab('content')} className={`btn-secondary !h-9 px-4 text-xs ${tab === 'content' ? '!bg-navy !text-white' : ''}`}>{t('medical.admin.tabContent')}</button>
      </div>
      <div className="mt-6">
        {tab === 'queue' ? <RequestsQueue /> : <ContentManager />}
      </div>
    </div>
  );
}

export function AdminMedical() {
  return (
    <RequireMedicalCoordinator>
      <AdminMedicalInner />
    </RequireMedicalCoordinator>
  );
}
