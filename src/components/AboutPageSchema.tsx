import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SITE_URL, SEO_LANGS } from '../lib/seo';
import { buildOrganizationNode, buildWebsiteNode, ORGANIZATION_ID, WEBSITE_ID } from '../lib/organizationSchema';
import { ABOUT_PAGE } from '../data/aboutPage';
import { CONTACT_PAGE } from '../data/contactPage';
import type { Lang } from '../lib/types';

/**
 * JSON-LD for /about and /contact.
 *
 * These two pages are the site's identity pages, so they carry the FULL
 * Organization node (name, contact point, telephone, email, areaServed,
 * sameAs) rather than an `@id` reference to a node defined only on Home.
 * A reference to an @id that is not defined on the same page is a much weaker
 * signal, and these are exactly the pages a search engine or AI answer engine
 * lands on when it is trying to establish who this business is.
 *
 * AboutPage and ContactPage are the schema.org types Google documents for
 * this purpose. Neither produces a rich result on its own — their value here
 * is entity resolution, which is the specific thing the audit found missing.
 */

/**
 * Takes the already-serialised JSON so the effect depends on a string, not on
 * an object literal rebuilt every render — which would re-run on every single
 * render instead of only when the content actually changes.
 */
function useJsonLd(scriptId: string, json: string) {
  useEffect(() => {
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = json;
    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [scriptId, json]);
}

function useIdentityPageSchema(
  scriptId: string,
  pageType: 'AboutPage' | 'ContactPage',
  path: '/about' | '/contact',
  title: string,
  description: string,
  breadcrumbLabel: string,
) {
  const { t, i18n } = useTranslation();
  const lang = (SEO_LANGS as string[]).includes(i18n.language) ? (i18n.language as Lang) : 'ar';
  const url = `${SITE_URL}/${lang}${path}`;

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      buildOrganizationNode(t('common.tagline')),
      buildWebsiteNode(lang),
      {
        '@type': pageType,
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: lang,
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': ORGANIZATION_ID },
        // On a ContactPage this is what ties the page to the entity it lets you
        // contact; on an AboutPage, to the entity it describes.
        mainEntity: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${SITE_URL}/${lang}` },
          { '@type': 'ListItem', position: 2, name: breadcrumbLabel, item: url },
        ],
      },
    ],
  };

  useJsonLd(scriptId, JSON.stringify(data));
  return null;
}

export function AboutPageSchema() {
  const { i18n } = useTranslation();
  const lang = (SEO_LANGS as string[]).includes(i18n.language) ? (i18n.language as Lang) : 'ar';
  const content = ABOUT_PAGE[lang] ?? ABOUT_PAGE.ar;
  return useIdentityPageSchema(
    'ld-about-page',
    'AboutPage',
    '/about',
    content.seoTitle,
    content.metaDescription,
    content.title,
  );
}

export function ContactPageSchema() {
  const { i18n } = useTranslation();
  const lang = (SEO_LANGS as string[]).includes(i18n.language) ? (i18n.language as Lang) : 'ar';
  const content = CONTACT_PAGE[lang] ?? CONTACT_PAGE.ar;
  return useIdentityPageSchema(
    'ld-contact-page',
    'ContactPage',
    '/contact',
    content.seoTitle,
    content.metaDescription,
    content.title,
  );
}
