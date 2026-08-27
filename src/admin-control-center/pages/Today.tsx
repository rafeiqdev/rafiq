import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcon';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { maskEmail } from '../../lib/format';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Accordion } from '../components/Accordion';
import { Kpi, StatusChip, num } from '../components/CCKit';
import { overviewApi } from '../api/overview';
import { fetchOperations, summarizeOperations } from '../api/operations';
import { rangeFor } from '../period';
import { readMetric } from '../../lib/metrics/service';
import { Analytics } from './Analytics';

/** A card with a heading, an optional "view details" link, and body content — same shell as the old Overview page. */
function Card({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  const { cc } = useCC();
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-navy">{title}</h2>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline">
            {cc('overview.viewDetails')}
            <AppIcon name="arrow-right" className="h-3 w-3 dir-arrow" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Today — the default landing screen for a single owner. Leads with what
 * needs attention right now (overdue requests/bookings/leads, pending
 * payments) instead of a generic numbers dashboard, then recent activity.
 * Traffic analytics is real data too, but it's not a daily decision — it
 * lives in a collapsed accordion at the bottom.
 */
export function Today() {
  const { cc, lang } = useCC();

  const paymentsSec = useAsyncSection(() => overviewApi.pendingPayments(), []);
  const auditSec = useAsyncSection(() => overviewApi.recentAudit(8), []);
  const opsSec = useAsyncSection(() => fetchOperations(rangeFor('30d')), []);
  // Medical Tourism has its own admin queue (/admin/medical) with no Control
  // Center counterpart until now — this reads the SAME definition as that
  // queue's badge (METRICS.medicalPendingReview), not a re-derived one.
  const medicalSec = useAsyncSection(() => readMetric('medicalPendingReview'), []);

  const opsSummary = opsSec.status === 'ready' && opsSec.data ? summarizeOperations(opsSec.data) : null;
  const pendingCount = paymentsSec.status === 'ready' && paymentsSec.data ? paymentsSec.data.payments.length : null;
  const overdueCount = opsSummary?.overdue.length ?? null;
  const medicalCount = medicalSec.status === 'ready' ? medicalSec.data?.value ?? null : null;
  // Same honesty rule as pendingCount/overdueCount above: an unreadable count
  // (null) must never be treated as "confirmed clear".
  const hasNoAction = pendingCount === 0 && overdueCount === 0 && medicalCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('overview.hint')}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          icon="alert-triangle"
          label={cc('ops.overdue')}
          value={overdueCount == null ? '…' : num(overdueCount, lang)}
        />
        <Kpi
          icon="credit-card"
          label={cc('overview.kpi.pendingPayments')}
          value={pendingCount == null ? '…' : num(pendingCount, lang)}
        />
        <Kpi icon="hourglass" label={cc('ops.open')} value={num(opsSummary?.open ?? null, lang)} />
        <Kpi icon="layers" label={cc('ops.total')} value={num(opsSummary?.total ?? null, lang)} />
        <Kpi
          icon="heart-pulse"
          label={cc('overview.kpi.medicalPending')}
          value={medicalSec.status === 'ready' ? num(medicalCount, lang) : '…'}
        />
      </div>

      {hasNoAction && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <AppIcon name="check-circle" className="h-4 w-4 shrink-0" />
          {cc('today.allClear')}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue requests/bookings/leads — needs action */}
        <Card title={cc('today.needsAction')} to="/admin/control-center?section=orders">
          <CCState
            section={opsSec}
            title={cc('today.needsAction')}
            isEmpty={(rows) => summarizeOperations(rows).overdue.length === 0}
          >
            {(rows) => {
              const overdue = summarizeOperations(rows).overdue;
              return (
                <ul className="mt-3 flex flex-col gap-2">
                  {overdue.slice(0, 6).map((r) => (
                    <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold text-navy">{r.title}</span>
                      <StatusChip status={r.status} />
                      <Link to={r.href} className="shrink-0 text-xs font-semibold text-brand-red hover:underline">
                        {cc('ops.openInAdmin')}
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            }}
          </CCState>

          {medicalCount != null && medicalCount > 0 && (
            <a
              href="/admin/medical"
              className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-navy underline-offset-2 hover:underline"
            >
              <span className="flex items-center gap-1.5">
                <AppIcon name="heart-pulse" className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
                {cc('overview.card.medicalQueue')}
              </span>
              <span dir="ltr">{medicalCount}</span>
            </a>
          )}
        </Card>

        {/* Pending payments — needs action */}
        <Card title={cc('overview.kpi.pendingPayments')} to="/admin?tab=payments">
          <CCState
            section={paymentsSec}
            title={cc('overview.kpi.pendingPayments')}
            isEmpty={(d) => d.payments.length === 0}
          >
            {(d) => (
              <ul className="mt-3 flex flex-col gap-2">
                {d.payments.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                    <span className="font-semibold text-navy">{maskEmail(p.email)}</span>
                    <span className="text-xs text-navy/50" dir="ltr">
                      {p.amount.toLocaleString(lang)} · {new Date(p.createdAt).toLocaleDateString(lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CCState>
        </Card>
      </div>

      {/* Recent audit events */}
      <Card title={cc('today.recentActivity')} to="/admin?tab=auditLog">
        <CCState section={auditSec} title={cc('today.recentActivity')}>
          {(rows) => (
            <ul className="mt-3 flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs">
                  <AppIcon name="shield-check" className="h-3.5 w-3.5 shrink-0 text-navy/60" />
                  <span className="font-semibold text-navy">{r.action}</span>
                  <span className="text-navy/50">{r.targetType}</span>
                  {r.actorName && <span className="text-navy/40">· {r.actorName}</span>}
                  <span className="ms-auto text-navy/40" dir="ltr">{new Date(r.createdAt).toLocaleDateString(lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </CCState>
      </Card>

      <Accordion title={cc('accordion.analytics')} icon="bar-chart-2">
        <Analytics />
      </Accordion>
    </div>
  );
}
