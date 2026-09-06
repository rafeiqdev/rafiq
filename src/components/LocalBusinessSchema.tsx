import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SEO_LANGS } from '../lib/seo';
import { buildOrganizationNode, buildWebsiteNode } from '../lib/organizationSchema';
import type { Lang } from '../lib/types';

const SCRIPT_ID = 'ld-organization';

/**
 * Organization + WebSite JSON-LD for the public home page.
 *
 * The node itself is built by src/lib/organizationSchema.ts, which /about and
 * /contact share — the definition used to live inline here, and a contact
 * detail that disagrees with itself across a site is worse than one that is
 * missing. That module is also where the reasoning lives for why this stays
 * `Organization` rather than `LocalBusiness`: Rafiq has no premises open to
 * visitors, and `LocalBusiness` without a real `PostalAddress` would be both
 * invalid markup and an implicit claim of an office that does not exist.
 */
export function LocalBusinessSchema() {
  const { t, i18n } = useTranslation();
  // This component only ever mounts on Home, which is reachable under all
  // four language segments — the search target must follow suit instead of
  // always pointing at /ar/services, or every non-Arabic page would tell
  // search engines its site search is Arabic-only.
  const lang = (SEO_LANGS as string[]).includes(i18n.language) ? (i18n.language as Lang) : 'ar';

  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@graph': [buildOrganizationNode(t('common.tagline')), buildWebsiteNode(lang)],
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
