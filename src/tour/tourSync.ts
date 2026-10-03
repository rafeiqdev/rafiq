import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isSchemaUnavailable } from '../lib/errors';
import { track } from '../lib/analytics';

/**
 * The account side of "has this visitor seen the tour" plus the tour events —
 * everything that needs supabase/migrations/20261003_product_tour.sql.
 *
 * Every call here degrades to "do nothing" when that migration is not applied
 * (confirmed missing-schema error), so the device-only behaviour in
 * tourState.ts is always the floor. Nothing in this file ever throws.
 *
 * Why probe first: public.events has a CHECK on event_type, and a batch
 * insert is all-or-nothing — a single tour_* row sent to an un-migrated
 * database would throw away the page views queued with it. So tour events
 * are only emitted once the probe has seen the new table exist.
 */

const TABLE = 'user_tours_seen';

export type TourEvent = 'tour_started' | 'tour_completed' | 'tour_skipped';

/** null = not probed yet; false = migration missing; true = schema present. */
let schemaPresent: boolean | null = null;
let probe: Promise<boolean> | null = null;

export function resetTourSyncForTests(): void {
  schemaPresent = null;
  probe = null;
}

function client(): SupabaseClient | null {
  return supabase;
}

/** One cheap query per page load tells us whether the migration landed. */
export function probeTourSchema(c: SupabaseClient | null = client()): Promise<boolean> {
  if (schemaPresent !== null) return Promise.resolve(schemaPresent);
  if (probe) return probe;
  if (!c) return Promise.resolve(false);
  probe = (async () => {
    try {
      const { error } = await c.from(TABLE).select('tour_id').limit(1);
      // RLS hiding rows from a guest is not an error; "relation does not
      // exist" is the one answer that means "not migrated".
      schemaPresent = !(error && isSchemaUnavailable(error));
    } catch {
      schemaPresent = false;
    }
    return schemaPresent;
  })();
  return probe;
}

/** Tours this account has already finished or closed, or null when unknown. */
export async function fetchSeenTours(uid: string, c: SupabaseClient | null = client()): Promise<Set<string> | null> {
  if (!c || !(await probeTourSchema(c))) return null;
  const { data, error } = await c.from(TABLE).select('tour_id').eq('user_id', uid);
  if (error || !data) return null;
  return new Set((data as { tour_id: string }[]).map((r) => r.tour_id));
}

export async function markSeenRemote(uid: string, tourId: string, c: SupabaseClient | null = client()): Promise<void> {
  if (!c || !(await probeTourSchema(c))) return;
  await c.from(TABLE).upsert({ user_id: uid, tour_id: tourId }, { onConflict: 'user_id,tour_id', ignoreDuplicates: true });
}

/**
 * started / completed / skipped, with the step the visitor was on (1-based)
 * and how many there were. Dropped silently before the migration.
 */
export async function trackTourEvent(event: TourEvent, tourId: string, step: number, steps: number): Promise<void> {
  if (!(await probeTourSchema())) return;
  track(event, { target: tourId, meta: { step, steps } });
}
