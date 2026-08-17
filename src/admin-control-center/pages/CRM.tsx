import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Bar, Card, Kpi, StatusChip, TableWrap, Td, Th, num } from '../components/CCKit';
import { PeriodPicker } from '../components/PeriodPicker';
import { DEFAULT_PERIOD, rangeFor, type PeriodId } from '../period';
import { fetchOperations } from '../api/operations';

/**
 * CRM & Leads — the lead pipeline, read-only.
 *
 * The brief's richer CRM (owner, pipeline stage, next action, lost reason)
 * needs a new side table that has not been created yet, so those fields are
 * NOT rendered as empty columns pretending to work — the note explains why.
 */
export function CRM() {
  const { cc, lang } = useCC();
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const sec = useAsyncSection(() => fetchOperations(rangeFor(period)), [period]);

  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker value={period} onChange={setPeriod} />
      <p className="text-xs text-navy/50">{cc('crm.pipelineNote')}</p>

      <CCState section={sec} title={cc('section.crm')} isEmpty={() => false}>
        {(all) => {
          const leads = all.filter((r) => r.kind === 'lead');
          const statuses = new Map<string, number>();
          for (const l of leads) statuses.set(l.status, (statuses.get(l.status) ?? 0) + 1);
          const byStatus = [...statuses.entries()].sort((a, b) => b[1] - a[1]);
          const max = byStatus[0]?.[1] ?? 0;

          return (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon="mail" label={cc('crm.leadsTotal')} value={num(leads.length, lang)} />
                {byStatus.slice(0, 3).map(([st, n]) => (
                  <Kpi key={st} icon="circle" label={st} value={num(n, lang)} />
                ))}
              </div>

              {byStatus.length > 0 && (
                <Card title={cc('ops.byStatus')} icon="sliders-horizontal">
                  <div className="mt-3 flex flex-col gap-2">
                    {byStatus.map(([st, n]) => (
                      <Bar key={st} label={st} value={n} max={max} />
                    ))}
                  </div>
                </Card>
              )}

              <Card title={cc('crm.recent')} icon="mail" to="/admin?tab=leads">
                {leads.length === 0 ? (
                  <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>
                ) : (
                  <TableWrap minWidth={560}>
                    <thead>
                      <tr>
                        <Th>{cc('f.service')}</Th>
                        <Th>{cc('f.customer')}</Th>
                        <Th>{cc('f.status')}</Th>
                        <Th>{cc('f.date')}</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody>
                      {leads.slice(0, 25).map((l) => (
                        <tr key={l.id}>
                          <Td><span className="break-anywhere">{l.title}</span></Td>
                          <Td><span className="text-xs text-navy/60 break-all">{l.who ?? '—'}</span></Td>
                          <Td><StatusChip status={l.status} /></Td>
                          <Td dir="ltr"><span className="whitespace-nowrap text-xs text-navy/50">{new Date(l.createdAt).toLocaleDateString(lang)}</span></Td>
                          <Td>
                            <Link to={l.href} className="whitespace-nowrap text-xs font-semibold text-brand-red hover:underline">
                              {cc('ops.openInAdmin')}
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </Card>
            </div>
          );
        }}
      </CCState>
    </div>
  );
}
