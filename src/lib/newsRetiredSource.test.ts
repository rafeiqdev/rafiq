import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The public news feed must never serve rows left behind by the retired
 * Telegram mirror.
 *
 * What went wrong: that mirror copied another channel's posts wholesale, and
 * 176 of them WERE the public news section — every one linking out to
 * t.me/<that channel> as its "read more", 162 still carrying that channel's
 * own "اشترك بقناة التليغرام" sign-off, and 65 with no headline at all, just
 * "🇹🇷 خبر عاجل 🇹🇷" repeated down the page. Rafiq's news section was
 * advertising a competitor and handing them the traffic.
 *
 * This pins the QUERY, not the rendering. A page test mocks the api module and
 * asserts the UI shows whatever it is handed, so it would pass on a build that
 * serves every one of those rows. The filter is the fix, so the filter is what
 * gets tested.
 */

interface Call {
  table: string;
  op: string;
  args: unknown[];
}

const calls: Call[] = [];
let rows: unknown[] = [];
let single = false;

function makeBuilder(table: string) {
  const builder = {
    select(cols: string) {
      calls.push({ table, op: 'select', args: [cols] });
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.push({ table, op: 'eq', args: [column, value] });
      return builder;
    },
    neq(column: string, value: unknown) {
      calls.push({ table, op: 'neq', args: [column, value] });
      return builder;
    },
    order(column: string, opts: unknown) {
      calls.push({ table, op: 'order', args: [column, opts] });
      return builder;
    },
    limit(n: number) {
      calls.push({ table, op: 'limit', args: [n] });
      return Promise.resolve({ data: rows, error: null });
    },
    maybeSingle() {
      calls.push({ table, op: 'maybeSingle', args: [] });
      single = true;
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
  supabaseEnabled: true,
}));

import { news } from './api';

const hasFilter = (op: string, column: string, value: unknown) =>
  calls.some((c) => c.op === op && c.args[0] === column && c.args[1] === value);

describe('public news feed excludes the retired Telegram mirror', () => {
  beforeEach(() => {
    calls.length = 0;
    rows = [];
    single = false;
  });

  it('news.latest() filters out source = telegram, and still requires published', async () => {
    await news.latest(60);

    expect(hasFilter('neq', 'source', 'telegram')).toBe(true);
    expect(hasFilter('eq', 'published', true)).toBe(true);
  });

  it('news.byId() filters it out too, so an old article URL stops resolving', async () => {
    rows = [];
    const post = await news.byId('a-retired-telegram-post');

    expect(hasFilter('neq', 'source', 'telegram')).toBe(true);
    expect(hasFilter('eq', 'published', true)).toBe(true);
    expect(single).toBe(true);
    expect(post).toBeNull();
  });

  it('still returns the rows the query does hand back', async () => {
    rows = [
      {
        id: 'n1',
        title: 'انطلاق المهرجان الثقافي الأطول في تركيا',
        body: 'نص الخبر',
        url: 'https://www.turizmajansi.com/haber/x',
        image_url: null,
        source: 'rss',
        published: true,
        created_at: '2026-09-06T00:00:00Z',
        translations: { en: { title: 'Festival', body: 'Body' } },
      },
    ];

    const [post] = await news.latest(5);
    expect(post.id).toBe('n1');
    expect(post.source).toBe('rss');
    expect(post.translations.en.title).toBe('Festival');
  });
});
