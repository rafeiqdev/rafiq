import { SITE_URL, DEFAULT_OG_IMAGE } from './seo';
import { CONTACT_EMAIL, HAS_EMAIL, HAS_OFFICE_ADDRESS, HAS_WHATSAPP, OFFICE_ADDRESS, WHATSAPP_E164 } from './contact';

/**
 * The Organization node, in one place.
 *
 * It used to be written out twice — inline in LocalBusinessSchema.tsx (Home
 * only) and again in scripts/generate-seo-pages.mjs — and adding /about and
 * /contact would have made it four copies. The JS side now builds it here; the
 * build script keeps its own copy because it is a plain .mjs with no TypeScript
 * pipeline, and its header comment points back at this file.
 *
 * Rafiq is a coordination service, not a walk-in business: there are no public
 * premises, so this stays `Organization` rather than `LocalBusiness` unless a
 * real address is configured. `LocalBusiness` without a `PostalAddress` is
 * invalid markup and, worse, an implicit claim of premises that do not exist —
 * which is exactly the kind of thing the trust this site trades on cannot
 * afford. `areaServed` carries the geography honestly instead.
 *
 * Every contact property is conditional on being configured (src/lib/contact.ts):
 * structured data must never assert a contact route that does not work.
 */

const SAME_AS = [
  'https://www.facebook.com/profile.php?id=61593278548147',
  'https://www.instagram.com/rafiq.ist/',
];

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

const AVAILABLE_LANGUAGES = ['Arabic', 'English', 'Russian', 'Persian'];

/**
 * @param description — the localised tagline, so the entity describes itself
 *   in the language of the page it appears on.
 */
export function buildOrganizationNode(description: string): Record<string, unknown> {
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Rafiq Istanbul',
    alternateName: ['Rafiq', 'رفيق إسطنبول', 'Рафик Стамбул', 'رفیق استانبول'],
    description,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    image: DEFAULT_OG_IMAGE,
    availableLanguage: AVAILABLE_LANGUAGES,
    areaServed: { '@type': 'City', name: 'Istanbul', addressCountry: 'TR' },
    sameAs: SAME_AS,
  };

  if (HAS_WHATSAPP) organization.telephone = WHATSAPP_E164;
  if (HAS_EMAIL) organization.email = CONTACT_EMAIL;

  // Only claim an address when one is actually configured — see the file header.
  if (HAS_OFFICE_ADDRESS) {
    organization.address = {
      '@type': 'PostalAddress',
      streetAddress: OFFICE_ADDRESS,
      addressLocality: 'İstanbul',
      addressCountry: 'TR',
    };
  }

  if (HAS_WHATSAPP || HAS_EMAIL) {
    const contactPoint: Record<string, unknown> = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: AVAILABLE_LANGUAGES,
      areaServed: 'TR',
    };
    if (HAS_WHATSAPP) contactPoint.telephone = WHATSAPP_E164;
    if (HAS_EMAIL) contactPoint.email = CONTACT_EMAIL;
    organization.contactPoint = contactPoint;
  }

  return organization;
}

/** The WebSite node, with the site-search action pointed at this language. */
export function buildWebsiteNode(lang: string): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: 'Rafiq Istanbul',
    alternateName: ['Rafiq', 'رفيق إسطنبول'],
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: ['ar', 'en', 'ru', 'fa'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/${lang}/services?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
