import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageMeta, SITE_URL } from '../../lib/seo';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { useMedicalLeadForm, WA_ENABLED, humanFileSize } from '../healthTourism/useMedicalLeadForm';
import type { SpecialtyChip } from '../healthTourism/useMedicalLeadForm';
import { useAutoCarousel } from '../healthTourism/useAutoCarousel';
import { useSnapCarousel } from '../healthTourism/useSnapCarousel';
import { BEFORE_AFTER_IMAGES } from '../healthTourism/beforeAfterSlides';
import { pickLocalized } from '../healthTourism/pickLocalized';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { medicalContent } from '../../lib/api';

/**
 * /health-tourism landing page — phone viewport. This is a 1:1 port of the
 * client-provided mobile/index.html mockup (structure, copy, order, colors),
 * NOT a redesign — see src/i18n/locales/*.json under
 * `medical.landing.mobile.*` for the exact copy, transcribed from the
 * mockup. The mockup itself has no header/footer chrome or bottom nav (it
 * was built to "embed seamlessly into the main app layout"); the app's
 * MobileTabBar is kept since every other mobile page in this app has one and
 * this route otherwise has no way back to the rest of the app. The only
 * functional addition is wiring the form to medicalRequests.create()
 * (the app's usual pattern) instead of the mockup's WhatsApp-only
 * submission; WhatsApp is kept as the success sheet's own "done" action,
 * exactly as the mockup already does.
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
  { circle: 'bg-orange-50 text-orange-500 border-orange-200', icon: 'search' as const, shape: 'rounded-r-3xl rounded-l-full', dir: 'ltr' as const },
  { circle: 'bg-rose-50 text-rose-500 border-rose-200', icon: 'file-text' as const, shape: 'rounded-l-3xl rounded-r-full', dir: 'rtl' as const },
  { circle: 'bg-purple-50 text-purple-600 border-purple-200', icon: 'briefcase' as const, shape: 'rounded-r-3xl rounded-l-full', dir: 'ltr' as const },
  { circle: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'bar-chart-2' as const, shape: 'rounded-l-3xl rounded-r-full', dir: 'rtl' as const },
];

export function MobileHealthTourism() {
  const { t, i18n } = useTranslation();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

  usePageMeta({
    title: t('medical.seo.title'),
    description: t('medical.seo.description'),
    image: `${SITE_URL}${BEFORE_AFTER_IMAGES[0]}`,
  });

  const M = 'medical.landing.mobile';
  const fallbackSpecialtyItems = t(`${M}.specialties.items`, { returnObjects: true }) as SpecialtyCopy[];
  const howSteps = t('medical.landing.how.steps', { returnObjects: true }) as HowStep[];
  const logisticsCards = t(`${M}.logistics.cards`, { returnObjects: true }) as LogisticsCard[];
  const testimonialItems = t(`${M}.testimonials.items`, { returnObjects: true }) as TestimonialCopy[];
  const faqItems = t(`${M}.faq.items`, { returnObjects: true }) as FaqCopy[];
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

  const hero = useAutoCarousel(heroImages.length, 3000);
  const specialtiesCarousel = useSnapCarousel(specialtyItems.length, 3200);
  const logisticsCarousel = useSnapCarousel(logisticsCards.length, 3500);
  const testimonialsCarousel = useSnapCarousel(testimonialItems.length, 3800);

  const chips: SpecialtyChip[] = (t(`${M}.form.specialtyChips`, { returnObjects: true }) as string[]).map((label, i) => ({
    slug: SPECIALTY_SLUGS[i] ?? label,
    label,
  }));
  const form = useMedicalLeadForm(chips);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 font-rubik">
      <div className={`pb-[calc(env(safe-area-inset-bottom)+80px)] transition-all duration-500 ${form.successOpen ? 'blur-md scale-[0.98] brightness-90' : ''}`}>
        {/* ==================== HERO ==================== */}
        <section className="relative overflow-hidden rounded-b-[36px] shadow-2xl mb-6 bg-slate-950 text-white p-4 pt-6 pb-6 border-b border-slate-800">
          <div className="text-center space-y-1.5 mb-4">
            <h1 className="text-xl font-black text-white font-rubik tracking-tight pt-1">{t(`${M}.hero.title`)}</h1>
            <p className="text-xs text-slate-400 font-medium">{t(`${M}.hero.subtitle`)}</p>
          </div>

          <div
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none max-w-sm mx-auto rounded-3xl select-none"
            onTouchStart={hero.pause}
            onTouchEnd={hero.resume}
          >
            {heroImages.map((src, i) => (
              <div
                key={src}
                className={`snap-start min-w-full w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 shrink-0 bg-slate-900 ${i === hero.index ? '' : 'hidden'}`}
              >
                <div className="h-[220px] relative">
                  <img src={src} alt={heroCaptions[i] ?? ''} className="w-full h-full object-contain" />
                  <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full border border-emerald-400/30 shadow-md flex items-center gap-1">
                    <AppIcon name="check-circle" className="w-3 h-3 text-white" />
                    <span>{afterLabel}</span>
                  </div>
                  <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/20 shadow-md flex items-center gap-1">
                    <AppIcon name="history" className="w-3 h-3 text-slate-400" />
                    <span>{beforeLabel}</span>
                  </div>
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/80 pointer-events-none flex items-center justify-center -translate-x-1/2">
                    <div className="w-6 h-6 rounded-full bg-white text-slate-950 shadow-xl flex items-center justify-center text-[9px] font-black border border-slate-200">
                      <AppIcon name="arrow-left-right" className="w-3 h-3 text-slate-900" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-950 text-white text-[10px] font-black px-3 py-1.5 border-t border-white/10 text-center">
                  {heroCaptions[i]}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== SPECIALTIES ==================== */}
        <section className="py-6 bg-slate-50 border-y border-slate-200/80 mb-6">
          <div className="px-6 text-center mb-5">
            <h2 className="text-2xl font-black text-slate-900 font-rubik tracking-tight">{t(`${M}.specialties.title`)}</h2>
          </div>

          <div ref={specialtiesCarousel.trackRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none px-6 pb-4">
            {specialtyItems.map((item) => (
              <div
                key={item.slug}
                onTouchStart={specialtiesCarousel.pause}
                onTouchEnd={specialtiesCarousel.resume}
                className="snap-start min-w-[82vw] max-w-[320px] h-[410px] rounded-[32px] overflow-hidden relative shadow-xl border border-slate-200/80 shrink-0 group bg-slate-900"
              >
                <img src={item.image.startsWith('/') || item.image.startsWith('http') ? item.image : `/img/health-tourism/${item.image}`} alt={item.title} className="absolute inset-0 w-full h-full object-cover brightness-105 contrast-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-5 flex flex-col justify-end text-white space-y-2">
                  <h3 className="text-xl font-black text-white font-rubik drop-shadow-md">{item.title}</h3>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">{item.description}</p>
                  <div className="pt-2">
                    <a
                      href="#mobile-lead-form"
                      onClick={() => form.setFormSpecialty(item.slug)}
                      className="w-full py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black text-center block shadow-lg active:scale-95 transition"
                    >
                      {t(`${M}.specialties.ctaQuote`)} <DirArrow className="w-4 h-4 inline ms-1" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            {specialtyItems.map((item, i) => (
              <span key={item.slug} className={`rounded-full inline-block ${i === specialtiesCarousel.index ? 'w-2.5 h-2.5 bg-slate-900 shadow-sm' : 'w-2 h-2 bg-slate-300'}`} />
            ))}
          </div>
        </section>

        {/* ==================== HOW IT WORKS: SNAKE INFOGRAPHIC ==================== */}
        <section className="px-4 py-6 mb-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-black text-slate-900 font-rubik">{t('medical.landing.how.title')}</h2>
          </div>

          <div className="relative max-w-sm mx-auto space-y-5 px-2">
            <div className="flex justify-center -mb-2">
              <div className="w-6 h-6 rounded-full border-4 border-slate-700 bg-white shadow-sm" />
            </div>

            {howSteps.map((step, i) => {
              const style = HOW_STYLES[i];
              const numberFirst = style.dir === 'ltr';
              return (
                <div key={step.title} className={`relative bg-white p-3 sm:p-3.5 border-2 border-slate-700 shadow-md flex items-center gap-3 h-auto ${style.shape}`}>
                  {numberFirst ? (
                    <div className={`w-12 h-12 rounded-full font-black text-3xl flex items-center justify-center shrink-0 border ${style.circle}`}>{i + 1}</div>
                  ) : (
                    <div className="text-slate-400 shrink-0">
                      <AppIcon name={style.icon} className="w-5 h-5" />
                    </div>
                  )}
                  <div className={`flex-1 min-w-0 ${numberFirst ? '' : 'text-end'}`}>
                    <h3 className="text-xs font-black text-slate-900 font-rubik break-words">{step.title}</h3>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5 break-words">{step.body}</p>
                  </div>
                  {numberFirst ? (
                    <div className="text-slate-400 shrink-0">
                      <AppIcon name={style.icon} className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full font-black text-3xl flex items-center justify-center shrink-0 border ${style.circle}`}>{i + 1}</div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-center pt-2">
              <AppIcon name="arrow-left" className="w-6 h-6 text-slate-700 stroke-[3] -rotate-90" />
            </div>
          </div>
        </section>

        {/* ==================== LOGISTICS ==================== */}
        <section className="bg-[#2563eb] p-4 py-5 rounded-3xl mx-4 mb-6 shadow-xl text-white">
          <div className="mb-3 text-center">
            <h2 className="text-lg font-black font-rubik text-white">{t(`${M}.logistics.title`)}</h2>
          </div>

          <div ref={logisticsCarousel.trackRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1">
            {logisticsCards.map((card) => (
              <div
                key={card.title}
                onTouchStart={logisticsCarousel.pause}
                onTouchEnd={logisticsCarousel.resume}
                className="snap-start min-w-full w-full relative shrink-0"
              >
                <div className="absolute inset-0 bg-white/20 rounded-[24px] transform rotate-[-1.5deg] scale-[0.98]" />
                <div className="relative bg-white rounded-[24px] p-3.5 shadow-xl text-slate-900 border border-white/60 flex flex-col justify-between h-[180px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                      <AppIcon name={card.icon} className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 font-rubik leading-tight">{card.title}</h3>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{card.description}</p>
                    </div>
                  </div>
                  <div className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 text-center">
                    {card.tag}
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block leading-none">{card.availabilityLabel}</span>
                      <span className="text-[10px] font-black text-emerald-600">{card.availabilityValue}</span>
                    </div>
                    <a href="#mobile-lead-form" className="bg-slate-950 hover:bg-black text-white text-[10px] font-black px-3.5 py-1.5 rounded-full shadow-md active:scale-95 transition">
                      {card.cta}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== TESTIMONIALS ==================== */}
        <section className="px-4 py-4 mb-6">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-black text-slate-900 font-rubik">{t('medical.landing.testimonials.title')}</h2>
          </div>

          <div ref={testimonialsCarousel.trackRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-3">
            {testimonialItems.map((item) => (
              <div
                key={item.name}
                onTouchStart={testimonialsCarousel.pause}
                onTouchEnd={testimonialsCarousel.resume}
                className="snap-start min-w-full w-full shrink-0 relative bg-white rounded-3xl p-5 shadow-lg border border-slate-200/80"
              >
                <div className="absolute top-3 start-4 text-purple-600 text-5xl leading-none opacity-20 font-serif font-black">&rdquo;</div>
                <div className="relative z-10 space-y-3 mb-4">
                  <div className="flex items-center text-purple-600 text-sm tracking-widest gap-1 font-bold">★ ★ ★ ★ ★</div>
                  <p className="text-sm text-slate-800 leading-relaxed font-bold">&quot;{item.quote}&quot;</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 font-black text-sm flex items-center justify-center shrink-0">
                    {item.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{item.name}</h4>
                    <span className="text-xs text-slate-500 font-bold block">{item.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== LEAD FORM (iOS SHEET) ==================== */}
        <section id="mobile-lead-form" className="px-4 py-4 mb-8">
          <div className="bg-white rounded-[32px] p-6 shadow-2xl border border-slate-200/70 relative">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-slate-900 font-rubik mx-auto">
                {form.requestType === 'consultation' ? t('medical.landing.form.titleConsult') : t('medical.landing.form.titleEval')}
              </h2>
            </div>

            <div className="bg-[#f4f4f5] p-1 rounded-full flex max-w-xs mx-auto mb-6">
              {(['consultation', 'evaluation'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setRequestType(type)}
                  className={`w-1/2 py-2 rounded-full text-xs transition-all ${
                    form.requestType === type ? 'bg-white text-slate-900 font-black shadow-sm' : 'text-slate-500 font-bold'
                  }`}
                >
                  {t(`medical.landing.form.requestType.${type}`)}
                </button>
              ))}
            </div>

            <form onSubmit={form.submitConsultation} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ht-name" className="block text-xs font-extrabold text-slate-500">
                  {t(`${M}.form.name.label`)} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ht-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => form.setName(e.target.value)}
                  placeholder={t(`${M}.form.name.placeholder`)}
                  className="w-full bg-[#f4f4f5] border-none rounded-2xl px-4 py-3.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ht-phone" className="block text-xs font-extrabold text-slate-500">
                  {t(`${M}.form.phone.label`)} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ht-phone"
                  type="tel"
                  required
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => form.setPhone(e.target.value)}
                  placeholder={t(`${M}.form.phone.placeholder`)}
                  className="w-full bg-[#f4f4f5] border-none rounded-2xl px-4 py-3.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-900 transition text-end"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-500">{t(`${M}.form.specialtyLabel`)}</label>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                  {chips.map((chip) => (
                    <button
                      key={chip.slug}
                      type="button"
                      onClick={() => form.setFormSpecialty(chip.slug)}
                      className={`px-4 py-2 rounded-full text-xs shrink-0 whitespace-nowrap transition-all ${
                        form.formSpecialty === chip.slug
                          ? 'font-extrabold bg-slate-900 text-white shadow-sm'
                          : 'font-bold bg-[#f4f4f5] text-slate-700 border border-slate-200/80 hover:bg-slate-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-500">{t(`${M}.form.files.label`)}</label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => form.fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') form.fileInputRef.current?.click();
                  }}
                  className="w-full bg-[#f4f4f5] rounded-2xl p-3.5 text-center cursor-pointer hover:bg-slate-200 transition"
                >
                  <input
                    ref={form.fileInputRef}
                    type="file"
                    className="hidden"
                    accept={form.FILE_ACCEPT}
                    multiple
                    onChange={(e) => {
                      form.addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <span className={`cursor-pointer text-xs font-extrabold flex items-center justify-center gap-2 ${form.files.length > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    <AppIcon name="paperclip" className="w-4 h-4 text-slate-500" />
                    <span>{form.files.length > 0 ? `تم إرفاق ${form.files.length} ملف بنجاح ✓` : t(`${M}.form.files.cta`)}</span>
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
                <label htmlFor="ht-notes" className="block text-xs font-extrabold text-slate-500">
                  {t(`${M}.form.notes.label`)}
                </label>
                <textarea
                  id="ht-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => form.setNotes(e.target.value)}
                  placeholder={t(`${M}.form.notes.placeholder`)}
                  className="w-full bg-[#f4f4f5] border-none rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    form.setName('');
                    form.setPhone('');
                    form.setNotes('');
                    form.setFormSpecialty(chips[0]?.slug ?? '');
                  }}
                  className="w-1/3 py-3.5 rounded-full bg-[#f4f4f5] hover:bg-slate-200 active:scale-95 text-slate-700 font-extrabold text-xs text-center transition"
                >
                  {t(`${M}.form.reset`)}
                </button>
                <button
                  type="submit"
                  disabled={form.submitting}
                  className="w-2/3 py-3.5 rounded-full bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs text-center transition shadow-lg disabled:opacity-60"
                >
                  {form.submitting ? t('medical.landing.form.sending') : t(`${M}.form.submit`)}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ==================== FAQ ==================== */}
        <FaqSection items={faqItems} title={t(`${M}.faq.title`)} />

        {/* ==================== FLOATING WHATSAPP BUTTON ==================== */}
        {WA_ENABLED && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] left-4 z-40">
            <a
              href={`https://wa.me/${(import.meta.env.VITE_WHATSAPP_NUMBER as string).replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            >
              <AppIcon name="message-circle" className="w-6 h-6" />
            </a>
          </div>
        )}
      </div>

      {/* ==================== SUCCESS MODAL: iOS bottom sheet ==================== */}
      {form.successOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xl flex items-end justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-[40px] p-7 pt-9 pb-7 max-w-sm w-full shadow-2xl text-center space-y-6 border border-slate-100 mb-2">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
                <path
                  d="M50 6 Q62 20 81 19 Q80 38 94 50 Q80 62 81 81 Q62 80 50 94 Q38 80 19 81 Q20 62 6 50 Q20 38 19 19 Q38 20 50 6Z"
                  fill="#bdf581"
                />
                <path d="M35 51 L46 62 L67 37" stroke="#052e16" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-rubik">{t(`${M}.successModal.title`)}</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[240px] mx-auto">{t(`${M}.successModal.body`)}</p>
            </div>

            <div className="pt-2">
              {WA_ENABLED && form.waHref ? (
                <a
                  href={form.waHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => form.setSuccessOpen(false)}
                  className="w-full py-3.5 rounded-2xl bg-[#262626] hover:bg-black active:scale-95 text-white font-bold text-sm text-center shadow-lg transition-all block"
                >
                  {t(`${M}.successModal.cta`)}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => form.setSuccessOpen(false)}
                  className="w-full py-3.5 rounded-2xl bg-[#262626] hover:bg-black active:scale-95 text-white font-bold text-sm text-center shadow-lg transition-all"
                >
                  {t(`${M}.successModal.cta`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <MobileTabBar />
    </div>
  );
}

function FaqSection({ items, title }: { items: FaqCopy[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="px-4 py-4 mb-8">
      <div className="mb-4 text-center">
        <h2 className="text-xl font-extrabold text-slate-900 font-rubik">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={item.q} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="w-full p-4 text-start text-xs font-bold text-slate-900 flex items-center justify-between gap-3 focus:outline-none"
              >
                <span>{item.q}</span>
                <AppIcon name="plus" className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} />
              </button>
              <div className="overflow-hidden transition-[max-height] duration-300" style={{ maxHeight: open ? '400px' : '0px' }}>
                <div className="p-4 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100">{item.a}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
