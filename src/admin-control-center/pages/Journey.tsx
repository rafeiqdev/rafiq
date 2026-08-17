import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Card, Kpi, TableWrap, Td, Th, num } from '../components/CCKit';
import { fetchJourney } from '../api/growth';

/**
 * Journey & Onboarding — completion rate per onboarding step across all users.
 *
 * This answers "which step do people get stuck on", which nothing in the
 * product could answer before: journey rows were only ever read one user at a
 * time, from that user's own session.
 */
export function Journey() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => fetchJourney(), []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('jr.taskHint')}</p>

      <CCState section={sec} title={cc('section.journey')} isEmpty={(d) => d.totalItems === 0}>
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon="users" label={cc('jr.users')} value={num(d.usersWithJourney, lang)} />
              <Kpi icon="check-circle" label={cc('jr.done')} value={num(d.done, lang)} />
              <Kpi icon="hourglass" label={cc('jr.todo')} value={num(d.todo, lang)} />
              <Kpi
                icon="trending-up"
                label={cc('jr.byTask')}
                value={d.totalItems > 0 ? `${Math.round((d.done / d.totalItems) * 100)}%` : '—'}
              />
            </div>

            <Card title={cc('jr.byTask')} icon="compass">
              <TableWrap minWidth={480}>
                <thead>
                  <tr>
                    <Th>{cc('f.task')}</Th>
                    <Th align="center">{cc('jr.users')}</Th>
                    <Th align="center">{cc('jr.done')}</Th>
                    <Th>%</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.byTask.map((t) => {
                    const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
                    return (
                      <tr key={t.task}>
                        <Td>{t.task}</Td>
                        <Td align="center" dir="ltr">{num(t.total, lang)}</Td>
                        <Td align="center" dir="ltr">{num(t.done, lang)}</Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-24 overflow-hidden rounded-full bg-cream-dark">
                              <span
                                className={`block h-full rounded-full ${pct < 34 ? 'bg-brand-red' : pct < 67 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                            <span className="text-xs font-bold" dir="ltr">{pct}%</span>
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </Card>
          </div>
        )}
      </CCState>
    </div>
  );
}
