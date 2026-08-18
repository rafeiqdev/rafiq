import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { PageHero } from '../components/PageHero';
import { IstanbulApps } from '../components/IstanbulApps';
import { IstanbulCityGuide } from '../components/IstanbulCityGuide';
import { IstanbulHeroFacts } from '../components/IstanbulHeroFacts';
import { ComingSoon } from '../components/ComingSoon';
import { BANNERS } from '../lib/images';

/** Redesign is still being refined — visitors see a "coming soon" placeholder until this flips to true. */
export const TRICKS_PAGE_READY = false;

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

/** Groups the 12 tips into themed sections on the list page (the detail page at /tricks/:id is unaffected). */
export const TRICK_CATEGORIES: { id: string; icon: IconName; tint: string; slugs: TrickSlug[] }[] = [
  { id: 'paperwork', icon: 'id-card', tint: 'bg-sky-100 text-sky-700', slugs: ['edevlet', 'vergi', 'addressRegistration'] },
  {
    id: 'transport',
    icon: 'bus',
    tint: 'bg-emerald-100 text-emerald-700',
    slugs: ['istanbulkartTopup', 'marmaray', 'dolmus', 'taxiCaution'],
  },
  { id: 'money', icon: 'wallet', tint: 'bg-amber-100 text-amber-800', slugs: ['esim', 'imeiRegistration', 'moneyExchange'] },
  { id: 'leisure', icon: 'sparkles', tint: 'bg-purple-100 text-purple-600', slugs: ['freeWifi', 'museumPass'] },
];

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
  if (!TRICKS_PAGE_READY) return <ComingSoon />;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="animate-fade-in">
        <PageHero image={BANNERS.tricks} title={t('tricks.title')} subtitle={t('tricks.subtitle')}>
          <IstanbulHeroFacts />
        </PageHero>
      </div>

      {/* City guide: practical info about Istanbul itself (areas, cost of living, climate…) */}
      <IstanbulCityGuide />

      {/* Practical tips, grouped by theme */}
      <section className="mt-10">
        <span className="eyebrow">{t('tricks.tipsEyebrow')}</span>
        <h2 className="section-title mt-2">{t('tricks.tipsSectionTitle')}</h2>
        <div className="mt-6 flex flex-col gap-8">
          {TRICK_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <h3 className="font-extrabold text-navy inline-flex items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cat.tint}`}>
                  <AppIcon name={cat.icon} className="w-[18px] h-[18px]" />
                </span>
                {t(`tricks.categories.${cat.id}`)}
              </h3>
              <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch stagger">
                {cat.slugs.map((id, i) => (
                  <TrickCard key={id} id={id} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

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
