import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { blocksFor } from '../blocks/registry';
import { BlockCard } from '../blocks/BlockCard';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ImageCarousel } from '../components/ImageCarousel';
import { CAROUSEL } from '../lib/images';
import { SERVICES, normalizeSearch, keywordsFor, pickText } from '../data/services';
import { HowItWorks } from '../components/sections/HowItWorks';
import { Testimonials } from '../components/sections/Testimonials';
import { AboutSection } from '../components/sections/AboutSection';
import { NewsSection } from '../components/sections/NewsSection';
import { LocalBusinessSchema } from '../components/LocalBusinessSchema';
import { usePageMeta } from '../lib/seo';

// P-simplify3: the old standalone "استكشف كل شي" grid (8 cards) duplicated
// links already reachable from the header nav / services dropdown, and was
// one of the 9 stacked sections making Home too long on mobile. Removed —
// see خطة_تبسيط_التصميم.md section 3, option أ.

const TRUST: { icon: IconName; key: string }[] = [
  { icon: 'languages', key: 'languages' },
  { icon: 'users', key: 'experts' },
  { icon: 'sparkles', key: 'free' },
  { icon: 'shield-check', key: 'secure' },
];

const FAQ_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

export function Home() {
  const { t, i18n } = useTranslation();
  const { profile } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

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
      {/* ── Hero: rotating Turkey photos (auto every 3s) + navy overlay, no buttons ── */}
      <section className="relative overflow-hidden border-b border-cream-dark">
        <ImageCarousel images={CAROUSEL} intervalMs={3000} priority />
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
                {/* bdi isolates Latin runs like (KVKK) inside Arabic text */}
                <bdi>{t(`home.trustbar.${c.key}`)}</bdi>
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

      {/* how it works */}
      <HowItWorks />

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
