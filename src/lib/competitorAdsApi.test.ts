import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * adminCompetitorAds — imports are additive (never overwritten), and each
 * import must correctly flag ads whose ad_library_id was already seen in an
 * EARLIER import for the same service, so staff can tell "still running"
 * from "brand new" competitor ads at a glance.
 */

interface Rec { table: string; op: string; args: unknown[] }
const calls: Rec[] = [];
let existingAdIds: { ad_library_id: string }[] = [];
let insertedImport: Record<string, unknown> | null = null;
let importsRows: Record<string, unknown>[] = [];
let adsRows: Record<string, unknown>[] = [];
let insertAdsError: { message: string } | null = null;

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {
    select: (cols: string) => {
      calls.push({ table, op: 'select', args: [cols] });
      return builder;
    },
    insert: (rows: unknown) => {
      calls.push({ table, op: 'insert', args: [rows] });
      if (table === 'competitor_ad_imports') {
        insertedImport = { id: 'import-new', ...(Array.isArray(rows) ? rows[0] : rows) as Record<string, unknown> };
        return {
          select: () => ({
            single: () => Promise.resolve({ data: insertedImport, error: null }),
          }),
        };
      }
      // competitor_ads bulk insert
      return Promise.resolve({ data: null, error: insertAdsError });
    },
    eq: (c: string, v: unknown) => {
      calls.push({ table, op: 'eq', args: [c, v] });
      return builder;
    },
    order: (c: string, o: unknown) => {
      calls.push({ table, op: 'order', args: [c, o] });
      const data = table === 'competitor_ad_imports' ? importsRows : adsRows;
      return Promise.resolve({ data, error: null });
    },
    limit: (n: number) => {
      calls.push({ table, op: 'limit', args: [n] });
      return Promise.resolve({ data: importsRows.slice(0, n), error: null });
    },
    then: (resolve: (v: { data: unknown; error: null }) => void) => {
      // select().eq() with no further chain (used by the existing-ids lookup)
      resolve({ data: table === 'competitor_ads' ? existingAdIds : [], error: null });
    },
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'admin-1' } } } }) },
  },
  supabaseEnabled: true,
}));

import { adminCompetitorAds } from './api';
import type { CompetitorAdRow } from './api';

const ROW = (over: Partial<CompetitorAdRow> = {}): CompetitorAdRow => ({
  adLibraryId: 'lib-1',
  advertiserName: 'شركة أ',
  status: 'Active',
  startedOn: '27 Jul 2021 - 27 Jul 2021',
  platforms: 'Facebook, Instagram',
  contentType: 'صورة',
  adText: 'نص الإعلان',
  adUrl: 'https://www.facebook.com/ads/library/?id=1',
  amountSpent: 'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
  searchLanguage: 'العربية',
  searchKeyword: 'إقامة سياحية في تركيا',
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  existingAdIds = [];
  insertedImport = null;
  importsRows = [];
  adsRows = [];
  insertAdsError = null;
});

describe('importRows', () => {
  it('creates an import row scoped to the given service', async () => {
    await adminCompetitorAds.importRows('res-tourist', 'ads.xlsx', [ROW()]);

    const insertCall = calls.find((c) => c.table === 'competitor_ad_imports' && c.op === 'insert');
    expect(insertCall).toBeDefined();
    const payload = (insertCall!.args[0] as Record<string, unknown>[])[0];
    expect(payload.service_id).toBe('res-tourist');
    expect(payload.file_name).toBe('ads.xlsx');
    expect(payload.row_count).toBe(1);
  });

  it('flags an ad as NOT seen before when its ad_library_id is new', async () => {
    existingAdIds = [];

    await adminCompetitorAds.importRows('res-tourist', 'ads.xlsx', [ROW({ adLibraryId: 'lib-new' })]);

    const adsInsert = calls.find((c) => c.table === 'competitor_ads' && c.op === 'insert');
    const rows = adsInsert!.args[0] as Record<string, unknown>[];
    expect(rows[0].seen_in_previous_import).toBe(false);
  });

  it('flags an ad as seen before when its ad_library_id already exists for this service', async () => {
    existingAdIds = [{ ad_library_id: 'lib-old' }];

    await adminCompetitorAds.importRows('res-tourist', 'ads.xlsx', [ROW({ adLibraryId: 'lib-old' })]);

    const adsInsert = calls.find((c) => c.table === 'competitor_ads' && c.op === 'insert');
    const rows = adsInsert!.args[0] as Record<string, unknown>[];
    expect(rows[0].seen_in_previous_import).toBe(true);
  });

  it('tags every inserted ad with the new import id and the service id', async () => {
    await adminCompetitorAds.importRows('res-tourist', 'ads.xlsx', [ROW({ adLibraryId: 'a' }), ROW({ adLibraryId: 'b' })]);

    const adsInsert = calls.find((c) => c.table === 'competitor_ads' && c.op === 'insert');
    const rows = adsInsert!.args[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.import_id === 'import-new')).toBe(true);
    expect(rows.every((r) => r.service_id === 'res-tourist')).toBe(true);
  });

  it('rejects an empty file rather than creating an empty import', async () => {
    await expect(adminCompetitorAds.importRows('res-tourist', 'ads.xlsx', [])).rejects.toThrow();

    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('listImports / latestImport', () => {
  it('lists imports for a service, newest first', async () => {
    importsRows = [
      { id: 'i2', service_id: 'res-tourist', file_name: 'b.xlsx', row_count: 5, imported_by: null, imported_at: '2026-08-20T00:00:00Z' },
      { id: 'i1', service_id: 'res-tourist', file_name: 'a.xlsx', row_count: 3, imported_by: null, imported_at: '2026-08-01T00:00:00Z' },
    ];

    const out = await adminCompetitorAds.listImports('res-tourist');

    expect(out.map((i) => i.id)).toEqual(['i2', 'i1']);
    expect(out[0].rowCount).toBe(5);
  });

  it('returns null from latestImport when no import exists yet', async () => {
    importsRows = [];

    const out = await adminCompetitorAds.latestImport('res-tourist');

    expect(out).toBeNull();
  });

  it('returns the newest import from latestImport', async () => {
    importsRows = [{ id: 'i2', service_id: 'res-tourist', file_name: 'b.xlsx', row_count: 5, imported_by: null, imported_at: '2026-08-20T00:00:00Z' }];

    const out = await adminCompetitorAds.latestImport('res-tourist');

    expect(out?.id).toBe('i2');
  });
});

describe('listAds', () => {
  it('maps every column to its camelCase field', async () => {
    adsRows = [{
      id: 'ad-1', import_id: 'i1', service_id: 'res-tourist', ad_library_id: 'lib-1',
      advertiser_name: 'شركة أ', status: 'Active', started_on: '27 Jul 2021', platforms: 'Facebook',
      content_type: 'صورة', ad_text: 'نص', ad_url: 'https://x', amount_spent: 'غير متاح',
      search_language: 'العربية', search_keyword: 'كلمة', seen_in_previous_import: true, created_at: '2026-08-20T00:00:00Z',
    }];

    const out = await adminCompetitorAds.listAds('i1');

    expect(out).toEqual([{
      id: 'ad-1', importId: 'i1', serviceId: 'res-tourist', adLibraryId: 'lib-1',
      advertiserName: 'شركة أ', status: 'Active', startedOn: '27 Jul 2021', platforms: 'Facebook',
      contentType: 'صورة', adText: 'نص', adUrl: 'https://x', amountSpent: 'غير متاح',
      searchLanguage: 'العربية', searchKeyword: 'كلمة', seenInPreviousImport: true, createdAt: '2026-08-20T00:00:00Z',
    }]);
  });
});
