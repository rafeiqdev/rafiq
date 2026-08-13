import { useTranslation } from 'react-i18next';
import { adminAuditLog } from '../../lib/api';
import { AppIcon } from '../AppIcon';
import { SectionState } from '../SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';

/** Read-only view of admin_audit_log — who did what, when. See migration 20260813_admin_audit_log.sql. */
export function AdminAuditLog() {
  const { t, i18n } = useTranslation();
  const section = useAsyncSection(() => adminAuditLog.list(100), []);

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy flex items-center gap-2">
        <AppIcon name="shield-check" className="w-4 h-4" />
        {t('admin.auditLog.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-500">{t('admin.auditLog.body')}</p>

      <SectionState
        section={section}
        title={t('admin.auditLog.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('admin.auditLog.empty')}</p>}
      >
        {(rows) => (
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map((entry) => (
              <li key={entry.id} className="rounded-xl bg-cream px-4 py-2.5 text-sm flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy">{entry.actorName ?? t('admin.auditLog.unknownActor')}</span>
                <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-[11px] font-bold text-navy">
                  {entry.action}
                </span>
                <span className="text-xs text-navy/60" dir="ltr">
                  {entry.targetType}{entry.targetId ? `:${entry.targetId.slice(0, 8)}` : ''}
                </span>
                <span className="ms-auto text-xs text-gray-500">
                  {new Date(entry.createdAt).toLocaleString(i18n.language)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionState>
    </div>
  );
}
