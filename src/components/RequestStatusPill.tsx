import { useTranslation } from 'react-i18next';

/**
 * The customer-facing status of a service request.
 *
 * Until now `status` was fetched, mapped onto CustomerRequest and then never
 * rendered anywhere, and serviceRequests.status() had no callers at all — so an
 * admin marking a request Ready or Done changed nothing the customer could see,
 * on any screen in the product. The workflow existed only inside /admin.
 *
 * Copy reuses admin.serviceRequests.status.*, which already reads as plain
 * customer language in all four locales (Pending / Ready / Done / Closed —
 * قيد الانتظار / جاهز / منجز / مغلق). The keys live under `admin.` for
 * historical reasons only; sharing them keeps the two sides of the workflow
 * describing a request with the same word, which is worth more than a tidier
 * namespace. No locale file is touched.
 *
 * 'new' and 'pending' are the same state to a customer — 'new' is what rows
 * created before the status workflow use — so both render as Pending, exactly
 * as ServiceRequestsManager and AdminNewRequests already treat them.
 */
const TONE: Record<string, string> = {
  accepted: 'bg-green-100 text-green-800',
  done: 'bg-brand-blue text-navy',
  rejected: 'bg-brand-red/10 text-brand-red',
  pending: 'bg-gold-soft text-gold-dark',
};

export function RequestStatusPill({ status, className = '' }: { status: string; className?: string }) {
  const { t } = useTranslation();
  const key = status === 'new' ? 'pending' : status;
  const tone = TONE[key] ?? TONE.pending;

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${tone} ${className}`}>
      {t(`admin.serviceRequests.status.${key}`)}
    </span>
  );
}
