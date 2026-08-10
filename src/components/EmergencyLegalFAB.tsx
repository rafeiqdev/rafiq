import { Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { track } from '../lib/analytics';

/** Mobile-only floating action button for urgent legal help. Reads
 *  VITE_WHATSAPP_NUMBER (digits only, same guard as WhatsAppButton.tsx) and
 *  opens WhatsApp with a pre-filled urgent-assistance message. */
const NUMBER = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const CONFIGURED = !!NUMBER && NUMBER !== '905000000000';

export function EmergencyLegalFAB() {
  const { t } = useTranslation();
  if (!CONFIGURED) return null;
  const text = encodeURIComponent(t('emergencyLegal.message'));
  const href = `https://wa.me/${NUMBER}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={t('emergencyLegal.aria')}
      onClick={() => track('whatsapp_clicked', { target: 'emergency_legal_fab' })}
      className="fixed bottom-20 end-4 z-50 w-14 h-14 rounded-full bg-red-600 text-white shadow-xl flex items-center justify-center animate-bounce md:hidden"
    >
      <Scale className="w-7 h-7" aria-hidden />
    </a>
  );
}
