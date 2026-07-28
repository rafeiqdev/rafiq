import { useTranslation } from 'react-i18next';
import { companyPayments } from '../lib/api';
import type { CompanyPayment } from '../lib/types';
import { AppIcon } from './AppIcon';
import { SectionState } from './SectionState';
import { useAsyncSection } from '../hooks/useAsyncSection';

/**
 * Admin: confirm/reject company subscription payments (mirrors user payments).
 * A failed load here used to render "no pending payments" — money owed
 * presenting as nothing. Error is now a state of its own.
 */
export function AdminCompanyPaymentsManager() {
  const { t, i18n } = useTranslation();
  const section = useAsyncSection<CompanyPayment[]>(() => companyPayments.pending(), []);

  const resolve = async (id: string, status: 'confirmed' | 'rejected') => {
    await companyPayments.resolve(id, status);
    section.reload();
  };

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy">{t('companyAdmin.payments.title')}</h2>
      <SectionState
        section={section}
        title={t('companyAdmin.payments.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('companyAdmin.payments.empty')}</p>}
      >
        {(rows) => (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-3 text-sm">
              <span className="font-semibold text-navy">{p.companyName || '—'}</span>
              <span className="text-xs text-gray-500">
                {t('companyAdmin.payments.method')}: {t(`company.billing.${p.method}`)} ·{' '}
                <span dir="ltr">{p.amount.toLocaleString()} {t('common.tl')}</span>
              </span>
              {p.hasReceipt && (
                <button type="button" onClick={() => companyPayments.openReceipt(p.id)} className="btn-secondary h-9 px-3 text-xs">
                  <AppIcon name="paperclip" className="w-3.5 h-3.5" />
                  {t('companyAdmin.payments.receipt')}
                </button>
              )}
              <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString(i18n.language)}</span>
              <span className="ms-auto flex gap-2">
                <button onClick={() => resolve(p.id, 'confirmed')} className="btn-primary h-9 px-3 text-xs">
                  <AppIcon name="check" className="w-3.5 h-3.5" />
                  {t('companyAdmin.payments.confirm')}
                </button>
                <button onClick={() => resolve(p.id, 'rejected')} className="btn-danger h-9 px-3 text-xs">
                  <AppIcon name="x" className="w-3.5 h-3.5" />
                  {t('companyAdmin.payments.reject')}
                </button>
              </span>
            </li>
          ))}
        </ul>
        )}
      </SectionState>
    </div>
  );
}
