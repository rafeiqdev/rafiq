import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { bookings, customerRequests, leads } from '../lib/api';
import type { Booking, CustomerRequest, Lead } from '../lib/types';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { shortSummary } from '../lib/bookingSummary';
import type { AsyncSection } from '../hooks/useAsyncSection';
import { AppIcon } from './AppIcon';
import { RequestStatusPill } from './RequestStatusPill';

/**
 * "What is happening with my case" — the customer's single activity list.
 *
 * It used to merge bookings + leads ONLY, so a service_request could never
 * appear in it no matter its status: three parallel tables, two of them read.
 * A customer with a live request was told "nothing yet" on the very card that
 * sits four lines above the link to the page proving otherwise.
 *
 * Worse, both sources were `useState([])` with `.catch(() => {})`, so the card
 * asserted emptiness on first paint before any fetch resolved, and again if
 * every fetch failed. Now:
 *
 *   - three INDEPENDENT sections; one failing never blanks the other two
 *   - a failed source shows its own error row with a retry, naming itself
 *   - the empty state renders ONLY when all three succeeded with zero rows
 *
 * One component for desktop and mobile so the two cannot drift, as with
 * MobileTabBar and RequestStatusPill.
 */

type Item =
  | { kind: 'booking'; id: string; createdAt: string; data: Booking }
  | { kind: 'lead'; id: string; createdAt: string; data: Lead }
  | { kind: 'request'; id: string; createdAt: string; data: CustomerRequest };

const PREVIEW = 2;

/** One failed source, named, with a retry that refetches only that source. */
function SourceError({ label, onRetry, compact }: { label: string; onRetry: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mt-3 rounded-xl border border-brand-red/30 px-3.5 py-3">
      <p className={`flex items-start gap-2 font-semibold text-brand-red ${compact ? 'text-[13px]' : 'text-sm'}`}>
        <AppIcon name="alert-triangle" className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          {label} — {t('common.error')}
        </span>
      </p>
      <button onClick={onRetry} className="btn-secondary mt-2 min-h-[44px] px-4 text-xs">
        {t('chat.retry')}
      </button>
    </div>
  );
}

export function ActivityCard({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const bookingsSec = useAsyncSection<Booking[]>(() => bookings.mine(), []);
  const leadsSec = useAsyncSection<Lead[]>(() => leads.mine(), []);
  const requestsSec = useAsyncSection<CustomerRequest[]>(() => customerRequests.allMine(), []);

  const sections: { sec: AsyncSection<unknown[]>; label: string }[] = [
    { sec: bookingsSec as AsyncSection<unknown[]>, label: t('admin.users.bookings') },
    { sec: leadsSec as AsyncSection<unknown[]>, label: t('admin.users.leads') },
    { sec: requestsSec as AsyncSection<unknown[]>, label: t('nav.myRequests') },
  ];

  const items: Item[] = [
    ...(bookingsSec.status === 'ready' ? (bookingsSec.data ?? []) : []).map(
      (b): Item => ({ kind: 'booking', id: b.id, createdAt: b.createdAt, data: b }),
    ),
    ...(leadsSec.status === 'ready' ? (leadsSec.data ?? []) : []).map(
      (l): Item => ({ kind: 'lead', id: l.id, createdAt: l.createdAt, data: l }),
    ),
    ...(requestsSec.status === 'ready' ? (requestsSec.data ?? []) : []).map(
      (r): Item => ({ kind: 'request', id: r.id, createdAt: r.createdAt, data: r }),
    ),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const failed = sections.filter((s) => s.sec.status === 'error');
  const anyLoading = sections.some((s) => s.sec.status === 'loading');
  const allReady = sections.every((s) => s.sec.status === 'ready');
  const visible = showAll ? items : items.slice(0, PREVIEW);

  const row = compact
    ? 'flex items-center gap-3 rounded-btn border border-cream-dark bg-cream px-3.5 py-3'
    : 'flex items-center gap-3 rounded-xl bg-cream px-4 py-3 text-sm';
  const title = compact
    ? 'min-w-0 flex-1 text-[13px] font-semibold leading-snug text-navy break-anywhere'
    : 'font-semibold text-navy flex-1 min-w-0 break-anywhere';
  const icon = compact ? 'h-[18px] w-[18px] shrink-0 text-navy/60' : 'w-4 h-4 shrink-0 text-navy/70';

  return (
    <>
      {/* Every failed source names itself and retries alone. */}
      {failed.map((s) => (
        <SourceError key={s.label} label={s.label} onRetry={s.sec.reload} compact={compact} />
      ))}

      {anyLoading && items.length === 0 && failed.length === 0 && (
        <p className={`mt-3 text-gray-500 ${compact ? 'text-[13px]' : 'text-sm'}`} aria-busy="true">
          {t('common.loading')}
        </p>
      )}

      {/* "Nothing yet" is only true when all three answered and all three were
          empty. Anything less is an unfinished or broken question. */}
      {allReady && items.length === 0 && (
        <p className={`mt-3 text-gray-500 ${compact ? 'text-[13px]' : 'text-sm'}`}>{t('profile.pipeline.empty')}</p>
      )}

      {items.length > 0 && (
        <>
          <ul className={compact ? 'mt-3.5 flex flex-col gap-2.5' : 'mt-3 flex flex-col gap-2'}>
            {visible.map((it) => {
              if (it.kind === 'booking') {
                return (
                  <li key={`b-${it.id}`} className={row}>
                    <AppIcon name="calendar" className={icon} />
                    <span className={title}>{shortSummary(it.data.problemSummary)}</span>
                    <span className="shrink-0 rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-navy">
                      {t(`adminBookings.statuses.${it.data.status}`)}
                    </span>
                  </li>
                );
              }
              if (it.kind === 'lead') {
                return (
                  <li key={`l-${it.id}`} className={row}>
                    <AppIcon name="mail" className={icon} />
                    <span className={title}>
                      {t(`leads.kind.${it.data.kind}`)} — {it.data.item}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {new Date(it.createdAt).toLocaleDateString(i18n.language)}
                    </span>
                  </li>
                );
              }
              // A service request — the row this card could never show before.
              return (
                <li key={`r-${it.id}`} className={row}>
                  <AppIcon name="inbox" className={icon} />
                  <Link to="/requests" className={`${title} hover:underline`}>
                    {it.data.serviceTitle}
                  </Link>
                  <RequestStatusPill status={it.data.status} className="shrink-0" />
                </li>
              );
            })}
          </ul>
          {!showAll && items.length > PREVIEW && (
            <button
              onClick={() => setShowAll(true)}
              className={compact ? 'btn btn-secondary mt-3 min-h-[48px] w-full text-[13.5px]' : 'btn-secondary w-full mt-3 text-sm'}
            >
              {t('common.viewAll')} ({items.length - PREVIEW}+)
            </button>
          )}
        </>
      )}
    </>
  );
}
