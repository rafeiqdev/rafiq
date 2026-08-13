import { Scale, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { track } from '../lib/analytics';
import { motion } from 'framer-motion';

/** Mobile-only full-width sticky bottom bar for urgent legal help.
 *  Displays horizontal banner across the width of mobile viewports. */
const NUMBER = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const CONFIGURED = !!NUMBER && NUMBER !== '905000000000';

export function EmergencyLegalFAB() {
  const { t, i18n } = useTranslation();
  if (!CONFIGURED) return null;
  const text = encodeURIComponent(t('emergencyLegal.message'));
  const href = `https://wa.me/${NUMBER}?text=${text}`;
  const isRtl = i18n.dir() === 'rtl';

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 my-4 pb-20 md:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
        className="w-full bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md border border-red-500/40 flex flex-row items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold leading-tight truncate">
              {t('emergencyLegal.title')}
            </p>
            <p className="text-[10px] sm:text-xs text-red-100/90 leading-tight truncate">
              {t('emergencyLegal.subtitle')}
            </p>
          </div>
        </div>

        <motion.a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={t('emergencyLegal.aria')}
          onClick={() => track('whatsapp_clicked', { target: 'emergency_legal_bar' })}
          className="shrink-0 bg-white text-red-700 hover:bg-cream font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-colors whitespace-nowrap"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
        >
          <span>{t('emergencyLegal.cta')}</span>
          {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
        </motion.a>
      </motion.div>
    </div>
  );
}
