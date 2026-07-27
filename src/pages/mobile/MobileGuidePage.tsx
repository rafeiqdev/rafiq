import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getGuideContent, isTranslated, SERVICE_FOR_SLUG } from '../../data/guides';
import { SERVICE_CATEGORIES, pickText } from '../../data/services';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { ServiceRequestModal } from '../../components/ServiceRequestModal';
import { track } from '../../lib/analytics';
import { usePageMeta } from '../../lib/seo';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

/** White content card with an icon-chip heading. */
function SectionCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="card p-[18px]">
      <h2 className="inline-flex items-center gap-2.5 text-[15px] font-extrabold text-navy">
        <span className="icon-chip !h-[34px] !w-[34px]">
          <AppIcon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <div className="mt-3.5 text-[13.5px] leading-relaxed text-navy/80">{children}</div>
    </section>
  );
}

export function MobileGuidePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const [requesting, setRequesting] = useState(false);

  const guide = getGuideContent(slug, lang);
  const service = SERVICE_FOR_SLUG[slug];
  const category = service ? SERVICE_CATEGORIES.find((c) => c.id === service.category) : undefined;
  const title = service ? pickText(service.title, lang) : (guide?.name ?? slug);
  const isPartner = service ? service.type === 'partner' : (guide?.type?.includes('شريك') ?? false);

  const langCode = (lang || 'en').split('-')[0];
  const isRTL = langCode === 'ar' || langCode === 'fa';
  const mc = mobileCopy[langCode] ?? mobileCopy.en;

  useEffect(() => {
    track('guide_viewed', { target: slug });
  }, [slug]);

  // SEO: per-guide, per-language title + description (+ matching og/twitter tags)
  usePageMeta({
    title: `${title} — ${t('common.appName')}`,
    description: guide?.intro ? guide.intro.slice(0, 160) : t('common.tagline'),
  });

  const badge = (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        isPartner ? 'bg-gold-soft text-gold-dark' : 'bg-white/20 text-white'
      }`}
    >
      {isPartner ? t('services.partnerBadge') : t('services.directBadge')}
    </span>
  );

  // Shared header shell (used by both the found and not-found states).
  const Header = ({ children }: { children?: ReactNode }) => (
    <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-navy to-navy-light px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
      <span
        aria-hidden="true"
        className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.75rem] font-bold leading-none text-white/5"
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
      {children}
    </header>
  );

  if (!guide) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
        <Header />
        <div className="px-5 py-16">
          <div className="card p-8 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="file-text" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm text-gray-500">{t('guide.notAvailable')}</p>
            <Link to="/services" className="btn-primary mt-5 flex min-h-[52px] w-full text-[15px]">
              {t('nav.allServices')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const request = () => {
    if (!service) {
      navigate('/services');
      return;
    }
    track('request_started', { target: service.id, meta: { category: service.category } });
    setRequesting(true);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+84px)]">
        <Header>
          {/* breadcrumb */}
          <nav className="relative mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/70">
            <Link to="/services" className="hover:text-white">{t('nav.allServices')}</Link>
            {category && (
              <>
                <DirArrow className="h-3 w-3" />
                <span>{pickText(category.title, lang)}</span>
              </>
            )}
            <DirArrow className="h-3 w-3" />
            <span className="text-white/90">{title}</span>
          </nav>

          {/* icon avatar + title + badge + intro */}
          <div className="animate-fade-up relative mt-3.5 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15">
              <AppIcon name={category?.icon ?? 'file-text'} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-extrabold leading-tight">{title}</h1>
                {badge}
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{guide.intro}</p>
            </div>
          </div>

          {/* stat chips */}
          {(guide.duration || guide.cost) && (
            <div className="relative mt-4 flex flex-wrap gap-2">
              {guide.duration && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11.5px]">
                  <AppIcon name="clock" className="h-4 w-4 text-gold-light" />
                  <span className="text-white/70">{t('serviceGuides.duration')}:</span>
                  <bdi className="font-semibold">{guide.duration}</bdi>
                </span>
              )}
              {guide.cost && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11.5px]">
                  <AppIcon name="receipt" className="h-4 w-4 text-gold-light" />
                  <span className="text-white/70">{t('serviceGuides.cost')}:</span>
                  <bdi className="font-semibold">{guide.cost}</bdi>
                </span>
              )}
            </div>
          )}
        </Header>

        <div className="flex flex-col gap-3.5 px-5 pt-[18px]">
          {!isTranslated(slug, lang) && lang !== 'ar' && (
            <div className="amber-note flex flex-wrap items-center gap-2.5 text-xs">
              <span className="min-w-0 flex-1">{t('serviceGuides.translationNote')}</span>
              <Link
                to={`/premium?topic=${encodeURIComponent(service?.id ?? '')}`}
                className="btn-secondary min-h-[36px] shrink-0 px-3 text-[11.5px]"
              >
                <AppIcon name="message-circle" className="h-3.5 w-3.5" />
                {t('guide.choice.ai.label')}
              </Link>
            </div>
          )}

          {guide.whoFor && (
            <SectionCard icon="users" title={t('serviceGuides.whoFor')}>
              <p>{guide.whoFor}</p>
            </SectionCard>
          )}

          {guide.documents.length > 0 && (
            <SectionCard icon="file-check" title={t('serviceGuides.documents')}>
              <ul className="flex flex-col gap-2.5">
                {guide.documents.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-navy text-white">
                      <AppIcon name="check" className="h-3 w-3" />
                    </span>
                    <bdi>{d}</bdi>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {guide.steps.length > 0 && (
            <SectionCard icon="check-circle" title={t('serviceGuides.steps')}>
              <ol className="relative flex flex-col">
                {guide.steps.map((s, i) => (
                  <li key={i} className="relative ps-[38px] pb-[18px] last:pb-0">
                    <span className="absolute start-0 top-0 z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-navy text-xs font-extrabold text-white">
                      {i + 1}
                    </span>
                    {i < guide.steps.length - 1 && (
                      <span className="absolute start-[12.5px] top-[26px] bottom-0 w-px bg-cream-dark" aria-hidden />
                    )}
                    <bdi className="block pt-[3px]">{s}</bdi>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}

          {guide.mistakes.length > 0 && (
            <section className="rounded-card border border-amber-200 bg-amber-50 p-[18px]">
              <h2 className="inline-flex items-center gap-2 text-[15px] font-extrabold text-amber-900">
                <AppIcon name="alert-triangle" className="h-5 w-5" />
                {t('serviceGuides.mistakes')}
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-[13px] text-amber-900/90">
                {guide.mistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <bdi>{m}</bdi>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11.5px] text-navy/50">{t('serviceGuides.disclaimer')}</p>

          {/* how Rafiq helps */}
          <section className="rounded-card bg-navy p-[22px] text-white">
            <div className="flex flex-wrap items-center gap-2">
              <AppIcon name="shield-check" className="h-5 w-5 text-gold-light" />
              <h2 className="text-[15px] font-extrabold">{t('serviceGuides.rafiqHelp')}</h2>
              {badge}
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/85">{guide.rafiqHelp}</p>
            <button onClick={request} className="btn-gold mt-[18px] flex min-h-[52px] w-full text-[15px]">
              <AppIcon name="message-circle" className="h-[18px] w-[18px]" />
              {t('services.request')}
            </button>
          </section>

          <p className="mb-1 text-center text-[11px] text-navy/40">{t('serviceGuides.independent')}</p>
        </div>
      </div>

      {/* ── Sticky request CTA (the only bottom bar on this screen) ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-cream-dark bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
        <button onClick={request} className="btn-primary flex min-h-[52px] w-full text-[15px]">
          <AppIcon name="message-circle" className="h-[18px] w-[18px]" />
          {t('services.request')}
        </button>
      </div>

      {requesting && service && (
        <ServiceRequestModal
          source={{ id: service.id, title, category: service.category, type: service.type }}
          onClose={() => setRequesting(false)}
        />
      )}
    </div>
  );
}
