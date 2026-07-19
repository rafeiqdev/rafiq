import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { PageHero } from '../../components/PageHero';
import { IstanbulApps } from '../../components/IstanbulApps';
import { BANNERS } from '../../lib/images';
import { useApp } from '../../context/AppContext';

interface Trick {
  id: string;
  icon: IconName;
  kind: 'app' | 'tip';
  /** external link for app tricks */
  url?: string;
  /** featured (full-width, highlighted) */
  featured?: boolean;
  /** accent tint token (mobile polish) */
  accent: 'navy-light' | 'navy' | 'brand-red';
}

// Tips only — the apps themselves live once in the IstanbulApps directory below.
const TRICKS: Trick[] = [
  { id: 'esim', icon: 'smartphone', kind: 'tip', accent: 'navy-light' },
  { id: 'vergi', icon: 'receipt', kind: 'tip', accent: 'navy' },
  { id: 'taxiCaution', icon: 'alert-triangle', kind: 'tip', accent: 'brand-red' },
];

// Per-accent tinted icon-chip + accent bar (Tailwind-safe literal classes).
const ACCENT: Record<Trick['accent'], { chip: string; bar: string }> = {
  'navy-light': { chip: 'bg-navy-light/10 text-navy-light', bar: 'bg-navy-light' },
  navy: { chip: 'bg-navy/10 text-navy', bar: 'bg-navy' },
  'brand-red': { chip: 'bg-brand-red/10 text-brand-red', bar: 'bg-brand-red' },
};

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

function TrickCard({ trick, index }: { trick: Trick; index: number }) {
  const { t } = useTranslation();
  const isApp = trick.kind === 'app';
  const a = ACCENT[trick.accent];
  return (
    <article
      className={`card card-hover relative flex flex-col overflow-hidden p-[18px] ${trick.featured ? 'bg-brand-blue/40' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      <span aria-hidden className={`absolute start-0 top-0 h-full w-1 ${a.bar}`} />
      <div className="flex items-start gap-3.5">
        <span className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] ${a.chip}`}>
          <AppIcon name={trick.icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15.5px] font-extrabold text-navy">{t(`tricks.items.${trick.id}.title`)}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isApp ? 'bg-navy text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {t(isApp ? 'tricks.appBadge' : 'tricks.tipBadge')}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{t(`tricks.items.${trick.id}.body`)}</p>
        </div>
      </div>
      {isApp && trick.url && (
        <a
          href={trick.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary mt-3.5 flex min-h-[48px] w-full transition-transform active:scale-[0.98]"
        >
          <AppIcon name="download" className="h-4 w-4" />
          {t('tricks.openApp')}
        </a>
      )}
    </article>
  );
}

export function MobileTricks() {
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
            image={BANNERS.tricks}
            title={t('tricks.title')}
            subtitle={t('tricks.subtitle')}
            height="min-h-[14rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        <div className="flex flex-col gap-6 px-5 pt-5">
          {/* ── Trick cards (single column, polished) ── */}
          <div className="stagger flex flex-col gap-3.5">
            {TRICKS.map((trick, i) => (
              <TrickCard key={trick.id} trick={trick} index={i} />
            ))}
          </div>

          {/* ── Essential Istanbul apps directory (reused, unchanged) ── */}
          <IstanbulApps />

          {/* ── Closing CTA ── */}
          <section className="card animate-fade-up flex flex-col rounded-[18px] bg-navy p-[22px] text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/15">
                <AppIcon name="message-circle" className="h-[22px] w-[22px]" />
              </span>
              <h2 className="text-[17px] font-extrabold">{t('tricks.ctaTitle')}</h2>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">{t('tricks.ctaBody')}</p>
            <Link
              to="/premium"
              className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-btn bg-white text-[15px] font-bold text-navy transition-transform active:scale-[0.98]"
            >
              {t('tricks.ctaButton')}
              <DirArrow />
            </Link>
          </section>
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
