import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { PageHero } from '../components/PageHero';
import { IstanbulApps } from '../components/IstanbulApps';
import { BANNERS } from '../lib/images';

/** Every trick has its own detail page at /tricks/:id — steps + benefit. */
export const TRICK_SLUGS = [
  'esim',
  'vergi',
  'taxiCaution',
  'edevlet',
  'istanbulkartTopup',
  'imeiRegistration',
  'moneyExchange',
  'freeWifi',
  'marmaray',
  'museumPass',
  'dolmus',
  'addressRegistration',
] as const;
export type TrickSlug = (typeof TRICK_SLUGS)[number];

export const TRICK_ICONS: Record<TrickSlug, IconName> = {
  esim: 'smartphone',
  vergi: 'receipt',
  taxiCaution: 'alert-triangle',
  edevlet: 'id-card',
  istanbulkartTopup: 'credit-card',
  imeiRegistration: 'phone',
  moneyExchange: 'trending-up',
  freeWifi: 'globe',
  marmaray: 'navigation',
  museumPass: 'star',
  dolmus: 'car',
  addressRegistration: 'home',
};

function TrickCard({ id, index }: { id: TrickSlug; index: number }) {
  const { t } = useTranslation();
  return (
    <article
      className="card card-hover flex flex-col p-5"
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span className="icon-chip shrink-0">
          <AppIcon name={TRICK_ICONS[id]} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-navy">{t(`tricks.items.${id}.title`)}</h3>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800">
              {t('tricks.tipBadge')}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t(`tricks.items.${id}.body`)}</p>
        </div>
      </div>
      <Link to={`/tricks/${id}`} className="btn-primary w-full mt-4">
        {t('tricks.readMore')}
        <DirArrow />
      </Link>
    </article>
  );
}

export function Tricks() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="animate-fade-in">
        <PageHero image={BANNERS.tricks} title={t('tricks.title')} subtitle={t('tricks.subtitle')} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch stagger">
        {TRICK_SLUGS.map((id, i) => (
          <TrickCard key={id} id={id} index={i} />
        ))}
      </div>

      {/* Essential Istanbul apps directory (categorized, searchable, 4 langs) */}
      <IstanbulApps />

      <div className="card p-6 mt-10 flex items-center gap-4 flex-wrap animate-fade-up">
        <span className="icon-chip">
          <AppIcon name="message-circle" />
        </span>
        <div className="flex-1">
          <h2 className="font-bold text-navy">{t('tricks.ctaTitle')}</h2>
          <p className="text-sm text-gray-500">{t('tricks.ctaBody')}</p>
        </div>
        <Link to="/premium" className="btn-primary">
          {t('tricks.ctaButton')}
          <DirArrow />
        </Link>
      </div>
    </div>
  );
}
