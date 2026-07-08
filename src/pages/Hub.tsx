import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { ServiceRequestModal } from '../components/ServiceRequestModal';

export const GUIDE_SLUGS = ['istanbulkart', 'esim', 'ikamet', 'vergi', 'bank', 'districts'] as const;

const ICONS: Record<string, IconName> = {
  istanbulkart: 'bus',
  esim: 'smartphone',
  ikamet: 'id-card',
  vergi: 'receipt',
  bank: 'landmark',
  districts: 'map',
};

export function Hub() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('hub.title')}</h1>
      <p className="mt-1 text-navy/60">{t('hub.subtitle')}</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        {GUIDE_SLUGS.map((slug) => (
          <div key={slug} className="card card-hover flex flex-col p-5">
            <div className="icon-chip">
              <AppIcon name={ICONS[slug]} />
            </div>
            <h2 className="mt-3 font-bold text-navy text-sm leading-snug">{t(`hub.guides.${slug}.title`)}</h2>
            <p className="mt-2 text-xs text-gray-500 flex-1">{t(`hub.guides.${slug}.excerpt`)}</p>
            <Link to={`/hub/${slug}`} className="btn-primary w-full mt-4">
              {t('hub.readMore')}
              <DirArrow />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HubDetail() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const valid = slug && (GUIDE_SLUGS as readonly string[]).includes(slug);
  const [helping, setHelping] = useState(false);

  if (!valid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-navy/60">{t('common.error')}</p>
        <Link to="/hub" className="btn-primary mt-6">
          {t('nav.hub')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/hub" className="text-sm text-navy/60 hover:text-navy inline-flex items-center gap-1.5">
        <ArrowLeft className="dir-arrow w-4 h-4" strokeWidth={2} aria-hidden />
        {t('nav.hub')}
      </Link>
      <div className="card p-8 mt-4">
        <div className="icon-chip">
          <AppIcon name={ICONS[slug!]} className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-navy leading-snug">{t(`hub.guides.${slug}.title`)}</h1>
        <p className="mt-4 text-navy/80 leading-relaxed">{t(`hub.guides.${slug}.body`)}</p>
        <button onClick={() => setHelping(true)} className="btn-primary mt-8">
          <MessageCircle className="w-4 h-4" strokeWidth={1.8} aria-hidden />
          {t('common.helpMe')}
        </button>
      </div>
      {helping && (
        <ServiceRequestModal
          source={{ id: `hub:${slug}`, title: t(`hub.guides.${slug}.title`), category: 'hub', type: 'guide' }}
          onClose={() => setHelping(false)}
        />
      )}
    </div>
  );
}
