import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SITE_URL, DEFAULT_OG_IMAGE } from '../lib/seo';

const SCRIPT_ID = 'ld-localbusiness';

// Real WhatsApp number if one is actually configured (same placeholder guard
// as WhatsAppButton.tsx) — omitted entirely rather than left as a fabricated
// contact number.
const WA = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const WA_CONFIGURED = !!WA && WA !== '905000000000';

/**
 * LocalBusiness JSON-LD — home page only. No visible output; renders nothing.
 * Only includes fields backed by real site data (name, url, image, address,
 * languages, and telephone if actually configured) — no invented ratings,
 * reviews, or price range.
 */
export function LocalBusinessSchema() {
  const { t } = useTranslation();

  useEffect(() => {
    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: t('common.appName'),
      alternateName: ['Rafiq Istanbul', 'رفيق إسطنبول', 'Рафик Стамбул', 'رفیق استانبول'],
      description: t('common.tagline'),
      url: SITE_URL,
      image: DEFAULT_OG_IMAGE,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'İstanbul',
        addressCountry: 'TR',
      },
      availableLanguage: ['Arabic', 'English', 'Russian', 'Persian'],
    };
    if (WA_CONFIGURED) data.telephone = `+${WA}`;

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [t]);

  return null;
}
