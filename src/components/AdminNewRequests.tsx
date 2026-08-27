import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceRequests } from '../lib/api';
import type { ServiceRequest } from '../lib/api';
import { METRICS } from '../lib/metrics/definitions';
import { relativeTime } from '../lib/relativeTime';
import { AppIcon } from './AppIcon';

/**
 * "Needs action" block at the top of /admin.
 *
 * There is no email or push behind any inbound queue, so the only way an admin
 * learns a request arrived is by looking. ServiceRequestsManager sits below
 * users, listings, places and payments — far enough down that a new request can
 * sit unseen for a day. This surfaces the newest unhandled ones where they
 * cannot be missed, with accept/reject inline so the common case never needs a
 * scroll.
 */

/**
 * Unhandled = awaiting a first response. Sourced from the shared metrics
 * dictionary (METRICS.serviceRequestsUnhandled) — the same definition backs
 * serviceRequests.newCount(), the header badge this block sits under.
 */
const UNHANDLED = new Set<string>(METRICS.serviceRequestsUnhandled.statusFilter);

/** How many to show before deferring to the full manager below. */
const LIMIT = 5;

export function AdminNewRequests() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<ServiceRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await serviceRequests.adminList();
      setRows(all.filter((r) => UNHANDLED.has(r.status)));
      setFailed(false);
    } catch {
      // A queue that failed to load must never be mistaken for an empty queue,
      // so this renders an error rather than falling through to the null case.
      setRows(null);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, status: 'accepted' | 'rejected') => {
    setBusyId(id);
    try {
      await serviceRequests.adminSetStatus(id, status);
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  };

  if (failed) {
    return (
      <div className="card mt-6 border border-brand-red/30 p-4" role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-red">
          <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0" />
          {t('admin.newRequests.error')}
        </p>
        <button onClick={load} className="btn-secondary mt-3 min-h-[44px] px-4 text-sm">
          {t('chat.retry')}
        </button>
      </div>
    );
  }

  // Still loading, or genuinely nothing waiting — render nothing at all rather
  // than an empty card on a quiet day.
  if (!rows || rows.length === 0) return null;

  const shown = rows.slice(0, LIMIT);
  const extra = rows.length - shown.length;

  return (
    <section className="card mt-6 border border-gold/40 p-5" aria-labelledby="admin-new-requests-title">
      <h2 id="admin-new-requests-title" className="flex items-center gap-2 font-bold text-navy">
        <AppIcon name="inbox" className="h-4 w-4 shrink-0 text-gold-dark" />
        {t('admin.newRequests.title', { count: rows.length })}
      </h2>

      <ul className="mt-4 flex flex-col gap-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-xl bg-cream p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold text-navy">{r.name}</span>
              <span className="text-sm text-navy/70">{r.serviceTitle}</span>
              <span className="ms-auto text-xs text-gray-500">
                {relativeTime(r.createdAt, i18n.language)}
              </span>
            </div>

            {r.message && <p className="mt-1 text-xs text-gray-600">“{r.message}”</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* tap-to-call: the phone IS the action on mobile */}
              <a
                href={`tel:${r.phone.replace(/\s/g, '')}`}
                dir="ltr"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-navy underline-offset-2 hover:underline"
                aria-label={t('admin.newRequests.callAria', { name: r.name, phone: r.phone })}
              >
                <AppIcon name="phone" className="h-4 w-4 shrink-0" />
                {r.phone}
              </a>

              {r.serviceId && (
                <a
                  href={`/admin?tab=competitors&service=${r.serviceId}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-navy underline-offset-2 hover:underline"
                >
                  <AppIcon name="search" className="h-4 w-4 shrink-0" />
                  {t('admin.newRequests.competitors')}
                </a>
              )}

              <button
                onClick={() => act(r.id, 'accepted')}
                disabled={busyId === r.id}
                className="btn-primary ms-auto min-h-[44px] px-4 text-sm disabled:opacity-50"
              >
                <AppIcon name="check" className="h-4 w-4 shrink-0" />
                {t('admin.serviceRequests.markReady')}
              </button>
              <button
                onClick={() => act(r.id, 'rejected')}
                disabled={busyId === r.id}
                className="btn-danger min-h-[44px] px-4 text-sm disabled:opacity-50"
              >
                {t('admin.serviceRequests.reject')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {extra > 0 && (
        <a
          href="#service-requests"
          className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-navy underline-offset-2 hover:underline"
        >
          {t('admin.newRequests.more', { count: extra })}
        </a>
      )}
    </section>
  );
}
