import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AppIcon, DirArrow } from '../../components/AppIcon';
import { useApp } from '../../context/AppContext';
import { ImageCarousel } from '../../components/ImageCarousel';
import { CAROUSEL } from '../../lib/images';
import { SERVICES, normalizeSearch, keywordsFor, pickText } from '../../data/services';
import { blocksFor } from '../../blocks/registry';
import { BlockCard } from '../../blocks/BlockCard';
import { Testimonials } from '../../components/sections/Testimonials';
import { LocalBusinessSchema } from '../../components/LocalBusinessSchema';
import { usePageMeta } from '../../lib/seo';
import { track, normalizeSearchQuery } from '../../lib/analytics';

const FAQ_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

const TRUST = [
  { icon: 'languages', key: 'home.trustbar.languages' },
  { icon: 'users', key: 'home.trustbar.experts' },
  { icon: 'sparkles', key: 'home.trustbar.free' },
  { icon: 'shield-check', key: 'home.trustbar.secure' },
] as const;

type MobileCopy = {
  tabHome: string;
  tabChat: string;
  tabMap: string;
  tabServices: string;
  tabProfile: string;
  viewAll: string;
  searchPlaceholder: string;
};

const mobileCopy: Record<string, MobileCopy> = {
  en: {
    tabHome: 'Home',
    tabChat: 'AI Chat',
    tabMap: 'Map',
    tabServices: 'Services',
    tabProfile: 'Profile',
    viewAll: 'View all',
    searchPlaceholder: 'Search services…',
  },
  ar: {
    tabHome: 'الرئيسية',
    tabChat: 'المساعد',
    tabMap: 'الخريطة',
    tabServices: 'الخدمات',
    tabProfile: 'حسابي',
    viewAll: 'عرض الكل',
    searchPlaceholder: 'ابحث عن خدمة…',
  },
  fa: {
    tabHome: 'خانه',
    tabChat: 'دستیار',
    tabMap: 'نقشه',
    tabServices: 'خدمات',
    tabProfile: 'پروفایل',
    viewAll: 'نمایش همه',
    searchPlaceholder: 'جستجوی خدمات…',
  },
  ru: {
    tabHome: 'Главная',
    tabChat: 'ИИ-чат',
    tabMap: 'Карта',
    tabServices: 'Услуги',
    tabProfile: 'Профиль',
    viewAll: 'Показать все',
    searchPlaceholder: 'Поиск услуг…',
  },
};

export function MobileHome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user } = useApp();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  // ----- state (mirrors desktop Home.tsx) -----
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [showAllBlocks, setShowAllBlocks] = useState(false);

  usePageMeta({
    title: `${t('common.appName')} — ${t('home.heroTitle')}`,
    description: t('home.heroSubtitle'),
  });

  // Exact same forgiving-match predicate as desktop Home.tsx: normalize, then
  // match either the whole normalized query or any individual token (>=2
  // chars) against title/desc (ar/en/tr) + search synonyms.
  const suggestions = useMemo(() => {
    const nq = normalizeSearch(query);
    if (!nq) return [];
    const toks = nq.split(' ').filter((tk) => tk.length >= 2);
    return SERVICES.filter((s) => {
      const hay = normalizeSearch(
        [s.title.ar, s.title.en, s.title.tr, s.desc.ar, s.desc.en, s.desc.tr, keywordsFor(s.id)].join(' '),
      );
      return hay.includes(nq) || toks.some((tk) => hay.includes(tk));
    }).slice(0, 6);
  }, [query]);

  // Personalized blocks — same source + same filter predicate as desktop
  // (matches against the TRANSLATED title/body text via t(), blocks don't
  // carry an I18nText title object like SERVICES items do).
  const blocks = useMemo(() => blocksFor(profile), [profile]);
  const visible = query.trim()
    ? blocks.filter((b) =>
        `${t(`blocks.${b.id}.title`)} ${t(`blocks.${b.id}.body`)}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : blocks;
  const visibleBlocks = query.trim() || showAllBlocks ? visible : visible.slice(0, 3);
  const hasMoreBlocks = !query.trim() && !showAllBlocks && visible.length > 3;

  const goServices = () => {
    const q = query.trim();
    if (q) track('search_performed', { meta: { query: normalizeSearchQuery(q), result_count: suggestions.length } });
    navigate(q ? `/services?q=${encodeURIComponent(q)}` : '/services');
  };

  // ----- bottom tab bar (self-contained block — copy verbatim onto every mobile screen) -----
  const tabs = [
    { to: '/', icon: 'home', label: mc.tabHome },
    { to: '/premium', icon: 'message-circle', label: mc.tabChat },
    { to: '/map', icon: 'map', label: mc.tabMap },
    { to: '/services', icon: 'layers', label: mc.tabServices },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.tabProfile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <LocalBusinessSchema />
      {/* clears the fixed tab bar */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ================= HERO ================= */}
        {/* `overflow-hidden` lives on the decoration wrapper below, NOT here:
            on the header it clipped the search suggestions at the hero's edge,
            which read as results hidden behind the next section. */}
        <header className="relative z-20 rounded-b-[28px] bg-navy">
          <div className="absolute inset-0 overflow-hidden rounded-b-[28px]">
            <div className="absolute inset-0">
              <ImageCarousel images={CAROUSEL} intervalMs={3000} />
            </div>
            <div className="absolute inset-0 bg-navy/80" aria-hidden="true" />
            {/* quiet brand watermark — same trick as MobileAuth */}
            <span
              aria-hidden="true"
              className="pointer-events-none select-none absolute -bottom-14 -end-4 text-[190px] leading-none font-bold text-white/5"
            >
              ر
            </span>
          </div>

          <div className="relative px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-10">
            <h1 className="text-white text-[28px] leading-snug font-bold animate-fade-up text-balance">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-3 text-white/75 text-[15px] leading-relaxed animate-fade-up">
              {t('home.heroSubtitle')}
            </p>

            {/* search */}
            <div className="relative mt-6 animate-pop">
              <div className="flex items-center gap-2 bg-white rounded-btn p-1.5 shadow-lg">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  onKeyDown={(e) => e.key === 'Enter' && goServices()}
                  placeholder={mc.searchPlaceholder}
                  className="input flex-1 min-w-0 border-0 shadow-none bg-transparent text-[15px]"
                  type="search"
                  enterKeyHint="search"
                />
                <button
                  type="button"
                  onClick={goServices}
                  aria-label={mc.tabServices}
                  className="shrink-0 w-12 h-12 rounded-btn bg-navy text-white flex items-center justify-center active:scale-95 transition-transform"
                >
                  <AppIcon name="search" className="w-5 h-5" />
                </button>
              </div>

              {focused && query.trim() && suggestions.length > 0 && (
                <ul className="absolute top-full inset-x-0 mt-2 z-30 bg-white rounded-card shadow-xl overflow-hidden animate-fade-in">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          navigate(
                            `/services?q=${encodeURIComponent(pickText(s.title, i18n.language))}`,
                          )
                        }
                        className="w-full min-h-[48px] flex items-center gap-3 px-4 py-3 text-start text-[15px] text-navy border-b border-cream-dark last:border-b-0 active:bg-brand-blue"
                      >
                        <AppIcon name="search" className="w-4 h-4 text-navy/40 shrink-0" />
                        <span className="truncate">{pickText(s.title, i18n.language)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* trust bar — horizontal scroll */}
            <div className="mt-6 -mx-5 px-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TRUST.map((item) => (
                <span
                  key={item.key}
                  className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 text-white text-[13px] px-3.5 py-2"
                >
                  <AppIcon name={item.icon} className="w-4 h-4" />
                  {t(item.key)}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* ================= FOR YOU ================= */}
        <section className="mt-8 stagger">
          <div className="px-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">{t('home.forYou')}</h2>
            </div>
          </div>

          {/* snap carousel — one card at a time */}
          <div className="mt-4 flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleBlocks.map((b) => (
              <div key={b.id} className="snap-center shrink-0 w-[86%] max-w-[340px]">
                <BlockCard block={b} />
              </div>
            ))}
          </div>

          {hasMoreBlocks && (
            <div className="px-5 mt-2">
              <button
                type="button"
                onClick={() => setShowAllBlocks(true)}
                className="btn btn-secondary w-full min-h-[48px]"
              >
                {mc.viewAll} ({visible.length - 3}+)
              </button>
            </div>
          )}
        </section>

        {/* ================= SERVICES CTA ================= */}
        <section className="px-5 mt-8">
          <Link
            to="/services"
            className="block rounded-card bg-gradient-to-br from-navy to-navy-dark text-white p-6 card-hover"
          >
            <h3 className="text-xl font-bold">{t('home.servicesCta.title')}</h3>
            <p className="mt-2 text-white/75 text-[14px] leading-relaxed">
              {t('home.servicesCta.body')}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-btn bg-white text-navy font-semibold text-[14px] px-4 py-3">
              {t('home.servicesCta.button')}
              <DirArrow className="w-4 h-4" />
            </span>
          </Link>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section className="px-5 mt-10">
          <p className="eyebrow">{t('home.how.eyebrow')}</p>
          <h2 className="section-title">{t('home.how.title')}</h2>
          <p className="mt-1 text-navy/60 text-[14px]">{t('home.how.subtitle')}</p>

          <ol className="mt-5 relative">
            {(['s1', 's2', 's3'] as const).map((step, i) => (
              <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
                {i < 2 && (
                  <span
                    aria-hidden="true"
                    className="absolute start-5 top-10 bottom-0 w-px bg-cream-dark"
                  />
                )}
                <span className="icon-chip shrink-0 w-10 h-10 flex items-center justify-center font-bold text-[15px]">
                  {i + 1}
                </span>
                <div className="pt-1.5">
                  <h3 className="font-semibold text-navy text-[15px]">
                    {t(`home.how.${step}.title`)}
                  </h3>
                  <p className="mt-1 text-navy/60 text-[14px] leading-relaxed">
                    {t(`home.how.${step}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ================= ABOUT ================= */}
        <section className="px-5 mt-10">
          <div className="card p-6">
            <p className="eyebrow">{t('home.about.eyebrow')}</p>
            <h2 className="section-title">{t('home.about.title')}</h2>
            <p className="mt-2 text-navy/70 text-[14px] leading-relaxed">
              {t('home.about.body')}
            </p>
            <ul className="mt-4 space-y-3">
              {(['p1', 'p2', 'p3'] as const).map((p) => (
                <li key={p} className="flex items-start gap-3 text-[14px] text-navy">
                  <span className="icon-chip-gold shrink-0 w-7 h-7 flex items-center justify-center">
                    <AppIcon name="check" className="w-4 h-4" />
                  </span>
                  {t(`home.about.${p}`)}
                </li>
              ))}
            </ul>
            <Link to="/premium" className="btn btn-primary w-full min-h-[48px] mt-5">
              {t('home.about.cta')}
              <DirArrow className="w-4 h-4 ms-2" />
            </Link>
          </div>
        </section>

        {/* ================= TESTIMONIALS (existing, full-bleed) ================= */}
        <div className="mt-10">
          <Testimonials />
        </div>

        {/* ================= FAQ ================= */}
        <section className="px-5 mt-10">
          <h2 className="section-title">{t('home.faq.title')}</h2>
          <div className="mt-4 space-y-3">
            {FAQ_IDS.map((id) => (
              <details key={id} className="card group overflow-hidden">
                <summary className="flex items-center justify-between gap-3 min-h-[52px] px-4 py-3.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] font-semibold text-navy">
                  <span className="flex-1 min-w-0">{t(`home.faq.${id}.q`)}</span>
                  <span className="text-navy/50 transition-transform group-open:rotate-45 text-xl leading-none shrink-0">+</span>
                </summary>
                <p className="px-4 pb-4 text-[14px] leading-relaxed text-navy/70">
                  {t(`home.faq.${id}.a`)}
                </p>
              </details>
            ))}
          </div>

          {/* closing CTA */}
          <Link
            to="/premium"
            className="mt-6 block rounded-card bg-gradient-to-br from-navy to-navy-dark text-white p-6"
          >
            <h3 className="text-lg font-bold">{t('home.faq.ctaTitle')}</h3>
            <p className="mt-2 text-white/75 text-[14px] leading-relaxed">
              {t('home.faq.ctaBody')}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-btn bg-white text-navy font-semibold text-[14px] px-4 py-3">
              {t('home.faq.ctaButton')}
              <DirArrow className="w-4 h-4" />
            </span>
          </Link>
        </section>
      </div>

      {/* ================= BOTTOM TAB BAR — copy this whole <nav> onto every mobile screen ================= */}
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
