import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';
import { HOME_STATS } from '../../data/siteStats';

const STEPS = ['s1', 's2', 's3'] as const;

/** One icon per step — no photography, so the card balances on its own
    (centered content) instead of leaning on an image to fill the space. */
const STEP_ICONS: Record<(typeof STEPS)[number], IconName> = {
  s1: 'languages', // choosing language / situation
  s2: 'file-text', // opening the matching guide
  s3: 'check-circle', // finishing with confidence
};

// Headline stats — values live in src/data/siteStats.ts (single source of
// truth for every placeholder number on the home page).
const STATS = [
  { key: 'languages', value: HOME_STATS.languagesSupported, plus: false },
  { key: 'users', value: HOME_STATS.usersServed, plus: true },
  { key: 'services', value: HOME_STATS.servicesCovered, plus: true },
] as const;

/**
 * "How Rafiq works" — three numbered, centered icon cards (balanced in both
 * RTL and LTR, no external imagery) followed by a navy stats bar.
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

      {/* three centered icon step-cards — content is centered rather than
          start-aligned so each card balances on its own in both RTL and LTR,
          instead of leaving one side of the card empty */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((key, i) => (
          <div
            key={key}
            className="card card-hover relative flex flex-col items-center p-6 text-center animate-fade-up sm:p-8"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white">
              <AppIcon name={STEP_ICONS[key]} className="h-6 w-6" />
              <span
                className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gold text-xs font-extrabold text-white tabular-nums"
                dir="ltr"
                aria-hidden
              >
                {nf(i + 1)}
              </span>
            </div>
            <h3 className="mt-4 font-bold text-navy leading-snug">{t(`home.how.${key}.title`)}</h3>
            <p className="mt-2 text-sm text-navy/70 leading-relaxed">{t(`home.how.${key}.desc`)}</p>
          </div>
        ))}
      </div>

      {/* stats bar */}
      <div className="mt-8 rounded-card bg-gradient-to-l from-navy-dark to-navy text-white shadow-card">
        <div className="grid grid-cols-3 sm:divide-x sm:divide-white/10 gap-y-4 sm:gap-y-0 py-4 sm:py-6">
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
