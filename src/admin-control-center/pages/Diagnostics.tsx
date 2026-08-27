import { useAsyncSection } from '../../hooks/useAsyncSection';
import { METRICS, type MetricDefinition } from '../../lib/metrics/definitions';
import { readAllTimeMetrics, type MetricReading } from '../../lib/metrics/service';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Card, Td, Th, TableWrap, num } from '../components/CCKit';

/**
 * Metrics Diagnostics — a parity view over the admin metrics dictionary.
 * Lives collapsed inside Settings (see pages/Settings.tsx), alongside the
 * other rarely-touched detail (system health, documents, notifications).
 *
 * Read-only, no I/O beyond the same count queries the badges already run.
 * Purpose: let an admin see, in one place, every metric's live value next to
 * its scope/status filter/timezone, and see WHY two similarly-named numbers
 * elsewhere in the product (e.g. the header badge vs. a Control Center KPI)
 * are allowed to disagree — rather than that divergence looking like a bug
 * report waiting to happen.
 *
 * There is no server-side metrics API in this app (it is a client-only SPA
 * reading Supabase directly under RLS — see src/lib/metrics/service.ts), so
 * this page IS the diagnostic endpoint: every reading here is executed live,
 * on demand, the same way the badges are.
 */

const scopeLabel = (cc: (k: string) => string, def: MetricDefinition): string =>
  def.scope === 'all-time' ? cc('diag.scope.allTime') : cc('diag.scope.selectedPeriod');

function ReadingRow({ reading, lang, cc }: { reading: MetricReading; lang: string; cc: (k: string) => string }) {
  const def = reading.definition;
  return (
    <tr>
      <Td>
        <span className="font-semibold text-navy">{def.label}</span>
        <span className="block text-[11px] text-navy/45">{def.key}</span>
      </Td>
      <Td dir="ltr"><span className="font-mono text-xs">{def.tables.join(', ')}</span></Td>
      <Td dir="ltr"><span className="font-mono text-xs">{def.statusFilter.join(', ') || '—'}</span></Td>
      <Td>{scopeLabel(cc, def)}</Td>
      <Td dir="ltr"><span className="font-mono text-xs">{def.timezone}</span></Td>
      <Td align="end" dir="ltr">
        <span className="text-lg font-extrabold text-navy">{num(reading.value, lang)}</span>
      </Td>
      <Td dir="ltr"><span className="whitespace-nowrap text-xs text-navy/50">{new Date(reading.computedAt).toLocaleTimeString(lang)}</span></Td>
    </tr>
  );
}

export function Diagnostics() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => readAllTimeMetrics(), []);

  const periodScoped = (Object.values(METRICS) as MetricDefinition[]).filter((d) => d.scope === 'selected-period');

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('diag.hint')}</p>

      <Card title={cc('diag.allTime.title')} icon="search">
        <CCState section={sec} title={cc('diag.allTime.title')} isEmpty={() => false}>
          {(readings) => (
            <TableWrap minWidth={760}>
              <thead>
                <tr>
                  <Th>{cc('diag.metric')}</Th>
                  <Th>{cc('diag.tables')}</Th>
                  <Th>{cc('diag.statusFilter')}</Th>
                  <Th>{cc('diag.scope')}</Th>
                  <Th>{cc('diag.timezone')}</Th>
                  <Th align="end">{cc('diag.value')}</Th>
                  <Th>{cc('diag.asOf')}</Th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <ReadingRow key={r.key} reading={r} lang={lang} cc={cc} />
                ))}
              </tbody>
            </TableWrap>
          )}
        </CCState>
      </Card>

      <Card title={cc('diag.periodScoped.title')} icon="sliders-horizontal">
        <p className="mt-1 text-xs text-navy/50">{cc('diag.periodScoped.hint')}</p>
        <TableWrap minWidth={760}>
          <thead>
            <tr>
              <Th>{cc('diag.metric')}</Th>
              <Th>{cc('diag.tables')}</Th>
              <Th>{cc('diag.statusFilter')}</Th>
              <Th>{cc('diag.timezone')}</Th>
              <Th>{cc('diag.note')}</Th>
            </tr>
          </thead>
          <tbody>
            {periodScoped.map((def) => (
              <tr key={def.key}>
                <Td>
                  <span className="font-semibold text-navy">{def.label}</span>
                  <span className="block text-[11px] text-navy/45">{def.key}</span>
                </Td>
                <Td dir="ltr"><span className="font-mono text-xs">{def.tables.join(', ')}</span></Td>
                <Td dir="ltr"><span className="font-mono text-xs">{def.statusFilter.join(', ') || '—'}</span></Td>
                <Td dir="ltr"><span className="font-mono text-xs">Europe/Istanbul</span></Td>
                <Td><span className="text-xs text-navy/60">{def.notes}</span></Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
