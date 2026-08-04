import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, medicalRequests } from '../lib/api';
import { useApp } from '../context/AppContext';
import { usePageMeta, SITE_URL } from '../lib/seo';
import { track } from '../lib/analytics';

/**
 * /health-tourism — ported 1:1 from an external design mockup
 * (Antigravity landing page, Aug 2026). Visual design is intentionally NOT
 * remapped onto the site's navy/cream tokens — colors are kept as the
 * mockup's exact hex values via Tailwind arbitrary-value classes.
 *
 * RTL DECISION: this page's outer wrapper is hardcoded `dir="rtl"`,
 * independent of the active site language. The mockup is hand-styled for RTL
 * throughout (hardcoded pr-/pl-, -right-/-left- positioning, mirrored
 * arrows) with no logical-property usage, so redoing it as direction-agnostic
 * CSS was out of scope for an "unchanged design" ask. Only the text content
 * changes per language — the visual arrangement always matches the mockup.
 * See src/i18n/locales/*.json under `medical.landing.*` for the copy.
 */

// ---------------------------------------------------------------------------
// Static data (images, colors, slugs) — copy lives in i18n, not here.
// ---------------------------------------------------------------------------

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

// Hero slideshow: hero_istanbul.jpg (local) + 8 more. The mockup shipped a
// 10th slide (photo-1567527268843-1498b0a996f0) whose Unsplash URL 404s
// upstream — dropped rather than shipping a broken image. Two of these ids
// were already self-hosted in /public/img (see src/lib/images.ts); the rest
// were downloaded fresh into /public/img/health-tourism.
const HERO_SLIDES = [
  '/img/health-tourism/hero_istanbul.jpg',
  '/img/1524231757912-21f4fe3a7200.webp',
  '/img/1541432901042-2d8bd64b4a9b.webp',
  '/img/1527838832700-5059252407fa.webp',
  '/img/health-tourism/hero_slide_1589561253898.jpg',
  '/img/health-tourism/hero_slide_1565008447742.jpg',
  '/img/health-tourism/hotel_1566073771259.jpg',
  '/img/health-tourism/hero_slide_1519046904884.jpg',
  '/img/health-tourism/translator_1576091160399.jpg',
];

const LOGISTICS_IMAGES = [
  '/img/health-tourism/vip_transport.jpg',
  '/img/health-tourism/hotel_1566073771259.jpg',
  '/img/health-tourism/translator_1576091160399.jpg',
];

const LOGISTICS_STYLES = [
  { card: 'bg-[#FEF9EF] border-amber-100/60' },
  { card: 'bg-white border-slate-100' },
  { card: 'bg-[#EFF6FF] border-blue-100/60' },
];

const LOGISTICS_ICONS = [
  <path key="t" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />,
  <path
    key="h"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1m-1-4h.01M9 16h.01M9 12h.01M9 8h.01M15 16h.01M15 12h.01M15 8h.01"
  />,
  <path
    key="i"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
  />,
];

const HOSPITAL_STYLES = [
  'bg-[#FEF9EF] border-slate-100',
  'bg-[#EFF6FF] border-blue-100',
  'bg-[#F0FDF4] border-emerald-100',
  'bg-[#FEF9EF] border-slate-100',
  'bg-[#EFF6FF] border-blue-100',
];

const TESTIMONIAL_STYLES = [
  { card: 'bg-[#F0F5FF] border-[#D0E2FF]', tag: 'bg-[#D0E2FF] text-[#1E3A8A]', divider: 'border-[#D0E2FF]/80' },
  { card: 'bg-[#ECFDF5] border-[#A7F3D0]', tag: 'bg-[#D1FADF] text-[#065F46]', divider: 'border-[#A7F3D0]/80' },
  { card: 'bg-[#FFFBEB] border-[#FDE68A]', tag: 'bg-[#FEF3C7] text-[#92400E]', divider: 'border-[#FDE68A]/80' },
  { card: 'bg-[#FFF1F2] border-[#FECDD3]', tag: 'bg-[#FFE4E6] text-[#9F1239]', divider: 'border-[#FECDD3]/80' },
];

const STATS = [
  { target: 5000, prefix: '+', suffix: '', color: 'text-blue-200', labelKey: 'patients' },
  { target: 45, prefix: '+', suffix: '', color: 'text-blue-200', labelKey: 'hospitals' },
  { target: 100, prefix: '', suffix: '%', color: 'text-emerald-300', labelKey: 'transparency' },
  { target: 24, prefix: '', suffix: '/7', color: 'text-blue-200', labelKey: 'support' },
];

const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx';

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
interface LogisticsCardCopy {
  title: string;
  description: string;
}
interface HospitalCopy {
  name: string;
  subtitle: string;
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

function humanFileSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Fires `onReveal` once, the first time the element crosses `threshold`. */
function useRevealOnScroll<T extends HTMLElement>(threshold: number, delayMs = 0) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delayMs > 0) setTimeout(() => setRevealed(true), delayMs);
            else setRevealed(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, revealed };
}

function ArrowButton({
  dir,
  onClick,
  variant = 'light',
  className = '',
}: {
  dir: 'prev' | 'next';
  onClick: () => void;
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const base =
    variant === 'dark'
      ? 'bg-white/10 backdrop-blur-sm text-white hover:bg-white hover:text-[#1E3A8A] border border-white/20'
      : 'bg-white text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white border border-slate-200';
  return (
    <button
      type="button"
      aria-label={dir}
      onClick={onClick}
      className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full transition duration-200 shadow-md items-center justify-center cursor-pointer focus:outline-none ${base} ${className}`}
    >
      <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {dir === 'prev' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        )}
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------

export function HealthTourism() {
  const { t } = useTranslation();
  const { user } = useApp();

  usePageMeta({
    title: t('medical.seo.title'),
    description: t('medical.seo.description'),
    image: `${SITE_URL}/img/health-tourism/hero_istanbul.jpg`,
  });

  const specialtyItems = t('medical.landing.specialties.items', { returnObjects: true }) as SpecialtyCopy[];
  const howSteps = t('medical.landing.how.steps', { returnObjects: true }) as HowStep[];
  const logisticsCards = t('medical.landing.logistics.cards', { returnObjects: true }) as LogisticsCardCopy[];
  const hospitalItems = t('medical.landing.hospitals.items', { returnObjects: true }) as HospitalCopy[];
  const testimonialItems = t('medical.landing.testimonials.items', { returnObjects: true }) as TestimonialCopy[];
  const faqItems = t('medical.landing.faq.items', { returnObjects: true }) as FaqCopy[];

  // ---- Hero slideshow: cross-fade every 2.5s ----
  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHeroSlide((s) => (s + 1) % HERO_SLIDES.length), 2500);
    return () => clearInterval(id);
  }, []);

  // ---- Stats counters: count up once, when the section is 40% visible ----
  const statsSectionRef = useRef<HTMLDivElement | null>(null);
  const [counts, setCounts] = useState<number[]>(() => STATS.map(() => 0));
  useEffect(() => {
    const el = statsSectionRef.current;
    if (!el) return;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true;
            const duration = 2000;
            STATS.forEach((stat, i) => {
              const step = Math.ceil(stat.target / (duration / 30));
              let count = 0;
              const timer = setInterval(() => {
                count += step;
                if (count >= stat.target) {
                  count = stat.target;
                  clearInterval(timer);
                }
                setCounts((prev) => prev.map((v, j) => (j === i ? count : v)));
              }, 30);
            });
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- Specialty card "request a quote" -> pre-fill + scroll to lead form ----
  const [formSpecialty, setFormSpecialty] = useState('');
  const [highlightSpecialty, setHighlightSpecialty] = useState(false);
  const leadFormRef = useRef<HTMLDivElement | null>(null);
  const selectSpecialty = (slug: string) => {
    setFormSpecialty(slug);
    setHighlightSpecialty(true);
    setTimeout(() => setHighlightSpecialty(false), 1500);
    leadFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ---- Carousels: side-arrow scroll ----
  const specialtiesTrackRef = useRef<HTMLDivElement | null>(null);
  const hospitalsTrackRef = useRef<HTMLDivElement | null>(null);
  const testimonialsTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollTrack = (ref: React.RefObject<HTMLDivElement | null>, amount: number) => {
    ref.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // ---- Logistics scroll-reveal ----
  const logisticsHeader = useRevealOnScroll<HTMLDivElement>(0.2);
  const logisticsCard0 = useRevealOnScroll<HTMLDivElement>(0.15, 0);
  const logisticsCard1 = useRevealOnScroll<HTMLDivElement>(0.15, 150);
  const logisticsCard2 = useRevealOnScroll<HTMLDivElement>(0.15, 300);
  const logisticsCardReveals = [logisticsCard0, logisticsCard1, logisticsCard2];

  // ---- FAQ accordion + search ----
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqSearch, setFaqSearch] = useState('');
  const visibleFaqItems = faqItems
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => `${item.q} ${item.a}`.toLowerCase().includes(faqSearch.trim().toLowerCase()));

  // ---- File dropzone ----
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  // ---- Consultation form ----
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const fallbackRefCode = () => `RFQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const resetConsultationForm = () => {
    setName('');
    setPhone('');
    setFormSpecialty('');
    setNotes('');
    setFiles([]);
  };

  const submitConsultation = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      const specialtyLabel = formSpecialty
        ? t(`medical.landing.form.specialty.options.${formSpecialty}`)
        : t('medical.landing.form.specialty.options.other');
      const description = notes.trim() ? `${specialtyLabel}\n\n${notes.trim()}` : specialtyLabel;
      const contactNotes = `${t('medical.landing.form.name.label')}: ${name}\n${t('medical.landing.form.phone.label')}: ${phone}`;

      try {
        track('request_started', { target: 'medical', meta: { specialty: formSpecialty || 'other' } });
        const res = await medicalRequests.create({
          specialty: formSpecialty || 'other',
          description,
          notes: contactNotes,
        });

        // Best-effort file uploads — never block the success UI on a failed upload.
        if (user) {
          for (const file of files) {
            try {
              await medicalRequests.uploadFile(res.id, file);
            } catch {
              // graceful degradation — the request itself already succeeded
            }
          }
        }

        track('request_submitted', { target: 'medical', meta: { specialty: formSpecialty || 'other', request_id: res.id } });
        setRefCode(`RFQ-${res.id.slice(0, 8).toUpperCase()}`);
      } catch (err) {
        // Not signed in, or any other failure — fall back to the mockup's
        // original client-only behavior rather than blocking the visitor.
        if (!(err instanceof ApiError)) {
          // unexpected error shape — still degrade gracefully
        }
        setRefCode(fallbackRefCode());
      } finally {
        setSubmitting(false);
        setSuccessOpen(true);
        resetConsultationForm();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitting, formSpecialty, notes, name, phone, files, user, t],
  );

  // ---- Callback ("quick call") mini-form ----
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [callbackName, setCallbackName] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackSent, setCallbackSent] = useState(false);
  const submitCallback = (e: React.FormEvent) => {
    e.preventDefault();
    setCallbackSent(true);
    setCallbackName('');
    setCallbackPhone('');
  };
  const closeCallback = () => {
    setCallbackOpen(false);
    setCallbackSent(false);
  };

  return (
    <div dir="rtl" className="bg-slate-50 text-slate-800 font-cairo antialiased selection:bg-blue-600 selection:text-white">
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

      {/* ==================== HERO ==================== */}
      <section className="relative pt-8 pb-10 sm:pt-10 sm:pb-20 md:pt-16 md:pb-28 overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {HERO_SLIDES.map((src, i) => (
            <div
              key={src}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${i === heroSlide ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundImage: `url('${src}')` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1E3A8A]/90 via-[#2563EB]/85 to-slate-950/90 backdrop-blur-[1px] z-0" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-7 space-y-4 sm:space-y-7 text-center lg:text-right">
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-black leading-[1.25] sm:leading-[1.2] font-tajawal text-white tracking-tight">
                {t('medical.landing.hero.title')}
                <br />
                {t('medical.landing.hero.titleLine2')}
              </h1>
              <p className="text-sm sm:text-lg text-blue-100 max-w-xl leading-relaxed font-normal mx-auto lg:mx-0">
                {t('medical.landing.hero.subtitleLine1')}
                <br className="hidden sm:inline" />
                {t('medical.landing.hero.subtitleLine2')}
              </p>
              <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
                <a
                  href="#specialties"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white text-[#1E3A8A] font-extrabold text-sm sm:text-base shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  <span>{t('medical.landing.hero.ctaSpecialties')}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-4 rounded-xl bg-transparent hover:bg-white/10 border-2 border-white/40 text-white font-bold text-sm sm:text-base transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('medical.landing.hero.ctaHowItWorks')}</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center lg:justify-start">
              <div className="w-full max-w-sm bg-white rounded-3xl p-5 sm:p-7 shadow-2xl shadow-blue-900/20 border border-white/80 space-y-4 sm:space-y-5">
                <div className="text-right space-y-1.5">
                  <h3 className="text-lg font-extrabold text-slate-900 font-tajawal">{t('medical.landing.hero.card.title')}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('medical.landing.hero.card.subtitle')}</p>
                </div>
                <div className="space-y-3">
                  {[t('medical.landing.hero.card.item1'), t('medical.landing.hero.card.item2')].map((label) => (
                    <div key={label} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-slate-800">{label}</span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  href="#lead-form"
                  className="block w-full py-3.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-sm text-center transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span>{t('medical.landing.hero.card.cta')}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== STATS ==================== */}
      <section ref={statsSectionRef} className="py-8 sm:py-14 bg-[#1E3A8A] text-white relative overflow-hidden my-8 sm:my-16 shadow-lg">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 text-center divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-blue-700/50">
            {STATS.map((stat, i) => (
              <div key={stat.labelKey} className="pt-3 lg:pt-0">
                <div className={`text-2xl sm:text-4xl lg:text-5xl font-black mb-1 sm:mb-2 font-tajawal ${stat.color}`}>
                  {stat.prefix}
                  {counts[i].toLocaleString('en-US')}
                  {stat.suffix}
                </div>
                <div className="text-xs sm:text-sm text-blue-100 font-semibold">{t(`medical.landing.stats.${stat.labelKey}`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== SPECIALTIES ==================== */}
      <section id="specialties" className="py-10 sm:py-16 md:py-20 bg-slate-50 border-t border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-12 space-y-2 sm:space-y-3">
            <span className="px-3.5 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-bold tracking-wide border border-blue-200">
              {t('medical.landing.specialties.badge')}
            </span>
            <h2 className="text-xl sm:text-4xl font-extrabold text-slate-900 font-tajawal">{t('medical.landing.specialties.title')}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{t('medical.landing.specialties.subtitle')}</p>
          </div>

          <div className="relative px-0 sm:px-8">
            <ArrowButton dir="prev" onClick={() => scrollTrack(specialtiesTrackRef, 340)} className="-right-3 sm:-right-5" />
            <ArrowButton dir="next" onClick={() => scrollTrack(specialtiesTrackRef, -340)} className="-left-3 sm:-left-5" />

            <div ref={specialtiesTrackRef} className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none scroll-smooth py-3 sm:py-4 px-1">
              {specialtyItems.map((item) => (
                <div
                  key={item.slug}
                  className="min-w-[240px] sm:min-w-[320px] md:min-w-[340px] flex-shrink-0 bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-32 sm:h-48 overflow-hidden bg-slate-800">
                      <img
                        src={SPECIALTY_IMAGES[item.slug as SpecialtySlug]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-md bg-slate-900/90 text-white text-[10px] sm:text-xs font-bold">{item.badge}</span>
                      <span className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-md bg-emerald-700 text-white text-[10px] sm:text-xs font-bold">{item.priceFrom}</span>
                    </div>
                    <div className="p-4 sm:p-6 space-y-2.5 sm:space-y-4">
                      <h3 className="text-sm sm:text-lg font-bold text-slate-900">{item.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                      <ul className="text-xs text-slate-700 space-y-1.5 sm:space-y-2 pt-2 sm:pt-3 border-t border-slate-100">
                        {item.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-2 text-slate-600">
                            <span className="text-emerald-600 font-bold">✓</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6 pt-0">
                    <button
                      type="button"
                      onClick={() => selectSpecialty(item.slug)}
                      className="w-full py-3 rounded-xl bg-slate-100 hover:bg-blue-900 hover:text-white text-slate-800 text-xs font-bold transition duration-200 flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
                    >
                      <span>{t('medical.landing.specialties.ctaQuote')}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section id="how-it-works" className="py-10 sm:py-16 bg-white border-t border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-14 space-y-2 sm:space-y-3">
            <span className="px-3.5 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-bold tracking-wide border border-blue-200">
              {t('medical.landing.how.badge')}
            </span>
            <h2 className="text-xl sm:text-4xl font-extrabold text-slate-900 font-tajawal">{t('medical.landing.how.title')}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{t('medical.landing.how.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 sm:gap-6">
            {howSteps.map((step, i) => (
              <div key={step.title} className="bg-slate-50 p-3.5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div
                    className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl text-white font-extrabold text-[11px] sm:text-sm flex items-center justify-center mb-2.5 sm:mb-5 ${i === howSteps.length - 1 ? 'bg-emerald-700' : 'bg-blue-900'}`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1 sm:mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== LOGISTICS ==================== */}
      <section id="logistics" className="py-10 sm:py-20 md:py-28 bg-[#EAF1FB] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            ref={logisticsHeader.ref}
            className="text-right max-w-3xl mb-6 sm:mb-14 space-y-2.5 sm:space-y-4 transition-[opacity,transform] duration-700 ease-out"
            style={{ opacity: logisticsHeader.revealed ? 1 : 0, transform: logisticsHeader.revealed ? 'translateY(0)' : 'translateY(30px)' }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#D0E2FF] text-[#1E3A8A] text-xs font-bold tracking-wide border border-blue-200/60">
              {t('medical.landing.logistics.badge')}
            </span>
            <h2 className="text-xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-tajawal tracking-tight leading-tight">
              {t('medical.landing.logistics.title')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-light max-w-xl">{t('medical.landing.logistics.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {logisticsCards.map((card, i) => {
              const reveal = logisticsCardReveals[i];
              return (
                <div
                  key={card.title}
                  ref={reveal.ref}
                  className={`group rounded-3xl p-4 sm:p-5 border shadow-sm hover:shadow-xl transition-all duration-500 cursor-default ${LOGISTICS_STYLES[i].card}`}
                  style={{
                    opacity: reveal.revealed ? 1 : 0,
                    transform: reveal.revealed ? 'translateY(0)' : 'translateY(40px)',
                    transition: 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <div className="relative rounded-2xl overflow-hidden mb-3 sm:mb-5 border-[3px] border-white shadow-md">
                    <img
                      src={LOGISTICS_IMAGES[i]}
                      alt={card.title}
                      className="w-full h-36 sm:h-52 object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-white/0 via-white/25 to-white/0 translate-x-full group-hover:-translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D0E2FF] text-[#1E3A8A] flex items-center justify-center flex-shrink-0 group-hover:rotate-6 transition-transform duration-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {LOGISTICS_ICONS[i]}
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pr-[3.25rem]">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== HOSPITALS ==================== */}
      <section id="hospitals" className="py-10 sm:py-20 md:py-28 bg-[#1E3A8A] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-14">
            <span className="text-xs sm:text-sm font-semibold text-blue-300 tracking-wide">{t('medical.landing.hospitals.badge')}</span>
            <h2 className="text-xl sm:text-4xl lg:text-5xl font-black text-white font-tajawal tracking-tight leading-tight">
              {t('medical.landing.hospitals.title')}
              <br className="hidden sm:inline" />
              <span className="text-blue-200">{t('medical.landing.hospitals.titleHighlight')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-blue-200/80 font-light max-w-lg mx-auto leading-relaxed">{t('medical.landing.hospitals.subtitle')}</p>
          </div>

          <div className="relative px-0 sm:px-12">
            <ArrowButton dir="prev" variant="dark" onClick={() => scrollTrack(hospitalsTrackRef, 280)} className="-right-1 sm:-right-2" />
            <ArrowButton dir="next" variant="dark" onClick={() => scrollTrack(hospitalsTrackRef, -280)} className="-left-1 sm:-left-2" />

            <div ref={hospitalsTrackRef} className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none scroll-smooth py-6 sm:py-8 px-1">
              {hospitalItems.map((h, i) => (
                <div key={h.name} className="min-w-[200px] sm:min-w-[260px] flex-shrink-0 relative">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <div className="w-12 h-12 rounded-full bg-[#1E3A8A] text-white font-extrabold text-[11px] flex items-center justify-center shadow-lg border-[3px] border-white">
                      JCI
                    </div>
                  </div>
                  <div className={`rounded-2xl pt-10 pb-6 px-6 text-center space-y-2 border shadow-md hover:shadow-xl transition duration-300 ${HOSPITAL_STYLES[i]}`}>
                    <h3 className="text-base font-bold text-slate-900">{h.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{h.subtitle}</p>
                    <div className="pt-3">
                      <span className="inline-block px-4 py-1.5 rounded-lg bg-white text-[11px] font-semibold text-slate-600 border border-slate-200">
                        {t('medical.landing.hospitals.accreditationLabel')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section id="testimonials" className="py-10 sm:py-20 bg-[#1E56C8] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-14 shadow-2xl border border-slate-100 relative">
            <div className="text-right space-y-2 sm:space-y-3 mb-5 sm:mb-10">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#D1FADF] text-[#027A48] text-xs font-bold tracking-wide">
                {t('medical.landing.testimonials.badge')}
              </span>
              <h2 className="text-xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-tajawal tracking-tight">
                {t('medical.landing.testimonials.title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">{t('medical.landing.testimonials.subtitle')}</p>
            </div>

            <div className="relative px-0 sm:px-8">
              <ArrowButton
                dir="prev"
                onClick={() => scrollTrack(testimonialsTrackRef, 340)}
                className="-right-3 sm:-right-5 bg-[#EBF3FF] text-[#1E56C8] hover:bg-[#1E56C8] hover:text-white border-0"
              />
              <ArrowButton
                dir="next"
                onClick={() => scrollTrack(testimonialsTrackRef, -340)}
                className="-left-3 sm:-left-5 bg-[#EBF3FF] text-[#1E56C8] hover:bg-[#1E56C8] hover:text-white border-0"
              />

              <div ref={testimonialsTrackRef} className="flex gap-6 overflow-x-auto scrollbar-none scroll-smooth py-2 px-1">
                {testimonialItems.map((item, i) => {
                  const style = TESTIMONIAL_STYLES[i];
                  return (
                    <div
                      key={item.name}
                      className={`w-full min-w-[230px] sm:min-w-[320px] md:min-w-[340px] flex-1 rounded-3xl p-4 sm:p-6 border flex flex-col justify-between space-y-4 sm:space-y-6 shadow-sm hover:shadow-md transition ${style.card}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold px-3 py-1 rounded-xl ${style.tag}`}>{item.tag}</span>
                          <div className="flex text-amber-400 text-sm tracking-widest">★★★★★</div>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal text-right">&quot;{item.quote}&quot;</p>
                      </div>
                      <div className={`pt-4 border-t text-right ${style.divider}`}>
                        <h4 className="text-sm font-extrabold text-slate-900">{item.name}</h4>
                        <span className="text-xs text-slate-500 font-medium">{item.location}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" className="py-10 sm:py-16 md:py-24 bg-slate-50 border-t border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-12 items-start">
            <div className="lg:col-span-4 space-y-2.5 sm:space-y-4 lg:sticky lg:top-28">
              <span className="px-3.5 py-1 rounded-md bg-blue-100 text-blue-900 text-xs font-bold tracking-wide border border-blue-200">
                {t('medical.landing.faq.title')}
              </span>
              <h2 className="text-2xl sm:text-5xl font-black text-slate-900 font-tajawal tracking-tight leading-tight">
                {t('medical.landing.faq.title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-light">{t('medical.landing.faq.subtitle')}</p>
              <div className="pt-2 sm:pt-3 relative max-w-sm">
                <div className="relative">
                  <svg
                    className="w-[18px] h-[18px] text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={faqSearch}
                    onChange={(e) => setFaqSearch(e.target.value)}
                    placeholder={t('medical.landing.faq.searchPlaceholder')}
                    className="w-full py-3 pr-10 pl-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm transition text-right"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 divide-y divide-slate-200/90 border-t border-b border-slate-200/90">
              {visibleFaqItems.map(({ item, i }) => {
                const open = openFaq === i;
                return (
                  <div key={item.q} className="py-3.5 sm:py-5 transition duration-200">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between text-right font-bold text-slate-900 text-sm sm:text-lg focus:outline-none cursor-pointer group"
                    >
                      <span className="leading-snug group-hover:text-blue-700 transition-colors">{item.q}</span>
                      <span className="text-2xl font-light text-slate-500 group-hover:text-blue-700 flex-shrink-0 mr-4 select-none transition-colors">
                        {open ? '✕' : '+'}
                      </span>
                    </button>
                    <div
                      className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
                      style={{ maxHeight: open ? '600px' : '0px', opacity: open ? 1 : 0 }}
                    >
                      <p className="pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed text-right font-light">{item.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== LEAD FORM ==================== */}
      <section id="lead-form" ref={leadFormRef} className="py-10 sm:py-16 md:py-24 bg-[#F4F6F9] relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-blue-700/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-12 shadow-2xl border border-slate-900/10 relative overflow-hidden">
            <div className="text-center space-y-2 sm:space-y-2.5 mb-5 sm:mb-10 relative z-10">
              <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold tracking-wide">
                {t('medical.landing.form.badge')}
              </span>
              <h2 className="text-xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 font-tajawal tracking-tight">
                {t('medical.landing.form.title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">{t('medical.landing.form.subtitle')}</p>
            </div>

            <form onSubmit={submitConsultation} className="space-y-4 sm:space-y-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2 text-right">
                  <label htmlFor="ht-form-name" className="block text-xs font-bold text-slate-800">
                    {t('medical.landing.form.name.label')} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    id="ht-form-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('medical.landing.form.name.placeholder')}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition text-right"
                  />
                </div>
                <div className="space-y-2 text-right">
                  <label htmlFor="ht-form-phone" className="block text-xs font-bold text-slate-800">
                    {t('medical.landing.form.phone.label')} <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    id="ht-form-phone"
                    type="tel"
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('medical.landing.form.phone.placeholder')}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition text-right"
                  />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <label htmlFor="ht-form-specialty" className="block text-xs font-bold text-slate-800">
                  {t('medical.landing.form.specialty.label')} <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  id="ht-form-specialty"
                  required
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer text-right ${highlightSpecialty ? 'ring-2 ring-blue-600' : ''}`}
                >
                  <option value="" disabled>
                    {t('medical.landing.form.specialty.placeholder')}
                  </option>
                  {SPECIALTY_SLUGS.map((slug) => (
                    <option key={slug} value={slug}>
                      {t(`medical.landing.form.specialty.options.${slug}`)}
                    </option>
                  ))}
                  <option value="other">{t('medical.landing.form.specialty.options.other')}</option>
                </select>
              </div>

              <div className="space-y-2 text-right">
                <label className="block text-xs font-bold text-slate-800">{t('medical.landing.form.files.label')}</label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  className={`w-full p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex items-center justify-between group ${dragOver ? 'border-blue-600 bg-blue-50/50' : 'bg-slate-50/80 border-slate-200 hover:border-blue-500 hover:bg-blue-50/30'}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={FILE_ACCEPT}
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center group-hover:border-blue-500 group-hover:text-blue-600 transition-colors shadow-sm">
                      <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {t('medical.landing.form.files.cta')}
                      </span>
                      <span className="block text-[11px] text-slate-400 font-medium">{t('medical.landing.form.files.hint')}</span>
                    </div>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold text-slate-700 border border-slate-200 group-hover:border-blue-500 group-hover:text-blue-600 transition-all shadow-sm">
                    {t('medical.landing.form.files.chooseFile')}
                  </span>
                </div>
                {files.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {files.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-slate-800 transition shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-7 h-7 rounded-lg bg-white border border-blue-200 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                              />
                            </svg>
                          </div>
                          <span className="truncate font-bold text-slate-800">{file.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">({humanFileSize(file.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-slate-400 hover:text-rose-500 font-bold p-1 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-right">
                <label htmlFor="ht-form-notes" className="block text-xs font-bold text-slate-800">
                  {t('medical.landing.form.notes.label')}
                </label>
                <textarea
                  id="ht-form-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('medical.landing.form.notes.placeholder')}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition text-right"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-[#1E56C8] hover:bg-blue-700 text-white font-bold text-sm shadow-md transition duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? t('medical.landing.form.sending') : t('medical.landing.form.submit')}</span>
                {!submitting && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>

              <div className="pt-1 text-center">
                <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>{t('medical.landing.form.privacyNote')}</span>
                </span>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ==================== SUCCESS MODAL ==================== */}
      {successOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-5 border border-slate-200 shadow-xl">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">✓</div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 font-tajawal">{t('medical.landing.form.successModal.title')}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('medical.landing.form.successModal.body')}
                <br />
                <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-800 font-mono font-bold rounded-md text-xs border border-slate-200">
                  {refCode}
                </span>
              </p>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">{t('medical.landing.form.successModal.note')}</p>
            <button
              type="button"
              onClick={() => setSuccessOpen(false)}
              className="w-full py-3 rounded-xl bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 transition"
            >
              {t('medical.landing.form.successModal.close')}
            </button>
          </div>
        </div>
      )}

      {/* ==================== CALLBACK MODAL ==================== */}
      {callbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full space-y-5 border border-slate-200 shadow-xl relative">
            <button type="button" onClick={closeCallback} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 font-bold">
              ✕
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900 font-tajawal">{t('medical.landing.form.callbackModal.title')}</h3>
              <p className="text-xs text-slate-600">{t('medical.landing.form.callbackModal.subtitle')}</p>
            </div>
            {callbackSent ? (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center font-semibold">
                {t('medical.landing.form.callbackModal.success')}
              </p>
            ) : (
              <form onSubmit={submitCallback} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('medical.landing.form.callbackModal.nameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={callbackName}
                    onChange={(e) => setCallbackName(e.target.value)}
                    placeholder={t('medical.landing.form.callbackModal.namePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('medical.landing.form.callbackModal.phoneLabel')}</label>
                  <input
                    type="tel"
                    required
                    value={callbackPhone}
                    onChange={(e) => setCallbackPhone(e.target.value)}
                    placeholder={t('medical.landing.form.callbackModal.phonePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition">
                  {t('medical.landing.form.callbackModal.submit')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
