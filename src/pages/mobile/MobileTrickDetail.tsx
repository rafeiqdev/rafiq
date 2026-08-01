import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/AppIcon';
import { usePageMeta } from '../../lib/seo';
import { TRICK_SLUGS, TRICK_ICONS } from '../Tricks';
import type { TrickSlug } from '../Tricks';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

export function MobileTrickDetail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const valid = id && (TRICK_SLUGS as readonly string[]).includes(id);
  const slug = id as TrickSlug;

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  usePageMeta({
    title: valid ? `${t(`tricks.items.${slug}.title`)} — ${t('common.appName')}` : t('common.appName'),
    description: valid ? t(`tricks.items.${slug}.body`).slice(0, 160) : t('common.tagline'),
  });

  const steps = valid ? (t(`tricks.items.${slug}.steps`, { returnObjects: true }) as string[]) : [];
  const benefit = valid ? (t(`tricks.items.${slug}.benefit`) as string) : '';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-10">
        <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-navy to-navy-light px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          {valid && (
            <div className="animate-fade-up relative mt-4 flex items-center gap-3.5">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15">
                <AppIcon name={TRICK_ICONS[slug]} className="h-[26px] w-[26px]" />
              </span>
              <h1 className="min-w-0 text-xl font-extrabold leading-snug">{t(`tricks.items.${slug}.title`)}</h1>
            </div>
          )}
        </header>

        <main className="px-5 pt-5">
          {valid ? (
            <article className="card animate-fade-up p-[22px]">
              <p className="text-[14.5px] leading-[1.75] text-navy/85">{t(`tricks.items.${slug}.body`)}</p>

              <h2 className="mt-6 text-[15px] font-bold text-navy">{t('tricks.howTitle')}</h2>
              <ol className="mt-3 space-y-3">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-[14px] leading-relaxed text-navy/85">{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 rounded-xl bg-brand-blue px-4 py-3">
                <h2 className="text-[13.5px] font-bold text-navy">{t('tricks.benefitTitle')}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-navy/80">{benefit}</p>
              </div>
            </article>
          ) : (
            <div className="card animate-pop mt-6 p-10 text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="file-text" className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-gray-500">{t('common.error')}</p>
              <Link to="/tricks" className="btn-primary mt-5 flex min-h-[50px] w-full text-[15px]">
                {t('nav.tricks')}
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
