import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

const STEPS = ['s1', 's2', 's3'] as const;

// Headline stats. These are elegant placeholders — swap `value` for real
// figures anytime (digits auto-localize per language via Intl). `plus`
// prepends a "+" for "and counting" style numbers.
const STATS = [
  { key: 'languages', value: 4, plus: false },
  { key: 'guides', value: 50, plus: true },
  { key: 'users', value: 1000, plus: true },
  { key: 'services', value: 20, plus: true },
] as const;

/**
 * "How Rafiq works" — three numbered step cards followed by a navy stats bar.
 * Replaces the old vertical step list in the same Home slot, matching the
 * navy/cream design system (see index.css / tailwind.config.js).
 */
export function HowItWorks() {
  const { t, i18n } = useTranslation();
  const nf = (n: number) => new Intl.NumberFormat(i18n.language).format(n);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      {/* heading */}
      <div className="text-center max-w-2xl mx-auto">
        <span className="eyebrow">{t('home.how.eyebrow')}</span>
        <h2 className="section-title mt-2">{t('home.how.title')}</h2>
      </div>

      {/* three step cards — connected by a thin line on desktop, stacked on phones */}
      <div className="mt-10 flex flex-col sm:flex-row items-stretch gap-4">
        {STEPS.map((key, i) => (
          <Fragment key={key}>
            <div
              className="card card-hover flex-1 p-5 sm:p-6 flex flex-col animate-fade-up"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex-1 font-bold text-navy leading-snug">
                  {t(`home.how.${key}.title`)}
                </h3>
                <span className="shrink-0 w-8 h-8 rounded-lg bg-navy text-white text-sm font-extrabold flex items-center justify-center">
                  {nf(i + 1)}
                </span>
              </div>
              <p className="mt-2 text-sm text-navy/60 leading-relaxed">
                {t(`home.how.${key}.desc`)}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <span className="hidden sm:block self-start mt-9 w-6 h-px bg-cream-dark shrink-0" aria-hidden />
            )}
          </Fragment>
        ))}
      </div>

      {/* stats bar */}
      <div className="mt-8 rounded-card bg-gradient-to-l from-navy-dark to-navy text-white shadow-card">
        <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-white/10 gap-y-4 sm:gap-y-0 py-4 sm:py-6">
          {STATS.map((s) => (
            <div key={s.key} className="text-center px-4">
              <div dir="ltr" className="text-2xl sm:text-3xl font-extrabold tabular-nums">
                {s.plus ? '+' : ''}
                {nf(s.value)}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-white/75 leading-snug">
                {t(`home.stats.${s.key}`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
