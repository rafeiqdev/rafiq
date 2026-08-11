import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { pickText } from '../data/services';
import type { GovFeeItem } from '../data/services';
import { AppIcon } from './AppIcon';

export function TransparentFeeBreakdown({ fees, lang }: { fees: GovFeeItem[]; lang: string }) {
  const { t } = useTranslation();

  return (
    <motion.div 
      className="esc-fee-breakdown"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
    >
      <h4 className="esc-fee-heading">
        <AppIcon name="shield-check" className="w-3.5 h-3.5" />
        {t('services.feeBreakdown.title')}
      </h4>

      <div className="esc-fee-group">
        <span className="esc-fee-group-label">{t('services.feeBreakdown.govSectionTitle')}</span>
        <ul className="esc-fee-list">
          {fees.map((fee, i) => (
            <motion.li 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
            >
              {pickText(fee.label, lang)}
            </motion.li>
          ))}
        </ul>
        <p className="esc-fee-note">{t('services.feeBreakdown.govSectionNote')}</p>
      </div>

      <div className="esc-fee-group">
        <span className="esc-fee-group-label">{t('services.feeBreakdown.platformSectionTitle')}</span>
        <ul className="esc-fee-list">
          <motion.li
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + fees.length * 0.05, duration: 0.3 }}
          >
            {t('services.feeBreakdown.platformFeeLabel')}
          </motion.li>
        </ul>
      </div>

      <p className="esc-fee-assurance">
        <AppIcon name="check-circle" className="w-3.5 h-3.5" />
        {t('services.feeBreakdown.assurance')}
      </p>
    </motion.div>
  );
}
