import { useTranslation } from 'react-i18next';

const STEPS = ['s1', 's2', 's3'];

/** "How we work" — connected step list, matching the numbered-steps pattern used on GuidePage. */
export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="max-w-prose">
        <span className="eyebrow">{t('home.how.eyebrow')}</span>
        <h2 className="section-title mt-2">{t('home.how.title')}</h2>
        <p className="mt-2 text-navy/60">{t('home.how.subtitle')}</p>
      </div>
      <ol className="relative mt-10 flex flex-col gap-6 max-w-xl ms-1">
        {STEPS.map((key, i) => (
          <li key={key} className="relative ps-9">
            <span className="absolute start-0 top-0 w-7 h-7 rounded-full bg-navy text-white text-xs font-extrabold flex items-center justify-center">
              {i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span className="absolute start-[13px] top-7 bottom-[-1.5rem] w-px bg-cream-dark" aria-hidden />
            )}
            <h3 className="font-bold text-navy">{t(`home.how.${key}.title`)}</h3>
            <p className="mt-1 text-sm text-navy/60">{t(`home.how.${key}.desc`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
