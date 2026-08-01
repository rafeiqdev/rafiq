import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../../lib/api';
import type { Listing, ListingType } from '../../lib/types';
import { AppIcon } from '../../components/AppIcon';
import { PageHero } from '../../components/PageHero';
import { MobileTabBar } from '../../components/MobileTabBar';
import { Modal } from '../../components/Modal';
import { ListingCard } from '../../components/realestate/ListingCard';
import { FilterPanel } from '../../components/realestate/FilterPanel';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  districtsOf,
  type ListingFilters,
} from '../../lib/listingFilters';
import { BANNERS } from '../../lib/images';
import { SITE_URL, usePageMeta } from '../../lib/seo';

const TABS: ListingType[] = ['sale', 'rent', 'commercial'];
const PAGE_SIZE = 8;

export function MobileRealEstate() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sheet, setSheet] = useState(false);
  // The sheet edits a draft so cancelling leaves the visible results untouched.
  const [draft, setDraft] = useState<ListingFilters>(EMPTY_FILTERS);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

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
  const draftResults = useMemo(() => applyFilters(all, draft), [all, draft]);
  const shown = results.slice(0, limit);
  const activeCount = activeFilterCount(filters);

  const update = (next: ListingFilters) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  };

  const openSheet = () => {
    setDraft(filters);
    setSheet(true);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        <div className="relative animate-fade-in overflow-hidden rounded-b-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors active:bg-white/30"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <PageHero
            image={BANNERS.realEstate}
            title={t('realEstate.title')}
            subtitle={t('realEstate.subtitle')}
            height="min-h-[13rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        <div className="flex flex-col gap-4 px-5 pt-5">
          <div className="flex animate-fade-up items-start gap-2.5 rounded-xl bg-brand-blue px-4 py-3 text-sm text-navy">
            <AppIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('realEstate.citizenshipNotice')}</span>
          </div>

          {/* sale / rent / commercial */}
          <div className="grid grid-cols-3 gap-1.5 rounded-card bg-white p-1.5 shadow-card">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => update({ ...filters, type: tab })}
                className={`rounded-btn py-2 text-xs font-bold transition-colors ${
                  filters.type === tab ? 'bg-navy text-white' : 'text-gray-500'
                }`}
              >
                {t(`realEstate.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* filter entry + sort — one row, no space wasted on a full form */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openSheet}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-bold ${
                activeCount ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-navy-100'
              }`}
            >
              <AppIcon name="layers" className="w-3.5 h-3.5" />
              {t('realEstate.filters.title')}
              {activeCount > 0 && (
                <span className="rounded-full bg-white px-1.5 text-[11px] font-bold text-navy">{activeCount}</span>
              )}
            </button>
            <select
              aria-label={t('realEstate.sort.label')}
              className="flex-1 rounded-full border-2 border-navy-100 bg-white px-3 py-2 text-xs font-bold text-navy"
              value={filters.sort}
              onChange={(e) => update({ ...filters, sort: e.target.value as ListingFilters['sort'] })}
            >
              {(['newest', 'priceAsc', 'priceDesc', 'yield'] as const).map((s) => (
                <option key={s} value={s}>{t(`realEstate.sort.${s}`)}</option>
              ))}
            </select>
          </div>

          {/* investment opportunities — wide, short */}
          <Link
            to="/real-estate/investments"
            className="flex items-center gap-3 rounded-card bg-gradient-to-r from-gold-dark via-gold to-navy px-4 py-3 text-white shadow-card"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 border border-white/25">
              <AppIcon name="trending-up" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm leading-snug">{t('realEstate.invest.title')}</b>
              <small className="block truncate text-xs text-white/75">{t('realEstate.invest.body')}</small>
            </span>
            <AppIcon name="arrow-right" className="h-4 w-4 shrink-0 dir-arrow" />
          </Link>

          <p className="text-sm text-gray-500">
            <b className="text-navy text-base">{t('realEstate.results.count', { count: results.length })}</b>
          </p>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card h-72 animate-pulse bg-cream-dark/40" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="card p-8 text-center">
              <AppIcon name="building" className="mx-auto h-10 w-10 text-navy/25" />
              <h2 className="mt-3 font-bold text-navy">{t('realEstate.results.emptyTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('realEstate.results.emptyBody')}</p>
            </div>
          ) : (
            <>
              <div className="stagger flex flex-col gap-4">
                {shown.map((l, i) => (
                  <ListingCard key={l.id} listing={l} index={i} to={`/real-estate/${l.id}`} />
                ))}
              </div>
              {results.length > shown.length && (
                <button onClick={() => setLimit((n) => n + PAGE_SIZE)} className="btn-secondary w-full">
                  {t('realEstate.results.loadMore')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {sheet && (
        <Modal onClose={() => setSheet(false)} labelId="re-filters" maxWidth="max-w-lg">
          <div className="card flex max-h-[86vh] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-cream-dark px-5 py-4">
              <h2 id="re-filters" className="font-bold text-navy">{t('realEstate.filters.title')}</h2>
              <button
                type="button"
                onClick={() => setDraft({ ...EMPTY_FILTERS, type: draft.type, sort: draft.sort })}
                className="text-xs font-bold text-gray-500"
              >
                {t('realEstate.filters.clear')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <FilterPanel filters={draft} onChange={setDraft} districts={districts} />
            </div>
            <div className="flex gap-2.5 border-t border-cream-dark p-4">
              <button onClick={() => setSheet(false)} className="btn-secondary flex-1">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  update(draft);
                  setSheet(false);
                }}
                className="btn-primary flex-[2]"
              >
                {t('realEstate.filters.apply', { count: draftResults.length })}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <MobileTabBar />
    </div>
  );
}
