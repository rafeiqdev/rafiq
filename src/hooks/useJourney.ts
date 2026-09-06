import { useCallback, useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { ApiError, journey as journeyApi } from '../lib/api';
import { useApp } from '../context/AppContext';
import { classifyError } from '../lib/errors';
import type { ErrorCategory } from '../lib/errors';
import { journeyProgress, nextJourneyItem, JOURNEY_TASK_KEYS } from '../lib/types';
import type { JourneyItem, JourneyProgress, Profile } from '../lib/types';

export type JourneyState = 'loading' | 'ready' | 'empty' | 'error';

const CATEGORIES: ErrorCategory[] = [
  'schema_unavailable',
  'unauthenticated',
  'forbidden',
  'network_error',
  'server_error',
  'unknown_error',
];

/** ApiError.code carries the category for journey calls; else classify raw. */
function categoryOf(e: unknown): ErrorCategory {
  if (e instanceof ApiError && (CATEGORIES as string[]).includes(e.code)) return e.code as ErrorCategory;
  return classifyError(e);
}

/** The catalogue card each default task is about (mirrors related_service_id
 *  on the seeded rows, so the fallback and the server rows open the same one). */
const LOCAL_TASK_SERVICE: Record<string, string> = {
  turkishPhone: 'tel-sim',
  taxNumber: 'res-tax',
  residencePermit: 'res-tourist',
  bankAccount: 'bank-account',
};

/**
 * Where a step's "افتح الخدمة" button goes: the full services page with THIS
 * step's own card already open on top of it. It used to hand over a bare
 * `/services` (or a `?q=` title search), which dropped the reader into a list
 * and made them hunt for the service the step had just named.
 *
 * Falls back to whatever route the row carries, then to the journey page, so a
 * step with no service attached still has somewhere to go.
 */
export function journeyServiceRoute(item: JourneyItem): string {
  const serviceId = item.relatedServiceId || LOCAL_TASK_SERVICE[item.taskKey];
  if (serviceId) return `/services?open=${encodeURIComponent(serviceId)}`;
  return item.relatedRoute || '/journey';
}

const LOCAL_ID_PREFIX = 'local-';

/**
 * Pre-migration fallback: derive the same four default tasks from the
 * onboarding profile (profile.has), which lives in the always-present
 * `onboarding` jsonb. The page then works before the journey migration runs,
 * and upgrades to server rows automatically once it has.
 */
function localItems(profile: Profile): JourneyItem[] {
  return JOURNEY_TASK_KEYS.map((key, i) => ({
    id: `${LOCAL_ID_PREFIX}${key}`,
    taskKey: key,
    titleAr: '',
    status: profile.has[key] ? ('done' as const) : ('todo' as const),
    sort: i,
    relatedServiceId: LOCAL_TASK_SERVICE[key] ?? null,
    relatedRoute: '/services',
  }));
}

/** Localized task title — falls back to the Arabic title stored on the row. */
export function journeyTitle(t: TFunction, item: JourneyItem): string {
  return t(`journeyTasks.${item.taskKey}.title`, { defaultValue: item.titleAr });
}
export function journeyDesc(t: TFunction, item: JourneyItem): string {
  return t(`journeyTasks.${item.taskKey}.desc`, { defaultValue: item.descriptionAr ?? '' });
}

/**
 * Loads the signed-in user's journey, seeding it once (server-side, idempotent)
 * when empty. Progress is derived ONLY from the user's own items.
 */
export function useJourney() {
  const { user, profile, updateProfile } = useApp();
  const [items, setItems] = useState<JourneyItem[]>([]);
  const [state, setState] = useState<JourneyState>('loading');
  const [errorCategory, setErrorCategory] = useState<ErrorCategory | null>(null);

  // Read via a ref inside load() so a profile change doesn't retrigger the
  // network call — it only matters for building the local fallback list.
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setErrorCategory(null);
      setState('ready');
      return;
    }
    setState('loading');
    setErrorCategory(null);
    try {
      let rows = await journeyApi.mine();
      if (rows.length === 0) {
        // first visit → create the default tasks, then re-read
        await journeyApi.ensure();
        rows = await journeyApi.mine();
      }
      setItems(rows);
      setState(rows.length > 0 ? 'ready' : 'empty');
    } catch (e) {
      const category = categoryOf(e);
      if (category === 'schema_unavailable') {
        // Journey tables not migrated yet → run fully client-side from the
        // onboarding profile instead of showing a "feature being prepared" wall.
        setItems(localItems(profileRef.current));
        setErrorCategory(null);
        setState('ready');
        return;
      }
      // Real auth/RLS/network faults keep a typed category so the UI shows
      // accurate copy. Retry stays available in all cases.
      setItems([]);
      setErrorCategory(category);
      setState('error');
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  /** Optimistic toggle; re-syncs from the server if the write fails. */
  const toggle = useCallback(
    async (item: JourneyItem) => {
      const next = item.status === 'done' ? 'todo' : 'done';
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
      if (item.id.startsWith(LOCAL_ID_PREFIX)) {
        // Local mode: persist through the onboarding profile (works pre-migration
        // and keeps Smart/blocks recommendations in sync with the same answer).
        updateProfile({ has: { ...profileRef.current.has, [item.taskKey]: next === 'done' } });
        return;
      }
      try {
        await journeyApi.setStatus(item.id, next);
      } catch {
        load();
      }
    },
    [load, updateProfile],
  );

  const progress: JourneyProgress = journeyProgress(items);

  return { items, state, errorCategory, progress, next: nextJourneyItem(items), reload: load, toggle };
}
