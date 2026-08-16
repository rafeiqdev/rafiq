import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AppIcon, DirArrow } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { useApp } from '../../context/AppContext';
import { SiteImage } from '../../components/SiteImage';
import { CAROUSEL } from '../../lib/images';
import { normalizeSearch, keywordsFor, pickText } from '../../data/services';
import { useCatalog } from '../../data/catalogStore';
import { blocksFor } from '../../blocks/registry';
import { BlockCard } from '../../blocks/BlockCard';
import { HowItWorks } from '../../components/sections/HowItWorks';
import { Testimonials } from '../../components/sections/Testimonials';
import { NewsSection } from '../../components/sections/NewsSection';
import { RealEstateSection } from '../../components/sections/RealEstateSection';
import { LocalBusinessSchema } from '../../components/LocalBusinessSchema';
// Label only — this screen keeps its own inline bar (see the tabs array below).
import { tabRequestsLabel } from '../../components/MobileTabBar';
import { usePageMeta } from '../../lib/seo';
import { track, normalizeSearchQuery } from '../../lib/analytics';

const FAQ_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

const TRUST = [
  { icon: 'languages', key: 'home.trustbar.languages' },
  { icon: 'users', key: 'home.trustbar.experts' },
] as const;

// Direct, always-visible links to the main service categories — previously
// only reachable via the bottom tab bar's "الخدمات" tab, which users weren't
// finding. See home.quickLinks.* for copy.
const QUICK_LINKS: { to: string; icon: IconName; key: string }[] = [
  { to: '/health-tourism', icon: 'heart-pulse', key: 'health' },
  { to: '/real-estate', icon: 'building', key: 'realEstate' },
  // Signed-in users lose /map from the bottom tab bar (that slot becomes
  // "Requests"), so this is their only way back to it — it must stay here.
  { to: '/map', icon: 'map', key: 'map' },
];

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
  const { services: catalogServices } = useCatalog();

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
    return catalogServices.filter((s) => {
      const hay = normalizeSearch(
        [s.title.ar, s.title.en, s.title.tr, s.desc.ar, s.desc.en, s.desc.tr, keywordsFor(s.id)].join(' '),
      );
      return hay.includes(nq) || toks.some((tk) => hay.includes(tk));
    }).slice(0, 6);
  }, [query, catalogServices]);

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

  // ----- bottom tab bar -----
  // THIS IS THE LAST INLINE COPY. Every other mobile screen now renders the
  // shared <MobileTabBar />; this one still draws its own because the file
  // belongs to a parallel workstream and a wholesale rewrite would collide with
  // it. Keep the two in lockstep until it can be consolidated too — a nav bar
  // that differs between pages is worse than the duplication itself.
  const tabs = [
    { to: '/', icon: 'home', label: mc.tabHome },
    { to: '/premium', icon: 'message-circle', label: mc.tabChat },
    // Signed in: the one question a returning customer has. Signed out: they
    // are pre-purchase, have no requests, and would only hit a sign-in wall.
    // `as const` on each branch: without it the ternary widens `icon` to
    // string and stops matching AppIcon's name union.
    user
      ? ({ to: '/requests', icon: 'inbox', label: tabRequestsLabel(lang) } as const)
      : ({ to: '/map', icon: 'map', label: mc.tabMap } as const),
    { to: '/services', icon: 'layers', label: mc.tabServices },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.tabProfile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <LocalBusinessSchema />
      {/* clears the fixed tab bar */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ================= HERO ================= */}
        {/* Light "Travelvise"-style hero (same Pinterest-inspired direction as
            desktop Home.tsx, recolored to navy/cream), replacing the old
            navy-photo-overlay header. `overflow-hidden` lives on the
            decoration wrapper below, NOT here: on the header it clipped the
            search suggestions at the hero's edge, which read as results
            hidden behind the next section. */}
        <header className="relative z-20 rounded-b-[28px] bg-cream">
          <div className="absolute inset-0 overflow-hidden rounded-b-[28px]" aria-hidden="true">
            <svg viewBox="0 0 200 200" className="absolute -end-16 -top-10 h-64 w-64 text-navy/[0.06]" fill="currentColor">
              <path d="M45.3,-58.7C58.5,-49.6,68.6,-35.1,71.9,-19.2C75.2,-3.3,71.7,14,63.4,28.4C55.1,42.8,42,54.3,27.1,61.6C12.2,68.9,-4.5,72,-20.6,68.4C-36.7,64.8,-52.2,54.5,-62.1,40.1C-72,25.7,-76.3,7.2,-73.4,-9.7C-70.5,-26.6,-60.4,-41.9,-46.9,-51.1C-33.4,-60.3,-16.7,-63.4,0.5,-64C17.7,-64.6,32.1,-67.8,45.3,-58.7Z" transform="translate(100 100)" />
            </svg>
            {/* small polaroid-style photo, echoing the desktop collage at a
                scale that fits a phone header without crowding the headline.
                Positioning lives on this plain wrapper div, NOT on SiteImage's
                own className: SiteImage's root always carries `relative`,
                and Tailwind emits `.relative` after `.absolute` in the
                stylesheet, so an `absolute` passed in via className loses
                the cascade and the photo stays in normal flow instead of
                floating in the corner (see the same fix in UserHome.tsx). */}
            <div className="absolute -end-3 top-[calc(env(safe-area-inset-top)+64px)] w-28 aspect-[4/5]">
              <SiteImage
                src={CAROUSEL[0]}
                alt=""
                priority
                className="w-full h-full rotate-[7deg] rounded-lg border-[3px] border-white shadow-cardHover"
              />
            </div>
          </div>

          <div className="relative px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-8">
            {/* This screen only ever renders for a signed-out visitor (see
                HomeGate in App.tsx: a signed-in user gets UserHome instead),
                so a notifications bell here was always a dead button — there
                is nothing to notify a guest about. Removed rather than
                guarded, since `user` can never be truthy on this screen. */}
            <h1 className="max-w-[64%] text-navy text-[28px] leading-snug font-bold animate-fade-up text-balance">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-3 max-w-[64%] text-navy/70 text-[15px] leading-relaxed animate-fade-up">
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
                  className="shrink-0 w-12 h-12 min-h-[48px] rounded-btn bg-navy text-white flex items-center justify-center active:scale-95 transition-transform"
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
                        {s.image ? (
                          <img src={s.image} alt="" loading="lazy" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        ) : (
                          <AppIcon name="search" className="w-4 h-4 text-navy/40 shrink-0" />
                        )}
                        <span className="truncate">{pickText(s.title, i18n.language)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* stacked step banner — the 3-step request flow (submit → quote →
                pay) shared by every service, surfaced right in the hero so a
                first-time visitor sees the whole journey before scrolling */}
            <div className="mt-6 flex flex-col gap-3 p-4 rounded-2xl bg-navy/90 text-white animate-fade-up border border-white/10 shadow-lg">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">{t('home.heroSteps.eyebrow')}</span>
              {(['s1', 's2', 's3'] as const).map((key, i) => (
                <div key={key} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10">
                  <span
                    dir="ltr"
                    className="shrink-0 w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xs font-black tabular-nums shadow-sm"
                  >
                    {i + 1}
                  </span>
                  <span className="text-[14px] font-semibold leading-snug text-white">{t(`home.heroSteps.${key}`)}</span>
                  {i < 2 && (
                    <DirArrow className="ms-auto w-4 h-4 shrink-0 text-white/50" aria-hidden />
                  )}
                </div>
              ))}
            </div>

            {/* trust bar — wraps instead of scrolling: the old horizontal
                scroller hid its scrollbar, so the row just looked clipped at
                the viewport edge with nothing suggesting more to the side */}
            <div className="mt-6 flex flex-wrap gap-2">
              {TRUST.map((item) => (
                <span
                  key={item.key}
                  className="flex items-center gap-1.5 rounded-full border border-cream-dark bg-white text-navy/80 text-[13px] px-3.5 py-2 shadow-soft"
                >
                  <AppIcon name={item.icon} className="w-4 h-4 text-navy/50" />
                  {/* bdi isolates Latin runs like (KVKK) inside Arabic text —
                      without it the parenthesis renders on the wrong side */}
                  <bdi>{t(item.key)}</bdi>
                </span>
              ))}
            </div>

            {/* guest journey preview — same low-commitment demo as desktop
                Home.tsx; see journeyPage.guest.* copy */}
            <Link
              to="/journey"
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-btn border-2 border-navy bg-white px-5 py-3 text-sm font-bold text-navy shadow-soft active:bg-brand-blue"
            >
              <AppIcon name="compass" className="w-4 h-4" />
              {t('home.guestJourneyCta')}
            </Link>
          </div>
        </header>

        {/* ================= QUICK LINKS ================= */}
        {/* One joined segmented pill, ported 1:1 (shape, colors, the
            gradient-fill highlight) from a Pinterest reference. That
            reference showed one segment permanently highlighted as
            "current" — we have no such state here (none of these is the
            page we're on), so the gradient fires on press instead of
            sitting on one item by default, rather than faking a "you are
            here" that isn't true. */}
        <section className="mt-6 px-5">
          <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-white p-1.5 shadow-soft scrollbar-none">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 transition-colors active:bg-gradient-to-r active:from-[#2f6fed] active:to-[#1a4fd6]"
              >
                <AppIcon
                  name={q.icon}
                  className="w-4 h-4 shrink-0 text-[#a9b6c9] transition-colors group-active:text-white"
                />
                <span className="text-sm font-semibold text-[#9aa5b8] transition-colors group-active:text-white">
                  {t(`home.quickLinks.${q.key}`)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        {/* moved above "for you": explains the product before showing
            personalized cards that only make sense once you know what Rafiq does.
            Now the shared component (same photo-card treatment as desktop)
            instead of a separately maintained numbered list — one less place
            for the two platforms to drift apart. */}
        <HowItWorks />

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
            className="relative block overflow-hidden rounded-card bg-navy-dark p-6 text-white card-hover"
          >
            {/* same organic-blob decoration as the hero, recolored for a dark
                surface — the reference's dark accent block, on-brand */}
            <svg viewBox="0 0 200 200" className="pointer-events-none absolute -end-12 -top-14 h-48 w-48 text-white/[0.06]" fill="currentColor" aria-hidden>
              <path d="M45.3,-58.7C58.5,-49.6,68.6,-35.1,71.9,-19.2C75.2,-3.3,71.7,14,63.4,28.4C55.1,42.8,42,54.3,27.1,61.6C12.2,68.9,-4.5,72,-20.6,68.4C-36.7,64.8,-52.2,54.5,-62.1,40.1C-72,25.7,-76.3,7.2,-73.4,-9.7C-70.5,-26.6,-60.4,-41.9,-46.9,-51.1C-33.4,-60.3,-16.7,-63.4,0.5,-64C17.7,-64.6,32.1,-67.8,45.3,-58.7Z" transform="translate(100 100)" />
            </svg>
            <h3 className="relative text-xl font-bold">{t('home.servicesCta.title')}</h3>
            <p className="relative mt-2 text-white/75 text-[14px] leading-relaxed">
              {t('home.servicesCta.body')}
            </p>
            <span className="relative mt-4 inline-flex items-center gap-2 rounded-btn bg-white text-navy font-semibold text-[14px] px-4 py-3">
              {t('home.servicesCta.button')}
              <DirArrow className="w-4 h-4" />
            </span>
          </Link>
        </section>

        {/* ================= REAL ESTATE ================= */}
        <RealEstateSection compact />

        {/* ================= NEWS (mirrors the Telegram channel) ================= */}
        <NewsSection compact />

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

          {/* closing CTA — quieter than the services CTA above (light blue,
              not another navy gradient card) so the page doesn't end on a
              third repeat of the same heavy treatment; matches desktop's style */}
          <div className="mt-6 rounded-card bg-brand-blue/40 p-6 text-center">
            <h3 className="text-lg font-bold text-navy">{t('home.faq.ctaTitle')}</h3>
            <p className="mt-2 text-navy/70 text-[14px] leading-relaxed">
              {t('home.faq.ctaBody')}
            </p>
            <Link
              to="/premium"
              className="btn btn-primary mt-4 min-h-[48px] inline-flex items-center gap-2"
            >
              <AppIcon name="message-circle" className="w-4 h-4" />
              {t('home.faq.ctaButton')}
            </Link>
          </div>
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
                  active ? 'text-navy' : 'text-navy/70'
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
