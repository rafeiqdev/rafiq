import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageMeta, SITE_URL } from '../lib/seo';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { useMedicalLeadForm, WA_ENABLED, humanFileSize } from './healthTourism/useMedicalLeadForm';
import type { SpecialtyChip } from './healthTourism/useMedicalLeadForm';
import { useAutoCarousel } from './healthTourism/useAutoCarousel';
import { useSnapCarousel } from './healthTourism/useSnapCarousel';
import { BEFORE_AFTER_IMAGES } from './healthTourism/beforeAfterSlides';

/**
 * /health-tourism landing page — desktop. This is a 1:1 port of the
 * client-provided medical-desktop.html mockup (structure, copy, order,
 * colors) into React/Tailwind/i18n, NOT a redesign — see
 * src/i18n/locales/*.json under `medical.landing.desktop.*` for the exact
 * copy, transcribed from the mockup. The only functional addition is wiring
 * the form to medicalRequests.create() (the rest of the app's pattern)
 * instead of the mockup's WhatsApp-only submission; WhatsApp is kept as the
 * success modal's own "continue" action, exactly as the mockup already does.
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
  { circle: 'bg-orange-50 text-orange-500 border-orange-200', icon: 'search' as const },
  { circle: 'bg-rose-50 text-rose-500 border-rose-200', icon: 'file-text' as const },
  { circle: 'bg-purple-50 text-purple-600 border-purple-200', icon: 'briefcase' as const },
  { circle: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'bar-chart-2' as const },
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
    <div className="min-w-full w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 shrink-0 bg-slate-900">
      <div className="h-[330px] relative">
        <img src={src} alt={caption} className="w-full h-full object-contain" />
        <div className="absolute top-4 right-4 bg-emerald-600/90 backdrop-blur-md text-white text-xs font-black px-4 py-1.5 rounded-full border border-emerald-400/30 shadow-md flex items-center gap-1.5">
          <AppIcon name="check-circle" className="w-4 h-4 text-white" />
          <span>{afterLabel}</span>
        </div>
        <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md text-white text-xs font-black px-4 py-1.5 rounded-full border border-white/20 shadow-md flex items-center gap-1.5">
          <AppIcon name="history" className="w-4 h-4 text-slate-400" />
          <span>{beforeLabel}</span>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/80 pointer-events-none flex items-center justify-center -translate-x-1/2">
          <div className="w-8 h-8 rounded-full bg-white text-slate-950 shadow-xl flex items-center justify-center text-xs font-black border border-slate-200">
            <AppIcon name="arrow-left-right" className="w-4 h-4 text-slate-900" />
          </div>
        </div>
      </div>
      <div className="bg-slate-950 text-white text-xs font-black px-4 py-2.5 border-t border-white/10 text-center">
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
  const specialtyItems = t(`${D}.specialties.items`, { returnObjects: true }) as SpecialtyCopy[];
  const howSteps = t('medical.landing.how.steps', { returnObjects: true }) as HowStep[];
  const logisticsCards = t(`${D}.logistics.cards`, { returnObjects: true }) as LogisticsCard[];
  const testimonialItems = t(`${D}.testimonials.items`, { returnObjects: true }) as TestimonialCopy[];
  const faqItems = t(`${D}.faq.items`, { returnObjects: true }) as FaqCopy[];
  const heroSlides = t('medical.landing.heroBeforeAfter.slides', { returnObjects: true }) as HeroSlideCopy[];
  const beforeLabel = t('medical.landing.heroBeforeAfter.beforeLabel');
  const afterLabel = t('medical.landing.heroBeforeAfter.afterLabel');

  const hero = useAutoCarousel(BEFORE_AFTER_IMAGES.length, 3200);
  const specialtiesCarousel = useSnapCarousel(specialtyItems.length, 3200);

  const chips: SpecialtyChip[] = (t(`${D}.form.specialtyChips`, { returnObjects: true }) as string[]).map((label, i) => ({
    slug: ['hair', 'dental', 'rhinoplasty', 'jaw'][i] ?? label,
    label,
  }));
  const form = useMedicalLeadForm(chips);
  const formTrust = t(`${D}.form.trust`, { returnObjects: true }) as string[];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="bg-slate-50 text-slate-800 font-rubik antialiased selection:bg-navy selection:text-white">
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
        <section className="relative overflow-hidden bg-slate-950 text-white py-14 lg:py-20 border-b border-slate-800">
          <div className="absolute -top-24 -end-24 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -start-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-start">
                <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-full text-xs text-emerald-400 font-black shadow-md">
                  <AppIcon name="check-circle" className="w-4 h-4 text-emerald-400" />
                  <span>{t(`${D}.hero.badge`)}</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight font-rubik tracking-tight">
                  {t(`${D}.hero.title`)}
                </h1>

                <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  {t(`${D}.hero.subtitle`)}
                </p>

                <div className="grid grid-cols-3 gap-4 pt-2 max-w-xl mx-auto lg:mx-0">
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center shadow-inner">
                    <span className="text-emerald-400 font-black text-xl block">{t(`${D}.hero.statFreeValue`)}</span>
                    <span className="text-xs text-slate-400 font-bold">{t(`${D}.hero.statFreeLabel`)}</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center shadow-inner">
                    <span className="text-emerald-400 font-black text-xl block">{t(`${D}.hero.statPatientsValue`)}</span>
                    <span className="text-xs text-slate-400 font-bold">{t(`${D}.hero.statPatientsLabel`)}</span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center shadow-inner">
                    <span className="text-emerald-400 font-black text-xl block">{t(`${D}.hero.statCareValue`)}</span>
                    <span className="text-xs text-slate-400 font-bold">{t(`${D}.hero.statCareLabel`)}</span>
                  </div>
                </div>

              </div>

              <div className="lg:col-span-5">
                <div className="bg-slate-900/90 p-4 rounded-[36px] border border-slate-800 shadow-2xl relative">
                  <div
                    className="relative overflow-hidden rounded-3xl select-none cursor-pointer"
                    onMouseEnter={hero.pause}
                    onMouseLeave={hero.resume}
                    onTouchStart={hero.pause}
                    onTouchEnd={hero.resume}
                  >
                    {BEFORE_AFTER_IMAGES.map((src, i) => (
                      <div key={src} className={i === hero.index ? 'block' : 'hidden'}>
                        <BeforeAfterCard src={src} caption={heroSlides[i]?.title ?? ''} beforeLabel={beforeLabel} afterLabel={afterLabel} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== SPECIALTIES ==================== */}
        <section id="specialties" className="py-16 bg-slate-50 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <h2 className="text-3xl font-black text-slate-950 font-rubik tracking-tight">{t(`${D}.specialties.title`)}</h2>
              <p className="text-sm text-slate-600 font-medium">{t(`${D}.specialties.subtitle`)}</p>
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
                  className="snap-center w-full shrink-0 h-[430px] rounded-[32px] overflow-hidden relative shadow-xl border border-slate-200/80 group bg-slate-900 transition hover:-translate-y-1 hover:shadow-2xl"
                >
                  <img
                    src={`/img/health-tourism/${item.image}`}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover brightness-105 contrast-105 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-6 flex flex-col justify-end text-white space-y-3">
                    <h3 className="text-2xl font-black text-white font-rubik drop-shadow-md">{item.title}</h3>
                    <p className="text-xs text-slate-200 font-medium leading-relaxed max-w-xl">{item.description}</p>
                    <div className="pt-2 max-w-sm">
                      <a
                        href="#lead-form"
                        onClick={() => form.setFormSpecialty(item.slug)}
                        className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black text-center block shadow-lg active:scale-95 transition"
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
                  className={`rounded-full inline-block ${i === specialtiesCarousel.index ? 'w-2.5 h-2.5 bg-slate-900 shadow-sm' : 'w-2 h-2 bg-slate-300'}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ==================== HOW IT WORKS ==================== */}
        <section id="how-it-works" className="py-16 bg-white border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-slate-950 font-rubik tracking-tight">{t('medical.landing.how.title')}</h2>
              <p className="text-sm text-slate-500 font-medium mt-2">{t(`${D}.how.subtitle`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howSteps.map((step, i) => (
                <div key={step.title} className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-slate-800 shadow-lg relative flex flex-col h-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-full font-black text-3xl flex items-center justify-center border shadow-sm ${HOW_STYLES[i].circle}`}>
                      {i + 1}
                    </div>
                    <AppIcon name={HOW_STYLES[i].icon} className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-950 font-rubik mb-1.5">{step.title}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== LOGISTICS ==================== */}
        <section id="logistics" className="py-16 bg-[#2563eb] text-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-black font-rubik text-white">{t(`${D}.logistics.title`)}</h2>
              <p className="text-sm text-blue-100 font-medium mt-2">{t(`${D}.logistics.subtitle`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {logisticsCards.map((card) => (
                <div key={card.title} className="bg-white rounded-3xl p-6 text-slate-900 shadow-2xl flex flex-col justify-between h-[230px]">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                        <AppIcon name={card.icon} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-950 font-rubik">{card.title}</h3>
                        <p className="text-xs text-slate-500 font-medium">{card.description}</p>
                      </div>
                    </div>
                    <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                      {card.tag}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">{card.availabilityLabel}</span>
                      <span className="text-xs font-black text-emerald-600">{card.availabilityValue}</span>
                    </div>
                    <a href="#lead-form" className="bg-slate-950 hover:bg-black text-white text-xs font-black px-5 py-2.5 rounded-full shadow-md active:scale-95 transition">
                      {card.cta}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== TESTIMONIALS ==================== */}
        <section id="testimonials" className="py-16 bg-slate-50 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-black text-slate-950 font-rubik tracking-tight">{t('medical.landing.testimonials.title')}</h2>
              <p className="text-sm text-slate-500 font-medium mt-2">{t(`${D}.testimonials.subtitle`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {testimonialItems.map((item) => (
                <div key={item.name} className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-lg relative flex flex-col justify-between">
                  <div className="text-purple-600 text-[60px] leading-none absolute top-4 start-6 opacity-20 font-serif font-black">&rdquo;</div>
                  <div className="space-y-4 relative z-10 mb-6">
                    <div className="flex items-center text-purple-600 text-base tracking-widest gap-1 font-bold">★ ★ ★ ★ ★</div>
                    <p className="text-base text-slate-800 leading-relaxed font-bold">&quot;{item.quote}&quot;</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 font-black text-base flex items-center justify-center shrink-0">
                      {item.initials}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-950">{item.name}</h4>
                      <span className="text-xs text-slate-500 font-bold block">{item.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== LEAD FORM ==================== */}
        <section id="lead-form" className="py-16 bg-white border-b border-slate-200/80">
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-white rounded-[36px] p-8 lg:p-10 shadow-2xl border border-slate-200/80 relative">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5 space-y-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-e border-slate-200 pb-6 lg:pb-0 lg:pe-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950 font-rubik mb-3">
                      {form.requestType === 'consultation' ? t(`${D}.form.titleConsult`) : t(`${D}.form.titleEval`)}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{t(`${D}.form.subtitle`)}</p>
                  </div>

                  <div className="space-y-4">
                    {(['check', 'shield-check', 'car'] as const).map((icon, i) => (
                      <div key={icon} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <AppIcon name={icon} className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{formTrust[i]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block">{t(`${D}.form.directContactLabel`)}</span>
                    <span className="text-sm font-black text-slate-950 font-mono" dir="ltr">
                      {t(`${D}.form.directContactValue`)}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-[#f4f4f5] p-1.5 rounded-full flex max-w-sm mx-auto">
                    {(['consultation', 'evaluation'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => form.setRequestType(type)}
                        className={`w-1/2 py-2.5 rounded-full font-black text-xs transition-all border cursor-pointer ${
                          form.requestType === type ? 'bg-white text-slate-900 shadow-md border-slate-200' : 'text-slate-500 font-bold border-transparent hover:text-slate-900'
                        }`}
                      >
                        {t(`medical.landing.form.requestType.${type}`)}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={form.submitConsultation} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="d-name" className="block text-xs font-extrabold text-slate-500">
                          {t(`${D}.form.name.label`)} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="d-name"
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => form.setName(e.target.value)}
                          placeholder={t(`${D}.form.name.placeholder`)}
                          className="w-full bg-[#f4f4f5] border-none rounded-2xl px-4 py-3.5 text-xs text-slate-950 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-950 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="d-phone" className="block text-xs font-extrabold text-slate-500">
                          {t(`${D}.form.phone.label`)} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="d-phone"
                          type="tel"
                          required
                          dir="ltr"
                          value={form.phone}
                          onChange={(e) => form.setPhone(e.target.value)}
                          placeholder={t(`${D}.form.phone.placeholder`)}
                          className="w-full bg-[#f4f4f5] border-none rounded-2xl px-4 py-3.5 text-xs text-slate-950 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-950 transition text-end"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-500">{t(`${D}.form.specialtyLabel`)}</label>
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                        {chips.map((chip) => (
                          <button
                            key={chip.slug}
                            type="button"
                            onClick={() => form.setFormSpecialty(chip.slug)}
                            className={`px-5 py-2.5 rounded-full text-xs shrink-0 transition-all cursor-pointer ${
                              form.formSpecialty === chip.slug
                                ? 'font-black bg-slate-950 text-white shadow-md'
                                : 'font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-500">{t(`${D}.form.files.label`)}</label>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => form.fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') form.fileInputRef.current?.click();
                        }}
                        className="w-full bg-[#f4f4f5] rounded-2xl p-4 text-center cursor-pointer hover:bg-slate-200 transition"
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
                        <span className="cursor-pointer text-xs font-extrabold text-slate-700 flex items-center justify-center gap-2">
                          <AppIcon name="paperclip" className="w-4 h-4 text-slate-500" />
                          <span className={form.files.length > 0 ? 'text-emerald-600' : ''}>
                            {form.files.length > 0 ? `${form.files.length} ${form.files.length === 1 ? '' : ''}✓` : t(`${D}.form.files.cta`)}
                          </span>
                        </span>
                      </div>
                      {form.files.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {form.files.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 text-[11px]">
                              <span className="truncate font-semibold text-slate-700">
                                {file.name} ({humanFileSize(file.size)})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="d-notes" className="block text-xs font-extrabold text-slate-500">
                        {t(`${D}.form.notes.label`)}
                      </label>
                      <textarea
                        id="d-notes"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => form.setNotes(e.target.value)}
                        placeholder={t(`${D}.form.notes.placeholder`)}
                        className="w-full bg-[#f4f4f5] border-none rounded-2xl px-4 py-3 text-xs text-slate-950 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-950 transition"
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
                        className="w-1/3 py-4 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-extrabold text-xs text-center transition"
                      >
                        {t(`${D}.form.reset`)}
                      </button>
                      <button
                        type="submit"
                        disabled={form.submitting}
                        className="w-2/3 py-4 rounded-full bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs text-center transition shadow-xl disabled:opacity-60"
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
        <section id="faq" className="py-16 bg-slate-50 border-b border-slate-200/80">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl font-black text-slate-950 font-rubik tracking-tight">{t(`${D}.faq.title`)}</h2>
            </div>

            <FaqAccordion items={faqItems} />
          </div>
        </section>
      </div>

      {/* ==================== SUCCESS MODAL ==================== */}
      {form.successOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md transition-all duration-300"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-slate-200/80 relative text-slate-900 space-y-5">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <AppIcon name="check-circle" className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black font-rubik text-slate-950">{t(`${D}.successModal.title`)}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{t(`${D}.successModal.body`)}</p>
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
                  className="w-full py-4 rounded-2xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs text-center transition shadow-xl"
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
          <div key={item.q} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm transition-all">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="w-full p-5 text-start text-sm font-extrabold text-slate-950 flex items-center justify-between gap-4 focus:outline-none"
            >
              <span>{item.q}</span>
              <AppIcon name="plus" className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} />
            </button>
            <div className="overflow-hidden transition-[max-height] duration-300" style={{ maxHeight: open ? '400px' : '0px' }}>
              <div className="p-5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100">{item.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
