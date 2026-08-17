import { useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Bar, Card, Kpi, num } from '../components/CCKit';
import { PeriodPicker } from '../components/PeriodPicker';
import { DEFAULT_PERIOD, rangeFor, type PeriodId } from '../period';
import { fetchAnalytics } from '../api/analytics';

/** Top-N list rendered as proportional bars. */
function TopList({ title, rows, icon }: { title: string; rows: [string, number][]; icon?: 'globe' | 'map' }) {
  const { cc } = useCC();
  const max = rows.length ? rows[0][1] : 0;
  return (
    <Card title={title} icon={icon}>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map(([label, count]) => (
            <Bar key={label} label={label} value={count} max={max} />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Analytics — real numbers from the events table, or an explicit "no data in
 * this period" state. Never an invented figure.
 */
export function Analytics() {
  const { cc, lang } = useCC();
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const sec = useAsyncSection(() => fetchAnalytics(rangeFor(period)), [period]);

  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker value={period} onChange={setPeriod} />

      <CCState
        section={sec}
        title={cc('section.analytics')}
        isEmpty={(d) => d.totalEvents === 0}
        empty={
          <section className="card p-8 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="bar-chart-2" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-navy">{cc('analytics.notCollecting.title')}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-navy/60">{cc('analytics.notCollecting.body')}</p>
          </section>
        }
      >
        {(d) => (
          <div className="flex flex-col gap-6">
            {d.capped && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900" role="status">
                <AppIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
                {cc('an.capped')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon="bar-chart-2" label={cc('an.events')} value={num(d.totalEvents, lang)} />
              <Kpi icon="users" label={cc('an.sessions')} value={num(d.uniqueSessions, lang)} />
              <Kpi icon="user" label={cc('an.signedIn')} value={num(d.signedInSessions, lang)} />
              <Kpi icon="file-text" label={cc('an.pageViews')} value={num(d.pageViews, lang)} />
            </div>

            {/* Funnel — the "where do people drop off" question. */}
            <Card title={cc('an.funnel')} icon="trending-up">
              <p className="mt-1 text-xs text-navy/50">{cc('an.funnelHint')}</p>
              <div className="mt-3 flex flex-col gap-2">
                {d.funnel.map((f) => {
                  const top = d.funnel[0]?.count ?? 0;
                  const pct = top > 0 ? Math.round((f.count / top) * 100) : 0;
                  return <Bar key={f.step} label={f.step} value={f.count} max={top} suffix={` (${pct}%)`} />;
                })}
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <TopList title={cc('an.topPages')} rows={d.topPaths} />
              <TopList title={cc('an.topReferrers')} rows={d.topReferrers} icon="globe" />
              <TopList title={cc('an.topServices')} rows={d.topServices} />
              <TopList title={cc('an.byType')} rows={d.byType} />
              <TopList title={cc('an.devices')} rows={d.byDevice} />
              <TopList title={cc('an.locales')} rows={d.byLocale} />
            </div>
          </div>
        )}
      </CCState>
    </div>
  );
}
