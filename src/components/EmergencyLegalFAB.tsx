import { Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { track } from '../lib/analytics';
import { ContactBanner } from './ContactBanner';

/** Sits alongside WhatsAppButton's inline variant at the end of the page —
 *  same card shape (ContactBanner), red theme, legal-emergency copy. */
const NUMBER = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const CONFIGURED = !!NUMBER && NUMBER !== '905000000000';

export function EmergencyLegalFAB() {
  const { t } = useTranslation();
  if (!CONFIGURED) return null;
  const text = encodeURIComponent(t('emergencyLegal.message'));
  const href = `https://wa.me/${NUMBER}?text=${text}`;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <ContactBanner
        icon={<Scale className="w-4 h-4 text-white animate-pulse" />}
        title={t('emergencyLegal.title')}
        subtitle={t('emergencyLegal.subtitle')}
        cta={t('emergencyLegal.cta')}
        href={href}
        ariaLabel={t('emergencyLegal.aria')}
        onClick={() => track('whatsapp_clicked', { target: 'emergency_legal_bar' })}
        gradient="bg-gradient-to-r from-red-700 via-red-600 to-red-700"
        border="border-red-500/40"
        ctaTextColor="text-red-700"
      />
    </div>
  );
}
