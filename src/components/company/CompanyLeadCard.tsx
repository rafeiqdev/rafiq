import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { companies } from '../../lib/api';
import type { CompanyLead } from '../../lib/types';
import { SERVICE_CATEGORIES, pickText } from '../../data/services';
import { pickArea } from '../../data/istanbulAreas';
import { Modal } from '../Modal';
import { AppIcon } from '../AppIcon';

function RespondModal({ lead, companyId, onClose, onDone }: { lead: CompanyLead; companyId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [quote, setQuote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(false);
    try {
      await companies.respond(companyId, lead.id, quote ? Number(quote) : null, message.trim());
      onDone();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="respond-title" maxWidth="max-w-md">
      <div className="card overflow-hidden">
        <div className="bg-navy px-5 py-4">
          <h2 id="respond-title" className="text-white font-extrabold">{t('company.respond.title')}</h2>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-navy/70">{t('company.respond.forService', { service: lead.serviceTitle })}</p>
          <label className="block text-xs font-semibold text-navy/70">
            {t('company.respond.quote')} <span className="text-navy/40">({t('company.respond.optional')})</span>
            <input className="input mt-1" value={quote} onChange={(e) => setQuote(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" dir="ltr" placeholder={t('company.respond.quotePh')} />
          </label>
          <label className="block text-xs font-semibold text-navy/70">
            {t('company.respond.message')}
            <textarea className="input mt-1 min-h-[96px] py-2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('company.respond.messagePh')} />
          </label>
          {error && (
            <p role="alert" className="amber-note flex items-center gap-2">
              <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
              {t('company.respond.error')}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button onClick={send} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
              {busy ? t('company.respond.sending') : t('company.respond.send')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function CompanyLeadCard({ lead, companyId, onResponded }: { lead: CompanyLead; companyId: string; onResponded: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const cat = SERVICE_CATEGORIES.find((c) => c.id === lead.category);

  return (
    <li className="rounded-xl bg-cream px-4 py-3 text-sm flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-navy">{lead.serviceTitle}</span>
        {cat && <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-[10px] font-bold text-navy">{pickText(cat.title, lang)}</span>}
        {lead.area && (
          <span className="inline-flex items-center gap-1 text-xs text-navy/60">
            <AppIcon name="map-pin" className="w-3.5 h-3.5" />
            {pickArea(lead.area, lang)}
          </span>
        )}
        <span className="ms-auto text-xs text-gray-500">{new Date(lead.createdAt).toLocaleDateString(i18n.language)}</span>
      </div>
      {lead.message && <p className="text-navy/70 break-anywhere">“{lead.message}”</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-navy/50">
          <AppIcon name="user" className="w-3.5 h-3.5" />
          {lead.customerName || '—'}
        </span>
        {lead.responded ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
            <AppIcon name="check-circle" className="w-4 h-4" />
            {t('company.dashboard.responded')}
          </span>
        ) : (
          <button onClick={() => setOpen(true)} className="btn-primary !h-9 px-4 text-xs">
            <AppIcon name="message-circle" className="w-3.5 h-3.5" />
            {t('company.dashboard.respond')}
          </button>
        )}
      </div>
      {open && <RespondModal lead={lead} companyId={companyId} onClose={() => setOpen(false)} onDone={onResponded} />}
    </li>
  );
}
