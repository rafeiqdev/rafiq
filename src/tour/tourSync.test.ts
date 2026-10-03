import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../lib/supabase', () => ({ supabase: null, supabaseEnabled: false }));
vi.mock('../lib/analytics', () => ({ track: vi.fn() }));

import { track } from '../lib/analytics';
import { fetchSeenTours, markSeenRemote, probeTourSchema, resetTourSyncForTests, trackTourEvent } from './tourSync';

/**
 * A tiny stand-in for the supabase client: every chain (`from().select()
 * .limit()`, `.eq()`, `.upsert()`) resolves to whatever `answer` returns, and
 * `calls` records what was asked so a test can see the upsert payload.
 */
function fakeClient(answer: (op: string) => { data?: unknown; error?: unknown }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain = (op: string) => {
    const p = Promise.resolve(answer(op)) as Promise<unknown> & Record<string, unknown>;
    p.eq = (...args: unknown[]) => {
      calls.push({ op: 'eq', args });
      return chain(op);
    };
    p.limit = () => chain(op);
    return p;
  };
  const c = {
    from: () => ({
      select: (...args: unknown[]) => {
        calls.push({ op: 'select', args });
        return chain('select');
      },
      upsert: (...args: unknown[]) => {
        calls.push({ op: 'upsert', args });
        return chain('upsert');
      },
    }),
  } as unknown as SupabaseClient;
  return { c, calls };
}

const MISSING_TABLE = { code: '42P01', message: 'relation "public.user_tours_seen" does not exist' };

beforeEach(() => {
  resetTourSyncForTests();
  vi.mocked(track).mockClear();
});

describe('before the migration (table missing)', () => {
  it('reports the schema absent, reads nothing, writes nothing, sends no events', async () => {
    const { c, calls } = fakeClient(() => ({ error: MISSING_TABLE }));
    expect(await probeTourSchema(c)).toBe(false);
    expect(await fetchSeenTours('u1', c)).toBeNull();
    await markSeenRemote('u1', 'home', c);
    expect(calls.filter((x) => x.op === 'upsert')).toHaveLength(0);
    await trackTourEvent('tour_started', 'home', 1, 6);
    expect(track).not.toHaveBeenCalled();
  });

  it('probes only once per page load', async () => {
    const { c, calls } = fakeClient(() => ({ error: MISSING_TABLE }));
    await probeTourSchema(c);
    await probeTourSchema(c);
    await fetchSeenTours('u1', c);
    expect(calls.filter((x) => x.op === 'select')).toHaveLength(1);
  });
});

describe('after the migration', () => {
  it('a guest hidden by RLS (no rows, no error) still counts as "schema present"', async () => {
    const { c } = fakeClient(() => ({ data: [] }));
    expect(await probeTourSchema(c)).toBe(true);
  });

  it('reads the account’s seen tours and mirrors the id set', async () => {
    const { c } = fakeClient((op) => (op === 'select' ? { data: [{ tour_id: 'home' }, { tour_id: 'chat' }] } : {}));
    const seen = await fetchSeenTours('u1', c);
    expect(seen).toEqual(new Set(['home', 'chat']));
  });

  it('marks a tour seen with an idempotent upsert on (user, tour)', async () => {
    const { c, calls } = fakeClient(() => ({ data: [] }));
    await markSeenRemote('u1', 'services', c);
    const up = calls.find((x) => x.op === 'upsert');
    expect(up?.args[0]).toEqual({ user_id: 'u1', tour_id: 'services' });
    expect(up?.args[1]).toMatchObject({ onConflict: 'user_id,tour_id', ignoreDuplicates: true });
  });

  it('sends tour events with the step reached, through the normal analytics pipe', async () => {
    const { c } = fakeClient(() => ({ data: [] }));
    await probeTourSchema(c);
    await trackTourEvent('tour_skipped', 'home', 3, 6);
    expect(track).toHaveBeenCalledWith('tour_skipped', { target: 'home', meta: { step: 3, steps: 6 } });
  });
});
