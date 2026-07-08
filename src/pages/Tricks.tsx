import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { PageHero } from '../components/PageHero';
import { IstanbulApps } from '../components/IstanbulApps';
import { BANNERS } from '../lib/images';

interface Trick {
  id: string;
  icon: IconName;
  kind: 'app' | 'tip';
  /** external link for app tricks */
  url?: string;
  /** featured (full-width, highlighted) */
  featured?: boolean;
}

// Tips only — the apps themselves now live once in the IstanbulApps directory below.
const TRICKS: Trick[] = [
  { id: 'esim', icon: 'smartphone', kind: 'tip' },
  { id: 'vergi', icon: 'receipt', kind: 'tip' },
  { id: 'taxiCaution', icon: 'alert-triangle', kind: 'tip' },
];

function TrickCard({ trick, index }: { trick: Trick; index: number }) {
  const { t } = useTranslation();
  const isApp = trick.kind === 'app';
  return (
    <article
      className={`card card-hover flex flex-col p-5 ${trick.featured ? 'sm:col-span-2 lg:col-span-3 bg-brand-blue/40' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span className="icon-chip shrink-0">
          <AppIcon name={trick.icon} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-navy">{t(`tricks.items.${trick.id}.title`)}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isApp ? 'bg-navy text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {t(isApp ? 'tricks.appBadge' : 'tricks.tipBadge')}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t(`tricks.items.${trick.id}.body`)}</p>
        </div>
      </div>
      {isApp && trick.url && (
        <a href={trick.url} target="_blank" rel="noreferrer" className="btn-primary w-full mt-4">
          <AppIcon name="download" className="w-4 h-4" />
          {t('tricks.openApp')}
        </a>
      )}
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
        {TRICKS.map((trick, i) => (
          <TrickCard key={trick.id} trick={trick} index={i} />
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
