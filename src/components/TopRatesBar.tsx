import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchTicker } from '../lib/api';
import type { TickerItem } from '../lib/api';
import { AppIcon } from './AppIcon';

/**
 * Slim black bar pinned above the header — a continuously scrolling marquee of
 * TRY crosses + Gulf currencies + Syrian Lira (admin-set) + Bitcoin/Ethereum.
 */
export function TopRatesBar() {
  const { t } = useTranslation();
  const [items, setItems] = useState<TickerItem[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchTicker()
        .then((r) => {
          if (alive) {
            setItems(r.items);
            setLive(r.live);
          }
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="bg-black text-white text-xs overflow-hidden" dir="ltr">
      <div className="h-9 flex items-center">
        <span className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 text-white/70 border-e border-white/15 z-10 bg-black">
          <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
          <AppIcon name="trending-up" className="w-3.5 h-3.5" />
        </span>
        {items.length === 0 ? (
          <span className="px-4 text-white/50">{t('rates.label')}</span>
        ) : (
          <div className="relative flex-1 overflow-hidden">
            <div className="flex w-max animate-ticker">
              {[0, 1].map((group) => (
                <div key={group} className="flex items-center gap-7 pe-7 shrink-0" aria-hidden={group === 1}>
                  {items.map((it, i) => (
                    <span key={`${group}-${it.label}-${i}`} className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
                      <span className="text-white/55">{it.label}</span>
                      <span className="tabular-nums">{it.value}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
