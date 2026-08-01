import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { AppIcon } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';
import { TRICK_SLUGS, TRICK_ICONS } from './Tricks';
import type { TrickSlug } from './Tricks';

export function TrickDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const valid = id && (TRICK_SLUGS as readonly string[]).includes(id);
  const slug = id as TrickSlug;

  usePageMeta({
    title: valid ? `${t(`tricks.items.${slug}.title`)} — ${t('common.appName')}` : t('common.appName'),
    description: valid ? t(`tricks.items.${slug}.body`).slice(0, 160) : t('common.tagline'),
  });

  if (!valid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-navy/60">{t('common.error')}</p>
        <Link to="/tricks" className="btn-primary mt-6">
          {t('nav.tricks')}
        </Link>
      </div>
    );
  }

  const steps = t(`tricks.items.${slug}.steps`, { returnObjects: true }) as string[];
  const benefit = t(`tricks.items.${slug}.benefit`) as string;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/tricks" className="text-sm text-navy/60 hover:text-navy inline-flex items-center gap-1.5">
        <ArrowLeft className="dir-arrow w-4 h-4" strokeWidth={2} aria-hidden />
        {t('nav.tricks')}
      </Link>
      <div className="card p-8 mt-4">
        <div className="icon-chip">
          <AppIcon name={TRICK_ICONS[slug]} className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-navy leading-snug">{t(`tricks.items.${slug}.title`)}</h1>
        <p className="mt-4 text-navy/80 leading-relaxed">{t(`tricks.items.${slug}.body`)}</p>

        <h2 className="mt-8 font-bold text-navy">{t('tricks.howTitle')}</h2>
        <ol className="mt-3 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-navy/80 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl bg-brand-blue px-4 py-3">
          <h2 className="text-sm font-bold text-navy">{t('tricks.benefitTitle')}</h2>
          <p className="mt-1 text-sm text-navy/80 leading-relaxed">{benefit}</p>
        </div>
      </div>
    </div>
  );
}
