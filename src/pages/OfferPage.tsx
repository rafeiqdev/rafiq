import { useEffect, useState, type TouchEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { customerRequests, serviceOffers, servicePayments } from '../lib/api';
import type { CustomerRequest, ServiceOffer, ServicePayment, CompanyResponse, Lang } from '../lib/types';
import { RequestStatusPill } from '../components/RequestStatusPill';
import { AppIcon, BackArrow } from '../components/AppIcon';
import { RafiqLoader } from '../components/RafiqLoader';
import { Modal } from '../components/Modal';
import { OrderTracking } from '@/components/ui/order-tracking';
import { ReviewStars } from '../components/ReviewStars';
import { localizeServiceTitle, SERVICE_CATEGORIES, pickText } from '../data/services';
import { useCatalog } from '../data/catalogStore';
import { humanMessage } from './MyRequests';
import { track } from '../lib/analytics';
import { RequireAuth } from '../components/Gates';

const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';
const SWIPE_THRESHOLD = 40;
const TIMELINE_STEPS = ['pending', 'accepted', 'done'] as const;
const RTL_LANGS = ['ar', 'fa'];

function applyDir(lang: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
  }
}

// ── 21st.dev Animated Icons & Custom Micro-Interactions ──────────────────────

/** 21st.dev Pulsing Status Indicator */
export function PulsingStatusDot({ color = 'bg-amber-500' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

/** 21st.dev Animated Success Checkmark */
export function AnimatedSuccessCheckmark({ className = 'w-12 h-12 text-green-600' }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 50" fill="none" className={className}>
      <motion.circle
        cx="25"
        cy="25"
        r="22"
        stroke="currentColor"
        strokeWidth="3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <motion.path
        d="M15 26l7 7 13-14"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
      />
    </svg>
  );
}

/** 21st.dev Official WhatsApp SVG Icon */
export function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43l-.48-.01c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z" />
    </svg>
  );
}

/** 21st.dev Animated Radar Clock for In-Review */
export function AnimatedRadarClock({ className = 'w-8 h-8 text-navy' }: { className?: string }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full bg-brand-blue/40"
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <motion.polyline
          points="12 6 12 12 16 14"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '12px 12px' }}
        />
      </svg>
    </div>
  );
}

/** 21st.dev Interactive Click-to-Copy Chip */
export function CopyOrderIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy Order ID"
      className="group inline-flex items-center gap-1.5 text-xs font-mono font-bold text-navy/70 bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-cream-dark shadow-xs transition-all active:scale-95 cursor-pointer"
      dir="ltr"
    >
      <span>#{id.slice(0, 8)}</span>
      <AnimatePresence>
        {copied && (
          <motion.span
            key="copied"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="text-green-600 font-sans text-[10px] font-bold"
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Full-screen Photo Lightbox */
function PhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(index);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => setActive(index), [index]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [photos.length]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      setActive((i) => (dx > 0 ? (i - 1 + photos.length) % photos.length : (i + 1) % photos.length));
    }
    setTouchStartX(null);
  };

  return (
    <Modal onClose={onClose} labelId="offer-photo-lightbox-title" maxWidth="max-w-4xl">
      <h2 id="offer-photo-lightbox-title" className="sr-only">{t('offerPage.attachments')}</h2>
      <div
        className="relative flex items-center justify-center p-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photos[active]}
          alt=""
          className="max-h-[82vh] w-auto max-w-full touch-pan-y select-none rounded-card object-contain bg-navy-900 shadow-2xl"
          draggable={false}
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((i) => (i - 1 + photos.length) % photos.length)}
              aria-label="Previous"
              className="absolute start-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-navy shadow-card hover:bg-white transition-transform active:scale-95"
            >
              <AppIcon name="chevron-left" className="w-5 h-5 dir-arrow" />
            </button>
            <button
              type="button"
              onClick={() => setActive((i) => (i + 1) % photos.length)}
              aria-label="Next"
              className="absolute end-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-navy shadow-card hover:bg-white transition-transform active:scale-95"
            >
              <AppIcon name="chevron-right" className="w-5 h-5 dir-arrow" />
            </button>
            <span className="absolute bottom-4 start-1/2 -translate-x-1/2 rounded-full bg-navy/80 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-white shadow" dir="ltr">
              {active + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Parses offer details into clean semantic bullet checklist items and formatted paragraphs */
function FormattedOfferDetails({ details }: { details?: string | null }) {
  if (!details || typeof details !== 'string') return null;
  const lines = details.split('\n');

  return (
    <div className="space-y-2.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        // Match bullet markers: -, •, *, ✓, or numbered lists: 1., 2)
        const bulletMatch = line.match(/^([-•*✓✔]|\d+[.)])\s*(.*)$/);
        if (bulletMatch) {
          const itemText = bulletMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-green-700 font-extrabold text-sm leading-relaxed shrink-0">
                ✓
              </span>
              <span className="text-sm font-medium text-navy/90 leading-relaxed flex-1">
                {itemText}
              </span>
            </div>
          );
        }

        // Headings or lead lines ending with colon ':'
        if (line.endsWith(':')) {
          return (
            <p key={idx} className="text-xs font-extrabold text-navy uppercase tracking-wider pt-2 first:pt-0">
              {line}
            </p>
          );
        }

        // Standard narrative paragraph
        return (
          <p key={idx} className="text-sm text-navy/75 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function OfferPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = RTL_LANGS.includes(lang as Lang);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<CustomerRequest | null>(null);
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [payments, setPayments] = useState<ServicePayment[]>([]);
  const [responses, setResponses] = useState<CompanyResponse[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    applyDir(lang);
  }, [lang]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [reqData, offerList, paymentList, respList] = await Promise.all([
        customerRequests.byId(id),
        serviceOffers.listForRequest(id),
        servicePayments.forRequest(id),
        customerRequests.responses(id).catch(() => [] as CompanyResponse[]),
      ]);
      setRequest(reqData);
      setOffers(offerList);
      setPayments(paymentList);
      setResponses(respList);
    } catch (e: unknown) {
      console.error('[OfferPage loadData error]:', e);
      setError(e instanceof Error ? e.message : 'Error loading offer details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // SLA clock — declared BEFORE any early return so the hook order never
  // changes between renders (loading → loaded used to add two hooks late,
  // which crashed React with "Rendered more hooks than during the previous render").
  const [now, setNow] = useState<number>(() => Date.now());
  // Live catalog (static + admin overrides) — the same source the "All services"
  // cards use, so the offer banner shows the exact same service image.
  const { services: catalogServices } = useCatalog();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RafiqLoader size="lg" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-lg card p-8 shadow-card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-red/10 text-brand-red mb-4">
            <AppIcon name="alert-triangle" className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-navy">{request ? t('serviceOffer.error') : t('offerPage.notFound')}</h1>
          <p className="mt-2 text-sm text-navy/60">{error ?? t('offerPage.notFound')}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/requests" className="btn-secondary">
              <BackArrow className="w-4 h-4" />
              {t('offerPage.backToRequests')}
            </Link>
            <button onClick={loadData} className="btn-primary">
              <AppIcon name="history" className="w-4 h-4" />
              {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const primaryOffer = offers[0] as ServiceOffer | undefined;
  const primaryPayment = primaryOffer ? payments.find((p) => p.offerId === primaryOffer.id) : undefined;
  const isVerified = primaryPayment?.status === 'verified';
  const isExpired = primaryOffer?.expiresAt ? new Date(primaryOffer.expiresAt) < new Date() : false;
  const returnPath = typeof window !== 'undefined' ? window.location.pathname : `/requests/${id}/offer`;
  const resumeUrl = primaryPayment ? servicePayments.resumeUrl(primaryPayment, returnPath) : null;

  const localizedTitle = localizeServiceTitle(request.serviceTitle, lang);

  // Find service item icon & category if matched (from the live catalog)
  const reqTitle = request.serviceTitle || '';
  const reqTitleLower = reqTitle.toLowerCase();
  const matchedService = catalogServices.find(
    (s) => s.id === reqTitle || Object.values(s.title).some((t) => t && reqTitleLower && t.toLowerCase() === reqTitleLower)
  );
  // Same visual as the service card: the admin-uploaded image when present, otherwise the service icon.
  const serviceHeroPhoto = matchedService?.image || null;
  const matchedCatId = request.category || matchedService?.category;
  const catItem = SERVICE_CATEGORIES.find((c) => c.id === matchedCatId);
  const categoryName = catItem ? pickText(catItem.title, lang) : t('common.appName');
  const serviceIcon = catItem?.icon ?? matchedService?.icon ?? 'file-text';

  const startPayment = async () => {
    if (!primaryOffer) return;
    setBusy(true);
    try {
      const res = await servicePayments.createSession(primaryOffer.id);
      window.location.href = `${res.payUrl}&return=${encodeURIComponent(returnPath)}`;
    } catch {
      setError(t('serviceOffer.error'));
      setBusy(false);
    }
  };

  const rejectOffer = async () => {
    if (!primaryOffer) return;
    setBusy(true);
    try {
      await serviceOffers.reject(primaryOffer.id);
      await loadData();
    } catch {
      setError(t('serviceOffer.error'));
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  };

  // SLA & Overdue Response Calculations (> 2 hours without offer)
  // NOTE: [now, setNow] + its timer live above the early returns.
  const requestCreatedAtMs = request.createdAt && !isNaN(new Date(request.createdAt).getTime())
    ? new Date(request.createdAt).getTime()
    : now;
  const elapsedHours = (now - requestCreatedAtMs) / (1000 * 60 * 60);
  const isOverdue = !primaryOffer && elapsedHours >= 2 && request.status !== 'done' && request.status !== 'cancelled';

  // Dynamic SLA Card Content based on state (Pending < 2h vs Overdue >= 2h vs Offer Ready)
  const getSlaContent = () => {
    if (primaryOffer) {
      const titles: Record<string, string> = {
        ar: 'فريق المتابعة والاستفسارات',
        en: 'Support & Inquiries Team',
        fa: 'تیم پشتیبانی و پیگیری در خدمت شما',
        ru: 'Команда поддержки и сопровождения',
      };
      const descs: Record<string, string> = {
        ar: 'تم تجهيز عرض السعر المخصص لك بنجاح. فريقنا متاح للإجابة على أي استفسار أو تعديل في متطلباتك.',
        en: 'Your custom offer has been prepared. Our team is available to answer any questions or adjust details.',
        fa: 'پیشنهاد قیمت اختصاصی شما آماده است. تیم ما برای پاسخ به سوالات یا تغییرات در دسترس است.',
        ru: 'Ваше персональное предложение готово. Мы готовы ответить на любые вопросы и внести корректировки.',
      };
      const btns: Record<string, string> = {
        ar: 'تواصل مع فريق المتابعة عبر واتساب',
        en: 'Chat with Support via WhatsApp',
        fa: 'ارتباط با تیم پیگیری در واتساپ',
        ru: 'Связаться с поддержкой в WhatsApp',
      };
      return {
        title: t('offerPage.slaTitleResolved', { defaultValue: titles[lang] || titles.ar }),
        desc: t('offerPage.slaDescResolved', { defaultValue: descs[lang] || descs.ar }),
        buttonText: t('offerPage.escalateWaResolved', { defaultValue: btns[lang] || btns.ar }),
        type: 'resolved' as const,
      };
    }

    if (isOverdue) {
      const titles: Record<string, string> = {
        ar: 'نعتذر عن التأخير.. ضغط عالي على الإدارة',
        en: 'Apologies for the delay — High request volume',
        fa: 'پوزش بابت تأخیر.. ترافیک بالای بررسی درخواست‌ها',
        ru: 'Приносим извинения за задержку — высокая нагрузка',
      };
      const descs: Record<string, string> = {
        ar: 'نواجه حالياً ضغطاً استثنائياً في الطلبات ونعتذر بصدق عن التأخير عن موعد الساعتين. طلبك قيد المتابعة بأولوية، ولتسريع تجهيز العرض يمكنك التواصل المباشر مع الإدارة عبر واتساب.',
        en: 'We are currently experiencing exceptionally high demand and apologize for exceeding the 2-hour window. Your request has priority; message us directly on WhatsApp to expedite.',
        fa: 'در حال حاضر به دلیل حجم بالای درخواست‌ها، زمان پاسخگویی بیش از ۲ ساعت طول کشیده است. درخواست شما با اولویت بالا در حال پیگیری است و می‌توانید برای تسریع از طریق واتساپ مستقیماً پیام دهید.',
        ru: 'Сейчас у нас повышенный поток заявок, искренне извиняемся за задержку более 2 часов. Ваша заявка в высоком приоритете; напишите нам в WhatsApp для ускорения.',
      };
      const btns: Record<string, string> = {
        ar: 'تسريع الطلب عبر واتساب مباشرة',
        en: 'Expedite Request via WhatsApp',
        fa: 'تسریع درخواست از طریق واتساپ',
        ru: 'Ускорить ответ через WhatsApp',
      };
      return {
        title: t('offerPage.slaTitleOverdue', { defaultValue: titles[lang] || titles.ar }),
        desc: t('offerPage.slaDescOverdue', { defaultValue: descs[lang] || descs.ar }),
        buttonText: t('offerPage.escalateWaOverdue', { defaultValue: btns[lang] || btns.ar }),
        type: 'overdue' as const,
      };
    }

    return {
      title: t('offerPage.slaTitle', { defaultValue: 'رد وتحديث مضمون خلال ساعتين' }),
      desc: t('offerPage.slaDesc', { defaultValue: 'فريق الدعم والمتابعة متاح للرد على أي استفسار أو تعديل في متطلباتك.' }),
      buttonText: t('offerPage.escalateWa', { defaultValue: 'تواصل فوري عبر واتساب' }),
      type: 'normal' as const,
    };
  };

  const slaInfo = getSlaContent();

  const overdueWaMessages: Record<string, string> = {
    ar: `مرحباً فريق رفيق، أتابع طلبي رقم #${request.id} (${localizedTitle}). لقد مر أكثر من ساعتين على تقديمه، أرجو تسريع المراجعة وتزويدي بعرض السعر لطفاً.`,
    en: `Hello Rafiq team, following up on request #${request.id} (${localizedTitle}). It has been over 2 hours, please expedite my offer review.`,
    fa: `سلام تیم رفیق، پیگیر درخواست شماره #${request.id} (${localizedTitle}) هستم. بیش از ۲ ساعت گذشته است، لطفاً بررسی و ارسال پیشنهاد را تسریع بفرمایید.`,
    ru: `Здравствуйте, команда Рафик! Я по поводу заявки #${request.id} (${localizedTitle}). Прошло более 2 часов, пожалуйста, ускорьте отправку предложения.`,
  };

  const waMessage = isOverdue
    ? (overdueWaMessages[lang] || overdueWaMessages.ar)
    : (t('offerPage.waMessage', { id: request.id, service: localizedTitle }) || `مرحباً رفيق، أستفسر بخصوص طلبي #${request.id}`);
  const waHref = WA_ENABLED ? `https://wa.me/${WA}?text=${encodeURIComponent(waMessage)}` : null;

  // Tracking timeline calculations
  const key = request.status === 'new' ? 'pending' : request.status;
  const stepIndex = TIMELINE_STEPS.indexOf(key as (typeof TIMELINE_STEPS)[number]);
  const currentStep = stepIndex >= 0 ? stepIndex : 0;

  const trackingSteps = [
    {
      name: t('offerPage.timelineStep1'),
      timestamp: new Date(request.createdAt).toLocaleDateString(i18n.language),
      isCompleted: true,
    },
    {
      name: t('offerPage.timelineStep2'),
      timestamp: primaryOffer ? new Date(primaryOffer.createdAt).toLocaleDateString(i18n.language) : '',
      isCompleted: currentStep >= 1 || !!primaryOffer,
    },
    {
      name: t('offerPage.timelineStep3'),
      timestamp: isVerified ? new Date(primaryPayment?.verifiedAt ?? '').toLocaleDateString(i18n.language) : '',
      isCompleted: currentStep >= 2 || isVerified,
    },
  ];

  const msg = request.message ? humanMessage(request.message) : null;

  const isOfferPdf = (u: string) => /\.pdf(\?.*)?$/i.test(u) || u.toLowerCase().includes('/pdf');
  // The photo lightbox shows photos only (PDFs open separately), so photo
  // indices must come from this photos-only list — never the full list.
  const offerImageFiles = (primaryOffer?.imagePaths || []).filter((u) => !isOfferPdf(u));

  return (
    <div className="min-h-screen bg-cream pb-32 md:pb-20 pt-6 md:pt-10 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <Link
            to="/requests"
            className="btn-secondary !h-9 px-4 text-xs font-bold inline-flex items-center gap-2 rounded-xl shadow-sm hover:bg-cream-dark transition-colors"
          >
            <BackArrow className="w-4 h-4" />
            <span>{t('offerPage.backToRequests')}</span>
          </Link>
          <div className="flex items-center gap-2.5 ms-auto">
            <RequestStatusPill status={request.status} />
          </div>
        </div>

        {/* Navy Hero Banner with Integrated Real Service Photo (Matching View Details exactly) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-card bg-navy text-white p-5 sm:p-7 md:p-9 mb-8 shadow-card overflow-hidden"
        >
          {/* Real Service Photo placed on the opposite side (Left for RTL, Right for LTR) */}
          <div
            className={`absolute inset-y-0 ${
              isRTL ? 'left-0' : 'right-0'
            } w-5/12 sm:w-1/2 md:w-5/12 pointer-events-none overflow-hidden`}
          >
            {serviceHeroPhoto ? (
              <img
                src={serviceHeroPhoto}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover object-center opacity-90 transition-transform duration-700 hover:scale-105"
                loading="eager"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1d4b86] to-navy"
              >
                <AppIcon name={matchedService?.icon ?? serviceIcon} className="h-[34%] w-[34%] text-white/50" />
              </div>
            )}
            {/* Direction-aware gradient fade into solid navy */}
            <div
              className={`absolute inset-0 ${
                isRTL
                  ? 'bg-gradient-to-r from-transparent via-navy/50 to-navy'
                  : 'bg-gradient-to-r from-navy via-navy/50 to-transparent'
              }`}
            />
            <div className="absolute inset-0 bg-navy/10" />
          </div>

          {/* Banner Typography & Info Content - with max-width protection so it never collides with the photo */}
          <div className="relative z-10 max-w-[75%] sm:max-w-xl">
            {/* Category Top Line */}
            <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
              <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm shadow-sm">
                <AppIcon name={serviceIcon} className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </span>
              <p className="text-xs sm:text-sm font-bold text-gold-light tracking-wide">
                {categoryName}
              </p>
            </div>

            {/* Large Bold Service Title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {localizedTitle}
            </h1>
          </div>
        </motion.div>

        {/* Main Grid: Left Column (Offer + Request Info) | Right Column (Timeline & Trust) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Primary Custom Offer Card */}
            {primaryOffer ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="card p-6 md:p-8 shadow-card border-2 border-navy/15 bg-white relative overflow-hidden"
              >
                {/* Price summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-cream-dark">
                  <div>
                    <h2 className="text-lg font-extrabold text-navy flex items-center gap-1.5">
                      <AppIcon name="shield-check" className="w-5 h-5 text-green-700 shrink-0" />
                      {t('serviceOffer.title')}
                    </h2>
                    <p className="text-xs text-navy/55 font-medium mt-1">
                      {lang === 'ar' ? 'شامل كل الرسوم • لا مصاريف خفية' : 'All fees included • No hidden costs'}
                    </p>
                  </div>

                  <div className="text-start sm:text-end bg-cream/70 p-3.5 rounded-2xl border border-cream-dark shrink-0">
                    <p className="text-xs font-bold text-navy/50">{t('offerPage.price')}</p>
                    <p className="text-2xl md:text-3xl font-black text-navy tracking-tight" dir="ltr">
                      {(primaryOffer.price ?? 0).toLocaleString()} <span className="text-lg font-bold text-navy/70">{primaryOffer.currency || 'TL'}</span>
                    </p>
                  </div>
                </div>

                {/* Offer Details / Scope of work with semantic bullet parsing */}
                <div className="py-6 border-b border-cream-dark">
                  <h3 className="text-sm font-extrabold text-navy mb-3 flex items-center gap-2">
                    <AppIcon name="file-text" className="w-4 h-4 text-navy/60" />
                    {t('offerPage.offerDetails')}
                  </h3>
                  <FormattedOfferDetails details={primaryOffer.details} />
                </div>

                {/* Image Attachments / Photos & Document Gallery */}
                {(primaryOffer.imagePaths?.length ?? 0) > 0 && (() => {
                  const imageFiles = offerImageFiles;
                  const docFiles = (primaryOffer.imagePaths || []).filter((u) => isOfferPdf(u));

                  return (
                    <div className="py-6 border-b border-cream-dark">
                      {imageFiles.length > 0 && (
                        <div className={docFiles.length > 0 ? 'mb-4' : ''}>
                          <div className="flex items-center mb-3">
                            <h3 className="text-sm font-extrabold text-navy flex items-center gap-2">
                              <AppIcon name="camera" className="w-4 h-4 text-navy/60" />
                              {t('offerPage.attachmentsCount', { count: imageFiles.length })}
                            </h3>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {imageFiles.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setLightboxIndex(offerImageFiles.indexOf(url))}
                                className="group relative aspect-square overflow-hidden rounded-xl border border-cream-dark shadow-sm transition-transform hover:scale-[1.03] active:scale-95 bg-cream"
                              >
                                <img
                                  src={url}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-navy/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <AppIcon name="maximize" className="w-5 h-5 text-white drop-shadow" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {docFiles.length > 0 && (
                        <div className={imageFiles.length > 0 ? 'pt-4 border-t border-cream-dark/60' : ''}>
                          <h4 className="text-xs font-extrabold text-navy mb-2.5 flex items-center gap-1.5">
                            <AppIcon name="file-text" className="w-3.5 h-3.5 text-navy/60" />
                            <span>{lang === 'ar' ? 'المستندات والملفات المرفقة' : 'Attached Documents'}</span>
                          </h4>
                          <div className="space-y-2">
                            {docFiles.map((url, idx) => {
                              const cleanName = url.split('/').pop()?.split('?')[0] || `Document-${idx + 1}.pdf`;
                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-between p-3 rounded-xl bg-cream/40 border border-cream-dark hover:bg-cream hover:border-navy/20 transition-all group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red font-black text-xs">
                                      PDF
                                    </span>
                                    <span className="text-xs font-bold text-navy truncate group-hover:text-navy-dark">
                                      {decodeURIComponent(cleanName)}
                                    </span>
                                  </div>
                                  <span className="text-navy/40 group-hover:text-navy text-base leading-none shrink-0 ms-2" aria-hidden="true">↗</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Expiration Note */}
                {primaryOffer.expiresAt && (
                  <div className={`mt-4 text-xs flex items-center gap-1.5 ${isExpired ? 'text-brand-red font-bold' : 'text-navy/60 font-medium'}`}>
                    <AppIcon name="clock" className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('serviceOffer.expires')}: {new Date(primaryOffer.expiresAt).toLocaleDateString(lang)}</span>
                  </div>
                )}

                {/* Offer Status Badges */}
                {primaryOffer.status === 'rejected' && (
                  <div className="mt-4 rounded-xl bg-brand-red/10 p-3.5 text-xs font-bold text-brand-red flex items-center gap-2">
                    <AppIcon name="x-circle" className="w-4 h-4 shrink-0" />
                    {t('serviceOffer.youRejected')}
                  </div>
                )}
                {primaryOffer.status === 'expired' && (
                  <div className="mt-4 rounded-xl bg-brand-red/10 p-3.5 text-xs font-bold text-brand-red flex items-center gap-2">
                    <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                    {t('serviceOffer.offerExpired')}
                  </div>
                )}
                {primaryOffer.status === 'superseded' && (
                  <div className="mt-4 rounded-xl bg-navy/5 p-3.5 text-xs font-bold text-navy flex items-center gap-2">
                    <AppIcon name="history" className="w-4 h-4 shrink-0" />
                    {t('serviceOffer.superseded')}
                  </div>
                )}

                {/* Paid Verification Banner (21st.dev Animated Success style) */}
                {isVerified && (
                  <div className="mt-6 rounded-2xl bg-green-50 border border-green-200 p-5 flex items-center gap-4">
                    <AnimatedSuccessCheckmark className="w-12 h-12 text-green-600 shrink-0" />
                    <div>
                      <h4 className="text-base font-extrabold text-green-800">{t('serviceOffer.paid')}</h4>
                      <p className="text-xs text-green-700 mt-0.5">
                        {primaryPayment?.verifiedAt ? new Date(primaryPayment.verifiedAt).toLocaleDateString(lang) : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Pending Payment Resume Button */}
                {!isVerified && primaryPayment?.status === 'pending' && (
                  <div className="mt-6">
                    {resumeUrl ? (
                      <a
                        href={resumeUrl}
                        className="btn-primary w-full !h-12 text-base font-bold shadow-md flex items-center justify-center gap-2"
                      >
                        <AppIcon name="credit-card" className="w-5 h-5" />
                        {t('serviceOffer.resumePayment')}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={startPayment}
                        disabled={busy}
                        className="btn-primary w-full !h-12 text-base font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <AppIcon name="credit-card" className="w-5 h-5" />
                        {busy ? t('serviceOffer.starting') : t('serviceOffer.payCta')}
                      </button>
                    )}
                  </div>
                )}

                {/* Failed Payment Retry — a rejected payment used to leave the
                    desktop page with no action at all. */}
                {!isVerified && primaryPayment?.status === 'rejected' && (
                  <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-bold text-amber-900 leading-relaxed flex items-center gap-2">
                      <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                      {t('serviceOffer.paymentRejected')}
                    </p>
                    <button
                      type="button"
                      onClick={startPayment}
                      disabled={busy}
                      className="btn-primary w-full !h-12 mt-3 text-base font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <AppIcon name="credit-card" className="w-5 h-5" />
                      {busy ? t('serviceOffer.starting') : t('serviceOffer.payCta')}
                    </button>
                  </div>
                )}

                {/* Primary Pay / Reject Action CTAs */}
                {!isVerified && !primaryPayment && !isExpired && primaryOffer.status === 'sent' && (
                  <div className="mt-6 pt-4 border-t border-cream-dark">
                    {!rejecting ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => setRejecting(true)}
                          disabled={busy}
                          className="btn-secondary !h-12 px-6 text-sm font-bold flex-1 disabled:opacity-50"
                        >
                          {t('serviceOffer.reject')}
                        </button>
                        <button
                          type="button"
                          onClick={startPayment}
                          disabled={busy}
                          className="btn-primary !h-12 px-8 text-base font-extrabold flex-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <AppIcon name="credit-card" className="w-5 h-5" />
                          {busy ? t('serviceOffer.starting') : t('serviceOffer.payCta')}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-cream p-4 border border-cream-dark animate-fade-in">
                        <p className="text-xs text-navy/80 font-medium leading-relaxed">
                          {t('serviceOffer.rejectConfirm')}
                        </p>
                        <div className="mt-4 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setRejecting(false)}
                            className="btn-secondary flex-1 !h-10 text-xs font-bold"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={rejectOffer}
                            disabled={busy}
                            className="btn-danger flex-1 !h-10 text-xs font-bold disabled:opacity-50"
                          >
                            {busy ? t('serviceOffer.rejecting') : t('serviceOffer.rejectConfirmBtn')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              /* No custom offer yet (In Review State with 21st.dev Animated Radar) */
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="card p-8 shadow-card border border-navy/10 bg-white text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/30 text-navy mb-4">
                  <AnimatedRadarClock className="w-8 h-8 text-navy" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold mb-2">
                  <PulsingStatusDot color="bg-amber-500" />
                  <span>{t('offerPage.currentStatus')}: {t('admin.serviceRequests.status.pending')}</span>
                </div>
                <h3 className="text-lg font-extrabold text-navy mt-1">
                  {t('offerPage.noOffersTitle')}
                </h3>
                <p className="mt-2 text-sm text-navy/65 max-w-md mx-auto leading-relaxed">
                  {t('offerPage.noOffersDesc')}
                </p>
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track('whatsapp_clicked', { target: 'offer_page_inquiry', meta: { request_id: request.id } })}
                    className="btn-secondary mt-6 inline-flex items-center gap-2.5 !h-11 px-5 text-xs font-bold shadow-sm hover:bg-cream-dark transition-all"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-green-600" />
                    <span>{isOverdue ? slaInfo.buttonText : t('offerPage.escalateWa')}</span>
                  </a>
                )}
              </motion.div>
            )}

            {/* Original Request Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="card p-6 shadow-card border border-navy/10 bg-white"
            >
              <h3 className="text-sm font-extrabold text-navy mb-3 flex items-center gap-2">
                <AppIcon name="info" className="w-4 h-4 text-navy/60" />
                {t('offerPage.yourRequest')}
              </h3>

              <div className="space-y-3 text-sm">
                {msg && (
                  <div>
                    <p className="text-xs font-bold text-navy/50 mb-1">{t('offerPage.notes')}:</p>
                    <p className="text-navy/80 bg-cream/50 p-3.5 rounded-xl border border-cream-dark leading-relaxed">
                      “{msg.full}”
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-cream/40 p-3 rounded-xl border border-cream-dark">
                    <p className="text-[11px] font-bold text-navy/50">{t('offerPage.orderRef')}</p>
                    <p className="text-xs font-mono font-bold text-navy mt-0.5" dir="ltr">#{request.id}</p>
                  </div>
                  <div className="bg-cream/40 p-3 rounded-xl border border-cream-dark">
                    <p className="text-[11px] font-bold text-navy/50">{t('offerPage.placedOn')}</p>
                    <p className="text-xs font-bold text-navy mt-0.5">
                      {new Date(request.createdAt).toLocaleString(lang)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Additional Marketplace Quotes / Responses if available */}
            {responses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="card p-6 shadow-card border border-navy/10 bg-white"
              >
                <h3 className="text-sm font-extrabold text-navy mb-4 flex items-center gap-2">
                  <AppIcon name="users" className="w-4 h-4 text-navy/60" />
                  {t('offerPage.partnerResponses', { count: responses.length })}
                </h3>
                <ul className="space-y-3">
                  {responses.map((r) => (
                    <li key={r.id} className={`rounded-xl border p-4 transition-all ${r.chosen ? 'border-navy bg-brand-blue/30' : 'border-cream-dark bg-cream/40'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-navy">{r.companyName}</span>
                        <ReviewStars rating={r.rating} count={r.reviews} />
                      </div>
                      {r.quote != null && (
                        <p className="mt-2 text-base font-extrabold text-navy" dir="ltr">
                          {r.quote.toLocaleString()} {t('common.tl')}
                        </p>
                      )}
                      {r.message && <p className="mt-1.5 text-xs text-navy/70">{r.message}</p>}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>

          {/* Right Sidebar: Timeline, SLA, WhatsApp & Trust (5 cols) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {/* Timeline Progress Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="card p-6 shadow-card border border-navy/10 bg-white"
            >
              <h3 className="text-sm font-extrabold text-navy mb-4 flex items-center gap-2">
                <AppIcon name="check-circle" className="w-4 h-4 text-navy/60" />
                {t('offerPage.timelineTitle')}
              </h3>
              <OrderTracking steps={trackingSteps} className="my-2" />
            </motion.div>

            {/* Response Time SLA Guarantee / Overdue Apology Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className={`card p-6 shadow-card border transition-all ${
                slaInfo.type === 'overdue'
                  ? 'border-amber-300/90 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40'
                  : slaInfo.type === 'resolved'
                  ? 'border-green-200/80 bg-gradient-to-br from-green-50/60 via-white to-cream'
                  : 'border-navy/10 bg-gradient-to-br from-brand-blue/40 to-cream'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors ${
                    slaInfo.type === 'overdue'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
                      : slaInfo.type === 'resolved'
                      ? 'bg-green-600 text-white shadow-green-600/20'
                      : 'bg-navy text-white'
                  }`}
                >
                  {slaInfo.type === 'overdue' ? (
                    <AppIcon name="alert-triangle" className="w-5 h-5 text-white" />
                  ) : slaInfo.type === 'resolved' ? (
                    <AppIcon name="check-circle" className="w-5 h-5 text-white" />
                  ) : (
                    <AppIcon name="clock" className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  {slaInfo.type === 'overdue' && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/80 text-[11px] font-extrabold mb-1.5 shadow-2xs">
                      <PulsingStatusDot color="bg-amber-600" />
                      <span>{lang === 'ar' ? 'أولوية قصوى للمتابعة' : 'Priority Follow-up'}</span>
                    </div>
                  )}
                  <h4 className="text-sm font-extrabold text-navy leading-snug">{slaInfo.title}</h4>
                  <p className="mt-1.5 text-xs text-navy/75 leading-relaxed">
                    {slaInfo.desc}
                  </p>
                </div>
              </div>

              {waHref && (
                <div className="mt-5 border-t border-navy/10 pt-4">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      track('whatsapp_clicked', {
                        target: slaInfo.type === 'overdue' ? 'offer_page_escalate_overdue' : 'offer_page_escalate',
                        meta: { request_id: request.id, is_overdue: slaInfo.type === 'overdue' },
                      })
                    }
                    className={`btn-primary w-full !h-11 text-xs font-extrabold flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all ${
                      slaInfo.type === 'overdue'
                        ? '!bg-gradient-to-r !from-amber-600 !to-amber-700 hover:!from-amber-700 hover:!to-amber-800 text-white'
                        : ''
                    }`}
                  >
                    <WhatsAppIcon className="w-4 h-4 text-white" />
                    <span>{slaInfo.buttonText}</span>
                  </a>
                </div>
              )}
            </motion.div>

            {/* Rafiq Trust Guarantee Badge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="card p-6 shadow-card border border-cream-dark bg-white"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 border border-green-200">
                  <AppIcon name="shield-check" className="w-5 h-5 text-green-600 shrink-0" />
                </div>
                <h4 className="text-sm font-extrabold text-navy">{t('offerPage.trustTitle')}</h4>
              </div>
              <p className="text-xs text-navy/65 leading-relaxed">
                {t('offerPage.trustDesc')}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Lightbox for attachments */}
      {lightboxIndex != null && primaryOffer && (
        <PhotoLightbox
          photos={offerImageFiles}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      {/* Floating Sticky Mobile Bottom Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-cream-dark p-3.5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          {primaryOffer && !isVerified && primaryOffer.status === 'sent' && !isExpired ? (
            <>
              <div>
                <p className="text-[11px] font-bold text-navy/50">{t('offerPage.price')}</p>
                <p className="text-lg font-black text-navy leading-none" dir="ltr">
                  {(primaryOffer.price ?? 0).toLocaleString()} <span className="text-xs font-bold text-navy/70">{primaryOffer.currency || 'TL'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 w-11 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center shrink-0 shadow-xs active:scale-95 transition-transform"
                    aria-label="WhatsApp"
                  >
                    <WhatsAppIcon className="w-5 h-5 text-green-600" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={primaryPayment?.status === 'pending' && resumeUrl ? () => { window.location.href = resumeUrl; } : startPayment}
                  disabled={busy || isExpired}
                  className="btn-primary !h-11 px-5 text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition-transform"
                >
                  <AppIcon name="credit-card" className="w-4 h-4" />
                  <span>
                    {primaryPayment?.status === 'pending'
                      ? t('serviceOffer.resumePayment')
                      : (busy ? t('serviceOffer.starting') : t('serviceOffer.payCta'))}
                  </span>
                </button>
              </div>
            </>
          ) : !primaryOffer && waHref ? (
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <PulsingStatusDot color={isOverdue ? 'bg-amber-500' : 'bg-blue-500'} />
                <span className="text-xs font-bold text-navy truncate">
                  {isOverdue ? (lang === 'ar' ? 'أولوية قصوى' : 'Priority Request') : (lang === 'ar' ? 'قيد المراجعة' : 'In Review')}
                </span>
              </div>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className={`btn-primary !h-11 px-4 text-xs font-extrabold flex items-center justify-center gap-2 shadow-md ${
                  isOverdue ? '!bg-gradient-to-r !from-amber-600 !to-amber-700 text-white' : ''
                }`}
              >
                <WhatsAppIcon className="w-4 h-4 text-white" />
                <span>{slaInfo.buttonText}</span>
              </a>
            </div>
          ) : isVerified ? (
            <div className="flex items-center justify-center w-full gap-2 py-1 text-green-800 font-extrabold text-xs">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">✓</span>
              <span>{t('serviceOffer.paid')}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OfferPage() {
  return (
    <RequireAuth>
      <OfferPageInner />
    </RequireAuth>
  );
}
export default OfferPage;
