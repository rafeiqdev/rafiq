import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { medicalRequests, medicalOffers, medicalPayments, medicalContent } from '../../lib/api';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { SectionState } from '../../components/SectionState';
import { AppIcon } from '../../components/AppIcon';
import { MedicalStatusPill } from './MedicalStatusPill';
import { MedicalOfferCard } from './MedicalOfferCard';
import type { MedicalOffer, MedicalOptionalServiceType, MedicalPayment, MedicalRequest, MedicalSpecialty } from '../../lib/types';

const OPTIONAL_SERVICES: MedicalOptionalServiceType[] = ['transport', 'interpreter', 'accommodation', 'companion', 'nursing'];

function pick(v: { ar: string; en: string; fa: string; ru: string }, lang: string): string {
  const l = lang.split('-')[0];
  return (v as Record<string, string>)[l] || v.en || v.ar || '';
}

function RequestDetail({ req }: { req: MedicalRequest }) {
  const { t, i18n } = useTranslation();
  const detail = useAsyncSection(() => medicalRequests.detail(req.id), [req.id]);
  const offers = useAsyncSection<MedicalOffer[]>(() => medicalOffers.listForRequest(req.id), [req.id]);
  const payments = useAsyncSection<MedicalPayment[]>(() => medicalPayments.forRequest(req.id), [req.id]);
  const optional = useAsyncSection(() => medicalRequests.optionalServices(req.id), [req.id]);
  const [requesting, setRequesting] = useState<MedicalOptionalServiceType | null>(null);

  const paymentFor = (offerId: string) => (payments.data ?? []).find((p) => p.offerId === offerId);

  const requestOptional = async (type: MedicalOptionalServiceType) => {
    setRequesting(type);
    try {
      await medicalRequests.requestOptionalService(req.id, type);
      optional.reload();
    } finally {
      setRequesting(null);
    }
  };

  const existingStatus = (type: MedicalOptionalServiceType) => (optional.data ?? []).find((o) => o.serviceType === type)?.status;

  return (
    <div className="mt-4 border-t border-cream-dark pt-4 flex flex-col gap-4">
      <p className="text-sm text-navy/70 break-anywhere">{req.description}</p>

      <SectionState section={detail} title={t('medical.request.files.label')} empty={null} isEmpty={(d) => !d?.files?.length}>
        {(d) => (
          <div>
            <p className="text-xs font-bold text-navy/60 mb-1.5">{t('medical.request.files.label')}</p>
            <ul className="flex flex-col gap-1.5">
              {(d?.files ?? []).map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => medicalRequests.openFile(f.id)}
                    className="flex items-center gap-2 rounded-lg bg-cream px-3 py-2 text-xs w-full text-start hover:bg-cream-dark"
                  >
                    <AppIcon name="file-text" className="w-4 h-4 shrink-0 text-navy/50" />
                    <span className="flex-1 min-w-0 truncate">{f.originalFilename}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionState>

      <SectionState section={offers} title={t('medical.offer.title')} empty={<p className="text-xs text-navy/50">{t('medical.offer.empty')}</p>}>
        {(rows) => (
          <div>
            <p className="text-xs font-bold text-navy/60 mb-2">{t('medical.offer.title')}</p>
            <div className="flex flex-col gap-3">
              {rows.map((o) => <MedicalOfferCard key={o.id} offer={o} payment={paymentFor(o.id)} />)}
            </div>
          </div>
        )}
      </SectionState>

      <div>
        <p className="text-xs font-bold text-navy/60 mb-2">{t('medical.optional.title')}</p>
        <div className="flex flex-wrap gap-2">
          {OPTIONAL_SERVICES.map((type) => {
            const status = existingStatus(type);
            return (
              <button
                key={type}
                onClick={() => requestOptional(type)}
                disabled={!!status || requesting === type}
                className="rounded-full border border-cream-dark px-3 py-1.5 text-xs font-medium text-navy disabled:opacity-60"
              >
                {t(`medical.optional.types.${type}`)}
                {status && ` · ${t(`medical.optional.status.${status}`)}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RequestRow({ req, specialtyName }: { req: MedicalRequest; specialtyName: string }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <li className="card p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 text-start" aria-expanded={open}>
        <AppIcon name="arrow-right" className={`w-3.5 h-3.5 text-navy/40 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-navy block">{specialtyName}</span>
          <span className="text-xs text-navy/50">{new Date(req.createdAt).toLocaleDateString(i18n.language)}</span>
        </span>
        <MedicalStatusPill status={req.status} />
      </button>
      {open && <RequestDetail req={req} />}
    </li>
  );
}

/**
 * Reused by both the desktop and mobile My Requests pages — the medical
 * domain's requests are a structurally different shape from generic
 * service_requests (offers, payments, hidden center data), so it renders as
 * its own section rather than being forced into RequestRow's shape.
 */
export function MedicalRequestsPanel() {
  const { t, i18n } = useTranslation();
  const requests = useAsyncSection<MedicalRequest[]>(() => medicalRequests.mine(), []);
  const specialties = useAsyncSection<MedicalSpecialty[]>(() => medicalContent.specialties(), []);
  const specialtyName = (slug: string) => {
    const s = (specialties.data ?? []).find((x) => x.slug === slug);
    return s ? pick(s.name, i18n.language) : slug;
  };

  return (
    <SectionState section={requests} title={t('medical.myRequests.title')} empty={null}>
      {(rows) => (
        <div className="mt-8">
          <h2 className="text-lg font-extrabold text-navy">{t('medical.myRequests.title')}</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((r) => <RequestRow key={r.id} req={r} specialtyName={specialtyName(r.specialty)} />)}
          </ul>
        </div>
      )}
    </SectionState>
  );
}
