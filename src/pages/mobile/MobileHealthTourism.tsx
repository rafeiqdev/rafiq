import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta, SITE_URL } from '../../lib/seo';
import { AppIcon } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { useMedicalLeadForm, WA_ENABLED, humanFileSize } from '../healthTourism/useMedicalLeadForm';
import { useAutoCarousel } from '../healthTourism/useAutoCarousel';
import { BEFORE_AFTER_IMAGES } from '../healthTourism/beforeAfterSlides';

/**
 * /health-tourism landing page — phone viewport. Card/snap-scroll layout,
 * distinct from the desktop arrow-scroll carousels in ../HealthTourism.tsx.
 * Shares its lead-form/WhatsApp/carousel logic with the desktop page via
 * ../healthTourism/* so the two layouts can never submit a request differently.
 */

const SPECIALTY_SLUGS = ['hair', 'dental', 'bariatric', 'vision', 'checkup', 'cardiology'] as const;
type SpecialtySlug = (typeof SPECIALTY_SLUGS)[number];

const SPECIALTY_IMAGES: Record<SpecialtySlug, string> = {
  hair: '/img/health-tourism/hair_transplant.jpg',
  dental: '/img/health-tourism/dental_smile.jpg',
  bariatric: '/img/health-tourism/bariatric_1551076805.jpg',
  vision: '/img/health-tourism/vision_1579684385127.jpg',
  checkup: '/img/health-tourism/checkup_1584515979956.jpg',
  cardiology: '/img/health-tourism/cardiology_1628348068343.jpg',
};

const LOGISTICS_ICONS: Array<'car' | 'building' | 'message-circle'> = ['car', 'building', 'message-circle'];

interface SpecialtyCopy {
  slug: string;
  badge: string;
  priceFrom: string;
  title: string;
  description: string;
  bullets: string[];
}
interface HowStep {
  title: string;
  body: string;
}
interface LogisticsCard {
  title: string;
  description: string;
}
interface TestimonialCopy {
  tag: string;
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

function SectionHeading({ badge, title, subtitle }: { badge?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center space-y-1.5 mb-4 px-1">
      {badge && (
        <span className="inline-block px-3 py-1 rounded-full bg-navy-50 text-navy text-[11px] font-bold tracking-wide">{badge}</span>
      )}
      <h2 className="text-lg font-extrabold text-slate-900 font-tajawal leading-snug">{title}</h2>
      {subtitle && <p className="text-[11px] text-slate-500 leading-relaxed px-2">{subtitle}</p>}
    </div>
  );
}

export function MobileHealthTourism() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

  usePageMeta({
    title: t('medical.seo.title'),
    description: t('medical.seo.description'),
    image: `${SITE_URL}${BEFORE_AFTER_IMAGES[0]}`,
  });

  const specialtyItems = t('medical.landing.specialties.items', { returnObjects: true }) as SpecialtyCopy[];
  const howSteps = t('medical.landing.how.steps', { returnObjects: true }) as HowStep[];
  const logisticsCards = t('medical.landing.logistics.cards', { returnObjects: true }) as LogisticsCard[];
  const testimonialItems = t('medical.landing.testimonials.items', { returnObjects: true }) as TestimonialCopy[];
  const faqItems = t('medical.landing.faq.items', { returnObjects: true }) as FaqCopy[];
  const heroSlides = t('medical.landing.heroBeforeAfter.slides', { returnObjects: true }) as HeroSlideCopy[];

  const hero = useAutoCarousel(BEFORE_AFTER_IMAGES.length, 3000);

  const form = useMedicalLeadForm();
  const scrollToForm = (slug?: string) => {
    if (slug) form.selectSpecialty(slug);
    document.getElementById('mobile-lead-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className={`pb-[calc(env(safe-area-inset-bottom)+84px)] transition-all duration-300 ${form.successOpen ? 'blur-md scale-[0.98] brightness-90' : ''}`}>
        {/* ==================== HEADER ==================== */}
        <div className="sticky top-0 z-30 flex items-center gap-3 bg-cream/90 backdrop-blur px-4 py-3 border-b border-slate-200/70">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy border border-slate-200"
          >
            <AppIcon name="arrow-left" className={`h-4.5 w-4.5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <h1 className="text-sm font-extrabold text-slate-900 truncate">{t('medical.seo.title')}</h1>
        </div>

        {/* ==================== HERO: BEFORE/AFTER CAROUSEL ==================== */}
        <section className="px-4 pt-4">
          <div
            className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-800"
            onTouchStart={hero.pause}
            onTouchEnd={hero.resume}
          >
            {BEFORE_AFTER_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={heroSlides[i]?.title ?? ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${i === hero.index ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}

            {/* Fixed physical placement — labels a before/after photo crop, not text flow. */}
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[10px] font-bold z-10">
              {t('medical.landing.heroBeforeAfter.beforeLabel')}
            </span>
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold z-10">
              {t('medical.landing.heroBeforeAfter.afterLabel')}
            </span>

            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-4 pt-10 z-10">
              <p className="text-xs font-bold text-white leading-snug">{heroSlides[hero.index]?.title}</p>
              <div className="flex items-center gap-1.5 pt-2.5">
                {BEFORE_AFTER_IMAGES.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    aria-label={`slide-${i}`}
                    onClick={() => hero.goTo(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === hero.index ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-center space-y-2">
            <h2 className="text-xl font-black text-slate-900 font-tajawal leading-tight">
              {t('medical.landing.hero.title')}
              <br />
              {t('medical.landing.hero.titleLine2')}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">{t('medical.landing.hero.subtitleLine1')}</p>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => scrollToForm()}
              className="w-full py-3.5 rounded-2xl bg-navy text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
            >
              <span>{t('medical.landing.hero.card.cta')}</span>
              <AppIcon name="arrow-left" className={`h-4 w-4 ${isRTL ? '' : 'rotate-180'}`} />
            </button>
            <a
              href="#mobile-specialties"
              className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-navy font-bold text-xs text-center"
            >
              {t('medical.landing.hero.ctaSpecialties')}
            </a>
          </div>
        </section>

        {/* ==================== SPECIALTIES ==================== */}
        <section id="mobile-specialties" className="mt-8 px-4">
          <SectionHeading
            badge={t('medical.landing.specialties.badge')}
            title={t('medical.landing.specialties.title')}
            subtitle={t('medical.landing.specialties.subtitle')}
          />
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-4 pb-2 no-scrollbar">
            {specialtyItems.map((item) => (
              <div
                key={item.slug}
                className="snap-start shrink-0 w-[72vw] max-w-[280px] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col"
              >
                <div className="relative h-32 bg-slate-800">
                  <img src={SPECIALTY_IMAGES[item.slug as SpecialtySlug]} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-slate-900/90 text-white text-[10px] font-bold">{item.badge}</span>
                  <span className="absolute bottom-2.5 end-2.5 px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold">{item.priceFrom}</span>
                </div>
                <div className="p-3.5 space-y-2 flex-1">
                  <h3 className="text-[13px] font-bold text-slate-900">{item.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>
                </div>
                <div className="p-3.5 pt-0">
                  <button
                    type="button"
                    onClick={() => scrollToForm(item.slug)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-bold"
                  >
                    {t('medical.landing.specialties.ctaQuote')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== HOW IT WORKS (4-step pipeline) ==================== */}
        <section className="mt-8 px-4">
          <SectionHeading badge={t('medical.landing.how.badge')} title={t('medical.landing.how.title')} subtitle={t('medical.landing.how.subtitle')} />
          <div className="space-y-2.5">
            {howSteps.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3 bg-white rounded-2xl border border-slate-200 p-3.5">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl text-white font-extrabold text-xs flex items-center justify-center ${i === howSteps.length - 1 ? 'bg-emerald-700' : 'bg-navy'}`}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-bold text-slate-900">{step.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== VIP LOGISTICS ==================== */}
        <section className="mt-8 px-4">
          <SectionHeading badge={t('medical.landing.logistics.badge')} title={t('medical.landing.logistics.title')} subtitle={t('medical.landing.logistics.subtitle')} />
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-4 pb-2 no-scrollbar">
            {logisticsCards.map((card, i) => (
              <div key={card.title} className="snap-start shrink-0 w-[68vw] max-w-[240px] bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy flex items-center justify-center">
                  <AppIcon name={LOGISTICS_ICONS[i]} className="w-5 h-5" />
                </div>
                <h3 className="text-[13px] font-bold text-slate-900">{card.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== TESTIMONIALS ==================== */}
        <section className="mt-8 px-4">
          <SectionHeading
            badge={t('medical.landing.testimonials.badge')}
            title={t('medical.landing.testimonials.title')}
            subtitle={t('medical.landing.testimonials.subtitle')}
          />
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-4 pb-2 no-scrollbar">
            {testimonialItems.map((item) => (
              <div key={item.name} className="snap-start shrink-0 w-[78vw] max-w-[300px] bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-navy-50 text-navy">{item.tag}</span>
                  <div className="flex text-amber-400 text-xs tracking-widest">★★★★★</div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">&quot;{item.quote}&quot;</p>
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-[12px] font-extrabold text-slate-900">{item.name}</h4>
                  <span className="text-[10px] text-slate-400 font-medium">{item.location}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== FAQ ==================== */}
        <section className="mt-8 px-4">
          <SectionHeading title={t('medical.landing.faq.title')} subtitle={t('medical.landing.faq.subtitle')} />
          <div className="divide-y divide-slate-200 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {faqItems.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="p-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between text-start font-bold text-slate-900 text-[13px]"
                  >
                    <span className="leading-snug pe-3">{item.q}</span>
                    <span className="text-lg font-light text-slate-400 flex-shrink-0">{open ? '−' : '+'}</span>
                  </button>
                  {open && <p className="pt-2.5 text-[11px] text-slate-500 leading-relaxed">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ==================== LEAD FORM ==================== */}
        <section id="mobile-lead-form" className="mt-8 px-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
            <div className="text-center space-y-1.5 mb-4">
              <span className="inline-block px-3 py-1 rounded-full bg-navy-50 text-navy-light text-[11px] font-bold">
                {t('medical.landing.form.badge')}
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 font-tajawal leading-snug">{t('medical.landing.form.title')}</h2>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-100 mb-4">
              {(['consultation', 'evaluation'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setRequestType(type)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition ${form.requestType === type ? 'bg-navy text-white shadow' : 'text-slate-600'}`}
                >
                  {t(`medical.landing.form.requestType.${type}`)}
                </button>
              ))}
            </div>

            <form onSubmit={form.submitConsultation} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="mht-name" className="block text-[11px] font-bold text-slate-800">
                  {t('medical.landing.form.name.label')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="mht-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => form.setName(e.target.value)}
                  placeholder={t('medical.landing.form.name.placeholder')}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-light"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="mht-phone" className="block text-[11px] font-bold text-slate-800">
                  {t('medical.landing.form.phone.label')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="mht-phone"
                  type="tel"
                  required
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => form.setPhone(e.target.value)}
                  placeholder={t('medical.landing.form.phone.placeholder')}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-light"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-800">
                  {t('medical.landing.form.specialty.label')} <span className="text-rose-500">*</span>
                </label>
                <div className={`flex flex-wrap gap-1.5 rounded-2xl p-1 ${form.highlightSpecialty ? 'ring-2 ring-navy-light' : ''}`}>
                  {SPECIALTY_SLUGS.map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => form.setFormSpecialty(slug)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                        form.formSpecialty === slug ? 'bg-navy text-white border-navy' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {t(`medical.landing.form.specialty.options.${slug}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-800">{t('medical.landing.form.files.label')}</label>
                <button
                  type="button"
                  onClick={() => form.fileInputRef.current?.click()}
                  className="w-full p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center gap-2.5 text-start"
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
                  <AppIcon name="paperclip" className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-600 truncate">{t('medical.landing.form.files.cta')}</span>
                </button>
                {form.files.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.files.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-navy-50/60 text-[11px]">
                        <span className="truncate font-semibold text-slate-800">{file.name} ({humanFileSize(file.size)})</span>
                        <button type="button" onClick={() => form.removeFile(idx)} className="text-slate-400 font-bold px-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mht-notes" className="block text-[11px] font-bold text-slate-800">
                  {t('medical.landing.form.notes.label')}
                </label>
                <textarea
                  id="mht-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => form.setNotes(e.target.value)}
                  placeholder={t('medical.landing.form.notes.placeholder')}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-light"
                />
              </div>

              <button
                type="submit"
                disabled={form.submitting}
                className="w-full py-3.5 rounded-2xl bg-navy text-white font-bold text-sm shadow-md disabled:opacity-60"
              >
                {form.submitting ? t('medical.landing.form.sending') : t('medical.landing.form.submit')}
              </button>
              <p className="text-[10px] text-slate-400 text-center">{t('medical.landing.form.privacyNote')}</p>
            </form>
          </div>
        </section>
      </div>

      {/* ==================== SUCCESS MODAL: iOS bottom sheet ==================== */}
      {form.successOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/60" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="w-full bg-white rounded-t-[2rem] p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1.5 mx-auto rounded-full bg-slate-200" />
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">✓</div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 font-tajawal">{t('medical.landing.form.successModal.title')}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('medical.landing.form.successModal.body')}
                <br />
                <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-800 font-mono font-bold rounded-md text-xs border border-slate-200">
                  {form.refCode}
                </span>
              </p>
            </div>
            <p className="text-[11px] text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">{t('medical.landing.form.successModal.note')}</p>
            {WA_ENABLED && form.waHref && (
              <a
                href={form.waHref}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2"
                style={{ backgroundColor: '#25d366' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>{t('medical.request.whatsappCta')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => form.setSuccessOpen(false)}
              className="w-full py-3 rounded-xl bg-navy text-white font-bold text-xs"
            >
              {t('medical.landing.form.successModal.close')}
            </button>
          </div>
        </div>
      )}

      <MobileTabBar />
    </div>
  );
}
