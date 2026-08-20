import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { bookings, customerRequests, leads } from '../../lib/api';
import type { Booking, CustomerRequest, Lead } from '../../lib/types';
import { LANGS } from '../../lib/types';
import { mergeRequests } from '../../lib/myRequests';
import type { UnifiedRequest } from '../../lib/myRequests';
import { pickArea } from '../../data/istanbulAreas';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import type { AsyncSection } from '../../hooks/useAsyncSection';
import { track } from '../../lib/analytics';
import { AppIcon, type IconName } from '../AppIcon';
import { RequestStatusPill } from '../RequestStatusPill';
import { SourceError } from '../SourceError';
import { OrderTracking } from '@/components/ui/order-tracking';
import { RequestOffersPanel } from './RequestOffersPanel';

/**
 * THE WHOLE REQUEST CYCLE, ON ONE PAGE.
 *
 * A request is born in three unrelated places and lands in three unrelated
 * tables — a service form writes `service_requests`, the assistant's handoff
 * writes `bookings`, a property enquiry writes `leads` — and "طلباتي" read
 * exactly one of them. So a customer who booked a call with the assistant, or
 * asked for a viewing on a listing, opened the page built to prove we had heard
 * them and was told they had never made a request.
 *
 * The three sources load INDEPENDENTLY, on purpose:
 *
 *   - one failing never blanks the other two
 *   - a failed source names itself and retries alone
 *   - "you have no requests" renders ONLY when all three answered and all three
 *     were empty — an error is never an empty list
 *
 * One component for desktop and mobile (`compact`), like ActivityCard and
 * RequestStatusPill, so the two can no longer drift apart.
 */

const KIND_ICON: Record<UnifiedRequest['kind'], IconName> = {
  service: 'inbox',
  ai: 'sparkles',
  realestate: 'building',
  health: 'stethoscope',
};

// Admin WhatsApp number (international, no "+"). Same placeholder guard as
// ServiceRequestModal / WhatsAppButton — the escalation link only renders once
// a real number is configured.
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

/** Ordered steps of the customer-visible timeline. 'rejected' has no place on a
 *  forward-moving line, so it is handled separately by the caller. */
const TIMELINE_STEPS = ['pending', 'accepted', 'done'] as const;

/**
 * Reassurance banner for a request still awaiting resolution: a live status
 * timeline, the response-time guarantee, and a 1-click WhatsApp escalation
 * pre-filled with this request's reference so the admin can find it instantly.
 *
 * Only shown for pending/accepted — a done or rejected request has nothing left
 * to be reassured about.
 */
function ReassuranceBanner({ req }: { req: UnifiedRequest }) {
  const { t, i18n } = useTranslation();
  const stepIndex = TIMELINE_STEPS.indexOf(req.status as (typeof TIMELINE_STEPS)[number]);
  if (stepIndex < 0 || stepIndex === TIMELINE_STEPS.length - 1) return null;

  // The reference, not the raw uuid: it is what the customer can read out and
  // what the admin can search for.
  const waMessage = t('requests.reassurance.waMessage', { id: req.reference, service: req.title });
  const waHref = WA_ENABLED ? `https://wa.me/${WA}?text=${encodeURIComponent(waMessage)}` : null;

  const trackingSteps = TIMELINE_STEPS.map((step, i) => ({
    name: t(`requests.reassurance.timeline.${step}`),
    timestamp: i === 0 ? new Date(req.createdAt).toLocaleDateString(i18n.language) : '',
    isCompleted: i <= stepIndex,
  }));

  return (
    // Owns its own outer spacing: a card must not reserve padding for a banner
    // that a done/rejected request never renders.
    <div className="mx-4 mb-3.5 rounded-xl border border-navy/10 bg-brand-blue/30 p-3">
      <OrderTracking steps={trackingSteps} aria-label={t('requests.title')} />

      <div className="mt-1 flex items-center justify-between gap-2 flex-wrap border-t border-navy/10 pt-3">
        <p className="text-xs font-bold text-navy inline-flex items-center gap-1.5">
          <AppIcon name="clock" className="w-3.5 h-3.5 shrink-0" />
          {t('requests.reassurance.sla')}
        </p>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              track('whatsapp_clicked', { target: 'requests_escalation', meta: { request_id: req.id } })
            }
            className="btn-secondary !h-8 px-3 text-xs"
          >
            <AppIcon name="message-circle" className="w-3.5 h-3.5" />
            {t('requests.reassurance.escalate')}
          </a>
        )}
      </div>
    </div>
  );
}

/** One labelled fact in the expanded details block. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[11.5px] font-bold text-navy/50">{label}</span>
      <span className="min-w-0 break-anywhere text-[13px] text-navy">{children}</span>
    </div>
  );
}

/**
 * Where a customer goes to read what happened next. Every status change on a
 * request raises a notification (see 20260728_event_notifications.sql), and
 * until now nothing on this page said so — the updates existed and were never
 * pointed at.
 */
function NotificationsLink({ req }: { req: UnifiedRequest }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/notifications?tab=updates&ref=${encodeURIComponent(req.reference)}`}
      className="btn-secondary mt-3 flex min-h-[44px] w-full text-[13.5px]"
    >
      <AppIcon name="bell" className="h-4 w-4 shrink-0" />
      {t('requests.notificationsLink')}
    </Link>
  );
}

/** The kind-specific body of an expanded row. */
function RequestDetails({ req, compact }: { req: UnifiedRequest; compact: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  if (req.kind === 'service') {
    return (
      <>
        <RequestOffersPanel req={req.service} compact={compact} />
        <NotificationsLink req={req} />
      </>
    );
  }

  if (req.kind === 'ai') {
    const b = req.booking;
    const media = b.media ?? [];
    return (
      <>
        <div className="flex flex-col gap-2">
          <DetailRow label={t('requests.details.summary')}>{req.title}</DetailRow>
          <DetailRow label={t('requests.details.appointment')}>
            {new Date(b.preferredDatetime).toLocaleString(lang)}
          </DetailRow>
          <DetailRow label={t('requests.details.language')}>
            {LANGS.find((l) => l.code === b.preferredLanguage)?.native ?? b.preferredLanguage}
          </DetailRow>
          {media.length > 0 && (
            <DetailRow label={t('requests.details.attachments')}>{media.length}</DetailRow>
          )}
        </div>
        <NotificationsLink req={req} />
      </>
    );
  }

  // A property / health-tourism enquiry. `serviceKey` is the `[viewing]`-style
  // tag ListingServices writes; plain older leads simply have none.
  return (
    <>
      <div className="flex flex-col gap-2">
        {req.serviceKey && (
          <DetailRow label={t('requests.details.service')}>
            {t(`realEstate.service.${req.serviceKey}.title`, { defaultValue: req.serviceKey })}
          </DetailRow>
        )}
        <DetailRow label={t('requests.details.item')}>{req.itemText || t('requests.details.none')}</DetailRow>
      </div>
      <NotificationsLink req={req} />
    </>
  );
}

function RequestCard({ req, compact }: { req: UnifiedRequest; compact: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const area = req.kind === 'service' ? req.service.area : null;

  return (
    <li className="card animate-fade-up overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3.5 text-start transition-colors active:bg-cream"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-cream text-navy/60">
          <AppIcon name={KIND_ICON[req.kind]} className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-extrabold leading-snug text-navy ${compact ? 'text-[14.5px]' : 'text-[15px]'}`}>
            {req.title || t(`requests.kind.${req.kind}`)}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-navy/55">
            {/* The reference is the point of this row: it is what a customer
                quotes on WhatsApp and what the admin searches for. Always LTR,
                in all four locales. */}
            <span dir="ltr" className="font-bold tracking-wide text-navy/70">
              {req.reference}
            </span>
            <span aria-hidden>·</span>
            <span>{t(`requests.kind.${req.kind}`)}</span>
            {area && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="map-pin" className="h-3 w-3 shrink-0" />
                  {pickArea(area, lang)}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{new Date(req.createdAt).toLocaleDateString(lang)}</span>
          </span>
        </span>
        <AppIcon
          name="chevron-down"
          className={`h-4 w-4 shrink-0 text-navy/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        {/* What the admin did with it — the only signal the customer gets that
            anyone has looked at their request. */}
        <RequestStatusPill status={req.status} className="shrink-0" />
      </button>

      <div className="px-4 pb-3.5">
        <ReassuranceBanner req={req} />
      </div>

      {open && (
        <div className="border-t border-cream-dark p-4">
          <RequestDetails req={req} compact={compact} />
        </div>
      )}
    </li>
  );
}

/**
 * The merged list plus its three loading/error/empty states.
 *
 * `empty` and `loading` are passed in because the desktop and the phone frame
 * them differently, but WHEN each is shown is decided here — that decision is
 * the part that must not drift.
 */
export function RequestsFeed({
  compact = false,
  loading,
  empty,
}: {
  compact?: boolean;
  loading: React.ReactNode;
  empty: React.ReactNode;
}) {
  const { t } = useTranslation();

  const servicesSec = useAsyncSection<CustomerRequest[]>(() => customerRequests.allMine(), []);
  const aiSec = useAsyncSection<Booking[]>(() => bookings.mine(), []);
  const leadsSec = useAsyncSection<Lead[]>(() => leads.mine(), []);

  const sources: { sec: AsyncSection<unknown[]>; label: string }[] = [
    { sec: servicesSec as AsyncSection<unknown[]>, label: t('requests.kind.service') },
    { sec: aiSec as AsyncSection<unknown[]>, label: t('requests.kind.ai') },
    { sec: leadsSec as AsyncSection<unknown[]>, label: t('requests.kind.realestate') },
  ];

  const items = mergeRequests({
    services: servicesSec.status === 'ready' ? servicesSec.data : [],
    bookings: aiSec.status === 'ready' ? aiSec.data : [],
    leads: leadsSec.status === 'ready' ? leadsSec.data : [],
  });

  const failed = sources.filter((s) => s.sec.status === 'error');
  const anyLoading = sources.some((s) => s.sec.status === 'loading');
  const allReady = sources.every((s) => s.sec.status === 'ready');

  return (
    <>
      {/* Every failed source names itself and retries alone. */}
      {failed.map((s) => (
        <SourceError key={s.label} label={s.label} onRetry={s.sec.reload} compact={compact} />
      ))}

      {anyLoading && items.length === 0 && failed.length === 0 && <>{loading}</>}

      {/* "No requests yet" is only true when all three answered and all three
          were empty. Anything less is an unfinished or a broken question. */}
      {allReady && items.length === 0 && <>{empty}</>}

      {items.length > 0 && (
        <ul className="stagger mt-6 flex flex-col gap-3.5">
          {items.map((req) => (
            <RequestCard key={`${req.kind}-${req.id}`} req={req} compact={compact} />
          ))}
        </ul>
      )}
    </>
  );
}
