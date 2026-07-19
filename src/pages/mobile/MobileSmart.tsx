import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { blocksFor } from '../../blocks/registry';
import { AppIcon, DirArrow } from '../../components/AppIcon';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
type MobileCopy = {
  back: string;
  tabHome: string;
  tabChat: string;
  tabMap: string;
  tabServices: string;
  tabProfile: string;
};

const mobileCopy: Record<string, MobileCopy> = {
  en: { back: 'Back', tabHome: 'Home', tabChat: 'AI Chat', tabMap: 'Map', tabServices: 'Services', tabProfile: 'Profile' },
  ar: { back: 'رجوع', tabHome: 'الرئيسية', tabChat: 'المساعد', tabMap: 'الخريطة', tabServices: 'الخدمات', tabProfile: 'حسابي' },
  fa: { back: 'بازگشت', tabHome: 'خانه', tabChat: 'دستیار', tabMap: 'نقشه', tabServices: 'خدمات', tabProfile: 'پروفایل' },
  ru: { back: 'Назад', tabHome: 'Главная', tabChat: 'ИИ-чат', tabMap: 'Карта', tabServices: 'Услуги', tabProfile: 'Профиль' },
};

/** Smart Consultation (mobile): diagnostics dashboard derived from the profile. */
export function MobileSmart() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useApp();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  // ----- derived values (mirror desktop Smart.tsx exactly) -----
  const hasItems = [
    ['turkishPhone', profile.has.turkishPhone],
    ['taxNumber', profile.has.taxNumber],
    ['residencePermit', profile.has.residencePermit],
    ['bankAccount', profile.has.bankAccount],
  ] as const;

  const owned = hasItems.filter(([, v]) => v).length;
  const pct = Math.round((owned / hasItems.length) * 100);
  const missing = hasItems.filter(([, v]) => !v);
  const nextBlocks = blocksFor(profile).slice(0, 4);

  // ----- bottom tab bar (verbatim from MobileHome.tsx — none active on /smart) -----
  const tabs = [
    { to: '/', icon: 'home', label: mc.tabHome },
    { to: '/premium', icon: 'message-circle', label: mc.tabChat },
    { to: '/map', icon: 'map', label: mc.tabMap },
    { to: '/services', icon: 'layers', label: mc.tabServices },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.tabProfile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      {/* clears the fixed tab bar */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ================= STANDARD CONTENT-PAGE HEADER ================= */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-navy px-5 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-14 -end-4 text-[11.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div className="relative mt-4 animate-fade-up">
            <h1 className="text-[26px] font-extrabold leading-tight text-white">{t('smart.title')}</h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{t('smart.subtitle')}</p>
          </div>
        </header>

        {/* ================= COMPLETENESS ================= */}
        <section className="card animate-fade-up mx-5 mt-5 p-5">
          <h2 className="text-[15px] font-extrabold text-navy">{t('smart.completeness')}</h2>
          <div className="mt-4 flex items-center gap-[18px]">
            <div className="relative h-[92px] w-[92px] shrink-0">
              <svg viewBox="0 0 36 36" className="h-[92px] w-[92px] -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#dceaf6" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#1d5f9e"
                  strokeWidth="3.5"
                  strokeDasharray={`${pct} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[17px] font-extrabold text-navy" dir="ltr">
                {pct}%
              </span>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-2 text-[13.5px]">
              {hasItems.map(([k, v]) => (
                <li key={k} className={`flex items-center gap-2 ${v ? 'font-semibold text-green-700' : 'text-navy/60'}`}>
                  <AppIcon name={v ? 'check' : 'circle'} className="h-[15px] w-[15px] shrink-0" />
                  <span className="min-w-0">{t(`onboarding.q3.${k}.title`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= MISSING ITEMS ================= */}
        <section className="card animate-fade-up mx-5 mt-4 p-5">
          <h2 className="text-[15px] font-extrabold text-navy">{t('smart.missing')}</h2>
          {missing.length === 0 ? (
            <p className="mt-3.5 flex items-center gap-2 text-sm font-semibold text-green-700">
              <AppIcon name="check-circle" className="h-[18px] w-[18px] shrink-0" />
              {t('smart.noMissing')}
            </p>
          ) : (
            <ul className="mt-3.5 flex flex-col gap-2">
              {missing.map(([k]) => (
                <li key={k} className="amber-note flex min-h-[48px] items-center gap-2.5">
                  <AppIcon name="alert-triangle" className="h-[17px] w-[17px] shrink-0" />
                  {t(`onboarding.q3.${k}.title`)}
                </li>
              ))}
            </ul>
          )}
          <Link to="/premium" className="btn-primary mt-[18px] flex min-h-[52px] w-full text-[15px]">
            <AppIcon name="message-circle" className="h-5 w-5 shrink-0" />
            {t('smart.askAi')}
          </Link>
        </section>

        {/* ================= NEXT STEPS (stacked list, not desktop's grid) ================= */}
        <section className="card animate-fade-up mx-5 mt-4 p-5">
          <h2 className="text-[15px] font-extrabold text-navy">{t('smart.nextSteps')}</h2>
          <ol className="mt-2.5 flex flex-col">
            {nextBlocks.map((b, i) => (
              <li key={b.id} className={i < nextBlocks.length - 1 ? 'border-b border-cream-dark' : ''}>
                <Link to={b.ctaTo} className="flex min-h-[56px] items-center gap-3 px-0.5 py-2">
                  <span className="icon-chip !h-9 !w-9 text-[13px] font-extrabold">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-navy">
                    {t(`blocks.${b.id}.title`)}
                  </span>
                  <span className="shrink-0 text-navy/60">
                    <DirArrow className="h-[17px] w-[17px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ================= BOTTOM TAB BAR — copied verbatim from MobileHome.tsx ================= */}
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
