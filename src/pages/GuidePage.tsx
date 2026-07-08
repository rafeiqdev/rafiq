import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getGuideContent, isTranslated, SERVICE_FOR_SLUG } from '../data/guides';
import { SERVICE_CATEGORIES, pickText } from '../data/services';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ServiceRequestModal } from '../components/ServiceRequestModal';
import { track } from '../lib/analytics';

function SectionCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-extrabold text-navy inline-flex items-center gap-2">
        <span className="icon-chip !w-9 !h-9">
          <AppIcon name={icon} className="w-4 h-4" />
        </span>
        {title}
      </h2>
      <div className="mt-4 text-sm text-navy/80 leading-relaxed">{children}</div>
    </section>
  );
}

export function GuidePage() {
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

  useEffect(() => {
    track('guide_viewed_full', { service_slug: slug, lang });
  }, [slug, lang]);

  // SEO: per-guide, per-language title + description
  useEffect(() => {
    if (!guide) return;
    const prevTitle = document.title;
    document.title = `${title} — ${t('common.appName')}`;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') ?? '';
    if (meta && guide.intro) meta.setAttribute('content', guide.intro.slice(0, 160));
    return () => {
      document.title = prevTitle;
      if (meta) meta.setAttribute('content', prevDesc);
    };
  }, [guide, title, t]);

  if (!guide) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip mx-auto">
            <AppIcon name="file-text" className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm text-gray-500">{t('guide.notAvailable')}</p>
          <Link to="/services" className="btn-primary w-full mt-5">
            {t('nav.allServices')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-10">
      {/* hero */}
      <section className="bg-gradient-to-br from-navy to-navy-light text-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          {/* breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-white/70 flex-wrap">
            <Link to="/services" className="hover:text-white">{t('nav.allServices')}</Link>
            {category && (
              <>
                <DirArrow className="w-3 h-3" />
                <span>{pickText(category.title, lang)}</span>
              </>
            )}
            <DirArrow className="w-3 h-3" />
            <span className="text-white/90">{title}</span>
          </nav>

          <div className="mt-4 flex items-start gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/15 border border-white/25 shrink-0">
              <AppIcon name={category?.icon ?? 'file-text'} className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{title}</h1>
                <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 ${isPartner ? 'bg-gold-soft text-gold-dark' : 'bg-white/20 text-white'}`}>
                  {isPartner ? t('services.partnerBadge') : t('services.directBadge')}
                </span>
              </div>
              <p className="mt-2 text-white/85 text-sm sm:text-base">{guide.intro}</p>
            </div>
          </div>

          {/* stat chips: duration + cost */}
          <div className="mt-5 flex flex-wrap gap-2">
            {guide.duration && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 border border-white/15 px-3 py-2 text-xs">
                <AppIcon name="clock" className="w-4 h-4 text-gold-light" />
                <span className="text-white/70">{t('serviceGuides.duration')}:</span>
                <bdi className="font-semibold">{guide.duration}</bdi>
              </span>
            )}
            {guide.cost && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 border border-white/15 px-3 py-2 text-xs">
                <AppIcon name="receipt" className="w-4 h-4 text-gold-light" />
                <span className="text-white/70">{t('serviceGuides.cost')}:</span>
                <bdi className="font-semibold">{guide.cost}</bdi>
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        {!isTranslated(slug, lang) && lang !== 'ar' && (
          <div className="amber-note text-xs flex items-center gap-3 flex-wrap">
            <span className="flex-1 min-w-0">{t('serviceGuides.translationNote')}</span>
            <Link to={`/premium?topic=${encodeURIComponent(service?.id ?? '')}`} className="btn-secondary !h-8 text-xs shrink-0">
              <AppIcon name="message-circle" className="w-3.5 h-3.5" />
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
            <ul className="flex flex-col gap-2">
              {guide.documents.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 w-5 h-5 rounded-md bg-navy text-white flex items-center justify-center shrink-0">
                    <AppIcon name="check" className="w-3 h-3" />
                  </span>
                  <bdi>{d}</bdi>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {guide.steps.length > 0 && (
          <SectionCard icon="check-circle" title={t('serviceGuides.steps')}>
            <ol className="relative flex flex-col gap-4 ms-3">
              {guide.steps.map((s, i) => (
                <li key={i} className="relative ps-7">
                  <span className="absolute start-0 top-0 w-6 h-6 rounded-full bg-navy text-white text-xs font-extrabold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {i < guide.steps.length - 1 && (
                    <span className="absolute start-3 top-6 bottom-[-1rem] w-px bg-cream-dark" aria-hidden />
                  )}
                  <bdi>{s}</bdi>
                </li>
              ))}
            </ol>
          </SectionCard>
        )}

        {guide.mistakes.length > 0 && (
          <section className="rounded-card bg-amber-50 border border-amber-200 p-5">
            <h2 className="font-extrabold text-amber-900 inline-flex items-center gap-2">
              <AppIcon name="alert-triangle" className="w-5 h-5" />
              {t('serviceGuides.mistakes')}
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-amber-900/90">
              {guide.mistakes.map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <bdi>{m}</bdi>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* cost disclaimer */}
        <p className="text-xs text-navy/50">{t('serviceGuides.disclaimer')}</p>

        {/* how Rafiq helps + CTA */}
        <section className="rounded-card bg-navy text-white p-6">
          <div className="flex items-center gap-2">
            <AppIcon name="shield-check" className="w-5 h-5 text-gold-light" />
            <h2 className="font-extrabold">{t('serviceGuides.rafiqHelp')}</h2>
            <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 ${isPartner ? 'bg-gold-soft text-gold-dark' : 'bg-white/20 text-white'}`}>
              {isPartner ? t('services.partnerBadge') : t('services.directBadge')}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/85">{guide.rafiqHelp}</p>
          <button onClick={() => (service ? setRequesting(true) : navigate('/services'))} className="btn-gold w-full mt-5">
            <AppIcon name="message-circle" className="w-4 h-4" />
            {t('services.request')}
          </button>
        </section>

        <p className="text-center text-[11px] text-navy/40">{t('serviceGuides.independent')}</p>
      </div>

      {/* sticky CTA on mobile */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-cream-dark p-3">
        <button onClick={() => (service ? setRequesting(true) : navigate('/services'))} className="btn-primary w-full">
          <AppIcon name="message-circle" className="w-4 h-4" />
          {t('services.request')}
        </button>
      </div>

      {requesting && service && <ServiceRequestModal service={service} onClose={() => setRequesting(false)} />}
    </div>
  );
}
