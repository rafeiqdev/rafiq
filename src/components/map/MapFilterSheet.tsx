import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PLACE_CATEGORIES } from '../../lib/types';
import type { GooglePlaceResult, PlaceCategory } from '../../lib/types';
import { Modal } from '../Modal';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';
import type { QuickFilters } from './MapExplorer';

const CATEGORY_ICONS: Record<PlaceCategory, IconName> = {
  dining: 'utensils',
  hotels: 'hotel',
  hospitals: 'stethoscope',
  notary: 'file-text',
  government: 'landmark',
  shopping: 'shopping-bag',
  arabic: 'languages',
};

/**
 * The advanced-filter sheet from the supplied design: a bottom sheet on phones,
 * a centred dialog on desktop.
 *
 * Choices are held as a local DRAFT and only handed back on "apply" — the
 * design's behaviour, and it also means a browsing user can't trigger a billed
 * Places search on every tap inside the sheet.
 */
export function MapFilterSheet({
  category,
  quickFilters,
  counts,
  onApply,
  onReset,
  onClose,
}: {
  category: PlaceCategory | null;
  quickFilters: QuickFilters;
  /** The currently loaded result set — the only set we can honestly count. */
  counts: GooglePlaceResult[];
  onApply: (category: PlaceCategory | null, quick: QuickFilters) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draftCategory, setDraftCategory] = useState<PlaceCategory | null>(category);
  const [draftQuick, setDraftQuick] = useState<QuickFilters>(quickFilters);

  const openNowCount = counts.filter((r) => r.openNow === true).length;
  const topRatedCount = counts.filter((r) => (r.rating ?? 0) >= 4.5).length;

  // Rendered through the shared Modal rather than a hand-rolled overlay: it
  // owns the focus trap, Escape, the body-scroll lock and the portal. Locking
  // `document.body` in a second place is how a page ends up permanently
  // unscrollable — two components restoring the same global in the wrong order
  // leaves `overflow: hidden` behind, and that follows the user off this page.
  return (
    <Modal onClose={onClose} labelId="map-filter-title" maxWidth="max-w-md" mobileSheet showClose={false}>
      <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-gray-100 bg-white md:rounded-3xl md:border">
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 pb-3 pt-4">
          <h2 id="map-filter-title" className="text-base font-extrabold text-navy">
            {t('map.filterSheet.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-navy transition-colors hover:bg-gray-200"
          >
            <AppIcon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* scrollable options */}
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div>
            <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-gray-500">
              {t('map.filterSheet.mainCategory')}
            </p>
            <div className="space-y-1.5">
              {/* "all" is the absence of a category, not a category of its own */}
              <button
                type="button"
                onClick={() => setDraftCategory(null)}
                aria-pressed={draftCategory === null}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-2xl border p-3 transition-all ${
                  draftCategory === null
                    ? 'border-navy bg-navy text-white shadow-sm'
                    : 'border-gray-100 bg-gray-50 text-navy hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <AppIcon name="globe" className="h-4 w-4" />
                  <span className="text-xs font-extrabold">{t('map.filterSheet.all')}</span>
                </span>
                {draftCategory === null && <AppIcon name="check" className="h-4 w-4" />}
              </button>

              {PLACE_CATEGORIES.map((c) => {
                const selected = draftCategory === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftCategory(c)}
                    aria-pressed={selected}
                    className={`flex min-h-[44px] w-full items-center justify-between rounded-2xl border p-3 transition-all ${
                      selected
                        ? 'border-navy bg-navy text-white shadow-sm'
                        : 'border-gray-100 bg-gray-50 text-navy hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <AppIcon name={CATEGORY_ICONS[c]} className="h-4 w-4" />
                      <span className="text-xs font-extrabold">{t(`map.categories.${c}`)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {/* Only the loaded category has a number we can stand behind;
                          inventing counts for the others would be a lie. */}
                      {category === c && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            selected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {counts.length}
                        </span>
                      )}
                      {selected && <AppIcon name="check" className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-gray-500">
              {t('map.filterSheet.additional')}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setDraftQuick((q) => ({ ...q, openNow: !q.openNow }))}
                aria-pressed={draftQuick.openNow}
                className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border p-3 transition-all ${
                  draftQuick.openNow
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-gray-100 bg-gray-50 text-navy hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      draftQuick.openNow ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <AppIcon name="clock" className="h-4 w-4" />
                  </span>
                  <span className="text-start">
                    <span className="block text-xs font-extrabold">{t('map.quickFilters.openNow')}</span>
                    <span className="block text-[10.5px] text-gray-500">
                      {t('map.filterSheet.matching', { count: openNowCount })}
                    </span>
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                    draftQuick.openNow ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white'
                  }`}
                >
                  {draftQuick.openNow && <AppIcon name="check" className="h-3.5 w-3.5" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDraftQuick((q) => ({ ...q, topRated: !q.topRated }))}
                aria-pressed={draftQuick.topRated}
                className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl border p-3 transition-all ${
                  draftQuick.topRated
                    ? 'border-gold-dark/40 bg-gold-soft text-navy'
                    : 'border-gray-100 bg-gray-50 text-navy hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      draftQuick.topRated ? 'bg-gold-dark text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <AppIcon name="star" className="h-4 w-4" />
                  </span>
                  <span className="text-start">
                    <span className="block text-xs font-extrabold">{t('map.quickFilters.topRated')}</span>
                    <span className="block text-[10.5px] text-gray-500">
                      {t('map.filterSheet.matching', { count: topRatedCount })}
                    </span>
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                    draftQuick.topRated ? 'border-gold-dark bg-gold-dark text-white' : 'border-gray-300 bg-white'
                  }`}
                >
                  {draftQuick.topRated && <AppIcon name="check" className="h-3.5 w-3.5" />}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-4">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold text-gray-600 transition-colors hover:bg-gray-200 hover:text-navy"
          >
            <AppIcon name="history" className="h-3.5 w-3.5" />
            {t('map.resetFilters')}
          </button>
          <button
            type="button"
            onClick={() => onApply(draftCategory, draftQuick)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-colors hover:bg-navy-light"
          >
            <AppIcon name="check" className="h-4 w-4" />
            {t('map.filterSheet.apply')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
