import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { blocksFor } from '../blocks/registry';
import { BlockCard } from '../blocks/BlockCard';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ImageCarousel } from '../components/ImageCarousel';
import { SiteImage } from '../components/SiteImage';
import { CAROUSEL, EXPLORE_PHOTOS } from '../lib/images';
import { SERVICES, normalizeSearch, keywordsFor, pickText } from '../data/services';
import { HowItWorks } from '../components/sections/HowItWorks';
import { Testimonials } from '../components/sections/Testimonials';
import { AboutSection } from '../components/sections/AboutSection';

const EXPLORE: { to: string; icon: IconName; titleKey: string; descKey: string }[] = [
  { to: '/tricks', icon: 'lightbulb', titleKey: 'nav.tricks', descKey: 'tricks.subtitle' },
  { to: '/residency', icon: 'id-card', titleKey: 'nav.residency', descKey: 'residency.subtitle' },
  { to: '/real-estate', icon: 'building', titleKey: 'nav.realEstate', descKey: 'realEstate.subtitle' },
  { to: '/health-tourism', icon: 'heart-pulse', titleKey: 'nav.health', descKey: 'health.subtitle' },
  { to: '/map', icon: 'map', titleKey: 'nav.map', descKey: 'map.subtitle' },
  { to: '/hub', icon: 'file-text', titleKey: 'nav.hub', descKey: 'hub.subtitle' },
  { to: '/referrals', icon: 'gift', titleKey: 'nav.referrals', descKey: 'referrals.subtitle' },
  { to: '/pricing', icon: 'star', titleKey: 'nav.pricing', descKey: 'pricing.subtitle' },
];

const TRUST: { icon: IconName; key: string }[] = [
  { icon: 'languages', key: 'languages' },
  { icon: 'users', key: 'experts' },
  { icon: 'sparkles', key: 'free' },
  { icon: 'shield-check', key: 'secure' },
];

const FAQ_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

export function Home() {
  const { t, i18n } = useTranslation();
  const { profile, resetOnboarding } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

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

  return (
    <div>
      {/* ── Hero: rotating Turkey photos (auto every 3s) + navy overlay, no buttons ── */}
      <section className="relative overflow-hidden border-b border-cream-dark">
        <ImageCarousel images={CAROUSEL} intervalMs={3000} />
        <div className="absolute inset-0 bg-navy/80" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:py-28 text-center text-white">
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight max-w-3xl mx-auto">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-4 text-white/85 max-w-xl mx-auto sm:text-lg">{t('home.heroSubtitle')}</p>

          {/* trust bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {TRUST.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-medium text-white/90"
              >
                <AppIcon name={c.icon} className="w-3.5 h-3.5 text-gold-light" />
                {t(`home.trustbar.${c.key}`)}
              </span>
            ))}
          </div>

          {/* search with live suggestions; Enter / icon jumps to the full catalog */}
          <div className="mt-8 max-w-lg mx-auto relative">
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
                      <span className="block text-xs text-navy/50 truncate">{pickText(s.desc, i18n.language)}</span>
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
        </div>
      </section>

      {/* personalized blocks */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="section-title">{t('home.forYou')}</h2>
          <button onClick={resetOnboarding} className="btn-secondary h-9 px-3 text-xs">
            <AppIcon name="pencil" className="w-3.5 h-3.5" />
            {t('home.editAnswers')}
          </button>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {visible.map((b) => (
            <BlockCard key={b.id} block={b} />
          ))}
        </div>

        {/* CTA: explore the full services catalog */}
        <Link
          to="/services"
          className="mt-6 flex items-center gap-4 rounded-card bg-gradient-to-r from-navy to-navy-light text-white px-5 py-4 sm:px-6 sm:py-5 shadow-card hover:shadow-cardHover transition-shadow"
        >
          <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white/15 border border-white/25 shrink-0">
            <AppIcon name="layers" className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold leading-snug">{t('home.servicesCta.title')}</h3>
            <p className="text-sm text-white/80 line-clamp-2">{t('home.servicesCta.body')}</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-btn bg-white text-navy font-bold px-4 h-10 shrink-0">
            {t('home.servicesCta.button')}
            <DirArrow className="w-4 h-4" />
          </span>
        </Link>
      </section>

      {/* explore everything — every section reachable from the main page */}
      <section className="bg-cream/60 border-y border-cream-dark">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="section-title">{t('home.explore.title')}</h2>
          <p className="mt-1 text-sm text-navy/60">{t('home.explore.subtitle')}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 stagger">
            {EXPLORE.map((e, i) => (
              <Link
                key={e.to}
                to={e.to}
                className="card card-hover group relative overflow-hidden h-40 sm:h-44 lg:h-48 flex flex-col justify-end"
                style={{ '--i': i } as React.CSSProperties}
              >
                {/* subject background photo */}
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                  <SiteImage src={EXPLORE_PHOTOS[e.to]} alt="" className="w-full h-full" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/60 to-navy/20" aria-hidden />
                <div className="relative p-3 sm:p-4 text-white">
                  <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 border border-white/25 backdrop-blur mb-1.5 sm:mb-2">
                    <AppIcon name={e.icon} className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold leading-snug text-sm sm:text-base">{t(e.titleKey)}</h3>
                  <p className="mt-0.5 text-xs text-white/80 line-clamp-2">{t(e.descKey)}</p>
                  <span className="mt-2 text-sm font-semibold hidden sm:inline-flex items-center gap-1 text-gold-light">
                    {t('common.learnMore')}
                    <DirArrow className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <HowItWorks />

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

      {/* final CTA: view all Rafiq services (red button) */}
      <section className="px-4 pb-16 text-center">
        <Link
          to="/services"
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-brand-red text-white font-extrabold px-5 sm:px-8 h-14 text-base shadow-card hover:opacity-90 transition-opacity max-w-full whitespace-normal text-center"
        >
          <AppIcon name="layers" className="w-5 h-5" />
          {t('home.servicesCta.bottom')}
          <DirArrow className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
