import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, leads } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { MedicalTourismTypes } from '../../components/MedicalTourismTypes';
import { PageHero } from '../../components/PageHero';
import { EXPLORE_PHOTOS } from '../../lib/images';

// PART 1 — original data, verbatim.
const SERVICES: { id: string; icon: IconName; accent: string }[] = [
  { id: 'hair', icon: 'scissors', accent: 'navy-light' },
  { id: 'dental', icon: 'smile', accent: 'navy' },
  { id: 'checkup', icon: 'stethoscope', accent: 'brand-red' },
];

// Per-service tinted icon-chip + accent bar (Tailwind-safe literal classes).
const ACCENT: Record<string, { chip: string; bar: string }> = {
  'navy-light': { chip: 'bg-navy-light/10 text-navy-light', bar: 'bg-navy-light' },
  navy: { chip: 'bg-navy/10 text-navy', bar: 'bg-navy' },
  'brand-red': { chip: 'bg-brand-red/10 text-brand-red', bar: 'bg-brand-red' },
};

// New trust-strip chips (PART 2) — icon + copy key.
const TRUST: { icon: IconName; key: 'accredited' | 'modern' | 'cost'; chip: string }[] = [
  { icon: 'shield-check', key: 'accredited', chip: 'bg-navy-light/10 text-navy-light' },
  { icon: 'heart-pulse', key: 'modern', chip: 'bg-brand-red/10 text-brand-red' },
  { icon: 'trending-up', key: 'cost', chip: 'bg-navy/10 text-navy' },
];

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, {
  back: string; home: string; chat: string; map: string; services: string; profile: string;
  howEyebrow: string; howTitle: string; servicesHeading: string;
  trust: Record<'accredited' | 'modern' | 'cost', string>;
  steps: [string, string, string, string];
}> = {
  en: {
    back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile',
    howEyebrow: 'The Rafiq process', howTitle: 'How it works', servicesHeading: 'Popular treatments',
    trust: {
      accredited: 'Internationally accredited hospitals',
      modern: 'Modern facilities, English-speaking medical staff',
      cost: 'Significantly lower cost than Western Europe',
    },
    steps: [
      "Tell us what treatment you're looking for.",
      'Get matched with a vetted clinic + a quote within 24 hours.',
      'We coordinate your trip and treatment door-to-door.',
      "Ongoing aftercare support once you're back home.",
    ],
  },
  ar: {
    back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي',
    howEyebrow: 'مسار رفيق', howTitle: 'كيف تعمل', servicesHeading: 'أبرز العلاجات',
    trust: {
      accredited: 'مستشفيات معتمدة دوليًا',
      modern: 'مرافق حديثة وطاقم طبي يتحدث الإنجليزية',
      cost: 'تكلفة أقل بكثير من غرب أوروبا',
    },
    steps: [
      'أخبرنا بالعلاج الذي تبحث عنه.',
      'نطابقك مع عيادة موثوقة + عرض سعر خلال 24 ساعة.',
      'ننسّق رحلتك وعلاجك من الباب إلى الباب.',
      'دعم رعاية لاحقة بعد عودتك إلى بلدك.',
    ],
  },
  fa: {
    back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل',
    howEyebrow: 'روند رفیق', howTitle: 'چطور کار می‌کند', servicesHeading: 'درمان‌های محبوب',
    trust: {
      accredited: 'بیمارستان‌های دارای اعتبار بین‌المللی',
      modern: 'امکانات مدرن، کادر پزشکی انگلیسی‌زبان',
      cost: 'هزینه بسیار کمتر از اروپای غربی',
    },
    steps: [
      'به ما بگویید دنبال چه درمانی هستید.',
      'با یک کلینیک معتبر + پیشنهاد قیمت ظرف ۲۴ ساعت مطابقت داده می‌شوید.',
      'سفر و درمان شما را در به در هماهنگ می‌کنیم.',
      'پشتیبانی مراقبت پس از بازگشت به خانه.',
    ],
  },
  ru: {
    back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль',
    howEyebrow: 'Процесс Rafiq', howTitle: 'Как это работает', servicesHeading: 'Популярные направления',
    trust: {
      accredited: 'Больницы с международной аккредитацией',
      modern: 'Современные клиники, англоговорящий медперсонал',
      cost: 'Значительно ниже цен Западной Европы',
    },
    steps: [
      'Расскажите, какое лечение вам нужно.',
      'Мы подберём проверенную клинику и пришлём смету в течение 24 часов.',
      'Организуем поездку и лечение «под ключ».',
      'Поддерживаем связь и после вашего возвращения домой.',
    ],
  },
};

export function MobileHealthTourism() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  // requests are persisted leads — reflect existing ones after reload (verbatim)
  useEffect(() => {
    if (!user) return;
    leads
      .mine()
      .then((mine) => {
        const map: Record<string, boolean> = {};
        for (const l of mine.filter((x) => x.kind === 'health')) {
          const match = SERVICES.find((s) => l.item.startsWith(s.id));
          if (match) map[match.id] = true;
        }
        setRequested(map);
      })
      .catch(() => {});
  }, [user]);

  const request = async (id: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      await leads.create('health', `${id} — ${t(`health.services.${id}.title`)}`);
      setRequested((r) => ({ ...r, [id]: true }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) navigate('/auth');
    }
  };

  const tabs = [
    { to: '/', icon: 'home', label: mc.home },
    { to: '/premium', icon: 'message-circle', label: mc.chat },
    { to: '/map', icon: 'map', label: mc.map },
    { to: '/services', icon: 'layers', label: mc.services },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.profile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── PART 2: Photo hero (editorial variant, no fake status bar) ── */}
        <div className="relative animate-fade-in overflow-hidden rounded-b-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors active:bg-white/30"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <PageHero
            image={EXPLORE_PHOTOS['/health-tourism']}
            title={t('health.title')}
            subtitle={t('health.subtitle')}
            height="min-h-[14rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        <div className="flex flex-col gap-6 px-5 pt-5">
          {/* ── PART 2: "Why Istanbul" trust strip ── */}
          <div className="flex animate-fade-up flex-col gap-2.5">
            {TRUST.map((tr) => (
              <div key={tr.key} className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-white p-3.5 shadow-sm">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tr.chip}`}>
                  <AppIcon name={tr.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 text-[13.5px] font-semibold leading-snug text-navy">{mc.trust[tr.key]}</span>
              </div>
            ))}
          </div>

          {/* ── PART 2: "How it works" process timeline ── */}
          <section>
            <p className="eyebrow">{mc.howEyebrow}</p>
            <h2 className="section-title mt-1 !text-lg">{mc.howTitle}</h2>
            <ol className="relative mt-4 flex flex-col">
              {mc.steps.map((step, i) => (
                <li key={i} className="relative ps-11 pb-5 last:pb-0">
                  <span className="icon-chip absolute start-0 top-0 z-10 !h-8 !w-8 text-[13px] font-extrabold">{i + 1}</span>
                  {i < mc.steps.length - 1 && (
                    <span className="absolute start-[15.5px] top-8 bottom-0 w-px bg-cream-dark" aria-hidden />
                  )}
                  <p className="pt-1.5 text-[13.5px] leading-snug text-navy/80">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ── PART 1: 3 service cards (premium treatment, identical logic) ── */}
          <section>
            <h2 className="section-title mb-3.5 !text-lg">{mc.servicesHeading}</h2>
            <div className="flex flex-col gap-3.5">
              {SERVICES.map((s) => {
                const a = ACCENT[s.accent];
                return (
                  <div key={s.id} className="card card-hover relative flex animate-fade-up flex-col overflow-hidden p-5">
                    <span aria-hidden className={`absolute start-0 top-0 h-full w-1 ${a.bar}`} />
                    <span className={`flex h-[52px] w-[52px] items-center justify-center rounded-2xl ${a.chip}`}>
                      <AppIcon name={s.icon} className="h-7 w-7" />
                    </span>
                    <h3 className="mt-3.5 text-[16.5px] font-extrabold text-navy">{t(`health.services.${s.id}.title`)}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">{t(`health.services.${s.id}.body`)}</p>
                    <button
                      onClick={() => request(s.id)}
                      disabled={requested[s.id]}
                      className="btn-primary mt-4 flex min-h-[50px] w-full transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
                    >
                      {requested[s.id] && <AppIcon name="check" className="h-4 w-4" />}
                      {requested[s.id] ? t('health.requested') : t('health.cta')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── PART 1: interactive directory (reused, unchanged) ── */}
          <MedicalTourismTypes />
        </div>
      </div>

      {/* ── Bottom tab bar — verbatim from MobileHome.tsx; none active ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active =
              tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.icon}
                to={tab.to}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] pt-2 pb-1.5 ${
                  active ? 'text-navy' : 'text-navy/40'
                }`}
              >
                <AppIcon name={tab.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
