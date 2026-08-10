import { useTranslation } from 'react-i18next';
import { pickText } from '../data/services';
import type { GovFeeItem } from '../data/services';
import { AppIcon } from './AppIcon';

/**
 * Itemizes a service's official government taxes/fees separately from
 * Rafiq's own consultation fee, so users can see there's no markup hidden
 * inside a single bundled "price". Only rendered when the service actually
 * has `governmentFees` (src/data/services.ts) — no fixed amounts, since
 * harç/insurance rates change yearly and by nationality/age.
 */
export function TransparentFeeBreakdown({ fees, lang }: { fees: GovFeeItem[]; lang: string }) {
  const { t } = useTranslation();

  return (
    <div className="esc-fee-breakdown">
      <h4 className="esc-fee-heading">
        <AppIcon name="shield-check" className="w-3.5 h-3.5" />
        {t('services.feeBreakdown.title')}
      </h4>

      <div className="esc-fee-group">
        <span className="esc-fee-group-label">{t('services.feeBreakdown.govSectionTitle')}</span>
        <ul className="esc-fee-list">
          {fees.map((fee, i) => (
            <li key={i}>{pickText(fee.label, lang)}</li>
          ))}
        </ul>
        <p className="esc-fee-note">{t('services.feeBreakdown.govSectionNote')}</p>
      </div>

      <div className="esc-fee-group">
        <span className="esc-fee-group-label">{t('services.feeBreakdown.platformSectionTitle')}</span>
        <ul className="esc-fee-list">
          <li>{t('services.feeBreakdown.platformFeeLabel')}</li>
        </ul>
      </div>

      <p className="esc-fee-assurance">
        <AppIcon name="check-circle" className="w-3.5 h-3.5" />
        {t('services.feeBreakdown.assurance')}
      </p>
    </div>
  );
}
