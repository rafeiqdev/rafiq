import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceRequests } from '../lib/api';
import type { ServiceRequest } from '../lib/api';
import { AppIcon } from './AppIcon';

/** Admin panel section: incoming "Request service" submissions from /services. */
export function ServiceRequestsManager() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<ServiceRequest[]>([]);

  const load = () => serviceRequests.adminList().then(setRows).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: 'accepted' | 'done' | 'rejected') => {
    await serviceRequests.adminSetStatus(id, status);
    await load();
  };

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy">{t('admin.serviceRequests.title')}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{t('admin.serviceRequests.empty')}</p>
      ) : (
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
              <span className="text-xs text-navy/70 inline-flex items-center gap-1">
                <AppIcon name="user" className="w-3.5 h-3.5" />
                {r.name}
              </span>
              <a href={`tel:${r.phone}`} dir="ltr" className="text-xs text-navy underline inline-flex items-center gap-1">
                <AppIcon name="message-circle" className="w-3.5 h-3.5" />
                {r.phone}
              </a>
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
                {r.status !== 'accepted' && r.status !== 'done' && (
                  <button onClick={() => setStatus(r.id, 'accepted')} className="btn-primary !h-8 px-3 text-xs">
                    <AppIcon name="check" className="w-3.5 h-3.5" />
                    {t('admin.serviceRequests.markReady')}
                  </button>
                )}
                {r.status === 'accepted' && (
                  <button onClick={() => setStatus(r.id, 'done')} className="btn-secondary !h-8 px-3 text-xs">
                    {t('admin.serviceRequests.markDone')}
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button onClick={() => setStatus(r.id, 'rejected')} className="btn-danger !h-8 px-3 text-xs">
                    {t('admin.serviceRequests.reject')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
