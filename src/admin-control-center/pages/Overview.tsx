import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { maskEmail } from '../../lib/format';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { computeUserKpis, overviewApi } from '../api/overview';

/** A single KPI tile. `value` is a string so the caller controls the em-dash. */
function Kpi({ icon, label, value, hint }: { icon: IconName; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-navy/60">
        <AppIcon name={icon} className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-extrabold text-navy" dir="ltr">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-navy/45">{hint}</p>}
    </div>
  );
}

/** A card with a heading, an optional "view details" link, and body content. */
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
 * Overview — the one Phase-A section that reads REAL data. Every figure comes
 * from the existing admin service layer (adminUsers / adminPayments /
 * adminAuditLog). No mock data. Unreadable aggregates render as "—", never 0.
 * Each card loads independently with its own loading / error / empty state.
 */
export function Overview() {
  const { cc, lang } = useCC();

  const usersSec = useAsyncSection(() => overviewApi.users(), []);
  const paymentsSec = useAsyncSection(() => overviewApi.pendingPayments(), []);
  const cancellationsSec = useAsyncSection(() => overviewApi.cancellations(), []);
  const auditSec = useAsyncSection(() => overviewApi.recentAudit(8), []);

  const kpis = usersSec.status === 'ready' && usersSec.data ? computeUserKpis(usersSec.data) : null;
  const dash = (n: number | null | undefined): string => (n == null ? '—' : String(n));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('overview.hint')}</p>

      {/* KPI strip — driven by the users section's own status. */}
      <CCState section={usersSec} title={cc('overview.title')} isEmpty={() => false}>
        {() => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi icon="users" label={cc('overview.kpi.totalUsers')} value={dash(kpis?.totalUsers)} />
            <Kpi icon="star" label={cc('overview.kpi.payingUsers')} value={dash(kpis?.payingUsers)} />
            <Kpi icon="calendar" label={cc('overview.kpi.totalBookings')} value={dash(kpis?.totalBookings)} />
            <Kpi icon="mail" label={cc('overview.kpi.totalLeads')} value={dash(kpis?.totalLeads)} />
            <Kpi
              icon="credit-card"
              label={cc('overview.kpi.pendingPayments')}
              value={paymentsSec.status === 'ready' && paymentsSec.data ? String(paymentsSec.data.payments.length) : '…'}
            />
            <Kpi
              icon="x-circle"
              label={cc('overview.kpi.cancellations')}
              value={cancellationsSec.status === 'ready' && cancellationsSec.data ? String(cancellationsSec.data.length) : '…'}
            />
          </div>
        )}
      </CCState>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending payments — needs action */}
        <Card title={cc('overview.card.needsAction')} to="/admin?tab=payments">
          <CCState
            section={paymentsSec}
            title={cc('overview.card.needsAction')}
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

        {/* Recent audit events */}
        <Card title={cc('overview.card.recentAudit')} to="/admin?tab=auditLog">
          <CCState section={auditSec} title={cc('overview.card.recentAudit')}>
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
      </div>
    </div>
  );
}
