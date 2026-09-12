import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { PROPERTY_RESIDENCE_PATH } from '../data/propertyResidence';
import type { Lang } from '../lib/types';

/**
 * One contextual, in-content link to the canonical property-residence page
 * (src/data/propertyResidence.ts), rendered on the handful of pages a reader
 * of that topic actually passes through.
 *
 * The anchor text varies by source page on purpose: each variant is a real
 * phrase people search, and none of them is a bare "read more" / "click
 * here". A footer list on every page carries almost no topical signal; a
 * sentence inside the body of a closely related page does.
 *
 * Build-time twin: renderPropertyResidenceCallout() in
 * scripts/generate-seo-pages.mjs renders the same sentence and the same
 * anchor into the pre-rendered shell, so a crawler that never runs the app
 * sees exactly what a hydrated reader does. Keep the two copies in step.
 */

export type PropertyResidenceAnchor = 'main' | 'conditions' | 'ownership';

const COPY: Record<Lang, { lead: string; tail: string; anchors: Record<PropertyResidenceAnchor, string> }> = {
  ar: {
    lead: 'المسار القائم على تملّك العقار له صفحة كاملة على رفيق:',
    tail: '— من يحق له التقديم، الأوراق المطلوبة، مدة الإقامة وخطوات التقديم.',
    anchors: {
      main: 'الإقامة العقارية في إسطنبول',
      conditions: 'شروط الإقامة العقارية',
      ownership: 'الإقامة عن طريق تملك عقار',
    },
  },
  en: {
    lead: 'The property-ownership route has a page of its own on Rafiq:',
    tail: '— who may apply, the documents required, how long the permit lasts and what the process looks like.',
    anchors: {
      main: 'the property residence permit in Istanbul',
      conditions: 'conditions for a property residence permit',
      ownership: 'residence through property ownership',
    },
  },
  ru: {
    lead: 'Маршруту через владение недвижимостью посвящена отдельная страница Rafiq:',
    tail: '— кто может подать, какие документы нужны, на какой срок выдаётся разрешение и как идёт процесс.',
    anchors: {
      main: 'ВНЖ по недвижимости в Стамбуле',
      conditions: 'условия ВНЖ по недвижимости',
      ownership: 'ВНЖ через владение недвижимостью',
    },
  },
  fa: {
    lead: 'مسیر مبتنی بر مالکیت ملک صفحه‌ای جداگانه در رفیق دارد:',
    tail: '— چه کسی می‌تواند درخواست دهد، چه مدارکی لازم است، مدت اقامت چقدر است و روند کار چگونه پیش می‌رود.',
    anchors: {
      main: 'اقامت ملکی در استانبول',
      conditions: 'شرایط اقامت ملکی',
      ownership: 'اقامت از راه مالکیت ملک',
    },
  },
};

export function PropertyResidenceCallout({
  anchor = 'main',
  className = '',
}: {
  anchor?: PropertyResidenceAnchor;
  className?: string;
}) {
  const { i18n } = useTranslation();
  const language = (i18n.language in COPY ? i18n.language : 'ar') as Lang;
  const copy = COPY[language];

  return (
    <p
      className={`flex items-start gap-2.5 rounded-xl border border-cream-dark bg-cream/50 px-4 py-3 text-sm leading-7 text-gray-650 ${className}`}
    >
      <AppIcon name="building" className="mt-1.5 h-4 w-4 shrink-0 text-gold-dark" />
      <span>
        {copy.lead}{' '}
        <Link to={PROPERTY_RESIDENCE_PATH} className="font-bold text-navy underline underline-offset-2 hover:text-gold-dark">
          {copy.anchors[anchor]}
        </Link>{' '}
        {copy.tail}
      </span>
    </p>
  );
}

/**
 * Which service pages carry the callout, and with which anchor. Mirrors
 * PROPERTY_RESIDENCE_LINK_ROUTES in scripts/generate-seo-pages.mjs.
 */
export const PROPERTY_RESIDENCE_SERVICE_ANCHORS: Record<string, PropertyResidenceAnchor> = {
  'res-property': 'main',
  'res-renew': 'main',
  'res-eligibility': 'conditions',
  'res-citizenship': 'ownership',
};

/** Which category guides carry the callout, and with which anchor. */
export const PROPERTY_RESIDENCE_GUIDE_ANCHORS: Record<string, PropertyResidenceAnchor> = {
  realestate: 'main',
  residency: 'conditions',
};
