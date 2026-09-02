import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickText, normalizeSearch, keywordsFor, SERVICE_CATEGORIES } from '../data/services';
import type { ServiceType } from '../data/services';
import { useCatalog } from '../data/catalogStore';
import { useApp } from '../context/AppContext';
import { AppIcon } from '../components/AppIcon';
import { ExpandableServiceCard } from '../components/ExpandableServiceCard';
import { SituationSuggestions } from '../components/SituationSuggestions';
import { usePageMeta } from '../lib/seo';
import { track, normalizeSearchQuery } from '../lib/analytics';

// P-simplify2: the catalog has 12 categories / 79 services. Rendering all of
// them at once (the old default) was the biggest source of "too many
// categories" — the chip row needed horizontal scroll on mobile and the page
// became a very long stack of sections before the user asked for anything.
// Default view now shows only these 6 (most relevant to an individual
// newcomer) plus a "كل الفئات" toggle for the rest. A search query or an
// explicit category click always shows full results regardless.
const POPULAR_CATEGORY_IDS = ['residency', 'realestate', 'health', 'banking', 'translation', 'tourism'];
const RESIDENCE_SPOTLIGHT = [
  { key: 'tourist', to: '/services/res-tourist' },
  { key: 'property', to: '/services/res-property' },
  { key: 'renew', to: '/services/res-renew' },
  { key: 'guide', to: '/guides/residency' },
] as const;

export function Services() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const guideLabel = lang === 'en'
    ? 'Read guide'
    : lang === 'ru'
      ? 'Открыть гид'
      : lang === 'fa'
        ? 'مطالعه راهنما'
        : 'قراءة الدليل';
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  // ?category= from the homepage service cards (and any shared link). Unknown
  // ids fall back to 'all' rather than an empty page; the two legacy ids the
  // homepage used before 2026-09-02 are mapped so old links keep working.
  const [category, setCategory] = useState<string>(() => {
    const raw = params.get('category') ?? '';
    const id = ({ residence: 'residency', 'real-estate': 'realestate' } as Record<string, string>)[raw] ?? raw;
    return SERVICE_CATEGORIES.some((c) => c.id === id) ? id : 'all';
  });
  const [typeFilter, setTypeFilter] = useState<'all' | ServiceType>('all');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const { services, categories } = useCatalog();
  const { profile } = useApp();

  usePageMeta({
    title: `${t('services.title')} — ${t('common.appName')}`,
    description: t('services.metaDescription'),
  });

  const matches = useMemo(() => {
    const nq = normalizeSearch(query);
    const tokens = nq.split(' ').filter((tk) => tk.length >= 2);
    return services.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (!nq) return true;
      const hay = normalizeSearch(
        [s.title.ar, s.title.en, s.title.tr, s.desc.ar, s.desc.en, s.desc.tr, keywordsFor(s.id)].join(' '),
      );
      // full-phrase match OR any meaningful token (forgiving / "near" matches)
      return hay.includes(nq) || tokens.some((tk) => hay.includes(tk));
    });
  }, [query, category, typeFilter, services]);

  // Debounced so typing doesn't fire an event per keystroke. Never sends the
  // query text itself — just its length and how many results it found.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = setTimeout(() => {
      track('search_performed', { meta: { query: normalizeSearchQuery(q), result_count: matches.length } });
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Search or an explicit category pick always shows full results. Only the
  // untouched "all categories, no search" landing state gets trimmed to the
  // popular subset — that's the state that used to dump all 12 sections at once.
  const trimToPopular = category === 'all' && !query.trim() && !showAllCategories;
  const chipCategories = trimToPopular ? categories.filter((c) => POPULAR_CATEGORY_IDS.includes(c.id)) : categories;
  const visibleCategories = (trimToPopular ? chipCategories : categories).filter((c) =>
    matches.some((s) => s.category === c.id),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* hero */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="servicesHeroCurve" clipPathUnits="objectBoundingBox">
            <path d="M0,0 H1 V0.93 C0.77,0.93 0.63,1 0.46,1 C0.29,1 0.17,0.94 0,0.93 Z" />
          </clipPath>
        </defs>
      </svg>
      <div
        className="relative rounded-card overflow-hidden animate-fade-in"
        style={{ clipPath: 'url(#servicesHeroCurve)' }}
      >
        <img
          src="/img/services-hero.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          width={1909}
          height={824}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/15" />
        <div className="relative px-6 py-16 sm:py-24 pb-20 sm:pb-28 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{t('services.title')}</h1>
          <p className="mt-3 text-white/90 max-w-2xl mx-auto text-sm sm:text-base drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">{t('services.subtitle')}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur px-4 py-1.5 text-xs font-semibold text-navy shadow-sm ring-1 ring-navy/10">
            <AppIcon name="shield-check" className="w-4 h-4" />
            {t('services.trustNote')}
          </div>
        </div>
            </div>

      {/* personalized suggestions — only for the untouched landing state, and only when we know the visitor's situation */}
      {trimToPopular && <SituationSuggestions situation={profile.situation} services={services} />}

      <section aria-labelledby="residence-spotlight-title" className="mt-8 border-y border-cream-dark bg-cream/45 px-5 py-6 sm:px-6">
        <h2 id="residence-spotlight-title" className="text-xl font-extrabold text-navy">
          {t('services.residenceSpotlight.title')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-navy/70">
          {t('services.residenceSpotlight.subtitle')}
        </p>
        <nav aria-label={t('services.residenceSpotlight.title')} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {RESIDENCE_SPOTLIGHT.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="inline-flex min-h-11 items-center justify-between gap-3 border border-cream-dark bg-white px-4 py-3 text-sm font-bold text-navy hover:border-navy/40 hover:underline"
            >
              <span>{t(`services.residenceSpotlight.${item.key}`)}</span>
              <span aria-hidden="true">{t('services.residenceSpotlight.open')} →</span>
            </Link>
          ))}
        </nav>
      </section>

      {/* search */}
      <div className="mt-6 flex gap-2 max-w-xl mx-auto">

        <div className="relative flex-1">
          <span className="absolute inset-y-0 start-3 flex items-center text-navy/40">
            <AppIcon name="search" className="w-4 h-4" />
          </span>
          <input
            className="input ps-9"
            placeholder={t('services.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* type filter */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {(['all', 'direct', 'partner'] as const).map((tp) => (
          <button
            key={tp}
            onClick={() => setTypeFilter(tp)}
            aria-pressed={typeFilter === tp}
            className={`h-9 px-4 rounded-full text-xs font-semibold transition-colors ${
              typeFilter === tp ? 'bg-navy text-white' : 'bg-white border border-cream-dark text-navy/70 hover:text-navy'
            }`}
          >
            {t(`services.type.${tp}`)}
          </button>
        ))}
      </div>

      {/* category chips */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:flex-wrap sm:justify-center sm:mx-0 sm:px-0">
        <button
          onClick={() => setCategory('all')}
          aria-pressed={category === 'all'}
          className={`shrink-0 h-9 px-4 rounded-full text-xs font-semibold transition-colors ${
            category === 'all' ? 'bg-gold text-white' : 'bg-white border border-cream-dark text-navy/70 hover:text-navy'
          }`}
        >
          {t('services.allCategories')}
        </button>
        {chipCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold transition-colors ${
              category === c.id ? 'bg-gold text-white' : 'bg-white border border-cream-dark text-navy/70 hover:text-navy'
            }`}
          >
            <AppIcon name={c.icon} className="w-3.5 h-3.5" />
            {pickText(c.title, lang)}
          </button>
        ))}
        {trimToPopular ? (
          <button
            onClick={() => setShowAllCategories(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold border border-dashed border-navy/30 text-navy/70 hover:text-navy hover:border-navy/50 transition-colors"
          >
            {t('services.allCategories')} +
          </button>
        ) : (
          !query.trim() &&
          category === 'all' && (
            <button
              onClick={() => setShowAllCategories(false)}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold border border-dashed border-navy/30 text-navy/70 hover:text-navy hover:border-navy/50 transition-colors"
            >
              {t('common.showLess')}
            </button>
          )
        )}
      </div>

      {/* results grouped by category */}
      {visibleCategories.length === 0 ? (
        <div className="card p-10 mt-8 text-center">
          <div className="icon-chip mx-auto">
            <AppIcon name="search" className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm text-gray-500">{t('services.noResults')}</p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {visibleCategories.map((c) => {
            const items = matches.filter((s) => s.category === c.id);
            return (
              <section key={c.id}>
                <div className="flex items-center gap-2.5">
                  <span className="icon-chip !w-9 !h-9">
                    <AppIcon name={c.icon} className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-extrabold text-navy flex-1 min-w-0">{pickText(c.title, lang)}</h2>
                  <Link to={`/guides/${c.id}`} className="text-xs font-semibold text-navy/70 hover:text-navy hover:underline shrink-0">
                    {guideLabel}
                  </Link>
                  <span className="text-xs text-navy/50 shrink-0">({items.length})</span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                  {items.map((s, i) => (
                    <ExpandableServiceCard key={s.id} service={s} index={i} categoryTitle={pickText(c.title, lang)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
