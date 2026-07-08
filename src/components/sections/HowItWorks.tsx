import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';

const STEPS: { key: string; icon: IconName }[] = [
  { key: 's1', icon: 'message-circle' },
  { key: 's2', icon: 'file-text' },
  { key: 's3', icon: 'check-circle' },
];

/** "How we work" — 3-step template (content via i18n, refined in Phase 3). */
export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center max-w-prose mx-auto">
        <span className="eyebrow">{t('home.how.eyebrow')}</span>
        <h2 className="section-title mt-2">{t('home.how.title')}</h2>
        <p className="mt-2 text-navy/60">{t('home.how.subtitle')}</p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3 stagger">
        {STEPS.map((s, i) => (
          <div key={s.key} className="card card-hover p-6 text-center" style={{ '--i': i } as React.CSSProperties}>
            <div className="icon-chip-gold mx-auto">
              <AppIcon name={s.icon} className="w-6 h-6" />
            </div>
            <div className="mt-2 text-xs font-extrabold tracking-wide text-gold-dark">{i + 1}</div>
            <h3 className="mt-1 font-bold text-navy">{t(`home.how.${s.key}.title`)}</h3>
            <p className="mt-2 text-sm text-navy/60">{t(`home.how.${s.key}.desc`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
