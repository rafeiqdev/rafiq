import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminBroadcast } from '../lib/api';
import { SERVICE_CATEGORIES, pickText } from '../data/services';
import { pickArea } from '../data/istanbulAreas';
import { AppIcon } from './AppIcon';

type Req = Awaited<ReturnType<typeof adminBroadcast.requests>>[number];
type Resp = Awaited<ReturnType<typeof adminBroadcast.responses>>[number];

/** Admin overview: broadcast customer requests + the offers companies sent. */
export function AdminBroadcastManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [requests, setRequests] = useState<Req[]>([]);
  const [responses, setResponses] = useState<Resp[]>([]);

  useEffect(() => {
    adminBroadcast.requests().then(setRequests).catch(() => {});
    adminBroadcast.responses().then(setResponses).catch(() => {});
  }, []);

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy">{t('companyAdmin.broadcast.title')}</h2>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-navy/40">{t('companyAdmin.broadcast.requestsTitle')}</h3>
      {requests.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{t('companyAdmin.broadcast.requestsEmpty')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {requests.map((r) => {
            const cat = SERVICE_CATEGORIES.find((c) => c.id === r.category);
            return (
              <li key={r.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-2.5 text-sm">
                <span className="font-semibold text-navy">{r.serviceTitle}</span>
                {cat && <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-[10px] font-bold text-navy">{pickText(cat.title, lang)}</span>}
                {r.area && <span className="text-xs text-navy/60 inline-flex items-center gap-1"><AppIcon name="map-pin" className="w-3 h-3" />{pickArea(r.area, lang)}</span>}
                <span className="ms-auto text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString(i18n.language)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-navy/40">{t('companyAdmin.broadcast.responsesTitle')}</h3>
      {responses.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{t('companyAdmin.broadcast.responsesEmpty')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {responses.map((r) => (
            <li key={r.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-2.5 text-sm">
              <span className="font-semibold text-navy">{r.companyName || '—'}</span>
              <span className="text-xs text-navy/60">→ {r.serviceTitle}</span>
              {r.quote != null && <span className="text-xs font-bold text-navy" dir="ltr">{t('companyAdmin.broadcast.quote')}: {r.quote.toLocaleString()} {t('common.tl')}</span>}
              {r.chosen && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
                  <AppIcon name="check-circle" className="w-3.5 h-3.5" />
                  {t('companyAdmin.broadcast.chosen')}
                </span>
              )}
              <span className="ms-auto text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString(i18n.language)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
