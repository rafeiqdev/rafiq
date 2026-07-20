import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickText, normalizeSearch, keywordsFor } from '../data/services';
import type { ServiceItem, ServiceType } from '../data/services';
import { useCatalog } from '../data/catalogStore';
import { AppIcon } from '../components/AppIcon';
import { ServiceActionModal } from '../components/ServiceActionModal';

// P-simplify2: the catalog has 12 categories / 79 services. Rendering all of
// them at once (the old default) was the biggest source of "too many
// categories" — the chip row needed horizontal scroll on mobile and the page
// became a very long stack of sections before the user asked for anything.
// Default view now shows only these 6 (most relevant to an individual
// newcomer) plus a "كل الفئات" toggle for the rest. A search query or an
// explicit category click always shows full results regardless.
const POPULAR_CATEGORY_IDS = ['residency', 'realestate', 'health', 'banking', 'translation', 'tourism'];

function TypeBadge({ type }: { type: ServiceType }) {
  const { t } = useTranslation();
  if (type === 'partner') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft text-gold-dark text-[10px] font-bold px-2 py-0.5">
        <AppIcon name="shield-check" className="w-3 h-3" />
        {t('services.partnerBadge')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue text-navy text-[10px] font-bold px-2 py-0.5">
      <AppIcon name="check" className="w-3 h-3" />
      {t('services.directBadge')}
    </span>
  );
}

function ServiceCard({ service, onOpen }: { service: ServiceItem; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <button onClick={onOpen} className="card card-hover p-4 flex flex-col h-full text-start w-full">
      <div className="flex items-start gap-3">
        <span className="icon-chip shrink-0">
          <AppIcon name={service.icon} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-navy text-sm leading-snug">{pickText(service.title, i18n.language)}</h3>
          <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{pickText(service.desc, i18n.language)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <TypeBadge type={service.type} />
        {service.onRequest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cream-dark text-navy/70 text-[10px] font-bold px-2 py-0.5">
            <AppIcon name="clock" className="w-3 h-3" />
            {t('services.onRequest')}
          </span>
        )}
      </div>
      <div className="flex-1" />
      <span className="btn-primary w-full mt-3 h-10 text-xs pointer-events-none">
        <AppIcon name="message-circle" className="w-4 h-4" />
        {t('common.helpMe')}
      </span>
    </button>
  );
}

export function Services() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ServiceType>('all');
  const [active, setActive] = useState<ServiceItem | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const { services, categories } = useCatalog();

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
      <div className="relative rounded-card overflow-hidden animate-fade-in">
        <img
          src="/img/services-hero.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          width={1600}
          height={900}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/20 to-white/10" />
        <div className="relative px-6 py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy drop-shadow-sm">{t('services.title')}</h1>
          <p className="mt-3 text-navy/80 max-w-2xl mx-auto text-sm sm:text-base">{t('services.subtitle')}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur px-4 py-1.5 text-xs font-semibold text-navy shadow-sm ring-1 ring-navy/10">
            <AppIcon name="shield-check" className="w-4 h-4" />
            {t('services.trustNote')}
          </div>
        </div>
      </div>

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
                  <span className="text-xs text-navy/50 shrink-0">({items.length})</span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                  {items.map((s) => (
                    <ServiceCard key={s.id} service={s} onOpen={() => setActive(s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {active && <ServiceActionModal service={active} onClose={() => setActive(null)} />}
    </div>
  );
}
