import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../AppIcon';
import { SiteImage } from '../SiteImage';
import { ISTANBUL } from '../../lib/images';

const POINTS = ['p1', 'p2', 'p3'];

/** "Who we are" — template (content via i18n, refined in Phase 3). */
export function AboutSection() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid gap-8 lg:grid-cols-2 items-center">
        <div className="animate-fade-up">
          <span className="eyebrow">{t('home.about.eyebrow')}</span>
          <h2 className="section-title mt-2">{t('home.about.title')}</h2>
          <p className="mt-3 text-navy/70 leading-relaxed">{t('home.about.body')}</p>
          <ul className="mt-5 flex flex-col gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="icon-chip-gold !w-7 !h-7 mt-0.5">
                  <AppIcon name="check" className="w-4 h-4" />
                </span>
                <span className="text-sm text-navy/80">{t(`home.about.${p}`)}</span>
              </li>
            ))}
          </ul>
          <Link to="/premium" className="btn-primary mt-6">
            {t('home.about.cta')}
            <DirArrow />
          </Link>
        </div>
        <SiteImage
          src={ISTANBUL.bosphorus}
          alt="Istanbul"
          className="rounded-card shadow-card aspect-[4/3] w-full"
        />
      </div>
    </section>
  );
}
