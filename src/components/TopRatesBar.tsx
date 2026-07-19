import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fx } from '../lib/api';
import type { FxRate } from '../lib/api';
import { FX_PAIRS, hoursSince } from '../lib/fxRates';
import { AppIcon } from './AppIcon';

/** Refresh cadence. The data only changes once a day, so this is just a catch-up. */
const POLL_MS = 30 * 60 * 1000;

/** A rate older than this is presented as stale rather than current. */
const STALE_AFTER_HOURS = 36;

/**
 * Slim black bar above the header: the five TRY crosses, synced server-side.
 *
 * It reads `fx_rates` and nothing else — the previous version called
 * open.er-api.com and coingecko directly from the user's browser every 5
 * minutes, which exposed every visitor to third-party endpoints and produced
 * numbers that could not be validated or audited.
 */
export function TopRatesBar() {
  const { t, i18n } = useTranslation();
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fx.list().then((r) => {
        if (!alive) return;
        setRates(r);
        setLoaded(true);
      });
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /**
   * The five TRY crosses first, in a fixed order, then anything else the sync
   * wrote (BTC/USD, ETH/USD, and any pair an admin added by hand such as
   * USD/SYP). Rendering the remainder generically means a new pair shows up
   * without a code change.
   */
  const items = useMemo(() => {
    const by = new Map(rates.map((r) => [r.pair, r]));
    const primary = FX_PAIRS.map(({ pair }) => by.get(pair)).filter((r): r is FxRate => Boolean(r));
    const primaryPairs = new Set<string>(FX_PAIRS.map((p) => p.pair));
    const rest = rates.filter((r) => !primaryPairs.has(r.pair)).sort((a, b) => a.pair.localeCompare(b.pair));
    return [...primary, ...rest];
  }, [rates]);

  /** Currencies read naturally at 2dp; BTC at 2dp is fine, SYP needs none. */
  const format = (r: FxRate) => (r.rate >= 1000 ? Math.round(r.rate).toLocaleString('en-US') : r.rate.toFixed(2));

  const newest = useMemo(
    () => items.reduce<string | null>((acc, r) => (!acc || r.updatedAt > acc ? r.updatedAt : acc), null),
    [items],
  );

  const age = hoursSince(newest, new Date());
  const isStale = age === null || age > STALE_AFTER_HOURS;
  const hasManual = items.some((r) => r.source === 'manual');

  const updatedLabel = newest
    ? new Date(newest).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  const sourceLabel = hasManual
    ? t('rates.sourceManual')
    : (items.find((r) => r.providerName)?.providerName ?? t('rates.sourceProvider'));

  /**
   * One accessible summary, announced once. The visual marquee below is
   * duplicated for seamless scrolling, so BOTH copies are hidden from assistive
   * tech — otherwise a screen reader reads all five pairs twice.
   */
  const spokenSummary =
    items.length > 0
      ? [
          items.map((r) => `${r.pair} ${format(r)}`).join(' · '),
          t('rates.updatedAt', { time: updatedLabel }),
          t('rates.source', { source: sourceLabel }),
        ].join('. ')
      : '';

  return (
    <div className="bg-black text-white text-xs overflow-hidden">
      <div className="h-9 flex items-center" dir="ltr">
        <span className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 border-e border-white/15 z-10 bg-black">
          {/* The status dot used to be colour-only; it now has a text equivalent. */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`}
            aria-hidden
          />
          <AppIcon name="trending-up" className="w-3.5 h-3.5 text-white/70" />
          <span className="sr-only">{t(isStale ? 'rates.statusStale' : 'rates.statusFresh')}</span>
        </span>

        {!loaded ? (
          <span className="px-4 text-white/50">{t('rates.loading')}</span>
        ) : items.length === 0 ? (
          <span className="px-4 text-white/50">{t('rates.unavailable')}</span>
        ) : (
          <>
            {/* Polite: a background rate refresh must not interrupt the user. */}
            <p className="sr-only" aria-live="polite">
              {spokenSummary}
            </p>

            <div className="relative flex-1 overflow-hidden" aria-hidden>
              <div className="flex w-max animate-ticker">
                {[0, 1].map((group) => (
                  <div key={group} className="flex items-center gap-7 pe-7 shrink-0">
                    {items.map((r) => (
                      <span
                        key={`${group}-${r.pair}`}
                        className="flex items-center gap-1.5 font-semibold whitespace-nowrap"
                      >
                        <span className="text-white/55">{r.pair}</span>
                        <span className="tabular-nums">{format(r)}</span>
                        {r.source === 'manual' && <span className="text-amber-300/80 text-[10px]">•</span>}
                      </span>
                    ))}
                    {/* Provenance rides along in the marquee, so freshness and
                        source are visible without opening the admin panel. */}
                    <span className="whitespace-nowrap text-white/40">
                      {t('rates.updatedAt', { time: updatedLabel })} · {t('rates.source', { source: sourceLabel })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
