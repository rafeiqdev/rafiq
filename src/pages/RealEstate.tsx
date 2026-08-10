import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../lib/api';
import type { Listing, ListingType } from '../lib/types';
import { AppIcon } from '../components/AppIcon';
import { PageHero } from '../components/PageHero';
import { ListingCard } from '../components/realestate/ListingCard';
import { FilterPanel } from '../components/realestate/FilterPanel';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  districtsOf,
  type ListingFilters,
} from '../lib/listingFilters';
import { BANNERS } from '../lib/images';
import { SITE_URL, usePageMeta } from '../lib/seo';

const TABS: ListingType[] = ['sale', 'rent', 'commercial'];
const PAGE_SIZE = 12;

/** Wide, short banner linking to the investment-opportunities section. */
export function InvestmentStrip() {
  const { t } = useTranslation();
  return (
    <Link
      to="/real-estate/investments"
      className="mt-5 flex items-center gap-4 rounded-card bg-gradient-to-r from-gold-dark via-gold to-navy text-white px-5 py-4 shadow-card hover:shadow-cardHover transition-shadow"
    >
      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white/15 border border-white/25 shrink-0">
        <AppIcon name="trending-up" className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className="font-extrabold leading-snug">{t('realEstate.invest.title')}</h2>
        <p className="text-sm text-white/75 line-clamp-2">{t('realEstate.invest.body')}</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 rounded-btn bg-white text-navy font-bold px-4 h-10 shrink-0">
        {t('realEstate.invest.cta')}
        <AppIcon name="arrow-right" className="w-4 h-4 dir-arrow" />
      </span>
    </Link>
  );
}

export function RealEstate() {
  const { t } = useTranslation();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);

  usePageMeta({
    title: `${t('realEstate.title')} — ${t('common.appName')}`,
    description: t('realEstate.subtitle'),
    image: `${SITE_URL}${BANNERS.realEstate}`,
  });

  useEffect(() => {
    listingsApi
      .list()
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const districts = useMemo(() => districtsOf(all), [all]);
  const results = useMemo(() => applyFilters(all, filters), [all, filters]);
  const shown = results.slice(0, limit);
  const activeCount = activeFilterCount(filters);

  // Any change to the filters starts the list over — otherwise a user who had
  // paged deep into one result set would land mid-way through the next.
  const update = (next: ListingFilters) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  };

  const reset = () => update({ ...EMPTY_FILTERS, type: filters.type, sort: filters.sort });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="animate-fade-in">
        <PageHero image={BANNERS.realEstate} title={t('realEstate.title')} subtitle={t('realEstate.subtitle')} />
      </div>

      <div className="mt-5 rounded-xl bg-brand-blue px-4 py-3 text-sm text-navy flex gap-2 items-start animate-fade-up">
        <AppIcon name="info" className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{t('realEstate.citizenshipNotice')}</span>
      </div>

      {/* sale / rent / commercial */}
      <div className="mt-5 inline-flex gap-1.5 rounded-card bg-white p-1.5 shadow-card">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => update({ ...filters, type: tab })}
            className={`rounded-btn px-5 py-2 text-sm font-bold transition-colors ${
              filters.type === tab ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'
            }`}
          >
            {t(`realEstate.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <InvestmentStrip />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_272px] items-start">
        {/* Results come first in the DOM on purpose: in an RTL grid the first
            column lands on the right, which puts the filter column on the
            left exactly as the design calls for — without absolute hacks. */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-gray-500">
              <b className="text-navy text-base">{t('realEstate.results.count', { count: results.length })}</b>
            </p>
            <div className="flex-1" />
            <select
              aria-label={t('realEstate.sort.label')}
              className="rounded-btn border-2 border-cream-dark bg-white px-3 py-2 text-sm text-navy"
              value={filters.sort}
              onChange={(e) => update({ ...filters, sort: e.target.value as ListingFilters['sort'] })}
            >
              {(['newest', 'priceAsc', 'priceDesc', 'yield'] as const).map((s) => (
                <option key={s} value={s}>{t(`realEstate.sort.${s}`)}</option>
              ))}
            </select>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy-50 border border-navy-100 px-3 py-1.5 text-xs font-bold text-navy"
            >
              {t('realEstate.filters.clearCount', { count: activeCount })}
              <AppIcon name="x" className="w-3 h-3" />
            </button>
          )}

          {loading ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="card h-80 animate-pulse bg-cream-dark/40" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-5 card p-10 text-center">
              <AppIcon name="building" className="w-10 h-10 mx-auto text-navy/25" />
              <h2 className="mt-3 font-bold text-navy">{t('realEstate.results.emptyTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('realEstate.results.emptyBody')}</p>
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 items-stretch stagger">
                {shown.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} index={index} to={`/real-estate/${listing.id}`} />
                ))}
              </div>
              {results.length > shown.length && (
                <button onClick={() => setLimit((n) => n + PAGE_SIZE)} className="btn-secondary w-full mt-5">
                  {t('realEstate.results.loadMore')}
                </button>
              )}
            </>
          )}
        </div>

        {/* vertical filter column — sits on the left in RTL */}
        <aside className="card p-4 lg:sticky lg:top-4">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-cream-dark">
            <h2 className="font-bold text-navy">{t('realEstate.filters.title')}</h2>
            <button type="button" onClick={reset} className="text-xs font-bold text-gray-500 hover:text-navy">
              {t('realEstate.filters.clear')}
            </button>
          </div>
          <FilterPanel filters={filters} onChange={update} districts={districts} />
        </aside>
      </div>
    </div>
  );
}
