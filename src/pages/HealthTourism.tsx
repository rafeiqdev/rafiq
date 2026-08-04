import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { medicalContent } from '../lib/api';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { SectionState } from '../components/SectionState';
import { AppIcon } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { PageHero } from '../components/PageHero';
import { EXPLORE_PHOTOS } from '../lib/images';
import { usePageMeta, SITE_URL } from '../lib/seo';
import { track } from '../lib/analytics';
import type { MedicalFaq, MedicalPageSection, MedicalService, MedicalSpecialty, MedicalTestimonial } from '../lib/types';

type Lang = 'ar' | 'en' | 'ru' | 'fa';

function pick(v: { ar: string; en: string; fa: string; ru: string }, lang: string): string {
  const l = (lang.split('-')[0] as Lang) in { ar: 1, en: 1, ru: 1, fa: 1 } ? (lang.split('-')[0] as Lang) : 'en';
  return v[l] || v.en || v.ar || '';
}

const SPECIALTY_ICON: Record<string, IconName> = {
  hair_transplant: 'scissors',
  dental: 'smile',
  bariatric: 'heart-pulse',
  eye_care: 'shield-check',
  oncology: 'stethoscope',
  cardiology: 'heart-pulse',
  checkup: 'file-check',
  other: 'plus',
};
const SERVICE_ICON: Record<string, IconName> = {
  translation: 'languages',
  outreach: 'send',
  appointment: 'calendar',
  transport: 'car',
  accommodation: 'hotel',
  interpreter: 'message-circle',
  companion: 'user',
  medication: 'briefcase',
  nursing: 'heart-pulse',
  visa: 'plane',
};

function isSectionVisible(sections: MedicalPageSection[] | null, key: string): boolean {
  if (!sections) return true;
  const s = sections.find((x) => x.sectionKey === key);
  return s ? s.visible : true;
}

function FaqItem({ faq, lang }: { faq: MedicalFaq; lang: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start"
      >
        <span className="font-semibold text-navy">{pick(faq.question, lang)}</span>
        <AppIcon name="chevron-down" className={`w-4 h-4 shrink-0 text-navy/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-4 text-sm text-navy/70 leading-relaxed">{pick(faq.answer, lang)}</p>}
    </div>
  );
}

export function HealthTourism() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;

  const specialties = useAsyncSection<MedicalSpecialty[]>(() => medicalContent.specialties(), []);
  const services = useAsyncSection<MedicalService[]>(() => medicalContent.services(), []);
  const faqs = useAsyncSection<MedicalFaq[]>(() => medicalContent.faqs(), []);
  const testimonials = useAsyncSection<MedicalTestimonial[]>(() => medicalContent.testimonials(), []);
  const sections = useAsyncSection<MedicalPageSection[]>(() => medicalContent.sections(), []);
  const visible = (key: string) => isSectionVisible(sections.data, key);

  usePageMeta({
    title: t('medical.seo.title'),
    description: t('medical.seo.description'),
    image: `${SITE_URL}${EXPLORE_PHOTOS['/health-tourism']}`,
  });

  const goRequest = () => {
    track('service_click', { target: 'medical_request_cta' });
    navigate('/medical-request');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* structured data: a coordination service, never a medical provider */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'Medical tourism coordination',
            provider: { '@type': 'Organization', name: 'Rafiq Istanbul', url: SITE_URL },
            areaServed: { '@type': 'City', name: 'Istanbul' },
            description: t('medical.seo.description'),
          }),
        }}
      />

      {/* 1. Hero + trust indicators */}
      <PageHero image={EXPLORE_PHOTOS['/health-tourism']} title={t('medical.hero.title')} subtitle={t('medical.hero.subtitle')}>
        <button onClick={goRequest} className="btn-primary mt-5 w-fit">
          {t('medical.hero.cta')}
          <AppIcon name="arrow-right" className="w-4 h-4" />
        </button>
      </PageHero>

      {visible('trust') && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(['coordination', 'noGuarantee', 'istanbulOnly'] as const).map((k) => (
            <div key={k} className="card p-4 flex items-start gap-3">
              <div className="icon-chip shrink-0"><AppIcon name="shield-check" className="w-5 h-5" /></div>
              <p className="text-sm text-navy/70">{t(`medical.trust.${k}`)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 2. About */}
      {visible('about') && (
        <section className="mt-10">
          <p className="eyebrow">{t('medical.about.eyebrow')}</p>
          <h2 className="section-title mt-1">{t('medical.about.title')}</h2>
          <p className="mt-3 text-navy/70 leading-relaxed max-w-3xl">{t('medical.about.body')}</p>
        </section>
      )}

      {/* 3. How it works */}
      {visible('how_it_works') && (
        <section className="mt-10">
          <h2 className="section-title">{t('medical.how.title')}</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-4">
            {(['submit', 'compare', 'choose', 'support'] as const).map((k, i) => (
              <li key={k} className="card p-4">
                <span className="icon-chip !h-8 !w-8 text-sm font-extrabold">{i + 1}</span>
                <p className="mt-3 text-sm font-semibold text-navy">{t(`medical.how.${k}.title`)}</p>
                <p className="mt-1 text-xs text-navy/60">{t(`medical.how.${k}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 4. Specialties */}
      {visible('specialties') && (
        <section className="mt-10">
          <h2 className="section-title">{t('medical.specialties.title')}</h2>
          <SectionState section={specialties} title={t('medical.specialties.title')} empty={null}>
            {(rows) => (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {rows.filter((r) => r.visible).map((s) => (
                  <div key={s.id} className="card card-hover p-4 flex flex-col">
                    <div className="icon-chip"><AppIcon name={SPECIALTY_ICON[s.slug] ?? 'plus'} className="w-5 h-5" /></div>
                    <p className="mt-3 font-semibold text-navy text-sm">{pick(s.name, lang)}</p>
                    {pick(s.description, lang) && <p className="mt-1 text-xs text-navy/60 flex-1">{pick(s.description, lang)}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionState>
        </section>
      )}

      {/* 5. Center evaluation */}
      {visible('center_evaluation') && (
        <section className="mt-10">
          <h2 className="section-title">{t('medical.evaluation.title')}</h2>
          <p className="mt-2 text-sm text-navy/60 max-w-2xl">{t('medical.evaluation.subtitle')}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {(['license', 'specialty', 'reviews', 'accreditation', 'pricing', 'scope', 'comparison', 'onSite'] as const).map((k) => (
              <li key={k} className="flex items-start gap-2 text-sm text-navy/70">
                <AppIcon name="check-circle" className="w-4 h-4 mt-0.5 shrink-0 text-navy" />
                {t(`medical.evaluation.criteria.${k}`)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. Supporting services */}
      {visible('supporting_services') && (
        <section className="mt-10">
          <h2 className="section-title">{t('medical.services.title')}</h2>
          <SectionState section={services} title={t('medical.services.title')} empty={null}>
            {(rows) => (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {rows.filter((r) => r.visible).map((s) => (
                  <div key={s.id} className="card p-4 flex items-center gap-3">
                    <div className="icon-chip shrink-0 !h-10 !w-10"><AppIcon name={SERVICE_ICON[s.slug] ?? 'check-circle'} className="w-5 h-5" /></div>
                    <p className="text-sm font-medium text-navy">{pick(s.name, lang)}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionState>
        </section>
      )}

      {/* 7. Testimonials — admin-managed, published + consented only */}
      {visible('testimonials') && (
        <section className="mt-10">
          <h2 className="section-title">{t('medical.testimonials.title')}</h2>
          <SectionState
            section={testimonials}
            title={t('medical.testimonials.title')}
            empty={<p className="mt-3 text-sm text-navy/50">{t('medical.testimonials.empty')}</p>}
          >
            {(rows) => (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {rows.map((tst) => (
                  <blockquote key={tst.id} className="card p-5">
                    <p className="text-sm text-navy/80 leading-relaxed">"{pick(tst.quote, lang)}"</p>
                    <footer className="mt-3 text-xs font-semibold text-navy/60">{tst.authorName}</footer>
                  </blockquote>
                ))}
              </div>
            )}
          </SectionState>
        </section>
      )}

      {/* 8. FAQ */}
      {visible('faq') && (
        <section className="mt-10">
          <h2 className="section-title">{t('medical.faq.title')}</h2>
          <SectionState section={faqs} title={t('medical.faq.title')} empty={null}>
            {(rows) => (
              <div className="mt-5 flex flex-col gap-2">
                {rows.filter((r) => r.visible).map((f) => <FaqItem key={f.id} faq={f} lang={lang} />)}
              </div>
            )}
          </SectionState>
        </section>
      )}

      {/* 9. Medical/legal disclaimer */}
      {visible('disclaimer') && (
        <section className="mt-10 card p-5 bg-cream">
          <p className="text-xs text-navy/60 leading-relaxed">{t('medical.disclaimer.body')}</p>
        </section>
      )}

      {/* 10. Final CTA */}
      {visible('final_cta') && (
        <section className="mt-10 card p-8 text-center bg-navy text-white">
          <h2 className="text-xl font-extrabold">{t('medical.finalCta.title')}</h2>
          <p className="mt-2 text-sm text-white/80">{t('medical.finalCta.subtitle')}</p>
          <button onClick={goRequest} className="btn-primary mt-5">
            {t('medical.hero.cta')}
            <AppIcon name="arrow-right" className="w-4 h-4" />
          </button>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-navy/40">
        <Link to="/terms" className="hover:underline">{t('nav.terms')}</Link>
      </p>
    </div>
  );
}
