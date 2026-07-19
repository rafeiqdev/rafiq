import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { PageHero } from '../components/PageHero';
import { BANNERS } from '../lib/images';
import { IkametCard } from '../components/IkametCard';

const TYPES: { id: string; icon: IconName; accent: string; label: string }[] = [
  { id: 'shortTerm', icon: 'id-card', accent: '#1d5f9e', label: 'SHORT-TERM' },
  { id: 'family', icon: 'users', accent: '#2f7fc4', label: 'FAMILY' },
  { id: 'student', icon: 'graduation-cap', accent: '#3d63a5', label: 'STUDENT' },
  { id: 'longTerm', icon: 'landmark', accent: '#163f6b', label: 'LONG-TERM' },
];

export function Residency() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="animate-fade-in">
        <PageHero image={BANNERS.residency} title={t('residency.title')} subtitle={t('residency.subtitle')} />
      </div>

      <div className="amber-note mt-5 flex gap-2 items-start animate-fade-up">
        <AppIcon name="alert-triangle" className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{t('residency.warning')}</span>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 stagger">
        {TYPES.map((x, i) => (
          <div key={x.id} className="card card-hover flex flex-col overflow-hidden" style={{ '--i': i } as React.CSSProperties}>
            {/* İkamet card illustration header (always LTR so it never mirrors) */}
            <div dir="ltr" className="img-zoom h-44 p-4 flex items-center justify-center" style={{ background: `${x.accent}14` }}>
              <IkametCard label={x.label} accent={x.accent} />
            </div>
            <div className="p-5 flex flex-col flex-1">
              <div className="flex items-center gap-3">
                <span className="icon-chip">
                  <AppIcon name={x.icon} />
                </span>
                <h2 className="font-bold text-navy">{t(`residency.types.${x.id}.title`)}</h2>
              </div>
              <p className="mt-3 text-sm text-gray-500 flex-1">{t(`residency.types.${x.id}.body`)}</p>
              <Link to={`/help?topic=residency-${x.id}`} className="btn-primary w-full mt-4">
                {t('common.helpMe')}
                <DirArrow />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 mt-6 animate-fade-up">
        <h2 className="font-bold text-navy">{t('residency.steps.title')}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {(['s1', 's2', 's3', 's4'] as const).map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="icon-chip !w-8 !h-8 text-sm font-extrabold">{i + 1}</span>
              <p className="text-sm text-navy/80 pt-1.5">{t(`residency.steps.${s}`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
