import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { PageHero } from '../../components/PageHero';
import { EXPLORE_PHOTOS } from '../../lib/images';
import { useApp } from '../../context/AppContext';

// Kept local (not exported) — Hub.tsx stays the canonical export.
const GUIDE_SLUGS = ['istanbulkart', 'esim', 'ikamet', 'vergi', 'bank', 'districts'] as const;

const ICONS: Record<string, IconName> = {
  istanbulkart: 'bus',
  esim: 'smartphone',
  ikamet: 'id-card',
  vergi: 'receipt',
  bank: 'landmark',
  districts: 'map',
};

// Per-guide accent tint (mobile polish) — Tailwind-safe literal classes.
const ACCENT: Record<string, { chip: string; bar: string }> = {
  istanbulkart: { chip: 'bg-navy-light/10 text-navy-light', bar: 'bg-navy-light' },
  esim: { chip: 'bg-navy-light/10 text-navy-light', bar: 'bg-navy-light' },
  ikamet: { chip: 'bg-navy/10 text-navy', bar: 'bg-navy' },
  vergi: { chip: 'bg-navy/10 text-navy', bar: 'bg-navy' },
  bank: { chip: 'bg-navy/10 text-navy', bar: 'bg-navy' },
  districts: { chip: 'bg-brand-red/10 text-brand-red', bar: 'bg-brand-red' },
};

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

export function MobileHub() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useApp();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

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
        {/* ── Photo-hero header (editorial variant, no fake status bar) ── */}
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
            image={EXPLORE_PHOTOS['/hub']}
            title={t('hub.title')}
            subtitle={t('hub.subtitle')}
            height="min-h-[14rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        {/* ── Guide list (single column, tactile rows) ── */}
        <div className="stagger flex flex-col gap-3 px-5 pt-5">
          {GUIDE_SLUGS.map((slug, i) => {
            const a = ACCENT[slug];
            return (
              <Link
                key={slug}
                to={`/hub/${slug}`}
                className="card card-hover relative flex animate-fade-up flex-col overflow-hidden p-5 transition-transform active:scale-[0.99]"
                style={{ '--i': i } as React.CSSProperties}
              >
                <span aria-hidden className={`absolute start-0 top-0 h-full w-1 ${a.bar}`} />
                <div className="flex items-start gap-3.5">
                  <span className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] ${a.chip}`}>
                    <AppIcon name={ICONS[slug]} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[14.5px] font-extrabold leading-snug text-navy">{t(`hub.guides.${slug}.title`)}</h2>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">{t(`hub.guides.${slug}.excerpt`)}</p>
                  </div>
                </div>
                {/* whole card is the tap target — the button is a visual affordance */}
                <span className="btn-primary pointer-events-none mt-4 flex min-h-[48px] w-full text-sm">
                  {t('hub.readMore')}
                  <DirArrow />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Bottom tab bar — verbatim from MobileTricks.tsx; none active ── */}
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
