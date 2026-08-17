import { useState } from 'react';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Card, StatusChip, money, num } from '../components/CCKit';
import { PeriodPicker } from '../components/PeriodPicker';
import { DEFAULT_PERIOD, rangeFor, type PeriodId } from '../period';
import { fetchFinance, type SourceTotals } from '../api/finance';

function SourceCard({ s }: { s: SourceTotals }) {
  const { cc, lang } = useCC();
  const currencies = Object.entries(s.byCurrency);

  return (
    <Card title={cc(`fin.source.${s.source}`)} icon="credit-card" to={s.href}>
      <p className="mt-1 text-xs text-navy/50">
        {cc('fin.records')}: <span dir="ltr" className="font-bold text-navy">{num(s.count, lang)}</span>
      </p>

      {currencies.length === 0 ? (
        <p className="mt-3 text-sm text-navy/50">{cc('state.empty')}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {currencies.map(([cur, v]) => (
            <div key={cur} className="rounded-xl bg-cream px-3 py-2">
              <p className="text-[11px] font-bold text-navy/50" dir="ltr">{cur}</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs text-navy/60">{cc('fin.settled')}</span>
                <span className="font-extrabold text-emerald-700" dir="ltr">{money(v.verified, cur, lang)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs text-navy/60">{cc('fin.waiting')}</span>
                <span className="font-bold text-amber-800" dir="ltr">{money(v.pending, cur, lang)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {s.byStatus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.byStatus.map(([st, n]) => (
            <span key={st} className="inline-flex items-center gap-1">
              <StatusChip status={st} />
              <span className="text-[11px] font-bold text-navy/50" dir="ltr">×{n}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Finance — all four payment tables side by side. Read-only by design: the
 * money actions stay in the classic Admin.
 */
export function Finance() {
  const { cc } = useCC();
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const sec = useAsyncSection(() => fetchFinance(rangeFor(period)), [period]);

  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker value={period} onChange={setPeriod} />
      <div className="flex flex-col gap-1 text-xs text-navy/50">
        <p>{cc('fin.currencyNote')}</p>
        <p>{cc('fin.actionsNote')}</p>
      </div>

      <CCState section={sec} title={cc('section.finance')} isEmpty={() => false}>
        {(sources) => (
          <div className="grid gap-6 lg:grid-cols-2">
            {sources.map((s) => (
              <SourceCard key={s.source} s={s} />
            ))}
          </div>
        )}
      </CCState>
    </div>
  );
}
