import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageMeta, SITE_URL } from '../lib/seo';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { useMedicalLeadForm, WA_ENABLED, humanFileSize } from './healthTourism/useMedicalLeadForm';
import type { SpecialtyChip } from './healthTourism/useMedicalLeadForm';
import { useAutoCarousel } from './healthTourism/useAutoCarousel';
import { useSnapCarousel } from './healthTourism/useSnapCarousel';
import { BEFORE_AFTER_IMAGES } from './healthTourism/beforeAfterSlides';
import { pickLocalized } from './healthTourism/pickLocalized';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { medicalContent } from '../lib/api';

/**
 * /health-tourism landing page — desktop. Structure, copy and layout are a
 * 1:1 port of the client-provided medical-desktop.html mockup — see
 * src/i18n/locales/*.json under `medical.landing.desktop.*` for the exact
 * copy, transcribed from the mockup. Fonts and colors were repainted onto
 * the site's own brand system (navy/cream/gold, Inter + IBM Plex Sans
 * Arabic) instead of the mockup's Rubik + slate/blue/purple palette, so this
 * page reads as part of Rafiq Istanbul rather than a standalone landing
 * page. The only functional addition is wiring the form to
 * medicalRequests.create() (the rest of the app's pattern) instead of the
 * mockup's WhatsApp-only submission; WhatsApp is kept as the success
 * modal's own "continue" action, exactly as the mockup already does.
 * Phones get mobile/index.html's layout instead: src/pages/mobile/MobileHealthTourism.tsx.
 */

const SPECIALTY_SLUGS = ['hair', 'dental', 'bariatric', 'eye', 'cosmetic'] as const;
type SpecialtySlug = (typeof SPECIALTY_SLUGS)[number];

interface SpecialtyCopy {
  slug: SpecialtySlug;
  title: string;
  description: string;
  image: string;
}
interface HowStep {
  title: string;
  body: string;
}
interface LogisticsCard {
  icon: 'car' | 'hotel' | 'languages';
  title: string;
  description: string;
  tag: string;
  availabilityLabel: string;
  availabilityValue: string;
  cta: string;
}
interface TestimonialCopy {
  initials: string;
  quote: string;
  name: string;
  location: string;
}
interface FaqCopy {
  q: string;
  a: string;
}
interface HeroSlideCopy {
  title: string;
}

const HOW_STYLES = [
  { circle: 'bg-navy/10 text-navy border-navy/20', icon: 'search' as const },
  { circle: 'bg-gold-soft text-gold-dark border-black/10', icon: 'file-text' as const },
  { circle: 'bg-brand-blue text-navy border-navy/15', icon: 'briefcase' as const },
  { circle: 'bg-cream-dark/70 text-navy-dark border-navy/20', icon: 'bar-chart-2' as const },
];

function BeforeAfterCard({
  src,
  caption,
  beforeLabel,
  afterLabel,
}: {
  src: string;
  caption: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="min-w-full w-full rounded-3xl overflow-hidden shadow-2xl border border-white/15 shrink-0 bg-navy-dark">
      <div className="h-[330px] relative">
        <img src={src} alt={caption} className="w-full h-full object-contain" />
        <div className="absolute top-4 right-4 bg-emerald-600/90 backdrop-blur-md text-white text-xs font-black px-4 py-1.5 rounded-full border border-emerald-400/30 shadow-md flex items-center gap-1.5">
          <AppIcon name="check-circle" className="w-4 h-4 text-white" />
          <span>{afterLabel}</span>
        </div>
        <div className="absolute top-4 left-4 bg-navy-dark/85 backdrop-blur-md text-white text-xs font-black px-4 py-1.5 rounded-full border border-white/20 shadow-md flex items-center gap-1.5">
          <AppIcon name="history" className="w-4 h-4 text-white/60" />
          <span>{beforeLabel}</span>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/80 pointer-events-none flex items-center justify-center -translate-x-1/2">
          <div className="w-8 h-8 rounded-full bg-white text-navy shadow-xl flex items-center justify-center text-xs font-black border border-cream-dark">
            <AppIcon name="arrow-left-right" className="w-4 h-4 text-navy" />
          </div>
        </div>
      </div>
      <div className="bg-navy-dark text-white text-xs font-black px-4 py-2.5 border-t border-white/10 text-center">
        {caption}
      </div>
    </div>
  );
}

export function HealthTourism() {
  const { t, i18n } = useTranslation();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

  usePageMeta({
    title: t('medical.seo.title'),
    description: t('medical.seo.description'),
    image: `${SITE_URL}${BEFORE_AFTER_IMAGES[0]}`,
  });

  const D = 'medical.landing.desktop';
  const fallbackSpecialtyItems = t(`${D}.specialties.items`, { returnObjects: true }) as SpecialtyCopy[];
  const howSteps = t('medical.landing.how.steps', { returnObjects: true }) as HowStep[];
  const logisticsCards = t(`${D}.logistics.cards`, { returnObjects: true }) as LogisticsCard[];
  const testimonialItems = t(`${D}.testimonials.items`, { returnObjects: true }) as TestimonialCopy[];
  const faqItems = t(`${D}.faq.items`, { returnObjects: true }) as FaqCopy[];
  const fallbackHeroSlides = t('medical.landing.heroBeforeAfter.slides', { returnObjects: true }) as HeroSlideCopy[];
  const beforeLabel = t('medical.landing.heroBeforeAfter.beforeLabel');
  const afterLabel = t('medical.landing.heroBeforeAfter.afterLabel');

  // Admin-editable in AdminMedical > Content; falls back to the shipped
  // copy/images above until the CMS has rows (or if it's briefly unreachable).
  const landingCards = useAsyncSection(() => medicalContent.landingCards(), []);
  const heroSlideRows = useAsyncSection(() => medicalContent.heroSlides(), []);

  const specialtyItems: SpecialtyCopy[] = landingCards.data?.length
    ? landingCards.data.map((c) => ({ slug: c.slug as SpecialtySlug, title: pickLocalized(c.title, lang), description: pickLocalized(c.description, lang), image: c.imageUrl ?? '' }))
    : fallbackSpecialtyItems;

  const heroImages: string[] = heroSlideRows.data?.length ? heroSlideRows.data.map((s) => s.imageUrl) : [...BEFORE_AFTER_IMAGES];
  const heroCaptions: string[] = heroSlideRows.data?.length ? heroSlideRows.data.map((s) => pickLocalized(s.caption, lang)) : fallbackHeroSlides.map((s) => s.title);

  const hero = useAutoCarousel(heroImages.length, 3200);
  const specialtiesCarousel = useSnapCarousel(specialtyItems.length, 3200);

  const chips: SpecialtyChip[] = (t(`${D}.form.specialtyChips`, { returnObjects: true }) as string[]).map((label, i) => ({
    slug: ['hair', 'dental', 'rhinoplasty', 'jaw'][i] ?? label,
    label,
  }));
  const form = useMedicalLeadForm(chips);
  const formTrust = t(`${D}.form.trust`, { returnObjects: true }) as string[];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="bg-cream text-navy antialiased selection:bg-navy selection:text-white">
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

      <div className={`transition-all duration-500 ${form.successOpen ? 'blur-md scale-[0.98] brightness-90' : ''}`}>
        {/* ==================== HERO ==================== */}
        <section className="relative overflow-hidden bg-navy text-white py-14 lg:py-20 border-b border-white/10">
          <div className="absolute -top-24 -end-24 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -start-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-start">
                <div className="inline-flex items-center gap-2 bg-navy-dark/70 border border-white/15 px-4 py-2 rounded-full text-xs text-emerald-400 font-black shadow-md">
                  <AppIcon name="check-circle" className="w-4 h-4 text-emerald-400" />
                  <span>{t(`${D}.hero.badge`)}</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                  {t(`${D}.hero.title`)}
                </h1>

                <p className="text-base sm:text-lg text-white/70 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  {t(`${D}.hero.subtitle`)}
                </p>

                <div className="grid grid-cols-3 gap-4 pt-2 max-w-xl mx-auto lg:mx-0">
                  <div className="bg-white/10 border border-white/15 p-4 rounded-2xl text-center shadow-inner">
                    <span className="text-emerald-400 font-black text-xl block">{t(`${D}.hero.statFreeValue`)}</span>
                    <span className="text-xs text-white/60 font-bold">{t(`${D}.hero.statFreeLabel`)}</span>
                  </div>
                  <div className="bg-white/10 border border-white/15 p-4 rounded-2xl text-center shadow-inner">
                    <span className="text-emerald-400 font-black text-xl block">{t(`${D}.hero.statPatientsValue`)}</span>
                    <span className="text-xs text-white/60 font-bold">{t(`${D}.hero.statPatientsLabel`)}</span>
                  </div>
                  <div className="bg-white/10 border border-white/15 p-4 rounded-2xl text-center shadow-inner">
                    <span className="text-emerald-400 font-black text-xl block">{t(`${D}.hero.statCareValue`)}</span>
                    <span className="text-xs text-white/60 font-bold">{t(`${D}.hero.statCareLabel`)}</span>
                  </div>
                </div>

              </div>

              <div className="lg:col-span-5">
                <div className="bg-navy-dark/60 p-4 rounded-[36px] border border-white/10 shadow-2xl relative">
                  <div
                    className="relative overflow-hidden rounded-3xl select-none cursor-pointer"
                    onMouseEnter={hero.pause}
                    onMouseLeave={hero.resume}
                    onTouchStart={hero.pause}
                    onTouchEnd={hero.resume}
                  >
                    {heroImages.map((src, i) => (
                      <div key={src} className={i === hero.index ? 'block' : 'hidden'}>
                        <BeforeAfterCard src={src} caption={heroCaptions[i] ?? ''} beforeLabel={beforeLabel} afterLabel={afterLabel} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== SPECIALTIES ==================== */}
        <section id="specialties" className="py-16 bg-cream border-b border-cream-dark">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <h2 className="text-3xl font-black text-navy tracking-tight">{t(`${D}.specialties.title`)}</h2>
              <p className="text-sm text-navy/70 font-medium">{t(`${D}.specialties.subtitle`)}</p>
            </div>

            <div
              ref={specialtiesCarousel.trackRef}
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4"
            >
              {specialtyItems.map((item) => (
                <div
                  key={item.slug}
                  onMouseEnter={specialtiesCarousel.pause}
                  onMouseLeave={specialtiesCarousel.resume}
                  className="snap-center w-full shrink-0 h-[430px] rounded-[32px] overflow-hidden relative shadow-xl border border-cream-dark group bg-navy-dark transition hover:-translate-y-1 hover:shadow-2xl"
                >
                  <img
                    src={item.image.startsWith('/') || item.image.startsWith('http') ? item.image : `/img/health-tourism/${item.image}`}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover brightness-105 contrast-105 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-dark via-navy-dark/80 to-transparent p-6 flex flex-col justify-end text-white space-y-3">
                    <h3 className="text-2xl font-black text-white drop-shadow-md">{item.title}</h3>
                    <p className="text-xs text-white/80 font-medium leading-relaxed max-w-xl">{item.description}</p>
                    <div className="pt-2 max-w-sm">
                      <a
                        href="#lead-form"
                        onClick={() => form.setFormSpecialty(item.slug)}
                        className="w-full py-3.5 rounded-2xl bg-white hover:bg-cream text-navy text-xs font-black text-center block shadow-lg active:scale-95 transition"
                      >
                        {t(`${D}.specialties.ctaQuote`)} <DirArrow className="w-4 h-4 inline ms-1" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-1">
              {specialtyItems.map((item, i) => (
                <span
                  key={item.slug}
                  className={`rounded-full inline-block ${i === specialtiesCarousel.index ? 'w-2.5 h-2.5 bg-navy shadow-sm' : 'w-2 h-2 bg-navy/20'}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ==================== HOW IT WORKS ==================== */}
        <section id="how-it-works" className="py-16 bg-white border-b border-cream-dark">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-navy tracking-tight">{t('medical.landing.how.title')}</h2>
              <p className="text-sm text-navy/60 font-medium mt-2">{t(`${D}.how.subtitle`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howSteps.map((step, i) => (
                <div key={step.title} className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-navy shadow-lg relative flex flex-col h-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-full font-black text-3xl flex items-center justify-center border shadow-sm ${HOW_STYLES[i].circle}`}>
                      {i + 1}
                    </div>
                    <AppIcon name={HOW_STYLES[i].icon} className="w-6 h-6 text-navy/40" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-navy mb-1.5">{step.title}</h3>
                    <p className="text-xs text-navy/60 font-medium leading-relaxed break-words">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== LOGISTICS ==================== */}
        <section id="logistics" className="py-16 bg-navy text-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-white">{t(`${D}.logistics.title`)}</h2>
              <p className="text-sm text-white/70 font-medium mt-2">{t(`${D}.logistics.subtitle`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {logisticsCards.map((card) => (
                <div key={card.title} className="bg-white rounded-3xl p-6 text-navy shadow-2xl flex flex-col justify-between h-[230px]">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center shrink-0 shadow-sm">
                        <AppIcon name={card.icon} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-navy">{card.title}</h3>
                        <p className="text-xs text-navy/60 font-medium">{card.description}</p>
                      </div>
                    </div>
                    <div className="inline-block px-3 py-1 rounded-lg bg-cream border border-cream-dark text-xs font-bold text-navy/80">
                      {card.tag}
                    </div>
                  </div>
                  <div className="border-t border-cream-dark pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-navy/50 block">{card.availabilityLabel}</span>
                      <span className="text-xs font-black text-emerald-600">{card.availabilityValue}</span>
                    </div>
                    <a href="#lead-form" className="bg-navy hover:bg-navy-light text-white text-xs font-black px-5 py-2.5 rounded-full shadow-md active:scale-95 transition">
                      {card.cta}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== TESTIMONIALS ==================== */}
        <section id="testimonials" className="py-16 bg-cream border-b border-cream-dark">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-navy tracking-tight">{t('medical.landing.testimonials.title')}</h2>
              <p className="text-sm text-navy/60 font-medium mt-2">{t(`${D}.testimonials.subtitle`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {testimonialItems.map((item) => (
                <div key={item.name} className="bg-white p-8 rounded-3xl border border-cream-dark shadow-lg relative flex flex-col justify-between">
                  <div className="text-gold-dark text-[60px] leading-none absolute top-4 start-6 opacity-20 font-serif font-black">&rdquo;</div>
                  <div className="space-y-4 relative z-10 mb-6">
                    <div className="flex items-center text-gold-dark text-base tracking-widest gap-1 font-bold">★ ★ ★ ★ ★</div>
                    <p className="text-base text-navy leading-relaxed font-bold">&quot;{item.quote}&quot;</p>
                  </div>
                  <div className="pt-4 border-t border-cream-dark flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold-soft text-gold-dark font-black text-base flex items-center justify-center shrink-0">
                      {item.initials}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-navy">{item.name}</h4>
                      <span className="text-xs text-navy/60 font-bold block">{item.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== LEAD FORM ==================== */}
        <section id="lead-form" className="py-16 bg-white border-b border-cream-dark">
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-white rounded-[36px] p-8 lg:p-10 shadow-2xl border border-cream-dark relative">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5 space-y-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-e border-cream-dark pb-6 lg:pb-0 lg:pe-8">
                  <div>
                    <h2 className="text-2xl font-black text-navy mb-3">
                      {form.requestType === 'consultation' ? t(`${D}.form.titleConsult`) : t(`${D}.form.titleEval`)}
                    </h2>
                    <p className="text-xs text-navy/60 font-medium leading-relaxed">{t(`${D}.form.subtitle`)}</p>
                  </div>

                  <div className="space-y-4">
                    {(['check', 'shield-check', 'car'] as const).map((icon, i) => (
                      <div key={icon} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <AppIcon name={icon} className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-navy/80">{formTrust[i]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-cream p-4 rounded-2xl border border-cream-dark">
                    <span className="text-[10px] font-bold text-navy/50 block">{t(`${D}.form.directContactLabel`)}</span>
                    <span className="text-sm font-black text-navy font-mono" dir="ltr">
                      {t(`${D}.form.directContactValue`)}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-cream p-1.5 rounded-full flex max-w-sm mx-auto">
                    {(['consultation', 'evaluation'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => form.setRequestType(type)}
                        className={`w-1/2 py-2.5 rounded-full font-black text-xs transition-all border cursor-pointer ${
                          form.requestType === type ? 'bg-white text-navy shadow-md border-cream-dark' : 'text-navy/60 font-bold border-transparent hover:text-navy'
                        }`}
                      >
                        {t(`medical.landing.form.requestType.${type}`)}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={form.submitConsultation} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="d-name" className="block text-xs font-extrabold text-navy/60">
                          {t(`${D}.form.name.label`)} <span className="text-brand-red">*</span>
                        </label>
                        <input
                          id="d-name"
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => form.setName(e.target.value)}
                          placeholder={t(`${D}.form.name.placeholder`)}
                          className="w-full bg-cream border-none rounded-2xl px-4 py-3.5 text-xs text-navy placeholder:text-navy/40 outline-none focus:ring-2 focus:ring-navy transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="d-phone" className="block text-xs font-extrabold text-navy/60">
                          {t(`${D}.form.phone.label`)} <span className="text-brand-red">*</span>
                        </label>
                        <input
                          id="d-phone"
                          type="tel"
                          required
                          dir="ltr"
                          value={form.phone}
                          onChange={(e) => form.setPhone(e.target.value)}
                          placeholder={t(`${D}.form.phone.placeholder`)}
                          className="w-full bg-cream border-none rounded-2xl px-4 py-3.5 text-xs text-navy placeholder:text-navy/40 outline-none focus:ring-2 focus:ring-navy transition text-end"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-navy/60">{t(`${D}.form.specialtyLabel`)}</label>
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                        {chips.map((chip) => (
                          <button
                            key={chip.slug}
                            type="button"
                            onClick={() => form.setFormSpecialty(chip.slug)}
                            className={`px-5 py-2.5 rounded-full text-xs shrink-0 transition-all cursor-pointer ${
                              form.formSpecialty === chip.slug
                                ? 'font-black bg-navy text-white shadow-md'
                                : 'font-bold bg-cream text-navy/80 border border-cream-dark hover:bg-cream-dark'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-navy/60">{t(`${D}.form.files.label`)}</label>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => form.fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') form.fileInputRef.current?.click();
                        }}
                        className="w-full bg-cream rounded-2xl p-4 text-center cursor-pointer hover:bg-cream-dark transition"
                      >
                        <input
                          ref={form.fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          accept={form.FILE_ACCEPT}
                          onChange={(e) => {
                            form.addFiles(e.target.files);
                            e.target.value = '';
                          }}
                        />
                        <span className="cursor-pointer text-xs font-extrabold text-navy/80 flex items-center justify-center gap-2">
                          <AppIcon name="paperclip" className="w-4 h-4 text-navy/50" />
                          <span className={form.files.length > 0 ? 'text-emerald-600' : ''}>
                            {form.files.length > 0 ? `${form.files.length} ${form.files.length === 1 ? '' : ''}✓` : t(`${D}.form.files.cta`)}
                          </span>
                        </span>
                      </div>
                      {form.files.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {form.files.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-cream text-[11px]">
                              <span className="truncate font-semibold text-navy/80">
                                {file.name} ({humanFileSize(file.size)})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="d-notes" className="block text-xs font-extrabold text-navy/60">
                        {t(`${D}.form.notes.label`)}
                      </label>
                      <textarea
                        id="d-notes"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => form.setNotes(e.target.value)}
                        placeholder={t(`${D}.form.notes.placeholder`)}
                        className="w-full bg-cream border-none rounded-2xl px-4 py-3 text-xs text-navy placeholder:text-navy/40 outline-none focus:ring-2 focus:ring-navy transition"
                      />
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          form.setName('');
                          form.setPhone('');
                          form.setNotes('');
                          form.setFormSpecialty(chips[0]?.slug ?? '');
                        }}
                        className="w-1/3 py-4 rounded-full bg-cream hover:bg-cream-dark active:scale-95 text-navy/80 font-extrabold text-xs text-center transition"
                      >
                        {t(`${D}.form.reset`)}
                      </button>
                      <button
                        type="submit"
                        disabled={form.submitting}
                        className="w-2/3 py-4 rounded-full bg-navy hover:bg-navy-light active:scale-95 text-white font-black text-xs text-center transition shadow-xl disabled:opacity-60"
                      >
                        {form.submitting ? t('medical.landing.form.sending') : t(`${D}.form.submit`)}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== FAQ ==================== */}
        <section id="faq" className="py-16 bg-cream border-b border-cream-dark">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl font-black text-navy tracking-tight">{t(`${D}.faq.title`)}</h2>
            </div>

            <FaqAccordion items={faqItems} />
          </div>
        </section>
      </div>

      {/* ==================== SUCCESS MODAL ==================== */}
      {form.successOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-navy-dark/60 backdrop-blur-md transition-all duration-300"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-cream-dark relative text-navy space-y-5">
            <div className="w-12 h-1.5 bg-cream-dark rounded-full mx-auto mb-2" />
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <AppIcon name="check-circle" className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black text-navy">{t(`${D}.successModal.title`)}</h3>
              <p className="text-xs text-navy/60 font-medium leading-relaxed">{t(`${D}.successModal.body`)}</p>
            </div>
            <div className="pt-2">
              {WA_ENABLED && form.waHref ? (
                <a
                  href={form.waHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => form.setSuccessOpen(false)}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs text-center transition shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AppIcon name="message-circle" className="w-5 h-5" />
                  <span>{t(`${D}.successModal.cta`)}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => form.setSuccessOpen(false)}
                  className="w-full py-4 rounded-2xl bg-navy hover:bg-navy-light active:scale-95 text-white font-black text-xs text-center transition shadow-xl"
                >
                  {t(`${D}.successModal.cta`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqAccordion({ items }: { items: FaqCopy[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className="bg-white rounded-2xl border border-cream-dark overflow-hidden shadow-sm transition-all">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="w-full p-5 text-start text-sm font-extrabold text-navy flex items-center justify-between gap-4 focus:outline-none"
            >
              <span>{item.q}</span>
              <AppIcon name="plus" className={`w-5 h-5 text-navy/40 shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} />
            </button>
            <div className="overflow-hidden transition-[max-height] duration-300" style={{ maxHeight: open ? '400px' : '0px' }}>
              <div className="p-5 pt-0 text-xs text-navy/70 leading-relaxed border-t border-cream-dark">{item.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
