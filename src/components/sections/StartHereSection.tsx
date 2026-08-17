import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../AppIcon';
import type { IconName } from '../AppIcon';

const STEPS: { number: string; icon: IconName; to: string; key: string }[] = [
  { number: '01', icon: 'compass', to: '/journey', key: 'arrive' },
  { number: '02', icon: 'file-text', to: '/guides/residency', key: 'legal' },
  { number: '03', icon: 'home', to: '/real-estate', key: 'home' },
  { number: '04', icon: 'map', to: '/map', key: 'districts' },
  { number: '05', icon: 'layers', to: '/services', key: 'daily' },
  { number: '06', icon: 'message-circle', to: '/help', key: 'help' },
];

/**
 * A practical “start here” roadmap inspired by high-performing Istanbul guides:
 * numbered chapters, concrete next actions, and honest hand-offs to official
 * sources or Rafiq services instead of vague promotional copy.
 */
export function StartHereSection() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-cream-dark bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="max-w-2xl">
          <span className="eyebrow">{t('home.startHere.eyebrow')}</span>
          <h2 className="section-title mt-2">{t('home.startHere.title')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-navy/70 sm:text-base">{t('home.startHere.subtitle')}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => (
            <Link
              key={step.key}
              to={step.to}
              className="group relative flex min-h-44 flex-col rounded-card border border-cream-dark bg-cream/45 p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-cardHover"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="icon-chip bg-white">
                  <AppIcon name={step.icon} className="h-5 w-5" />
                </span>
                <span className="font-mono text-xs font-bold tracking-widest text-navy/35">{step.number}</span>
              </div>
              <h3 className="mt-5 font-extrabold leading-snug text-navy">{t(`home.startHere.steps.${step.key}.title`)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-navy/70">{t(`home.startHere.steps.${step.key}.body`)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-navy">
                {t('home.startHere.open')}
                <DirArrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-navy/55">{t('home.startHere.note')}</p>
      </div>
    </section>
  );
}
