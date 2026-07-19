import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROFILE,
  JOURNEY_TASK_KEYS,
  SITUATION_TO_PATH,
  SITUATION_TO_REASON,
  journeyProgress,
  nextJourneyItem,
} from './types';
import type { JourneyItem, Profile, Situation } from './types';
import { blocksFor } from '../blocks/registry';

function item(over: Partial<JourneyItem> & { id: string }): JourneyItem {
  return {
    taskKey: 'turkishPhone',
    titleAr: 'مهمة',
    descriptionAr: null,
    status: 'todo',
    sort: 1,
    relatedRoute: null,
    relatedServiceId: null,
    completedAt: null,
    ...over,
  };
}

describe('journey progress', () => {
  it('computes done / remaining / percent from the user’s own items only', () => {
    const items = [
      item({ id: 'a', sort: 1, status: 'done' }),
      item({ id: 'b', sort: 2 }),
      item({ id: 'c', sort: 3 }),
      item({ id: 'd', sort: 4 }),
    ];
    const p = journeyProgress(items);
    expect(p.total).toBe(4);
    expect(p.done).toBe(1);
    expect(p.remaining).toBe(3);
    expect(p.percent).toBe(25); // matches the spec example: 25% — أنجزت 1 من 4
  });

  it('an empty journey yields 0% and never NaN or 0/0 arithmetic errors', () => {
    const p = journeyProgress([]);
    expect(p.total).toBe(0);
    expect(p.done).toBe(0);
    expect(p.remaining).toBe(0);
    expect(p.percent).toBe(0);
    expect(Number.isNaN(p.percent)).toBe(false);
  });

  it('reports 100% when everything is done', () => {
    const items = [item({ id: 'a', status: 'done' }), item({ id: 'b', sort: 2, status: 'done' })];
    expect(journeyProgress(items).percent).toBe(100);
  });
});

describe('next recommended step', () => {
  it('picks the lowest-sort incomplete task', () => {
    const items = [
      item({ id: 'a', sort: 1, status: 'done' }),
      item({ id: 'c', sort: 3, taskKey: 'residencePermit' }),
      item({ id: 'b', sort: 2, taskKey: 'taxNumber' }),
    ];
    expect(nextJourneyItem(items)?.id).toBe('b');
  });

  it('returns null when nothing is left', () => {
    expect(nextJourneyItem([item({ id: 'a', status: 'done' })])).toBeNull();
  });

  it('returns null for an empty journey', () => {
    expect(nextJourneyItem([])).toBeNull();
  });
});

describe('onboarding answers → journey seeding', () => {
  // Mirrors ensure_my_journey(): a task the user reported as already done
  // starts completed. The four task keys line up with Profile.has.
  const seed = (has: Profile['has']): JourneyItem[] =>
    JOURNEY_TASK_KEYS.map((k, idx) =>
      item({ id: k, taskKey: k, sort: idx + 1, status: has[k] ? 'done' : 'todo' }),
    );

  it('marks "الحصول على رقم هاتف تركي" completed when the user already has a phone', () => {
    const items = seed({ ...EMPTY_PROFILE.has, turkishPhone: true });
    expect(items.find((i) => i.taskKey === 'turkishPhone')?.status).toBe('done');
    expect(journeyProgress(items)).toMatchObject({ total: 4, done: 1, percent: 25 });
  });

  it('starts every task incomplete when the user has done nothing yet', () => {
    const items = seed(EMPTY_PROFILE.has);
    expect(journeyProgress(items)).toMatchObject({ done: 0, percent: 0 });
    expect(nextJourneyItem(items)?.taskKey).toBe('turkishPhone');
  });

  it('covers exactly the four slice tasks', () => {
    expect(JOURNEY_TASK_KEYS).toEqual(['turkishPhone', 'taxNumber', 'residencePermit', 'bankAccount']);
  });
});

describe('situation mapping keeps the existing recommendation engine working', () => {
  it('maps every situation to a legacy JourneyPath', () => {
    const situations: Situation[] = ['planning', 'arrived', 'visiting', 'student', 'resident', 'long_resident'];
    for (const s of situations) {
      expect(SITUATION_TO_PATH[s]).toBeDefined();
    }
    expect(SITUATION_TO_PATH.arrived).toBe('arrived');
    expect(SITUATION_TO_PATH.long_resident).toBe('living');
    expect(SITUATION_TO_REASON.student).toBe('study');
  });

  it('blocksFor still returns recommendations for a mapped profile', () => {
    const profile: Profile = { ...EMPTY_PROFILE, situation: 'arrived', path: SITUATION_TO_PATH.arrived };
    const blocks = blocksFor(profile);
    expect(blocks.length).toBeGreaterThan(0);
    // the arrived checklist surfaces the same four things the journey tracks
    expect(blocks.some((b) => b.hasKey === 'turkishPhone')).toBe(true);
  });
});

describe('re-running journey synchronisation', () => {
  /**
   * Mirrors the UNIQUE (user_id, task_key) + ON CONFLICT DO UPDATE rule: seeding
   * repeatedly must never create a second row for the same stable task key.
   */
  const sync = (existing: JourneyItem[], has: Profile['has']): JourneyItem[] => {
    const byKey = new Map(existing.map((i) => [i.taskKey, i]));
    JOURNEY_TASK_KEYS.forEach((k, idx) => {
      const current = byKey.get(k);
      if (!current) {
        byKey.set(k, item({ id: k, taskKey: k, sort: idx + 1, status: has[k] ? 'done' : 'todo' }));
        return;
      }
      // upgrade-only, exactly like the SQL
      if (current.status === 'todo' && has[k]) byKey.set(k, { ...current, status: 'done' });
    });
    return [...byKey.values()];
  };

  it('creates no duplicates when run repeatedly', () => {
    let items = sync([], EMPTY_PROFILE.has);
    items = sync(items, EMPTY_PROFILE.has);
    items = sync(items, { ...EMPTY_PROFILE.has, taxNumber: true });
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.taskKey)).size).toBe(4);
  });

  it('upgrades an incomplete task after an onboarding edit, without touching the rest', () => {
    const items = sync(sync([], EMPTY_PROFILE.has), { ...EMPTY_PROFILE.has, taxNumber: true });
    expect(items.find((i) => i.taskKey === 'taxNumber')?.status).toBe('done');
    expect(items.find((i) => i.taskKey === 'turkishPhone')?.status).toBe('todo');
    expect(journeyProgress(items).percent).toBe(25);
  });

  it('keeps a manually completed task completed when answers contradict it', () => {
    const manual = sync([], EMPTY_PROFILE.has).map((i) =>
      i.taskKey === 'bankAccount' ? { ...i, status: 'done' as const } : i,
    );
    const after = sync(manual, EMPTY_PROFILE.has); // answers still say "not done"
    expect(after.find((i) => i.taskKey === 'bankAccount')?.status).toBe('done');
  });
});
