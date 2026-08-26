import { useTranslation } from 'react-i18next';
import {
  AMENITY_OPTIONS,
  ROOM_OPTIONS,
  type ListingFilters,
  num,
  toggle,
} from '../../lib/listingFilters';

/**
 * The filter body, shared verbatim between the desktop left sidebar and the
 * mobile bottom sheet. Keeping one implementation means a filter added here
 * shows up on both surfaces — the two used to drift apart because each page
 * owned its own copy of the controls.
 */
export function FilterPanel({
  filters,
  onChange,
  districts,
}: {
  filters: ListingFilters;
  onChange: (next: ListingFilters) => void;
  districts: string[];
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<ListingFilters>) => onChange({ ...filters, ...patch });

  const field = 'w-full rounded-btn border-2 border-cream-dark bg-cream px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none';
  const label = 'block text-xs font-bold text-navy mb-2';
  const checkbox = 'flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className={label} htmlFor="re-q">{t('realEstate.filters.search')}</label>
        <input
          id="re-q"
          inputMode="search"
          className={field}
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder={t('realEstate.filters.searchPlaceholder')}
        />
      </div>

      <div>
        <label className={label} htmlFor="re-district">{t('realEstate.filters.district')}</label>
        <select id="re-district" className={field} value={filters.district} onChange={(e) => set({ district: e.target.value })}>
          <option value="">{t('realEstate.filters.allDistricts')}</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        <span className={label}>{t('realEstate.filters.price')}</span>
        <div className="grid grid-cols-2 gap-2" dir="ltr">
          <input
            className={field}
            inputMode="numeric"
            placeholder={t('realEstate.filters.from')}
            aria-label={`${t('realEstate.filters.price')} — ${t('realEstate.filters.from')}`}
            value={filters.minPrice ?? ''}
            onChange={(e) => set({ minPrice: num(e.target.value) })}
          />
          <input
            className={field}
            inputMode="numeric"
            placeholder={t('realEstate.filters.to')}
            aria-label={`${t('realEstate.filters.price')} — ${t('realEstate.filters.to')}`}
            value={filters.maxPrice ?? ''}
            onChange={(e) => set({ maxPrice: num(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <span className={label}>{t('realEstate.filters.rooms')}</span>
        <div className="flex flex-wrap gap-1.5">
          {ROOM_OPTIONS.map((r) => {
            const on = filters.rooms.includes(r);
            return (
              <button
                key={r}
                type="button"
                dir="ltr"
                onClick={() => set({ rooms: toggle(filters.rooms, r) })}
                aria-pressed={on}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors ${
                  on ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-navy-100'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className={label}>{t('realEstate.filters.area')}</span>
        <div className="grid grid-cols-2 gap-2" dir="ltr">
          <input
            className={field}
            inputMode="numeric"
            placeholder={t('realEstate.filters.from')}
            aria-label={`${t('realEstate.filters.area')} — ${t('realEstate.filters.from')}`}
            value={filters.minM2 ?? ''}
            onChange={(e) => set({ minM2: num(e.target.value) })}
          />
          <input
            className={field}
            inputMode="numeric"
            placeholder={t('realEstate.filters.to')}
            aria-label={`${t('realEstate.filters.area')} — ${t('realEstate.filters.to')}`}
            value={filters.maxM2 ?? ''}
            onChange={(e) => set({ maxM2: num(e.target.value) })}
          />
        </div>
      </div>

      <hr className="border-cream-dark" />

      <div>
        <span className={label}>{t('realEstate.filters.citizenship')}</span>
        <div className="flex flex-col gap-2">
          {(['yes', 'unknown'] as const).map((k) => (
            <label key={k} className={checkbox}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-navy"
                checked={filters.citizenship.includes(k)}
                onChange={() => set({ citizenship: toggle(filters.citizenship, k) })}
              />
              {t(`realEstate.filters.citizenship_${k}`)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>{t('realEstate.filters.investment')}</span>
        <div className="flex flex-col gap-2">
          {(['yield', 'under-construction', 'ready'] as const).map((k) => (
            <label key={k} className={checkbox}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-navy"
                checked={filters.investment.includes(k)}
                onChange={() => set({ investment: toggle(filters.investment, k) })}
              />
              {t(`realEstate.filters.investment_${k}`)}
            </label>
          ))}
        </div>
      </div>

      <hr className="border-cream-dark" />

      <div>
        <span className={label}>{t('realEstate.filters.extras')}</span>
        <div className="flex flex-col gap-2">
          {AMENITY_OPTIONS.map((a) => (
            <label key={a} className={checkbox}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-navy"
                checked={filters.amenities.includes(a)}
                onChange={() => set({ amenities: toggle(filters.amenities, a) })}
              />
              {t(`realEstate.amenity.${a}`)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
