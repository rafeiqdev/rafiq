import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SITE_URL, DEFAULT_OG_IMAGE, SEO_LANGS } from '../lib/seo';
import type { Lang } from '../lib/types';

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
  const { t, i18n } = useTranslation();
  // This component only ever mounts on Home, which is reachable under all
  // four language segments — the search target must follow suit instead of
  // always pointing at /ar/services, or every non-Arabic page would tell
  // search engines its site search is Arabic-only.
  const lang = (SEO_LANGS as string[]).includes(i18n.language) ? (i18n.language as Lang) : 'ar';

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
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${SITE_URL}/${lang}/services?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
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
  }, [t, lang]);

  return null;
}
