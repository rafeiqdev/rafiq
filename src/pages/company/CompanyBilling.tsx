import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { checkout, companies, companyBilling } from '../../lib/api';
import type { Company, CompanyPayMethod } from '../../lib/types';
import { isCompanyActive } from '../../lib/types';
import { RequireCompany } from '../../components/Gates';
import { AppIcon } from '../../components/AppIcon';

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-navy/70">{label}</p>
      <div className="mt-1 flex gap-2">
        <code dir="ltr" className="flex-1 min-w-0 input flex items-center text-xs overflow-x-auto">{value}</code>
        <button className="btn-secondary px-3 shrink-0" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  );
}

function BillingInner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [plan, setPlan] = useState<{ monthly: number; currency: string }>({ monthly: 0, currency: 'TL' });
  const [bank, setBank] = useState<{ iban: string; holder: string; wallet: string; network: string } | null>(null);
  const [tab, setTab] = useState<CompanyPayMethod>('card');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');

  useEffect(() => {
    companies.mine().then(setCompany).catch(() => setCompany(null));
    companyBilling.config().then(setPlan).catch(() => {});
    checkout.config().then(setBank).catch(() => {});
  }, []);

  const pay = async () => {
    setBusy(true);
    try {
      await companyBilling.pay(tab, tab === 'card' ? undefined : receipt ?? undefined);
      setState('pending');
    } catch {
      setState('failed');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString();
  const active = company ? isCompanyActive(company) : false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('company.billing.title')}</h1>

      {/* plan summary */}
      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-navy">{t('company.billing.planName')}</h2>
            <p className="mt-1 text-sm text-navy/60">{t('company.billing.planDesc')}</p>
          </div>
          <p className="font-extrabold text-navy text-lg whitespace-nowrap" dir="ltr">
            {t('company.billing.perMonth', { price: fmt(plan.monthly), currency: plan.currency })}
          </p>
        </div>
        {active && company?.subscriptionExpiresAt && (
          <p className="mt-3 amber-note flex items-center gap-2">
            <AppIcon name="check-circle" className="w-4 h-4 shrink-0" />
            {t('company.billing.activeTitle')} · {t('company.billing.activeUntil', { date: new Date(company.subscriptionExpiresAt).toLocaleDateString(i18n.language) })}
          </p>
        )}
      </div>

      {state === 'pending' && (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto"><AppIcon name="hourglass" className="w-6 h-6" /></div>
          <h2 className="mt-4 font-extrabold text-navy">{t('company.billing.pendingTitle')}</h2>
          <p className="mt-2 text-sm text-navy/60">{t('company.billing.pendingBody')}</p>
          <button onClick={() => navigate('/company')} className="btn-primary mt-6">{t('company.dashboard.title')}</button>
        </div>
      )}

      {state === 'failed' && (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto"><AppIcon name="x-circle" className="w-6 h-6" /></div>
          <p className="mt-4 font-semibold text-navy">{t('company.billing.error')}</p>
          <button onClick={() => setState('idle')} className="btn-primary mt-6">{t('chat.retry')}</button>
        </div>
      )}

      {state === 'idle' && (
        <div className="card mt-6 overflow-hidden">
          <div className="flex border-b border-cream-dark" role="tablist">
            {(['card', 'bank_transfer', 'crypto'] as CompanyPayMethod[]).map((m) => (
              <button key={m} role="tab" aria-selected={tab === m} onClick={() => setTab(m)}
                className={`flex-1 min-w-0 h-12 text-xs sm:text-sm font-semibold transition-colors ${tab === m ? 'bg-brand-blue text-navy border-b-2 border-navy' : 'text-navy/70 hover:text-navy'}`}>
                {t(`company.billing.${m}`)}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'bank_transfer' && (
              <div>
                <p className="text-sm text-gray-500">{t('company.billing.bankNote')}</p>
                <CopyField label={t('checkout.bank.iban')} value={bank?.iban ?? '…'} />
                <CopyField label={t('checkout.bank.holder')} value={bank?.holder ?? '…'} />
                <label className="btn-secondary w-full mt-4 cursor-pointer flex items-center min-w-0">
                  <AppIcon name="paperclip" className="w-4 h-4 shrink-0" />
                  {receipt ? <span className="truncate min-w-0">{`${t('company.billing.uploaded')}: ${receipt.name}`}</span> : t('company.billing.uploadReceipt')}
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}
            {tab === 'crypto' && (
              <div>
                <p className="text-sm text-gray-500">{t('company.billing.cryptoNote')}</p>
                <CopyField label={`${t('checkout.crypto.network')} — ${bank?.network ?? '…'}`} value={bank?.wallet ?? '…'} />
                <label className="btn-secondary w-full mt-4 cursor-pointer flex items-center min-w-0">
                  <AppIcon name="paperclip" className="w-4 h-4 shrink-0" />
                  {receipt ? <span className="truncate min-w-0">{`${t('company.billing.uploaded')}: ${receipt.name}`}</span> : t('company.billing.uploadReceipt')}
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}
            {tab === 'card' && <p className="text-sm text-gray-500">{t('checkout.card.note')}</p>}

            <button onClick={pay} disabled={busy} className="btn-primary w-full mt-5 disabled:opacity-60">
              <AppIcon name="credit-card" className="w-4 h-4" />
              {busy ? t('company.billing.paying') : tab === 'card' ? t('company.billing.pay') : t('company.billing.submit')}
            </button>
          </div>
        </div>
      )}

      <Link to="/company" className="block text-center text-sm text-navy/50 mt-6 hover:text-navy">{t('company.dashboard.title')}</Link>
    </div>
  );
}

export function CompanyBilling() {
  return (
    <RequireCompany>
      <BillingInner />
    </RequireCompany>
  );
}
