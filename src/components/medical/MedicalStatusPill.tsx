import { useTranslation } from 'react-i18next';
import type { MedicalRequestStatus } from '../../lib/types';

const TONE: Record<MedicalRequestStatus, string> = {
  pending_review: 'bg-gold-soft text-gold-dark',
  under_review: 'bg-gold-soft text-gold-dark',
  collecting_offers: 'bg-brand-blue text-navy',
  offers_available: 'bg-green-100 text-green-800',
  awaiting_payment: 'bg-brand-blue text-navy',
  paid: 'bg-green-100 text-green-800',
  booked: 'bg-green-100 text-green-800',
  cancelled: 'bg-brand-red/10 text-brand-red',
};

export function MedicalStatusPill({ status, className = '' }: { status: MedicalRequestStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${TONE[status] ?? TONE.pending_review} ${className}`}>
      {t(`medical.status.${status}`)}
    </span>
  );
}
