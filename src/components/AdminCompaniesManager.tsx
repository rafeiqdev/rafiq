import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminCompanies } from '../lib/api';
import type { Company, CompanyStatus } from '../lib/types';
import { SERVICE_CATEGORIES, pickText } from '../data/services';
import { pickArea } from '../data/istanbulAreas';
import { AppIcon } from './AppIcon';

function CompanyRow({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [note, setNote] = useState(company.adminNote ?? '');
  const [noteSaved, setNoteSaved] = useState(false);

  const setStatus = async (status: CompanyStatus) => {
    await adminCompanies.setStatus(company.id, status);
    onChanged();
  };
  const saveNote = async () => {
    await adminCompanies.setNote(company.id, note);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const statusCls = company.status === 'approved' ? 'bg-green-100 text-green-800' : company.status === 'suspended' ? 'bg-brand-red/10 text-brand-red' : 'bg-gold-soft text-gold-dark';
  const cats = company.categories.map((c) => SERVICE_CATEGORIES.find((x) => x.id === c)).filter(Boolean).map((c) => pickText(c!.title, lang));

  return (
    <li className="rounded-xl bg-cream px-4 py-3 text-sm flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-navy">{company.name}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCls}`}>{t('company.status.' + company.status)}</span>
        <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-[10px] font-bold text-navy">{t('company.sub.' + company.subscriptionStatus)}</span>
        <span className="ms-auto text-xs text-gray-500">{t('companyAdmin.companies.registered')}: {new Date(company.createdAt).toLocaleDateString(i18n.language)}</span>
      </div>

      {company.description && <p className="text-navy/70 break-anywhere">{company.description}</p>}

      <div className="text-xs text-navy/60 flex flex-wrap gap-x-4 gap-y-1">
        <span>{t('companyAdmin.companies.categories')}: {cats.join('، ') || '—'}</span>
        <span>{t('companyAdmin.companies.areas')}: {company.areas.map((a) => pickArea(a, lang)).join('، ') || '—'}</span>
      </div>

      {/* contact + documents */}
      <div className="flex flex-wrap items-center gap-2">
        {company.contact.email && <span className="text-xs text-navy/60" dir="ltr">{company.contact.email}</span>}
        {company.contact.phone && <span className="text-xs text-navy/60" dir="ltr">{company.contact.phone}</span>}
        {company.documents.length === 0 ? (
          <span className="text-xs text-gray-400">{t('companyAdmin.companies.noDocs')}</span>
        ) : (
          company.documents.map((d, i) => (
            <button key={i} type="button" onClick={() => adminCompanies.openDoc(d.path)} className="btn-secondary !h-7 px-2 text-xs">
              <AppIcon name="paperclip" className="w-3 h-3" />
              {d.name}
            </button>
          ))
        )}
      </div>

      {/* admin note */}
      <div className="flex gap-2">
        <input className="input !h-9 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('companyAdmin.companies.notePh')} />
        <button onClick={saveNote} className="btn-secondary !h-9 px-3 text-xs shrink-0">
          <AppIcon name={noteSaved ? 'check' : 'save'} className="w-3.5 h-3.5" />
          {t('companyAdmin.companies.saveNote')}
        </button>
      </div>

      {/* status actions */}
      <div className="flex gap-2 flex-wrap">
        {company.status === 'pending' && (
          <>
            <button onClick={() => setStatus('approved')} className="btn-primary !h-8 px-3 text-xs">
              <AppIcon name="check" className="w-3.5 h-3.5" />{t('companyAdmin.companies.approve')}
            </button>
            <button onClick={() => setStatus('suspended')} className="btn-danger !h-8 px-3 text-xs">
              <AppIcon name="x" className="w-3.5 h-3.5" />{t('companyAdmin.companies.reject')}
            </button>
          </>
        )}
        {company.status === 'approved' && (
          <button onClick={() => setStatus('suspended')} className="btn-danger !h-8 px-3 text-xs">
            <AppIcon name="x-circle" className="w-3.5 h-3.5" />{t('companyAdmin.companies.suspend')}
          </button>
        )}
        {company.status === 'suspended' && (
          <button onClick={() => setStatus('approved')} className="btn-primary !h-8 px-3 text-xs">
            <AppIcon name="check" className="w-3.5 h-3.5" />{t('companyAdmin.companies.reinstate')}
          </button>
        )}
      </div>
    </li>
  );
}

export function AdminCompaniesManager() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Company[]>([]);
  const load = () => adminCompanies.list().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy">{t('companyAdmin.companies.title')}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{t('companyAdmin.companies.empty')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((c) => <CompanyRow key={c.id} company={c} onChanged={load} />)}
        </ul>
      )}
    </div>
  );
}
