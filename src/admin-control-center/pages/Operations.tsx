import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcon';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Bar, Card, Kpi, StatusChip, TableWrap, Td, Th, num } from '../components/CCKit';
import { PeriodPicker } from '../components/PeriodPicker';
import { DEFAULT_PERIOD, rangeFor, type PeriodId } from '../period';
import { fetchOperations, summarizeOperations, type OpsRow } from '../api/operations';

function RowsTable({ rows }: { rows: OpsRow[] }) {
  const { cc, lang } = useCC();
  return (
    <TableWrap minWidth={680}>
      <thead>
        <tr>
          <Th>{cc('f.type')}</Th>
          <Th>{cc('f.service')}</Th>
          <Th>{cc('f.customer')}</Th>
          <Th>{cc('f.status')}</Th>
          <Th>{cc('f.date')}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.kind}-${r.id}`}>
            <Td>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy/70">
                <AppIcon
                  name={r.kind === 'request' ? 'inbox' : r.kind === 'booking' ? 'calendar' : 'mail'}
                  className="h-3.5 w-3.5"
                />
                {cc(`ops.${r.kind}s`)}
              </span>
            </Td>
            <Td><span className="break-anywhere">{r.title}</span></Td>
            {/* Names/emails are shown as stored; nothing is unmasked here that
                the classic Admin does not already show in its own lists. */}
            <Td><span className="text-xs text-navy/60 break-all">{r.who ?? '—'}</span></Td>
            <Td><StatusChip status={r.status} /></Td>
            <Td dir="ltr"><span className="whitespace-nowrap text-xs text-navy/50">{new Date(r.createdAt).toLocaleDateString(lang)}</span></Td>
            <Td>
              <Link to={r.href} className="whitespace-nowrap text-xs font-semibold text-brand-red hover:underline">
                {cc('ops.openInAdmin')}
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

/**
 * Unified Operations — every "someone is waiting on us" record in one list,
 * across service requests, bookings and leads.
 */
export function Operations() {
  const { cc, lang } = useCC();
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const sec = useAsyncSection(() => fetchOperations(rangeFor(period)), [period]);

  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker value={period} onChange={setPeriod} />
      <p className="text-xs text-navy/50">{cc('ops.readOnlyNote')}</p>

      <CCState section={sec} title={cc('section.operations')}>
        {(rows) => {
          const s = summarizeOperations(rows);
          const maxStatus = s.byStatus[0]?.[1] ?? 0;
          return (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <Kpi icon="layers" label={cc('ops.total')} value={num(s.total, lang)} />
                <Kpi icon="hourglass" label={cc('ops.open')} value={num(s.open, lang)} />
                <Kpi icon="alert-triangle" label={cc('ops.overdue')} value={num(s.overdue.length, lang)} />
                <Kpi icon="inbox" label={cc('ops.requests')} value={num(s.byKind.request, lang)} />
                <Kpi icon="calendar" label={cc('ops.bookings')} value={num(s.byKind.booking, lang)} />
                <Kpi icon="mail" label={cc('ops.leads')} value={num(s.byKind.lead, lang)} />
              </div>

              {s.overdue.length > 0 && (
                <Card title={cc('ops.overdue')} icon="alert-triangle">
                  <RowsTable rows={s.overdue.slice(0, 10)} />
                </Card>
              )}

              <Card title={cc('ops.byStatus')} icon="sliders-horizontal">
                <div className="mt-3 flex flex-col gap-2">
                  {s.byStatus.map(([st, n]) => (
                    <Bar key={st} label={st} value={n} max={maxStatus} />
                  ))}
                </div>
              </Card>

              <Card title={cc('ops.recent')} icon="history">
                <RowsTable rows={rows.slice(0, 25)} />
              </Card>
            </div>
          );
        }}
      </CCState>
    </div>
  );
}
