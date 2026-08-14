import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SITE_URL, DEFAULT_OG_IMAGE } from '../lib/seo';

const SCRIPT_ID = 'ld-organization';

// The configured WhatsApp contact number is used only as a customer-service
// contact point. It does not imply an in-person office or LocalBusiness.
const WA = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const WA_CONFIGURED = !!WA && WA !== '905000000000';

/**
 * Organization + WebSite JSON-LD for the public home page.
 *
 * Rafiq is a digital platform, not a walk-in or service-area local business.
 * The markup therefore avoids LocalBusiness, a physical address, operating
 * hours, ratings, and any other information the site cannot substantiate.
 */
export function LocalBusinessSchema() {
  const { t } = useTranslation();

  useEffect(() => {
    const organization: Record<string, unknown> = {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Rafiq Istanbul',
      alternateName: ['Rafiq', 'رفيق إسطنبول', 'Рафик Стамбул', 'رفیق استانبول'],
      description: t('common.tagline'),
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      image: DEFAULT_OG_IMAGE,
      availableLanguage: ['Arabic', 'English', 'Russian', 'Persian'],
    };

    if (WA_CONFIGURED) {
      organization.contactPoint = {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: `+${WA}`,
        availableLanguage: ['Arabic', 'English', 'Russian', 'Persian'],
      };
    }

    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        organization,
        {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          url: SITE_URL,
          name: 'Rafiq Istanbul',
          alternateName: ['Rafiq', 'رفيق إسطنبول'],
          publisher: { '@id': `${SITE_URL}/#organization` },
          inLanguage: ['ar', 'en', 'ru', 'fa'],
        },
      ],
    };

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
