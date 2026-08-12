import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';

const ITEMS = ['t1', 't2', 't3'];

/** "Ahmad K." → "AK" — derived purely from the existing i18n name string, so
    the avatar reads as a real initials badge instead of a single stray letter. */
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Customer testimonials — template (sample content via i18n, refined in Phase 3). */
export function Testimonials() {
  const { t } = useTranslation();
  return (
    <section className="bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <span className="eyebrow text-gold-light">{t('home.testimonials.eyebrow')}</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-2">{t('home.testimonials.title')}</h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3 stagger">
          {ITEMS.map((id, i) => {
            const name = t(`home.testimonials.${id}.name`);
            return (
              <figure
                key={id}
                className="bg-white/5 border border-white/10 rounded-card p-6 flex flex-col"
                style={{ '--i': i } as React.CSSProperties}
              >
                <div className="flex gap-0.5 text-gold-light">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <AppIcon key={s} name="star" className="w-4 h-4" fill="currentColor" />
                  ))}
                </div>
                <blockquote className="mt-3 text-sm text-white/85 leading-relaxed flex-1">
                  “{t(`home.testimonials.${id}.quote`)}”
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold/30 to-white/5 border border-white/15 text-gold-light flex items-center justify-center font-bold text-sm tracking-wide shadow-inner shrink-0">
                    {initials(name)}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{name}</div>
                    <div className="text-xs text-white/60">{t(`home.testimonials.${id}.role`)}</div>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
