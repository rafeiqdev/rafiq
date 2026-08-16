import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { blocksFor } from '../blocks/registry';
import { BlockCard } from '../blocks/BlockCard';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { SiteImage } from '../components/SiteImage';
import { CAROUSEL } from '../lib/images';
import { SERVICES, normalizeSearch, keywordsFor, pickText } from '../data/services';
import { HowItWorks } from '../components/sections/HowItWorks';
import { Testimonials } from '../components/sections/Testimonials';
import { AboutSection } from '../components/sections/AboutSection';
import { NewsSection } from '../components/sections/NewsSection';
import { RealEstateSection } from '../components/sections/RealEstateSection';
import { LocalBusinessSchema } from '../components/LocalBusinessSchema';
import { JourneyProgressBar } from '../components/JourneyProgressBar';
import { usePageMeta } from '../lib/seo';
import { HOME_STATS } from '../data/siteStats';

// P-simplify3: the old standalone "استكشف كل شي" grid (8 cards) duplicated
// links already reachable from the header nav / services dropdown, and was
// one of the 9 stacked sections making Home too long on mobile. Removed —
// see خطة_تبسيط_التصميم.md section 3, option أ.

const TRUST: { icon: IconName; key: string }[] = [
  { icon: 'languages', key: 'languages' },
  { icon: 'users', key: 'experts' },
];

// Direct, always-visible links to the main service categories — previously
// only reachable via the header's services dropdown (desktop) or bottom tab
// bar (mobile), which users weren't finding. Title from home.quickLinks.*;
// desc/cta reuse each destination page's own existing copy (no new claims).
const QUICK_LINKS: { to: string; icon: IconName; titleKey: string; descKey: string; ctaKey: string }[] = [
  { to: '/real-estate', icon: 'building', titleKey: 'home.quickLinks.realEstate', descKey: 'realEstate.home.body', ctaKey: 'realEstate.home.cta' },
  { to: '/services', icon: 'layers', titleKey: 'home.quickLinks.allServices', descKey: 'services.subtitle', ctaKey: 'home.servicesCta.button' },
  { to: '/health-tourism', icon: 'heart-pulse', titleKey: 'home.quickLinks.health', descKey: 'medical.hero.subtitle', ctaKey: 'medical.hero.cta' },
];

const FAQ_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

/** Descriptive alternatives for the three public Istanbul photos in the home hero. */
const HOME_HERO_IMAGE_ALTS = {
  ar: ['آيا صوفيا والمدينة القديمة في إسطنبول', 'البوسفور وبرج غلطة في إسطنبول', 'الجامع الأزرق في إسطنبول'],
  en: ['Hagia Sophia and Istanbul old city', 'The Bosphorus and Galata Tower in Istanbul', 'The Blue Mosque in Istanbul'],
  ru: ['Собор Святой Софии и старый город Стамбула', 'Босфор и Галатская башня в Стамбуле', 'Голубая мечеть в Стамбуле'],
  fa: ['ایاصوفیه و بافت تاریخی استانبول', 'بسفر و برج گالاتا در استانبول', 'مسجد آبی در استانبول'],
} as const;

function homeHeroImageAlts(language: string): readonly string[] {
  const locale = language.split('-')[0] as keyof typeof HOME_HERO_IMAGE_ALTS;
  return HOME_HERO_IMAGE_ALTS[locale] ?? HOME_HERO_IMAGE_ALTS.en;
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { profile } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const heroImageAlts = homeHeroImageAlts(i18n.language);

  usePageMeta({
    title: `${t('common.appName')} — ${t('home.heroTitle')}`,
    description: t('home.heroSubtitle'),
  });

  // P-simplify3: personalized blocks can reach ~9 cards depending on profile —
  // show the top 3 (already priority-sorted by blocksFor) by default with an
  // explicit "اعرض الباقي" instead of dumping all of them on load.
  const [showAllBlocks, setShowAllBlocks] = useState(false);

  // typing in the hero search and pressing Enter (or the icon) jumps to the
  // full services catalog, pre-filtered by the query
  const goServices = () =>
    navigate(query.trim() ? `/services?q=${encodeURIComponent(query.trim())}` : '/services');

  // live, forgiving suggestions (services matched by title/desc/keywords)
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

  const blocks = useMemo(() => blocksFor(profile), [profile]);
  const visible = query.trim()
    ? blocks.filter((b) =>
        `${t(`blocks.${b.id}.title`)} ${t(`blocks.${b.id}.body`)}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : blocks;
  // a search query is explicit intent — never truncate matched results, only
  // the untouched default list.
  const visibleBlocks = query.trim() || showAllBlocks ? visible : visible.slice(0, 3);
  const hasMoreBlocks = !query.trim() && !showAllBlocks && visible.length > 3;

  return (
    <div>
      <LocalBusinessSchema />
      {/* self-gates on signed-in status — renders nothing for guests */}
      <JourneyProgressBar />
      {/* ── Hero: light "Travelvise"-style layout (ported from a Pinterest
          reference, recolored to Rafiq's navy/cream/black identity instead of
          the reference's purple/orange) — big headline + an overlapping photo
          collage on an organic blob backdrop, instead of the old full-bleed
          navy-overlay photo carousel. ── */}
      <section className="relative overflow-hidden border-b border-cream-dark bg-cream">
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 md:grid-cols-2 md:items-center">
          <div className="relative z-10 text-center md:text-start">
            <h1 className="mx-auto max-w-xl text-3xl font-extrabold leading-tight text-navy sm:text-5xl md:mx-0">
              {t('home.heroTitle')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-navy/70 sm:text-lg md:mx-0">{t('home.heroSubtitle')}</p>

            {/* trust bar */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
              {TRUST.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cream-dark bg-white px-3 py-1.5 text-xs font-medium text-navy/80 shadow-soft"
                >
                  <AppIcon name={c.icon} className="w-3.5 h-3.5 text-navy/50" />
                  {/* bdi isolates Latin runs like (KVKK) inside Arabic text */}
                  <bdi>{t(`home.trustbar.${c.key}`)}</bdi>
                </span>
              ))}
            </div>

            {/* search with live suggestions; Enter / icon jumps to the full catalog */}
            <div className="relative mx-auto mt-8 max-w-lg md:mx-0">
              <input
                className="input h-12 pe-12 shadow-card"
                placeholder={t('home.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                onKeyDown={(e) => e.key === 'Enter' && goServices()}
                aria-expanded={focused && suggestions.length > 0}
                role="combobox"
                aria-controls="home-search-suggestions"
              />
              <button
                type="button"
                onClick={goServices}
                aria-label={t('services.title')}
                className="absolute end-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-navy/70 hover:bg-cream"
              >
                <AppIcon name="search" className="w-4 h-4" />
              </button>

              {focused && query.trim() && suggestions.length > 0 && (
                <div
                  id="home-search-suggestions"
                  role="listbox"
                  className="absolute z-30 inset-x-0 mt-2 card p-1.5 text-start shadow-cardHover max-h-80 overflow-y-auto"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(`/services?q=${encodeURIComponent(pickText(s.title, i18n.language))}`);
                      }}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-cream text-start"
                    >
                      <span className="icon-chip !w-8 !h-8 shrink-0">
                        <AppIcon name={s.icon} className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-navy truncate">{pickText(s.title, i18n.language)}</span>
                        <span className="block text-xs text-navy/70 truncate">{pickText(s.desc, i18n.language)}</span>
                      </span>
                    </button>
                  ))}
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      goServices();
                    }}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-center text-xs font-bold text-navy bg-cream hover:bg-cream-dark inline-flex items-center justify-center gap-1"
                  >
                    {t('home.searchAllResults')}
                    <DirArrow className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* guest journey preview — a low-commitment way to see the product
                before signing up; interactive but nothing is saved until the
                visitor creates an account (see journeyPage.guest.* copy) */}
            <div className="mx-auto mt-5 max-w-lg md:mx-0">
              <Link
                to="/journey"
                className="inline-flex w-full items-center justify-center gap-2 rounded-btn border-2 border-navy bg-white px-5 py-3 text-sm font-bold text-navy shadow-soft transition-colors hover:bg-brand-blue sm:w-auto"
              >
                <AppIcon name="compass" className="w-4 h-4" />
                {t('home.guestJourneyCta')}
              </Link>
            </div>

            {/* stats bar — also doubles as filler for the dead vertical space
                this column left below the shorter text block on desktop, next
                to the taller photo collage. Values: src/data/siteStats.ts.
                Deliberately stays a 2x2 grid at every width: this column
                shares the hero row with the photo collage from md (768px)
                up, so its real width is roughly HALF the viewport, not the
                full viewport — a `sm:grid-cols-4` (keyed off viewport width)
                was cramming 4 columns into that halved space between ~768
                and ~1200px, wrapping captions onto 2-3 lines and making the
                numbers look scattered. 2 columns always fit that space. */}
            <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-x-4 gap-y-5 rounded-card border border-cream-dark bg-white px-5 py-5 shadow-card md:mx-0">
              <div className="text-center sm:text-start">
                <div dir="ltr" className="text-xl font-extrabold text-navy tabular-nums sm:text-2xl">
                  +{new Intl.NumberFormat(i18n.language).format(HOME_STATS.familiesServed)}
                </div>
                <div className="mt-1 text-xs leading-snug text-navy/70">{t('home.heroStats.families')}</div>
              </div>
              <div className="text-center sm:text-start">
                <div dir="ltr" className="text-xl font-extrabold text-navy tabular-nums sm:text-2xl">
                  {new Intl.NumberFormat(i18n.language).format(HOME_STATS.yearsExperience)}
                </div>
                <div className="mt-1 text-xs leading-snug text-navy/70">{t('home.heroStats.yearsExperience')}</div>
              </div>
              <div className="text-center sm:text-start">
                <div dir="ltr" className="text-xl font-extrabold text-navy tabular-nums sm:text-2xl">
                  {new Intl.NumberFormat(i18n.language).format(HOME_STATS.languagesSupported)}
                </div>
                <div className="mt-1 text-xs leading-snug text-navy/70">{t('home.stats.languages')}</div>
              </div>
              <div className="text-center sm:text-start">
                <div className="text-xl font-extrabold text-navy tabular-nums sm:text-2xl">
                  {t('home.heroStats.responseValue', { count: HOME_STATS.avgResponseHours })}
                </div>
                <div className="mt-1 text-xs leading-snug text-navy/70">{t('home.heroStats.responseTime')}</div>
              </div>
            </div>
          </div>

          {/* photo collage: three overlapping Istanbul photos on an organic
              blob backdrop — hidden below md since Home.tsx only renders
              there anyway, but the collage itself needs the room */}
          <div className="relative hidden h-[380px] md:block lg:h-[440px]" aria-hidden>
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full text-navy/[0.06]" fill="currentColor">
              <path d="M45.3,-58.7C58.5,-49.6,68.6,-35.1,71.9,-19.2C75.2,-3.3,71.7,14,63.4,28.4C55.1,42.8,42,54.3,27.1,61.6C12.2,68.9,-4.5,72,-20.6,68.4C-36.7,64.8,-52.2,54.5,-62.1,40.1C-72,25.7,-76.3,7.2,-73.4,-9.7C-70.5,-26.6,-60.4,-41.9,-46.9,-51.1C-33.4,-60.3,-16.7,-63.4,0.5,-64C17.7,-64.6,32.1,-67.8,45.3,-58.7Z" transform="translate(100 100)" />
            </svg>
            {/* each photo's positioning lives on a plain wrapper div, NOT on
                SiteImage's own className: SiteImage's root always carries
                `relative`, and Tailwind emits `.relative` after `.absolute`
                in the stylesheet, so an `absolute` passed in via className
                loses the cascade and the photo stays in normal flow instead
                of overlapping (see the same fix pattern in UserHome.tsx). */}
            <div className="absolute left-[6%] top-[4%] w-[48%] aspect-[4/5]">
              <SiteImage
                src={CAROUSEL[0]}
                                alt={heroImageAlts[0]}
                priority

                className="w-full h-full rotate-[-6deg] rounded-lg border-4 border-white shadow-cardHover"
              />
            </div>
            <div className="absolute right-[4%] top-[16%] w-[52%] aspect-[4/3]">
              <SiteImage
                src={CAROUSEL[1]}
                                alt={heroImageAlts[1]}
                className="w-full h-full rotate-[5deg] rounded-lg border-4 border-white shadow-cardHover"

              />
            </div>
            <div className="absolute bottom-[2%] left-[22%] w-[42%] aspect-square">
              <SiteImage
                src={CAROUSEL[3]}
                                alt={heroImageAlts[2]}
                className="w-full h-full rotate-[4deg] rounded-lg border-4 border-white shadow-cardHover"

              />
            </div>
          </div>
        </div>
      </section>

      {/* quick links: the three main service categories, each explained in
          its own card (not just an icon + label) so a first-time visitor
          knows what they're clicking into before they click */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {QUICK_LINKS.map((q, i) => (
            <Link
              key={q.to}
              to={q.to}
              className="card card-hover group flex flex-col p-6 animate-fade-up"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="icon-chip">
                <AppIcon name={q.icon} className="w-5 h-5" />
              </span>
              <h3 className="mt-4 font-bold text-navy leading-snug">{t(q.titleKey)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-navy/70">{t(q.descKey)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-navy">
                {t(q.ctaKey)}
                <DirArrow className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* how it works — explains the product before "for you" shows
          personalized cards that only make sense once you know what Rafiq does */}
      <HowItWorks />

      {/* personalized blocks */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        {/* Guests have no saved answers to edit — the button here used to
            re-open the legacy modal. Personalization now starts at sign-in. */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="section-title">{t('home.forYou')}</h2>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {visibleBlocks.map((b) => (
            <BlockCard key={b.id} block={b} />
          ))}
        </div>

        {hasMoreBlocks && (
          <button onClick={() => setShowAllBlocks(true)} className="btn-secondary w-full mt-5 sm:w-auto">
            {t('common.viewAll')} ({visible.length - 3}+)
          </button>
        )}

        {/* CTA: explore the full services catalog — the only full navy-gradient
            CTA card on the page; the FAQ's closing CTA below stays a quieter
            style so the two don't repeat the same heavy treatment */}
        <Link
          to="/services"
          className="relative mt-6 flex items-center gap-4 overflow-hidden rounded-card bg-navy-dark px-5 py-4 text-white shadow-card transition-shadow hover:shadow-cardHover sm:px-6 sm:py-5"
        >
          {/* same organic-blob decoration as the hero, recolored for a dark
              surface — the reference's dark accent block, on-brand */}
          <svg viewBox="0 0 200 200" className="pointer-events-none absolute -end-10 -top-16 h-56 w-56 text-white/[0.05]" fill="currentColor" aria-hidden>
            <path d="M45.3,-58.7C58.5,-49.6,68.6,-35.1,71.9,-19.2C75.2,-3.3,71.7,14,63.4,28.4C55.1,42.8,42,54.3,27.1,61.6C12.2,68.9,-4.5,72,-20.6,68.4C-36.7,64.8,-52.2,54.5,-62.1,40.1C-72,25.7,-76.3,7.2,-73.4,-9.7C-70.5,-26.6,-60.4,-41.9,-46.9,-51.1C-33.4,-60.3,-16.7,-63.4,0.5,-64C17.7,-64.6,32.1,-67.8,45.3,-58.7Z" transform="translate(100 100)" />
          </svg>
          <span className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white/15 border border-white/25 shrink-0">
            <AppIcon name="layers" className="w-5 h-5" />
          </span>
          <div className="relative flex-1 min-w-0">
            <h3 className="font-extrabold leading-snug">{t('home.servicesCta.title')}</h3>
            <p className="text-sm text-white/80 line-clamp-2">{t('home.servicesCta.body')}</p>
          </div>
          <span className="relative hidden sm:inline-flex items-center gap-1 rounded-btn bg-white text-navy font-bold px-4 h-10 shrink-0">
            {t('home.servicesCta.button')}
            <DirArrow className="w-4 h-4" />
          </span>
        </Link>
      </section>

      {/* real estate: wide strip + three featured listings */}
      <RealEstateSection />

      {/* latest news (mirrors the Telegram channel; hidden until posts exist) */}
      <NewsSection />

      {/* who we are */}
      <AboutSection />

      {/* testimonials */}
      <Testimonials />

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="section-title text-center">{t('home.faq.title')}</h2>
        <div className="mt-6 flex flex-col gap-3">
          {FAQ_IDS.map((id) => (
            <details key={id} className="card p-0 overflow-hidden group">
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-semibold text-navy">
                <span className="flex-1 min-w-0">{t(`home.faq.${id}.q`)}</span>
                <span className="text-navy/50 transition-transform group-open:rotate-45 text-xl leading-none shrink-0">+</span>
              </summary>
              <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{t(`home.faq.${id}.a`)}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 card p-6 text-center bg-brand-blue/40">
          <h3 className="font-bold text-navy">{t('home.faq.ctaTitle')}</h3>
          <p className="mt-1 text-sm text-gray-600">{t('home.faq.ctaBody')}</p>
          <Link to="/premium" className="btn-primary mt-4">
            <AppIcon name="message-circle" className="w-4 h-4" />
            {t('home.faq.ctaButton')}
          </Link>
        </div>
      </section>
    </div>
  );
}
