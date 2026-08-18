import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { pickAppText } from '../data/istanbulApps';
import { CITY_GUIDE } from '../data/istanbulCityGuide';

/** Tinted chip per card — cycled, same colored-chip convention used across the app. */
const TINTS = [
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-600',
  'bg-brand-red/10 text-brand-red',
  'bg-navy/10 text-navy',
];

/** City-guide cards about Istanbul itself (areas, cost of living, climate, safety, culture…). */
export function IstanbulCityGuide() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = lang === 'ar' || lang === 'fa';

  return (
    <section id="city-guide" dir={rtl ? 'rtl' : 'ltr'} className="mt-10 scroll-mt-20">
      <span className="eyebrow">{t('cityGuide.eyebrow')}</span>
      <h2 className="section-title mt-2">{t('cityGuide.title')}</h2>
      <p className="mt-1 text-sm text-navy/60">{t('cityGuide.subtitle')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
        {CITY_GUIDE.map((c, i) => (
          <article key={i} className="card card-hover p-5" style={{ '--i': i } as React.CSSProperties}>
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${TINTS[i % TINTS.length]}`}>
              <AppIcon name={c.icon} className="w-5 h-5" />
            </span>
            <h3 className="mt-3 font-bold text-navy">{pickAppText(c.title, lang)}</h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{pickAppText(c.body, lang)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
