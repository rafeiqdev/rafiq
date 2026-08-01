import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Listing } from '../../lib/types';
import { useApp } from '../../context/AppContext';
import { leads } from '../../lib/api';
import { AppIcon, type IconName } from '../AppIcon';
import { useState } from 'react';

/**
 * The four Rafiq services offered on a listing. Each one files a lead tagged
 * with the service key AND the listing, so the admin sees *which* property the
 * customer wants a viewing / contract / lawyer for — a bare "realestate" lead
 * used to arrive without that context and had to be chased by phone.
 */
export const LISTING_SERVICES = [
  { key: 'viewing', icon: 'car' },
  { key: 'contracts', icon: 'file-text' },
  { key: 'legal', icon: 'shield-check' },
  { key: 'citizenship', icon: 'id-card' },
] as const;

export type ListingServiceKey = (typeof LISTING_SERVICES)[number]['key'];

export function useListingService(listing: Listing | null) {
  const { user } = useApp();
  const navigate = useNavigate();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const request = async (key: string) => {
    if (!listing) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    setBusy(key);
    try {
      await leads.create('realestate', `[${key}] ${listing.district} ${listing.rooms} · $${listing.priceUsd.toLocaleString()} · #${listing.id}`);
      setSent((s) => ({ ...s, [key]: true }));
    } catch {
      // A failed lead must not look like a success — leave the row untouched
      // so the customer can retry rather than believing we got the request.
    } finally {
      setBusy(null);
    }
  };

  return { sent, busy, request };
}

export function ServiceRow({
  serviceKey,
  icon,
  sent,
  busy,
  onClick,
}: {
  serviceKey: string;
  icon: IconName;
  sent: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sent || busy}
      className="w-full flex items-center gap-3 rounded-card border-2 border-cream-dark bg-white p-3 text-start transition-colors hover:border-navy hover:bg-navy-50 disabled:opacity-60"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-btn bg-navy-50 shrink-0">
        <AppIcon name={sent ? 'check' : icon} className="w-4 h-4 text-navy" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-navy">{t(`realEstate.service.${serviceKey}.title`)}</span>
        <span className="block text-xs text-gray-500">
          {sent ? t('realEstate.requested') : t(`realEstate.service.${serviceKey}.body`)}
        </span>
      </span>
      <AppIcon name="arrow-right" className="w-4 h-4 text-navy/30 dir-arrow shrink-0" />
    </button>
  );
}

/** Legal footing shown next to every request button. */
export function ListingTrustNote() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 rounded-card bg-brand-blue px-4 py-3 text-xs text-navy">
      <AppIcon name="lock" className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{t('realEstate.trustNote')}</span>
    </div>
  );
}
