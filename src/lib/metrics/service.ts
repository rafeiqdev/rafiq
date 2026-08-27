/**
 * Metrics service — executes the single-table definitions in ./definitions.ts.
 *
 * This is the ONE place that builds the `select(id, {count:'exact', head:true})
 * .eq/.in('status', ...)` query shape. src/lib/api.ts's badge functions
 * (bookings.newCount, leads.newCount, serviceRequests.newCount,
 * adminMedical.newCount) delegate here instead of each hand-rolling the same
 * query — see the call sites in api.ts for the thin wrappers that preserve
 * their existing "0 on any failure" contract.
 *
 * A MetricReading is intentionally more honest than those wrappers: `value`
 * is `null` when the read failed, never coerced to 0, so a caller that wants
 * to render "—" (unreadable) instead of "0" (confirmed empty) — e.g. the
 * Control Center Diagnostics page — can.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { METRICS, SINGLE_TABLE_METRIC_KEYS, type MetricDefinition, type SingleTableMetricKey } from './definitions';

function sb(): SupabaseClient {
  if (!supabase) throw new Error('supabase_not_configured');
  return supabase;
}

export interface MetricReading {
  key: string;
  definition: MetricDefinition;
  /** null = the read failed (RLS denial, network loss, missing table) — NEVER coerced to 0. */
  value: number | null;
  /** When this reading was taken, ISO 8601. */
  computedAt: string;
}

/**
 * Exact row count for one table filtered to a status set, via PostgREST's
 * count-only HEAD request (no rows transferred). A single status uses `.eq`
 * and multiple uses `.in` — the two are functionally equivalent in Postgres,
 * but keeping the single-value case as `.eq` matches the query shape the
 * existing badge tests (adminCounts.test.ts) already pin.
 */
async function countByStatus(table: string, statuses: readonly string[]): Promise<{ count: number | null; error: unknown }> {
  const base = sb().from(table).select('id', { count: 'exact', head: true });
  if (statuses.length === 1) return base.eq('status', statuses[0]);
  if (statuses.length > 1) return base.in('status', [...statuses]);
  return base;
}

/** Read one single-table metric definition against the live database. */
export async function readMetric(key: SingleTableMetricKey): Promise<MetricReading> {
  const definition = METRICS[key];
  const { count, error } = await countByStatus(definition.tables[0], definition.statusFilter);
  return {
    key,
    definition,
    value: error ? null : (count ?? 0),
    computedAt: new Date().toISOString(),
  };
}

/** Read every single-table all-time metric — the parity view the Diagnostics page renders. */
export async function readAllTimeMetrics(): Promise<MetricReading[]> {
  const keys = SINGLE_TABLE_METRIC_KEYS.filter((k) => METRICS[k].scope === 'all-time');
  return Promise.all(keys.map(readMetric));
}
