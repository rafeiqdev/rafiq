import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRates } from '../lib/api';
import type { Rates } from '../lib/api';

/** Live USD/TRY & EUR/TRY tape; the green dot only shows for genuinely live data. */
export function RateTape() {
  const { t } = useTranslation();
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchRates()
        .then((r) => alive && setRates(r))
        .catch(() => alive && setRates((prev) => (prev ? { ...prev, live: false } : { usdtry: 41.2, eurtry: 44.8, live: false })));
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const live = rates?.live ?? false;

  return (
    <div className="inline-flex items-center gap-4 rounded-full bg-white/90 border border-cream-dark px-4 py-1.5 text-xs font-semibold text-navy shadow-card" dir="ltr">
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        {live ? t('rates.live') : t('rates.cached')}
      </span>
      <span>USD/TRY {rates ? rates.usdtry.toFixed(2) : '—'}</span>
      <span>EUR/TRY {rates ? rates.eurtry.toFixed(2) : '—'}</span>
    </div>
  );
}
