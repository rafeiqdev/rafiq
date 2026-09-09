import { useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { maskEmail } from '../../lib/format';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Bar, Card, Kpi, num } from '../components/CCKit';
import { PeriodPicker } from '../components/PeriodPicker';
import { DEFAULT_PERIOD, rangeFor, type PeriodId } from '../period';
import { fetchAnalytics, VISITOR_CAP, type DailyPoint, type VisitorSession } from '../api/analytics';

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

/** The '(unknown)' bucket the API emits for events with no country recorded. */
const UNKNOWN_COUNTRY = '(unknown)';

/**
 * A country code as a flag. Built from the two regional-indicator code points
 * rather than an image set: no asset to ship, no flag to keep up to date, and
 * it inherits the surrounding text size automatically.
 */
function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "TR" -> "تركيا" / "Turkey", in the admin's own language. */
function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    // Intl.DisplayNames is missing or the code is not a region — the raw code
    // is still true, just less readable.
    return code;
  }
}

/**
 * Visits per day as columns.
 *
 * Forced dir="ltr" even in Arabic: a time axis reads oldest→newest left to
 * right everywhere, and mirroring it would make "the line is going up" mean
 * the opposite of what it looks like.
 */
function Trend({ points, lang }: { points: DailyPoint[]; lang: string }) {
  const max = points.reduce((m, p) => Math.max(m, p.sessions), 0);
  // Enough labels to orient the eye, never so many they collide.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  return (
    <div className="mt-4 overflow-x-auto" dir="ltr">
      <div className="flex min-w-[420px] items-end gap-[3px]" style={{ height: 132 }}>
        {points.map((p) => {
          const pct = max > 0 ? (p.sessions / max) * 100 : 0;
          return (
            <div
              key={p.day}
              className="flex h-full min-w-0 flex-1 items-end"
              title={`${p.day} — ${p.sessions.toLocaleString(lang)}`}
            >
              <span
                className={`block w-full rounded-t ${p.sessions > 0 ? 'bg-navy/70' : 'bg-cream-dark'}`}
                // A day with visits never renders as an invisible sliver: 3px
                // floor, so "one visit" and "no visits" are distinguishable.
                style={{ height: p.sessions > 0 ? `max(3px, ${pct}%)` : '2px' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex min-w-[420px] gap-[3px]">
        {points.map((p, i) => (
          <span key={p.day} className="min-w-0 flex-1 truncate text-[9px] text-navy/45">
            {i % labelEvery === 0 ? p.day.slice(5) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

const TIME_FMT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * One visit, expandable into the pages it covered.
 *
 * "Who" is answered honestly: a name/email only for a visitor who was signed
 * in, and an explicit "anonymous visitor" otherwise — the event log holds no
 * IP, no location and no fingerprint, so there is nothing else to show and
 * guessing would be worse than saying so.
 */
function VisitorRow({ v, lang }: { v: VisitorSession; lang: string }) {
  const { cc } = useCC();
  const known = !!v.userId;
  const label = v.name?.trim() || (v.email ? maskEmail(v.email) : null) || (known ? cc('an.knownNoName') : cc('an.anonymous'));
  const minutes = Math.max(0, Math.round((new Date(v.lastAt).getTime() - new Date(v.firstAt).getTime()) / 60000));

  return (
    <details className="group rounded-xl bg-cream px-3 py-2">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
        <AppIcon name={known ? 'user' : 'users'} className={`h-3.5 w-3.5 shrink-0 ${known ? 'text-brand-red' : 'text-navy/40'}`} />
        <span className="font-semibold text-navy">{label}</span>
        {v.name && v.email && <span className="text-xs text-navy/45" dir="ltr">{maskEmail(v.email)}</span>}
        <span className="text-xs text-navy/50" dir="ltr">
          {new Date(v.firstAt).toLocaleString(lang, TIME_FMT)}
        </span>
        <span className="flex items-center gap-1 text-xs text-navy/50">
          <AppIcon name={v.device === 'mobile' ? 'smartphone' : 'maximize'} className="h-3 w-3 shrink-0" />
          {v.device}
        </span>
        <span className="text-xs text-navy/50">{v.locale}</span>
        {v.country && (
          <span className="text-xs text-navy/60" title={countryName(v.country, lang)}>
            {flagEmoji(v.country)} {v.country}
          </span>
        )}
        <span className="min-w-0 truncate text-xs text-navy/50" dir="ltr" title={v.referrer ?? undefined}>
          {v.referrer ?? cc('an.direct')}
        </span>
        <span className="ms-auto flex items-center gap-2 text-xs font-bold text-navy" dir="ltr">
          <span>{v.pageViews} {cc('an.pagesShort')}</span>
          {minutes > 0 && <span className="font-normal text-navy/45">{minutes}m</span>}
          <AppIcon name="chevron-down" className="h-3.5 w-3.5 shrink-0 text-navy/40 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="mt-2 border-t border-cream-dark pt-2">
        <p className="text-[11px] font-semibold text-navy/50">{cc('an.journey')}</p>
        <ol className="mt-1 flex flex-wrap items-center gap-1" dir="ltr">
          {v.paths.map((p, i) => (
            <li key={`${p}-${i}`} className="flex items-center gap-1">
              {i > 0 && <AppIcon name="chevron-right" className="h-3 w-3 shrink-0 text-navy/30" />}
              <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] text-navy/80">{p}</span>
            </li>
          ))}
        </ol>
        {v.actions.length > 0 && (
          <>
            <p className="mt-2 text-[11px] font-semibold text-navy/50">{cc('an.actions')}</p>
            <div className="mt-1 flex flex-wrap gap-1" dir="ltr">
              {v.actions.map((a, i) => (
                <span key={`${a}-${i}`} className="rounded-full bg-brand-blue/60 px-2 py-0.5 text-[11px] font-semibold text-navy">
                  {a}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

/**
 * Visitors & analytics — real numbers from the events table, or an explicit
 * "no data in this period" state. Never an invented figure.
 */
export function Analytics() {
  const { cc, lang } = useCC();
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const [showAll, setShowAll] = useState(false);
  const sec = useAsyncSection(() => fetchAnalytics(rangeFor(period)), [period]);

  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker value={period} onChange={setPeriod} />

      <CCState
        section={sec}
        title={cc('section.visitors')}
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
        {(d) => {
          const shown = showAll ? d.visitors : d.visitors.slice(0, 25);
          return (
            <div className="flex flex-col gap-6">
              {d.capped && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900" role="status">
                  <AppIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
                  {cc('an.capped')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi icon="users" label={cc('an.sessions')} value={num(d.uniqueSessions, lang)} />
                <Kpi icon="file-text" label={cc('an.pageViews')} value={num(d.pageViews, lang)} />
                <Kpi icon="user" label={cc('an.knownVisitors')} value={num(d.knownVisitors, lang)} />
                <Kpi icon="history" label={cc('an.signedIn')} value={num(d.signedInSessions, lang)} />
                <Kpi icon="bar-chart-2" label={cc('an.events')} value={num(d.totalEvents, lang)} />
              </div>

              {/* Consent is not a footnote: it is the reason this number is a
                  floor rather than the site's true traffic. */}
              <p className="flex items-start gap-2 rounded-xl bg-cream px-4 py-3 text-xs text-navy/60">
                <AppIcon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {cc('an.consentNote')}
              </p>

              <Card title={cc('an.trend')} icon="trending-up">
                <p className="mt-1 text-xs text-navy/50">{cc('an.trendHint')}</p>
                <Trend points={d.daily} lang={lang} />
              </Card>

              {/* Countries. The "not switched on yet" branch matters: the
                  column arrives via a migration pasted in by hand, and an
                  empty chart would read as "no visitors anywhere". */}
              <Card title={cc('an.countries')} icon="globe">
                {!d.hasCountryColumn ? (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                    <AppIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
                    {cc('an.countryNotEnabled')}
                  </p>
                ) : d.byCountry.length === 0 ? (
                  <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-navy/50">{cc('an.countriesHint')}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {d.byCountry.map(([code, count]) => (
                        <Bar
                          key={code}
                          label={
                            code === UNKNOWN_COUNTRY
                              ? cc('an.countryUnknown')
                              : `${flagEmoji(code)} ${countryName(code, lang)}`
                          }
                          value={count}
                          max={d.byCountry[0][1]}
                        />
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {/* "Who came" — the visit list. */}
              <Card title={cc('an.who')} icon="users">
                <p className="mt-1 text-xs text-navy/50">{cc('an.whoHint')}</p>
                {d.visitors.length === 0 ? (
                  <p className="mt-3 text-sm text-navy/50">{cc('state.empty')}</p>
                ) : (
                  <>
                    <div className="mt-3 flex flex-col gap-2">
                      {shown.map((v) => (
                        <VisitorRow key={v.sessionId} v={v} lang={lang} />
                      ))}
                    </div>
                    {!showAll && d.visitors.length > shown.length && (
                      <button onClick={() => setShowAll(true)} className="btn-secondary mt-3 min-h-[44px] px-4 text-sm">
                        {cc('an.showAllVisits')} ({d.visitors.length.toLocaleString(lang)})
                      </button>
                    )}
                    {d.visitorsTotal > d.visitors.length && (
                      <p className="mt-2 text-[11px] text-navy/45">
                        {cc('an.visitsTrimmed')} {VISITOR_CAP.toLocaleString(lang)} / {d.visitorsTotal.toLocaleString(lang)}
                      </p>
                    )}
                  </>
                )}
              </Card>

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
          );
        }}
      </CCState>
    </div>
  );
}
