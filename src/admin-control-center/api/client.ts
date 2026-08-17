/**
 * Supabase access for the Control Center's own read-only queries.
 *
 * Most sections reuse the proven readers in src/lib/api.ts. A few need
 * admin-wide reads that simply have no existing reader (there was never an
 * admin screen for them) — those go through here.
 *
 * Rules for everything in this folder:
 *  - SELECT only. No insert/update/delete, no RPC that mutates.
 *  - Errors are thrown, never swallowed, so the calling card renders its error
 *    state instead of an empty list that reads as "nothing happened".
 *  - Every table touched is admin-gated by RLS, so a non-admin session gets
 *    zero rows from Postgres regardless of what the UI does.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export function ccSb(): SupabaseClient {
  if (!supabase) throw new Error('supabase_not_configured');
  return supabase;
}

/** Throw on a PostgREST error so CCState shows "this section failed", not "empty". */
export function orThrow<T>(res: { data: T | null; error: { message?: string } | null }): T {
  if (res.error) throw new Error(res.error.message ?? 'query_failed');
  return (res.data ?? []) as T;
}

/**
 * An exact row count without transferring the rows (PostgREST HEAD + count).
 * Returns null when the count could not be read — callers must render that as
 * "—", never as 0.
 */
export async function countOf(
  table: string,
  build?: (q: ReturnType<SupabaseClient['from']> extends never ? never : any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<number | null> {
  try {
    let q = ccSb().from(table).select('*', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/** Sum a numeric field over rows, ignoring nulls. */
export function sumBy<T>(rows: T[], pick: (r: T) => number | null | undefined): number {
  let total = 0;
  for (const r of rows) {
    const v = pick(r);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

/** Count occurrences of a key, returned as a descending [key, count] list. */
export function tallyTop<T>(rows: T[], pick: (r: T) => string | null | undefined, limit = 8): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = pick(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}
