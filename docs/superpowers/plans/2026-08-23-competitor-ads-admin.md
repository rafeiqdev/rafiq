# Competitor Ads Admin Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin staff import Meta Ads Library competitor data (.xlsx) per catalog service, browse it grouped by advertiser company, keep every past import instead of overwriting it, flag ads seen again across imports, and jump straight into a service's competitor view from an incoming customer request.

**Architecture:** Two new Supabase tables (`competitor_ad_imports`, `competitor_ad_ads`... — see naming note below) gated by the same `is_admin()` RLS pattern every other admin table already uses. All reads and writes go through the existing client-side `sb()` Supabase client directly, exactly like `AdminServicesManager` and `ServiceRequestsManager` already do — **no new serverless endpoint**. (The design spec at `docs/superpowers/specs/2026-08-23-competitor-ads-admin-design.md` proposed an `api/admin/*.ts` endpoint mirroring `medical-translate.ts`; that pattern exists there only to hide a third-party Gemini API key from the browser. This feature has no secret to hide — RLS already restricts the tables to admins — so a server hop would just be an unnecessary layer inconsistent with every other admin CRUD manager in this codebase. Deviation noted here per the "follow established patterns" rule.) A new admin tab component follows the existing one-component-per-tab pattern. The `.xlsx` file is parsed client-side with SheetJS (`xlsx` package), split into a pure, fully-unit-testable row-mapping function plus a thin file-reading wrapper.

**Tech Stack:** React 18.3.1, TypeScript 5.6.3 (strict), Vite 5.4.11, Vitest 2.1.9 + @testing-library/react 16.3.2, Supabase (Postgres + RLS), Tailwind (utility classes only, no new CSS files), react-i18next, `xlsx` (SheetJS, new dependency).

## Global Constraints

- Every new/changed table or column follows the existing snake_case SQL / camelCase TS convention (see `ServiceRequestRow` → `ServiceRequest` mapping in `src/lib/api.ts` for the exact pattern to mirror).
- All Supabase access goes through the shared `sb()` helper (`src/lib/api.ts:111`) — never import `./supabase` directly in a component.
- Every admin-facing string goes through `useTranslation()`'s `t()` — no hardcoded UI text — and gets a real translation added to all 4 locale files (`src/i18n/locales/ar.json`, `en.json`, `ru.json`, `fa.json`) in the same task that introduces the key. No placeholder or English-only strings left for "later".
- `started_on` and `amount_spent` are always stored and displayed as free text, never parsed as a date or currency (confirmed unreliable in the real source data — see spec).
- Tap targets in any new interactive element follow the codebase's existing `min-h-[44px]` convention for primary actions (see `AdminNewRequests.tsx`).
- Migration files are **not** applied automatically in this project — `supabase/migrations/*.sql` files are pasted into the Supabase SQL Editor by hand (existing project convention). Task 1 ends with the file written and committed, not "run", and says so explicitly.
- No test file is added for `api/**/*.ts` serverless functions in this repo (confirmed: `vitest.config.ts`'s `include` is `src/**/*.test.{ts,tsx}` only, and `api/admin/medical-translate.ts` itself has no test) — moot here since this plan adds no serverless endpoint, but noted in case a future task adds one.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260823_competitor_ads.sql` | New tables + RLS (create) |
| `src/lib/api.ts` (modified) | `ServiceRequestRow`/`ServiceRequest` gain `serviceId`; new `CompetitorAdImport`/`CompetitorAd`/`CompetitorAdRow` types + `adminCompetitorAds` object |
| `src/lib/adminRequestOwner.test.ts` (modified) | Extends existing coverage with `serviceId` passthrough |
| `src/lib/competitorAdsApi.test.ts` (new) | Tests `adminCompetitorAds` |
| `src/lib/competitorAdsImport.ts` (new) | Pure `.xlsx`-row-to-`CompetitorAdRow[]` mapping (fully unit-testable, no file I/O) |
| `src/lib/competitorAdsImport.test.ts` (new) | Tests the pure mapping function |
| `src/lib/competitorAdsFile.ts` (new) | Thin wrapper: `File` → parsed rows, using `xlsx`. Not unit-tested (file I/O boundary, same convention as `OfferImagesField`'s upload handler) |
| `src/components/admin/CompetitorAdCard.tsx` (new) | One advertiser's card: summary + expand to full ad list |
| `src/components/admin/CompetitorAdCard.test.tsx` (new) | Tests the card |
| `src/components/admin/CompetitorAdsManager.tsx` (new) | The tab: service picker, import flow, previous-versions switcher, renders cards |
| `src/components/admin/CompetitorAdsManager.test.tsx` (new) | Tests the tab |
| `src/pages/Admin.tsx` (modified) | New `'competitors'` tab wired into `TABS`, `TAB_LABEL`, `TAB_ICON`, `NAV_GROUPS`, render switch, `?service=` passthrough |
| `src/components/ServiceRequestsManager.tsx` (modified) | "شوف منافسين هاي الخدمة" link per row |
| `src/components/AdminNewRequests.tsx` (modified) | Same link in the compact preview |
| `src/i18n/locales/{ar,en,ru,fa}.json` (modified) | New `admin.competitors.*` keys |
| `package.json` (modified) | New `xlsx` dependency |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260823_competitor_ads.sql`

**Interfaces:**
- Produces: tables `public.competitor_ad_imports`, `public.competitor_ads` — column names and types exactly as below, consumed by every later task's Supabase calls.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================================
-- Competitor ads: staff-imported Meta Ads Library snapshots, browsable per
-- catalog service and grouped by advertiser. Every import is kept — never
-- overwritten — so staff can flag "we saw this ad before" across snapshots
-- and revisit older imports. See docs/superpowers/specs/2026-08-23-
-- competitor-ads-admin-design.md for the full design.
-- ============================================================================

create table public.competitor_ad_imports (
  id           uuid primary key default gen_random_uuid(),
  service_id   text not null,       -- matches src/data/services.ts ids, e.g. 'res-tourist'
  file_name    text,
  row_count    int not null default 0,
  imported_by  uuid references public.profiles(id),
  imported_at  timestamptz not null default now()
);

create table public.competitor_ads (
  id                      uuid primary key default gen_random_uuid(),
  import_id               uuid not null references public.competitor_ad_imports(id) on delete cascade,
  service_id              text not null,   -- denormalized from the parent import, for direct filtering
  ad_library_id           text not null,   -- Meta's own ID; the cross-import duplicate-detection key
  advertiser_name         text not null,
  status                  text,            -- 'Active' | 'Inactive' | whatever Meta returned
  started_on              text,            -- free text, format varies in the source — never parsed as a date
  platforms               text,
  content_type            text,
  ad_text                 text,
  ad_url                  text,
  amount_spent            text,            -- free text note, not currency (Meta hides real spend for standard ads)
  search_language         text,
  search_keyword          text,
  seen_in_previous_import boolean not null default false,
  created_at              timestamptz not null default now()
);

create index competitor_ads_service_import_idx on public.competitor_ads (service_id, import_id);
create index competitor_ads_service_library_idx on public.competitor_ads (service_id, ad_library_id);
create index competitor_ad_imports_service_idx on public.competitor_ad_imports (service_id, imported_at desc);

alter table public.competitor_ad_imports enable row level security;
alter table public.competitor_ads enable row level security;

-- Admin-only, matching the existing service_requests RLS pattern
-- (supabase/migrations/20260721_base_tables_reconstructed.sql).
drop policy if exists "cai admin all" on public.competitor_ad_imports;
create policy "cai admin all" on public.competitor_ad_imports
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ca admin all" on public.competitor_ads;
create policy "ca admin all" on public.competitor_ads
  for all using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Commit**

This file is written and committed but **not run** — per this project's convention, migrations are pasted into the Supabase SQL Editor by hand. Say so plainly to whoever is executing this plan; do not attempt to apply it via any Supabase MCP tool or CLI command.

```bash
git add supabase/migrations/20260823_competitor_ads.sql
git commit -m "$(cat <<'EOF'
feat(db): add competitor_ad_imports and competitor_ads tables

Admin-only (RLS via is_admin(), same pattern as service_requests). Every
import is kept, never overwritten, so staff can browse previous snapshots
and detect ads that reappear across imports. Not yet applied to the live
database — paste into the Supabase SQL Editor per this project's existing
migration workflow.
EOF
)"
```

---

### Task 2: Add `serviceId` to `ServiceRequest`

**Files:**
- Modify: `src/lib/api.ts:2153-2158` (`ServiceRequestRow` interface)
- Modify: `src/lib/api.ts:2132-2151` (`ServiceRequest` interface)
- Modify: `src/lib/api.ts:2273-2304` (`serviceRequests.adminList()`)
- Modify: `src/lib/adminRequestOwner.test.ts`

**Interfaces:**
- Produces: `ServiceRequest.serviceId: string | null`, consumed by Task 8 (the "شوف منافسين" link).

**Context:** The underlying `service_requests` table already has a `service_id` column (confirmed in `supabase/migrations/20260721_base_tables_reconstructed.sql:21`, populated by `serviceRequests.create()` at `src/lib/api.ts:2171`) — it is simply never selected for admin display. This task only adds it to the read path.

- [ ] **Step 1: Extend the existing test file with a failing assertion**

Add this test inside the existing `describe('adminList attaches the owning account', ...)` block in `src/lib/adminRequestOwner.test.ts` (after the `'selects customer_id'` test):

```ts
  it('selects service_id', async () => {
    await serviceRequests.adminList();

    expect(String(calls.find((c) => c.op === 'select')?.args[0])).toContain('service_id');
  });

  it('carries serviceId through to the row', async () => {
    requestRows = [{ ...OWNED_A, service_id: 'res-tax' }];
    profileRows = [{ id: 'cac6dcb8', name: 'محمد', email: 'm@example.com' }];

    const out = await serviceRequests.adminList();

    expect(out[0].serviceId).toBe('res-tax');
  });

  it('leaves serviceId null when the column is absent (pre-migration rows)', async () => {
    requestRows = [{ ...OWNED_A, service_id: null }];
    profileRows = [{ id: 'cac6dcb8', name: 'محمد', email: 'm@example.com' }];

    const out = await serviceRequests.adminList();

    expect(out[0].serviceId).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/adminRequestOwner.test.ts`
Expected: the 3 new tests FAIL — `serviceId` is `undefined`, not `'res-tax'`/`null`, and the select-column assertion fails because `service_id` isn't in the query yet.

- [ ] **Step 3: Update the `ServiceRequestRow` interface**

In `src/lib/api.ts`, change:

```ts
interface ServiceRequestRow {
  id: string; name: string; phone: string; message: string | null;
  service_title: string | null; category: string | null; service_type: string | null;
  status: string; created_at: string;
}
```

to:

```ts
interface ServiceRequestRow {
  id: string; name: string; phone: string; message: string | null;
  service_id: string | null; service_title: string | null; category: string | null; service_type: string | null;
  status: string; created_at: string;
}
```

- [ ] **Step 4: Update the `ServiceRequest` interface**

In `src/lib/api.ts`, change:

```ts
export interface ServiceRequest {
  id: string;
  name: string;
  phone: string;
  message?: string;
  serviceTitle: string;
  category: string;
  serviceType: string;
  status: string;
  createdAt: string;
```

to:

```ts
export interface ServiceRequest {
  id: string;
  name: string;
  phone: string;
  message?: string;
  /** Catalog id (src/data/services.ts), null on rows predating this column. */
  serviceId: string | null;
  serviceTitle: string;
  category: string;
  serviceType: string;
  status: string;
  createdAt: string;
```

- [ ] **Step 5: Update `adminList()`'s select and mapping**

In `src/lib/api.ts`, inside `serviceRequests.adminList()`, change:

```ts
      .select('id,name,phone,message,service_title,category,service_type,status,customer_id,created_at')
```

to:

```ts
      .select('id,name,phone,message,service_id,service_title,category,service_type,status,customer_id,created_at')
```

and change the return mapping:

```ts
      return {
        id: r.id, name: r.name, phone: r.phone, message: r.message ?? undefined,
        serviceTitle: r.service_title ?? '', category: r.category ?? '', serviceType: r.service_type ?? '',
        status: r.status, createdAt: r.created_at,
        customerId: r.customer_id ?? null,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
      };
```

to:

```ts
      return {
        id: r.id, name: r.name, phone: r.phone, message: r.message ?? undefined,
        serviceId: r.service_id ?? null,
        serviceTitle: r.service_title ?? '', category: r.category ?? '', serviceType: r.service_type ?? '',
        status: r.status, createdAt: r.created_at,
        customerId: r.customer_id ?? null,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
      };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/adminRequestOwner.test.ts`
Expected: all tests PASS (the 3 new ones plus every pre-existing one in the file — check none regressed).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (`AdminNewRequests.tsx`'s local `row()` test helper and any other `ServiceRequest`-shaped literal will need `serviceId` — those are addressed in Task 8's test file; if `tsc` flags `AdminNewRequests.test.tsx`'s `row()` helper here, that's expected and gets fixed in Task 8, not this one — confirm the only new errors are in that one file before proceeding.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/api.ts src/lib/adminRequestOwner.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): select service_id on the admin service-requests queue

The service_requests table has always stored service_id (populated on every
submission since serviceRequests.create()) but the admin read path never
selected it. Needed by the upcoming competitor-ads link — a request needs
its catalog service id, not just its display title, to point at the right
competitor data.
EOF
)"
```

---

### Task 3: `adminCompetitorAds` in `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts` (add types + `adminCompetitorAds` object, near the other `admin*` exports — e.g. after `adminServiceOffers` at line 2945)
- Create: `src/lib/competitorAdsApi.test.ts`

**Interfaces:**
- Consumes: `sb()` (line 111), `fail()` (line 130), `sessionUser()` (line 118) — all already in this file.
- Produces:
  - `interface CompetitorAdImport { id: string; serviceId: string; fileName: string | null; rowCount: number; importedBy: string | null; importedAt: string }`
  - `interface CompetitorAd { id: string; importId: string; serviceId: string; adLibraryId: string; advertiserName: string; status: string | null; startedOn: string | null; platforms: string | null; contentType: string | null; adText: string | null; adUrl: string | null; amountSpent: string | null; searchLanguage: string | null; searchKeyword: string | null; seenInPreviousImport: boolean; createdAt: string }`
  - `interface CompetitorAdRow { adLibraryId: string; advertiserName: string; status: string | null; startedOn: string | null; platforms: string | null; contentType: string | null; adText: string | null; adUrl: string | null; amountSpent: string | null; searchLanguage: string | null; searchKeyword: string | null }` — consumed by Task 4 (the file parser produces this shape).
  - `adminCompetitorAds.listImports(serviceId: string): Promise<CompetitorAdImport[]>`
  - `adminCompetitorAds.latestImport(serviceId: string): Promise<CompetitorAdImport | null>`
  - `adminCompetitorAds.listAds(importId: string): Promise<CompetitorAd[]>`
  - `adminCompetitorAds.importRows(serviceId: string, fileName: string, rows: CompetitorAdRow[]): Promise<CompetitorAdImport>` — consumed by Task 6 (the import UI).

- [ ] **Step 1: Write the failing test file**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/competitorAdsApi.test.ts`
Expected: FAIL — `adminCompetitorAds` is not exported from `./api` yet.

- [ ] **Step 3: Implement `adminCompetitorAds`**

Add to `src/lib/api.ts`, after the `adminServiceOffers` export block (ends at line 2945 with the closing `};` before `export const adminBroadcast = {`):

```ts
// ---------- competitor ads (Meta Ads Library imports, per catalog service) --

interface CompetitorAdImportRow {
  id: string; service_id: string; file_name: string | null; row_count: number;
  imported_by: string | null; imported_at: string;
}
interface CompetitorAdRowDb {
  id: string; import_id: string; service_id: string; ad_library_id: string; advertiser_name: string;
  status: string | null; started_on: string | null; platforms: string | null; content_type: string | null;
  ad_text: string | null; ad_url: string | null; amount_spent: string | null;
  search_language: string | null; search_keyword: string | null;
  seen_in_previous_import: boolean; created_at: string;
}

export interface CompetitorAdImport {
  id: string;
  serviceId: string;
  fileName: string | null;
  rowCount: number;
  importedBy: string | null;
  importedAt: string;
}

export interface CompetitorAd {
  id: string;
  importId: string;
  serviceId: string;
  adLibraryId: string;
  advertiserName: string;
  status: string | null;
  startedOn: string | null;
  platforms: string | null;
  contentType: string | null;
  adText: string | null;
  adUrl: string | null;
  amountSpent: string | null;
  searchLanguage: string | null;
  searchKeyword: string | null;
  seenInPreviousImport: boolean;
  createdAt: string;
}

/** One row parsed from an uploaded .xlsx, before it's tied to an import batch. */
export interface CompetitorAdRow {
  adLibraryId: string;
  advertiserName: string;
  status: string | null;
  startedOn: string | null;
  platforms: string | null;
  contentType: string | null;
  adText: string | null;
  adUrl: string | null;
  amountSpent: string | null;
  searchLanguage: string | null;
  searchKeyword: string | null;
}

function toCompetitorAdImport(r: CompetitorAdImportRow): CompetitorAdImport {
  return {
    id: r.id, serviceId: r.service_id, fileName: r.file_name, rowCount: r.row_count,
    importedBy: r.imported_by, importedAt: r.imported_at,
  };
}

function toCompetitorAd(r: CompetitorAdRowDb): CompetitorAd {
  return {
    id: r.id, importId: r.import_id, serviceId: r.service_id, adLibraryId: r.ad_library_id,
    advertiserName: r.advertiser_name, status: r.status, startedOn: r.started_on, platforms: r.platforms,
    contentType: r.content_type, adText: r.ad_text, adUrl: r.ad_url, amountSpent: r.amount_spent,
    searchLanguage: r.search_language, searchKeyword: r.search_keyword,
    seenInPreviousImport: r.seen_in_previous_import, createdAt: r.created_at,
  };
}

export const adminCompetitorAds = {
  /** All imports for a service, newest first — drives the "previous versions" list. */
  async listImports(serviceId: string): Promise<CompetitorAdImport[]> {
    const { data, error } = await sb()
      .from('competitor_ad_imports')
      .select('id,service_id,file_name,row_count,imported_by,imported_at')
      .eq('service_id', serviceId)
      .order('imported_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as CompetitorAdImportRow[]).map(toCompetitorAdImport);
  },

  /** The import the manager tab shows by default — null when nothing's been imported yet. */
  async latestImport(serviceId: string): Promise<CompetitorAdImport | null> {
    const { data, error } = await sb()
      .from('competitor_ad_imports')
      .select('id,service_id,file_name,row_count,imported_by,imported_at')
      .eq('service_id', serviceId)
      .order('imported_at', { ascending: false })
      .limit(1);
    if (error) fail(error);
    const rows = (data ?? []) as CompetitorAdImportRow[];
    return rows.length ? toCompetitorAdImport(rows[0]) : null;
  },

  /** Every ad belonging to one import batch (current or a past "previous version"). */
  async listAds(importId: string): Promise<CompetitorAd[]> {
    const { data, error } = await sb()
      .from('competitor_ads')
      .select(
        'id,import_id,service_id,ad_library_id,advertiser_name,status,started_on,platforms,content_type,ad_text,ad_url,amount_spent,search_language,search_keyword,seen_in_previous_import,created_at',
      )
      .eq('import_id', importId)
      .order('advertiser_name', { ascending: true });
    if (error) fail(error);
    return ((data ?? []) as CompetitorAdRowDb[]).map(toCompetitorAd);
  },

  /**
   * Records a new import batch and its ads. Never touches earlier imports —
   * they stay exactly as they were, browsable via listImports(). Each row is
   * flagged seenInPreviousImport when its ad_library_id already exists among
   * this service's PRIOR ads, so staff can tell a persistent competitor ad
   * from a brand-new one at a glance.
   */
  async importRows(serviceId: string, fileName: string, rows: CompetitorAdRow[]): Promise<CompetitorAdImport> {
    if (rows.length === 0) throw new ApiError('empty_import', 400);

    const existing = await sb().from('competitor_ads').select('ad_library_id').eq('service_id', serviceId);
    if (existing.error) fail(existing.error);
    const seenIds = new Set(((existing.data ?? []) as { ad_library_id: string }[]).map((r) => r.ad_library_id));

    const importedBy = (await sessionUser())?.id ?? null;
    const importInsert = await sb()
      .from('competitor_ad_imports')
      .insert([{ service_id: serviceId, file_name: fileName, row_count: rows.length, imported_by: importedBy }])
      .select()
      .single();
    if (importInsert.error) fail(importInsert.error);
    const importRow = importInsert.data as CompetitorAdImportRow;

    const adsPayload = rows.map((r) => ({
      import_id: importRow.id,
      service_id: serviceId,
      ad_library_id: r.adLibraryId,
      advertiser_name: r.advertiserName,
      status: r.status,
      started_on: r.startedOn,
      platforms: r.platforms,
      content_type: r.contentType,
      ad_text: r.adText,
      ad_url: r.adUrl,
      amount_spent: r.amountSpent,
      search_language: r.searchLanguage,
      search_keyword: r.searchKeyword,
      seen_in_previous_import: seenIds.has(r.adLibraryId),
    }));
    const adsInsert = await sb().from('competitor_ads').insert(adsPayload);
    if (adsInsert.error) fail(adsInsert.error);

    return toCompetitorAdImport(importRow);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/competitorAdsApi.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/lib/competitorAdsApi.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add adminCompetitorAds data layer

Direct client-side Supabase calls under the new tables' admin-only RLS —
same pattern as every other admin manager in this file (AdminServicesManager,
ServiceRequestsManager), not a server endpoint, since there's no secret to
hide here. importRows() never overwrites a prior import and flags each ad
seenInPreviousImport by checking its ad_library_id against everything already
stored for that service.
EOF
)"
```

---

### Task 4: `.xlsx` row parsing

**Files:**
- Modify: `package.json` (add `xlsx` dependency)
- Create: `src/lib/competitorAdsImport.ts`
- Create: `src/lib/competitorAdsImport.test.ts`
- Create: `src/lib/competitorAdsFile.ts`

**Interfaces:**
- Consumes: `CompetitorAdRow` (Task 3).
- Produces:
  - `mapCompetitorAdsSheet(rows: unknown[][]): { rows: CompetitorAdRow[]; skipped: number }` — pure, unit-tested.
  - `readCompetitorAdsFile(file: File): Promise<{ rows: CompetitorAdRow[]; skipped: number }>` — thin `xlsx` wrapper, consumed by Task 6. Not unit-tested (file-I/O boundary; same convention as `OfferImagesField`'s upload handler in `ServiceRequestsManager.tsx`, which also isn't unit-tested).

**Context:** Real column order, confirmed from the source file (see the design spec, "Data source shape"): index 0 اسم الخدمة (ignored — staff pick the service from the catalog picker, not this free-text column), 1 اللغة المستخدمة بالبحث, 2 الكلمة المفتاحية المستخدمة, 3 رقم الإعلان Library ID, 4 اسم الصفحة المعلنة, 5 حالة الإعلان, 6 تاريخ بداية عرض الإعلان, 7 المنصات, 8 نوع المحتوى الإبداعي, 9 النص الكامل للإعلان, 10 رابط الإعلان المباشر, 11 المبلغ المصروف. Row 0 is the header row and is always skipped.

- [ ] **Step 1: Add the `xlsx` dependency**

```bash
npm install xlsx@^0.18.5
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { mapCompetitorAdsSheet } from './competitorAdsImport';

/**
 * Maps the raw "الإعلانات" sheet (array-of-arrays, header row included) to
 * CompetitorAdRow[]. Columns are matched by INDEX, not by Arabic header text
 * — header-string matching is fragile against formatting differences between
 * exports, index position is not.
 */

const HEADER = [
  'اسم الخدمة', 'اللغة المستخدمة بالبحث', 'الكلمة المفتاحية المستخدمة', 'رقم الإعلان Library ID',
  'اسم الصفحة المعلنة (Advertiser / Page name)', 'حالة الإعلان (Active أو Inactive)',
  'تاريخ بداية عرض الإعلان (Started running on)', 'المنصات', 'نوع المحتوى الإبداعي',
  'النص الكامل للإعلان', 'رابط الإعلان المباشر', 'المبلغ المصروف',
];

const REAL_ROW = [
  'إقامة سياحية', 'العربية', 'إقامة سياحية في تركيا', '202993668427755',
  'عبدالله الحمصي', 'Inactive', '27 Jul 2021 - 27 Jul 2021', 'غير متاح', 'نص فقط',
  "This content was removed because it didn't follow our\n.",
  'https://www.facebook.com/ads/library/?id=202993668427755',
  'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
];

describe('mapCompetitorAdsSheet', () => {
  it('skips the header row', () => {
    const { rows } = mapCompetitorAdsSheet([HEADER, REAL_ROW]);

    expect(rows).toHaveLength(1);
  });

  it('maps every column to the right field, by position', () => {
    const { rows } = mapCompetitorAdsSheet([HEADER, REAL_ROW]);

    expect(rows[0]).toEqual({
      adLibraryId: '202993668427755',
      advertiserName: 'عبدالله الحمصي',
      status: 'Inactive',
      startedOn: '27 Jul 2021 - 27 Jul 2021',
      platforms: 'غير متاح',
      contentType: 'نص فقط',
      adText: "This content was removed because it didn't follow our\n.",
      adUrl: 'https://www.facebook.com/ads/library/?id=202993668427755',
      amountSpent: 'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
      searchLanguage: 'العربية',
      searchKeyword: 'إقامة سياحية في تركيا',
    });
  });

  it('skips a row with no Library ID rather than importing a junk row', () => {
    const blank = [...REAL_ROW]; blank[3] = '';
    const { rows, skipped } = mapCompetitorAdsSheet([HEADER, blank]);

    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips an entirely empty trailing row', () => {
    const { rows, skipped } = mapCompetitorAdsSheet([HEADER, REAL_ROW, []]);

    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('coerces a numeric-looking Library ID to a string', () => {
    // SheetJS returns numeric-looking cells as JS numbers, not strings.
    const numericIdRow = [...REAL_ROW]; numericIdRow[3] = 202993668427755;
    const { rows } = mapCompetitorAdsSheet([HEADER, numericIdRow]);

    expect(rows[0].adLibraryId).toBe('202993668427755');
    expect(typeof rows[0].adLibraryId).toBe('string');
  });

  it('returns an empty result for a sheet with only a header row', () => {
    const { rows, skipped } = mapCompetitorAdsSheet([HEADER]);

    expect(rows).toEqual([]);
    expect(skipped).toBe(0);
  });

  it('returns an empty result for a completely empty sheet', () => {
    const { rows, skipped } = mapCompetitorAdsSheet([]);

    expect(rows).toEqual([]);
    expect(skipped).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/competitorAdsImport.test.ts`
Expected: FAIL — `competitorAdsImport.ts` doesn't exist yet.

- [ ] **Step 4: Implement the pure mapper**

Create `src/lib/competitorAdsImport.ts`:

```ts
import type { CompetitorAdRow } from './api';

/**
 * Maps the raw "الإعلانات" sheet — array-of-arrays including the header row —
 * to CompetitorAdRow[]. Column order is fixed and confirmed from the real
 * source file; matched by INDEX, not by Arabic header text (fragile against
 * formatting differences between exports). Column 0 (اسم الخدمة, free text)
 * is deliberately ignored — the caller already knows which catalog service
 * this import is for, from the admin's own picker selection.
 */

const COL = {
  SEARCH_LANGUAGE: 1,
  SEARCH_KEYWORD: 2,
  AD_LIBRARY_ID: 3,
  ADVERTISER_NAME: 4,
  STATUS: 5,
  STARTED_ON: 6,
  PLATFORMS: 7,
  CONTENT_TYPE: 8,
  AD_TEXT: 9,
  AD_URL: 10,
  AMOUNT_SPENT: 11,
} as const;

function cell(row: unknown[], index: number): string | null {
  const v = row[index];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function mapCompetitorAdsSheet(rows: unknown[][]): { rows: CompetitorAdRow[]; skipped: number } {
  const dataRows = rows.slice(1); // row 0 is always the header
  const out: CompetitorAdRow[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    if (!row || row.length === 0) {
      skipped += 1;
      continue;
    }
    const adLibraryId = cell(row, COL.AD_LIBRARY_ID);
    const advertiserName = cell(row, COL.ADVERTISER_NAME);
    if (!adLibraryId || !advertiserName) {
      skipped += 1;
      continue;
    }
    out.push({
      adLibraryId,
      advertiserName,
      status: cell(row, COL.STATUS),
      startedOn: cell(row, COL.STARTED_ON),
      platforms: cell(row, COL.PLATFORMS),
      contentType: cell(row, COL.CONTENT_TYPE),
      adText: cell(row, COL.AD_TEXT),
      adUrl: cell(row, COL.AD_URL),
      amountSpent: cell(row, COL.AMOUNT_SPENT),
      searchLanguage: cell(row, COL.SEARCH_LANGUAGE),
      searchKeyword: cell(row, COL.SEARCH_KEYWORD),
    });
  }

  return { rows: out, skipped };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/competitorAdsImport.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Write the (untested) file-reading wrapper**

Create `src/lib/competitorAdsFile.ts`:

```ts
import * as XLSX from 'xlsx';
import { mapCompetitorAdsSheet } from './competitorAdsImport';
import type { CompetitorAdRow } from './api';

/**
 * Reads the first sheet of an uploaded .xlsx File and maps it to
 * CompetitorAdRow[]. Thin wrapper around the SheetJS `xlsx` library and the
 * File API — a file-I/O boundary, not unit-tested, same convention as
 * OfferImagesField's upload handler in ServiceRequestsManager.tsx. All the
 * actual mapping logic lives in the tested mapCompetitorAdsSheet().
 */
export async function readCompetitorAdsFile(file: File): Promise<{ rows: CompetitorAdRow[]; skipped: number }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], skipped: 0 };
  const sheet = workbook.Sheets[firstSheetName];
  const asArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return mapCompetitorAdsSheet(asArrays);
}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (If `xlsx`'s bundled types don't resolve, check `node_modules/xlsx/types/index.d.ts` exists — the package ships its own types, no `@types/xlsx` needed.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/competitorAdsImport.ts src/lib/competitorAdsImport.test.ts src/lib/competitorAdsFile.ts
git commit -m "$(cat <<'EOF'
feat(admin): parse competitor-ads .xlsx uploads

Column mapping is index-based (confirmed order from the real source file),
not header-text matching, and split into a pure, fully-tested mapper
(competitorAdsImport.ts) plus a thin untested File-reading wrapper
(competitorAdsFile.ts) — mirrors how the codebase already separates tested
logic from untested file-I/O boundaries elsewhere (OfferImagesField).
EOF
)"
```

---

### Task 5: `CompetitorAdCard` component

**Files:**
- Create: `src/components/admin/CompetitorAdCard.tsx`
- Create: `src/components/admin/CompetitorAdCard.test.tsx`

**Interfaces:**
- Consumes: `CompetitorAd[]` (Task 3), `AppIcon` (`src/components/AppIcon.tsx`).
- Produces: `CompetitorAdCard({ advertiserName, ads }: { advertiserName: string; ads: CompetitorAd[] })` — a default-collapsed summary card, consumed by Task 6.

**Context:** One card per advertiser, grouping that advertiser's ads within the currently-viewed import. Collapsed state shows: name, total count, active count, platform chips. Expanded adds the full per-ad list: content-type icon, status badge, `startedOn` text, platform tags, `adText` (truncated with a "show more" toggle — ad text can be very long, confirmed in the real data), a link to `adUrl`, `amountSpent` as a small note, and a "🔁 seen before" badge when `seenInPreviousImport` is true.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
  }),
}));

import { CompetitorAdCard } from './CompetitorAdCard';
import type { CompetitorAd } from '../../lib/api';

const AD = (over: Partial<CompetitorAd> = {}): CompetitorAd => ({
  id: 'ad-1', importId: 'i1', serviceId: 'res-tourist', adLibraryId: 'lib-1',
  advertiserName: 'شركة أ', status: 'Active', startedOn: '27 Jul 2021 - 27 Jul 2021',
  platforms: 'Facebook, Instagram', contentType: 'صورة', adText: 'نص الإعلان',
  adUrl: 'https://www.facebook.com/ads/library/?id=1',
  amountSpent: 'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
  searchLanguage: 'العربية', searchKeyword: 'إقامة سياحية', seenInPreviousImport: false,
  createdAt: '2026-08-20T00:00:00Z',
  ...over,
});

describe('CompetitorAdCard', () => {
  it('shows the advertiser name and total ad count collapsed', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD(), AD({ id: 'ad-2', status: 'Inactive' })]} />);

    expect(screen.getByText('شركة أ')).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('counts active ads separately from the total', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ status: 'Active' }), AD({ id: 'ad-2', status: 'Inactive' })]} />);

    expect(screen.getByText('competitorAds.card.activeCount 1')).toBeInTheDocument();
  });

  it('does not show individual ad text until expanded', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ adText: 'نص فريد للإعلان' })]} />);

    expect(screen.queryByText('نص فريد للإعلان')).not.toBeInTheDocument();
  });

  it('reveals every ad after clicking to expand', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ adText: 'نص فريد للإعلان' })]} />);

    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getByText('نص فريد للإعلان')).toBeInTheDocument();
  });

  it('links out to the ad library URL', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ adUrl: 'https://example.com/ad/1' })]} />);
    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getByRole('link', { name: /competitorAds.card.openInLibrary/ })).toHaveAttribute('href', 'https://example.com/ad/1');
  });

  it('shows the "seen before" badge only on ads flagged seenInPreviousImport', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ id: 'new', seenInPreviousImport: false }), AD({ id: 'old', seenInPreviousImport: true })]} />);
    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getAllByText('competitorAds.card.seenBefore')).toHaveLength(1);
  });

  it('shows every distinct platform as a chip, without duplicates', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD({ platforms: 'Facebook, Instagram' }), AD({ id: 'ad-2', platforms: 'Facebook' })]} />);

    expect(screen.getAllByText('Facebook')).toHaveLength(1);
    expect(screen.getAllByText('Instagram')).toHaveLength(1);
  });

  it('renders amountSpent as a note, not a styled figure', () => {
    render(<CompetitorAdCard advertiserName="شركة أ" ads={[AD()]} />);
    fireEvent.click(screen.getByRole('button', { name: /شركة أ/ }));

    expect(screen.getByText('غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/CompetitorAdCard.test.tsx`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

Create `src/components/admin/CompetitorAdCard.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import type { CompetitorAd } from '../../lib/api';

const CONTENT_ICON: Record<string, 'camera' | 'file-text' | 'share-2'> = {
  'صورة': 'camera',
  'فيديو': 'share-2',
  'كاروسيل': 'share-2',
  'نص فقط': 'file-text',
};

function AdRow({ ad }: { ad: CompetitorAd }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const longText = (ad.adText?.length ?? 0) > 220;
  const shownText = longText && !expanded ? `${ad.adText!.slice(0, 220)}…` : ad.adText;

  return (
    <li className="rounded-lg bg-white p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <AppIcon name={CONTENT_ICON[ad.contentType ?? ''] ?? 'file-text'} className="h-3.5 w-3.5 shrink-0 text-navy/50" />
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            ad.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-cream-dark text-navy/50'
          }`}
        >
          {ad.status ?? '—'}
        </span>
        {ad.seenInPreviousImport && (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold-dark">
            {t('competitorAds.card.seenBefore')}
          </span>
        )}
        {ad.startedOn && <span className="text-navy/50">{ad.startedOn}</span>}
        {ad.adUrl && (
          <a href={ad.adUrl} target="_blank" rel="noopener noreferrer" className="ms-auto font-semibold text-navy underline-offset-2 hover:underline">
            {t('competitorAds.card.openInLibrary')}
          </a>
        )}
      </div>
      {ad.platforms && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {ad.platforms.split(',').map((p) => p.trim()).filter(Boolean).map((p) => (
            <span key={p} className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-navy/70">{p}</span>
          ))}
        </div>
      )}
      {shownText && (
        <p className="mt-1.5 whitespace-pre-wrap break-anywhere text-navy/80">
          {shownText}
          {longText && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="ms-1 font-semibold text-navy underline-offset-2 hover:underline">
              {expanded ? t('competitorAds.card.showLess') : t('competitorAds.card.showMore')}
            </button>
          )}
        </p>
      )}
      {ad.amountSpent && <p className="mt-1.5 text-[11px] text-navy/40">{ad.amountSpent}</p>}
    </li>
  );
}

export function CompetitorAdCard({ advertiserName, ads }: { advertiserName: string; ads: CompetitorAd[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeCount = ads.filter((a) => a.status === 'Active').length;
  const platforms = [...new Set(ads.flatMap((a) => (a.platforms ?? '').split(',').map((p) => p.trim()).filter(Boolean)))];

  return (
    <div className="card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-start"
      >
        <span className="flex-1 font-bold text-navy">{advertiserName}</span>
        <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-navy/70">
          {t('competitorAds.card.totalCount', { count: ads.length })}
        </span>
        {activeCount > 0 && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
            {t('competitorAds.card.activeCount', { count: activeCount })}
          </span>
        )}
        <AppIcon name={open ? 'chevron-down' : (document?.dir === 'rtl' ? 'arrow-left' : 'arrow-right')} className="h-4 w-4 shrink-0 text-navy/50" />
      </button>

      {!open && platforms.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {platforms.map((p) => (
            <span key={p} className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-navy/70">{p}</span>
          ))}
        </div>
      )}

      {open && (
        <ul className="mt-3 flex flex-col gap-2">
          {ads.map((ad) => <AdRow key={ad.id} ad={ad} />)}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/CompetitorAdCard.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/CompetitorAdCard.tsx src/components/admin/CompetitorAdCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add CompetitorAdCard — one advertiser, collapsed summary + expandable ad list
EOF
)"
```

---

### Task 6: `CompetitorAdsManager` tab component

**Files:**
- Create: `src/components/admin/CompetitorAdsManager.tsx`
- Create: `src/components/admin/CompetitorAdsManager.test.tsx`

**Interfaces:**
- Consumes: `adminCompetitorAds`, `CompetitorAdImport`, `CompetitorAd` (Task 3); `readCompetitorAdsFile` (Task 4); `CompetitorAdCard` (Task 5); `SERVICES`, `SERVICE_CATEGORIES`, `pickText` (`src/data/services.ts`); `useAsyncSection` (`src/hooks/useAsyncSection.ts`); `SectionState` (`src/components/SectionState.tsx`); `Modal` (`src/components/Modal.tsx`).
- Produces: `CompetitorAdsManager({ initialServiceId }: { initialServiceId?: string })`, consumed by Task 7 (`Admin.tsx`).

**Context:** Reuses the exact catalog-picker pattern already in `AdminServicesManager.tsx` (`SERVICES`/`SERVICE_CATEGORIES`/`pickText`). `initialServiceId` lets Task 7 pre-select a service when the admin arrives via the "شوف منافسين هاي الخدمة" link.

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

const listImportsMock = vi.fn();
const latestImportMock = vi.fn();
const listAdsMock = vi.fn();
const importRowsMock = vi.fn();
vi.mock('../../lib/api', () => ({
  adminCompetitorAds: {
    listImports: (...a: unknown[]) => listImportsMock(...a),
    latestImport: (...a: unknown[]) => latestImportMock(...a),
    listAds: (...a: unknown[]) => listAdsMock(...a),
    importRows: (...a: unknown[]) => importRowsMock(...a),
  },
}));

const readFileMock = vi.fn();
vi.mock('../../lib/competitorAdsFile', () => ({
  readCompetitorAdsFile: (...a: unknown[]) => readFileMock(...a),
}));

import { CompetitorAdsManager } from './CompetitorAdsManager';

const IMPORT = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'i1', serviceId: 'res-tourist', fileName: 'ads.xlsx', rowCount: 2,
  importedBy: null, importedAt: '2026-08-20T00:00:00Z', ...over,
});
const AD = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'ad-1', importId: 'i1', serviceId: 'res-tourist', adLibraryId: 'lib-1',
  advertiserName: 'شركة أ', status: 'Active', startedOn: null, platforms: null,
  contentType: null, adText: null, adUrl: null, amountSpent: null,
  searchLanguage: null, searchKeyword: null, seenInPreviousImport: false,
  createdAt: '2026-08-20T00:00:00Z', ...over,
});

beforeEach(() => {
  listImportsMock.mockReset().mockResolvedValue([]);
  latestImportMock.mockReset().mockResolvedValue(null);
  listAdsMock.mockReset().mockResolvedValue([]);
  importRowsMock.mockReset();
  readFileMock.mockReset();
});

describe('CompetitorAdsManager', () => {
  it('shows an empty state with no service selected', () => {
    render(<CompetitorAdsManager />);

    expect(screen.getByText('competitorAds.manager.pickService')).toBeInTheDocument();
  });

  it('pre-selects the service passed via initialServiceId', async () => {
    latestImportMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([AD()]);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);

    await waitFor(() => expect(latestImportMock).toHaveBeenCalledWith('res-tourist'));
  });

  it('shows an empty-data state (with an import shortcut) when the service has no imports yet', async () => {
    latestImportMock.mockResolvedValue(null);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);

    expect(await screen.findByText('competitorAds.manager.noDataYet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'competitorAds.manager.importNew' })).toBeInTheDocument();
  });

  it('groups ads from the latest import by advertiser', async () => {
    latestImportMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([
      AD({ id: 'a1', advertiserName: 'شركة أ' }),
      AD({ id: 'a2', advertiserName: 'شركة أ' }),
      AD({ id: 'a3', advertiserName: 'شركة ب' }),
    ]);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);

    expect(await screen.findByText('شركة أ')).toBeInTheDocument();
    expect(screen.getByText('شركة ب')).toBeInTheDocument();
    // one card per advertiser, not one per ad
    expect(screen.getAllByRole('button', { name: /شركة/ })).toHaveLength(2);
  });

  it('only shows "previous versions" once more than one import exists', async () => {
    latestImportMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([AD()]);
    listImportsMock.mockResolvedValue([IMPORT()]); // just one

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);
    await screen.findByText('شركة أ');

    expect(screen.queryByRole('button', { name: 'competitorAds.manager.previousVersions' })).not.toBeInTheDocument();
  });

  it('shows "previous versions" when more than one import exists, and switches the view on selection', async () => {
    const older = IMPORT({ id: 'i0', importedAt: '2026-08-01T00:00:00Z' });
    latestImportMock.mockResolvedValue(IMPORT());
    listImportsMock.mockResolvedValue([IMPORT(), older]);
    listAdsMock.mockImplementation((importId: string) =>
      Promise.resolve(importId === 'i0' ? [AD({ id: 'old-ad', advertiserName: 'شركة قديمة' })] : [AD({ advertiserName: 'شركة أ' })]),
    );

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);
    await screen.findByText('شركة أ');

    fireEvent.click(screen.getByRole('button', { name: 'competitorAds.manager.previousVersions' }));
    fireEvent.click(await screen.findByText(/2026-08-01/));

    expect(await screen.findByText('شركة قديمة')).toBeInTheDocument();
    expect(listAdsMock).toHaveBeenCalledWith('i0');
  });

  it('imports a parsed file and reloads the latest-import view', async () => {
    latestImportMock.mockResolvedValueOnce(null).mockResolvedValueOnce(IMPORT());
    readFileMock.mockResolvedValue({ rows: [{ adLibraryId: 'lib-1', advertiserName: 'شركة أ' }], skipped: 0 });
    importRowsMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([AD()]);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);
    await screen.findByText('competitorAds.manager.noDataYet');

    const file = new File(['x'], 'ads.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const input = screen.getByLabelText('competitorAds.manager.chooseFile', { selector: 'input' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: 'competitorAds.manager.confirmImport' }));

    await waitFor(() => expect(importRowsMock).toHaveBeenCalledWith('res-tourist', 'ads.xlsx', [{ adLibraryId: 'lib-1', advertiserName: 'شركة أ' }]));
    expect(await screen.findByText('شركة أ')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/CompetitorAdsManager.test.tsx`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

Create `src/components/admin/CompetitorAdsManager.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminCompetitorAds } from '../../lib/api';
import type { CompetitorAd, CompetitorAdImport } from '../../lib/api';
import { readCompetitorAdsFile } from '../../lib/competitorAdsFile';
import { SERVICES, SERVICE_CATEGORIES, pickText } from '../../data/services';
import { AppIcon } from '../AppIcon';
import { Modal } from '../Modal';
import { SectionState } from '../SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { CompetitorAdCard } from './CompetitorAdCard';

function ImportModal({
  serviceId, onClose, onImported,
}: {
  serviceId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: ReturnType<typeof readCompetitorAdsFile> extends Promise<infer R> ? R['rows'] : never; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const pick = async (f: File | null) => {
    setFile(f);
    setPreview(null);
    setError(false);
    if (!f) return;
    try {
      const parsed = await readCompetitorAdsFile(f);
      setPreview(parsed);
    } catch {
      setError(true);
    }
  };

  const confirm = async () => {
    if (!file || !preview || preview.rows.length === 0) return;
    setBusy(true);
    setError(false);
    try {
      await adminCompetitorAds.importRows(serviceId, file.name, preview.rows);
      onImported();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="competitor-import-title">
      <h2 id="competitor-import-title" className="font-bold text-navy">{t('competitorAds.manager.importNew')}</h2>
      <label className="mt-4 flex flex-col gap-1 text-sm">
        {t('competitorAds.manager.chooseFile')}
        <input
          type="file"
          accept=".xlsx"
          aria-label={t('competitorAds.manager.chooseFile')}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="input !h-auto py-2"
        />
      </label>

      {preview && (
        <p className="mt-3 text-sm text-navy/70">
          {t('competitorAds.manager.previewCount', { count: preview.rows.length })}
          {preview.skipped > 0 && ` · ${t('competitorAds.manager.previewSkipped', { count: preview.skipped })}`}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-brand-red">{t('common.error')}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={busy || !preview || preview.rows.length === 0}
        className="btn-primary mt-4 min-h-[44px] w-full disabled:opacity-50"
      >
        {busy ? t('common.loading') : t('competitorAds.manager.confirmImport')}
      </button>
    </Modal>
  );
}

function PreviousVersionsMenu({
  serviceId, activeImportId, onSelect,
}: {
  serviceId: string;
  activeImportId: string | null;
  onSelect: (imp: CompetitorAdImport) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const section = useAsyncSection(() => adminCompetitorAds.listImports(serviceId), [serviceId]);

  if (section.status !== 'ready' || !section.data || section.data.length <= 1) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary min-h-[44px] px-4 text-sm">
        {t('competitorAds.manager.previousVersions')}
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 w-64 rounded-lg border border-cream-dark bg-white p-1 shadow-card">
          {section.data.map((imp) => (
            <li key={imp.id}>
              <button
                type="button"
                onClick={() => { onSelect(imp); setOpen(false); }}
                className={`w-full rounded-md px-3 py-2 text-start text-sm hover:bg-cream ${imp.id === activeImportId ? 'font-bold text-navy' : 'text-navy/70'}`}
              >
                {new Date(imp.importedAt).toLocaleDateString(i18n.language)} · {t('competitorAds.manager.rowCount', { count: imp.rowCount })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CompetitorAdsManager({ initialServiceId }: { initialServiceId?: string } = {}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [viewImport, setViewImport] = useState<CompetitorAdImport | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const latest = useAsyncSection(
    () => (serviceId ? adminCompetitorAds.latestImport(serviceId) : Promise.resolve(null)),
    [serviceId, reloadNonce],
  );

  // Once the latest import is known, that's the default view — unless the
  // admin explicitly switched to an older one via PreviousVersionsMenu.
  const effectiveImport = viewImport ?? latest.data ?? null;
  const ads = useAsyncSection(
    () => (effectiveImport ? adminCompetitorAds.listAds(effectiveImport.id) : Promise.resolve([])),
    [effectiveImport?.id],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CompetitorAd[]>();
    for (const ad of ads.data ?? []) {
      const list = map.get(ad.advertiserName) ?? [];
      list.push(ad);
      map.set(ad.advertiserName, list);
    }
    return [...map.entries()].sort((a, b) => {
      const activeA = a[1].filter((x) => x.status === 'Active').length;
      const activeB = b[1].filter((x) => x.status === 'Active').length;
      return activeB - activeA;
    });
  }, [ads.data]);

  const onImported = () => {
    setViewImport(null); // fall back to "latest" — the import that just landed
    setReloadNonce((n) => n + 1);
  };

  return (
    <div className="card p-6">
      <h2 className="font-bold text-navy">{t('admin.competitors.title')}</h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="input !h-10 max-w-xs text-sm"
          value={serviceId ?? ''}
          onChange={(e) => { setServiceId(e.target.value || null); setViewImport(null); }}
        >
          <option value="">{t('competitorAds.manager.pickService')}</option>
          {SERVICE_CATEGORIES.map((cat) => (
            <optgroup key={cat.id} label={pickText(cat.title, lang)}>
              {SERVICES.filter((s) => s.category === cat.id).map((s) => (
                <option key={s.id} value={s.id}>{pickText(s.title, lang)}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {serviceId && (
          <>
            <button type="button" onClick={() => setImportModalOpen(true)} className="btn-primary min-h-[44px] px-4 text-sm">
              <AppIcon name="upload" className="h-4 w-4 shrink-0" />
              {t('competitorAds.manager.importNew')}
            </button>
            <PreviousVersionsMenu serviceId={serviceId} activeImportId={effectiveImport?.id ?? null} onSelect={setViewImport} />
          </>
        )}
      </div>

      {!serviceId && <p className="mt-6 text-sm text-gray-500">{t('competitorAds.manager.pickService')}</p>}

      {serviceId && (
        <SectionState section={latest} title={t('admin.competitors.title')} empty={null}>
          {() =>
            !effectiveImport ? (
              <div className="mt-6 rounded-xl border border-dashed border-cream-dark p-6 text-center">
                <p className="text-sm text-gray-500">{t('competitorAds.manager.noDataYet')}</p>
                <button type="button" onClick={() => setImportModalOpen(true)} className="btn-primary mt-3 min-h-[44px] px-4 text-sm">
                  {t('competitorAds.manager.importNew')}
                </button>
              </div>
            ) : (
              <SectionState
                section={ads}
                title={t('admin.competitors.title')}
                empty={<p className="mt-6 text-sm text-gray-500">{t('competitorAds.manager.noDataYet')}</p>}
              >
                {() => (
                  <div className="mt-6 flex flex-col gap-3">
                    {grouped.map(([advertiserName, adsForAdvertiser]) => (
                      <CompetitorAdCard key={advertiserName} advertiserName={advertiserName} ads={adsForAdvertiser} />
                    ))}
                  </div>
                )}
              </SectionState>
            )
          }
        </SectionState>
      )}

      {importModalOpen && serviceId && (
        <ImportModal serviceId={serviceId} onClose={() => setImportModalOpen(false)} onImported={onImported} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/CompetitorAdsManager.test.tsx`
Expected: all tests PASS. If any fail on the file-input interaction, confirm the `<input type="file">`'s accessible name matches `aria-label={t('competitorAds.manager.chooseFile')}` exactly as the mocked `t()` returns it (the key itself, since the test's `t` mock returns keys verbatim).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/CompetitorAdsManager.tsx src/components/admin/CompetitorAdsManager.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add CompetitorAdsManager tab — service picker, import flow, previous versions, grouped cards
EOF
)"
```

---

### Task 7: Wire the tab into `Admin.tsx`

**Files:**
- Modify: `src/pages/Admin.tsx`

**Interfaces:**
- Consumes: `CompetitorAdsManager` (Task 6).

- [ ] **Step 1: Add `'competitors'` to `TABS`**

In `src/pages/Admin.tsx`, change:

```ts
const TABS = [
  'overview', 'users', 'bookings', 'serviceRequests', 'payments',
  'paymentSettings', 'rates', 'cancellations', 'leads', 'companies', 'companyPayments',
  'broadcast', 'newsFeed', 'catalog', 'listings', 'investments', 'places', 'news', 'auditLog',
] as const;
```

to:

```ts
const TABS = [
  'overview', 'users', 'bookings', 'serviceRequests', 'competitors', 'payments',
  'paymentSettings', 'rates', 'cancellations', 'leads', 'companies', 'companyPayments',
  'broadcast', 'newsFeed', 'catalog', 'listings', 'investments', 'places', 'news', 'auditLog',
] as const;
```

- [ ] **Step 2: Add it to the `operations` nav group and its icon**

Change:

```ts
const NAV_GROUPS: { id: string; icon: IconName; labelKey: string; tabs: AdminTab[] }[] = [
  { id: 'operations', icon: 'inbox', labelKey: 'admin.groups.operations', tabs: ['serviceRequests', 'bookings', 'catalog', 'leads'] },
```

to:

```ts
const NAV_GROUPS: { id: string; icon: IconName; labelKey: string; tabs: AdminTab[] }[] = [
  { id: 'operations', icon: 'inbox', labelKey: 'admin.groups.operations', tabs: ['serviceRequests', 'competitors', 'bookings', 'catalog', 'leads'] },
```

Add to `TAB_ICON` (after the `serviceRequests: 'inbox',` line):

```ts
  serviceRequests: 'inbox',
  competitors: 'search',
```

- [ ] **Step 3: Add the tab label**

In the `TAB_LABEL` map inside `AdminInner()`, add after `serviceRequests: t('admin.serviceRequests.title'),`:

```ts
    competitors: t('admin.competitors.title'),
```

- [ ] **Step 4: Read the `?service=` query param and render the tab**

Near the top of `AdminInner()`, after the existing `rawTab`/`activeTab` declarations, add:

```ts
  // Set by the "شوف منافسين هاي الخدمة" link on a service-request row
  // (ServiceRequestsManager / AdminNewRequests) — pre-selects the service
  // in CompetitorAdsManager instead of landing on its own empty picker.
  const initialCompetitorServiceId = params.get('service') ?? undefined;
```

Then, immediately after the existing:

```tsx
          {/* incoming service-catalog requests */}
          {activeTab === 'serviceRequests' && <ServiceRequestsManager />}
```

add:

```tsx
          {/* competitor ads per service (Meta Ads Library imports) */}
          {activeTab === 'competitors' && <CompetitorAdsManager initialServiceId={initialCompetitorServiceId} />}
```

- [ ] **Step 5: Import the component**

Add near the other component imports (after `import { ServiceRequestsManager } from '../components/ServiceRequestsManager';`):

```ts
import { CompetitorAdsManager } from '../components/admin/CompetitorAdsManager';
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual verification**

This wiring has no dedicated test file (Admin.tsx is the page shell, not unit-tested elsewhere in this codebase either — confirmed no `Admin.test.tsx` exists). Verify manually:

```bash
npm run dev
```

Sign in as an admin, open `/admin?tab=competitors`, confirm the sidebar shows "المنافسون" (or whatever `admin.competitors.title` resolves to once Task 9 adds it — until then this will show the raw key, which is expected at this point in the plan) inside the "الطلبات والحجوزات والخدمات" group, and that the tab renders `CompetitorAdsManager`. Also try `/admin?tab=competitors&service=res-tourist` and confirm the service picker is pre-set to that service.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "$(cat <<'EOF'
feat(admin): wire the Competitors tab into Admin.tsx

Grouped under "Operations" alongside service requests, bookings, and the
catalog. Reads ?service= so the "شوف منافسين هاي الخدمة" link (next commit)
lands with the right service pre-selected instead of an empty picker.
EOF
)"
```

---

### Task 8: Link from service requests to their competitor view

**Files:**
- Modify: `src/components/ServiceRequestsManager.tsx`
- Modify: `src/components/AdminNewRequests.tsx`
- Modify: `src/components/AdminNewRequests.test.tsx` (existing `row()` helper needs `serviceId`)

**Interfaces:**
- Consumes: `ServiceRequest.serviceId` (Task 2).

- [ ] **Step 1: Update the existing test helper and add failing assertions**

In `src/components/AdminNewRequests.test.tsx`, update the `row()` helper to include `serviceId`:

```ts
const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1',
  name: 'Ahmet',
  phone: '+90 555 123 45 67',
  message: undefined,
  serviceId: 'res-tourist',
  serviceTitle: 'İkamet',
  category: 'residency',
  serviceType: 'direct',
  status: 'new',
  createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  ...over,
});
```

Add this test inside `describe('the queue itself', ...)`:

```ts
  it('links to that service\'s competitor view when serviceId is known', async () => {
    adminListMock.mockResolvedValue([row({ id: 'r9', serviceId: 'res-tourist' })]);

    render(<AdminNewRequests />);

    const link = await screen.findByRole('link', { name: 'admin.newRequests.competitors' });
    expect(link).toHaveAttribute('href', '/admin?tab=competitors&service=res-tourist');
  });

  it('omits the competitor link when serviceId is unknown (pre-migration rows)', async () => {
    adminListMock.mockResolvedValue([row({ id: 'r9', serviceId: null })]);

    render(<AdminNewRequests />);

    await screen.findByText('Ahmet');
    expect(screen.queryByRole('link', { name: 'admin.newRequests.competitors' })).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/components/AdminNewRequests.test.tsx`
Expected: the 2 new tests FAIL (link doesn't exist yet); every pre-existing test in the file still PASSES (confirms the `row()` helper change didn't break anything already covered).

- [ ] **Step 3: Add the link in `AdminNewRequests.tsx`**

Change the actions row:

```tsx
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* tap-to-call: the phone IS the action on mobile */}
              <a
                href={`tel:${r.phone.replace(/\s/g, '')}`}
                dir="ltr"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-navy underline-offset-2 hover:underline"
                aria-label={t('admin.newRequests.callAria', { name: r.name, phone: r.phone })}
              >
                <AppIcon name="phone" className="h-4 w-4 shrink-0" />
                {r.phone}
              </a>

              <button
```

to:

```tsx
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* tap-to-call: the phone IS the action on mobile */}
              <a
                href={`tel:${r.phone.replace(/\s/g, '')}`}
                dir="ltr"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-navy underline-offset-2 hover:underline"
                aria-label={t('admin.newRequests.callAria', { name: r.name, phone: r.phone })}
              >
                <AppIcon name="phone" className="h-4 w-4 shrink-0" />
                {r.phone}
              </a>

              {r.serviceId && (
                <a
                  href={`/admin?tab=competitors&service=${r.serviceId}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-navy underline-offset-2 hover:underline"
                >
                  <AppIcon name="search" className="h-4 w-4 shrink-0" />
                  {t('admin.newRequests.competitors')}
                </a>
              )}

              <button
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/AdminNewRequests.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Add the same link in `ServiceRequestsManager.tsx`**

In the row markup (after the `{r.message && ...}` line, before the `<span className="ms-auto ...">` timestamp), add:

```tsx
              {r.serviceId && (
                <a
                  href={`/admin?tab=competitors&service=${r.serviceId}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-navy underline-offset-2 hover:underline"
                >
                  <AppIcon name="search" className="w-3.5 h-3.5" />
                  {t('admin.serviceRequests.competitors')}
                </a>
              )}
```

- [ ] **Step 6: Write a focused test for `ServiceRequestsManager`**

Check whether `src/components/ServiceRequestsManager.test.tsx` already exists:

```bash
ls src/components/ServiceRequestsManager.test.tsx 2>/dev/null || echo "does not exist"
```

If it does not exist, create `src/components/ServiceRequestsManager.test.tsx` with just this focused coverage (do not attempt to re-test the whole component's existing behavior — that's out of scope for this task):

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

const adminListMock = vi.fn();
vi.mock('../lib/api', () => ({
  serviceRequests: { adminList: () => adminListMock() },
  adminServiceOffers: {},
  logPiiReveal: vi.fn(),
}));

import { ServiceRequestsManager } from './ServiceRequestsManager';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1', name: 'Ahmet', phone: '+90 555 123 45 67', message: undefined,
  serviceId: 'res-tourist', serviceTitle: 'İkamet', category: 'residency', serviceType: 'direct',
  status: 'new', createdAt: new Date().toISOString(), ownerName: null, ownerEmail: null,
  ...over,
});

beforeEach(() => {
  adminListMock.mockReset();
});

describe('ServiceRequestsManager — competitor link', () => {
  it('links to the competitors tab for the row\'s service', async () => {
    adminListMock.mockResolvedValue([row({ serviceId: 'res-tourist' })]);

    render(<ServiceRequestsManager />);

    const link = await screen.findByRole('link', { name: 'admin.serviceRequests.competitors' });
    expect(link).toHaveAttribute('href', '/admin?tab=competitors&service=res-tourist');
  });

  it('omits the link when the row has no serviceId', async () => {
    adminListMock.mockResolvedValue([row({ serviceId: null })]);

    render(<ServiceRequestsManager />);

    await screen.findByText('İkamet');
    expect(screen.queryByRole('link', { name: 'admin.serviceRequests.competitors' })).toBeNull();
  });
});
```

If `ServiceRequestsManager.test.tsx` already exists, read it first and add these two `it()` blocks inside its existing structure instead of creating a new file with a possibly-incompatible mock shape — match whatever mocking convention that file already uses for `serviceRequests`/`adminServiceOffers`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/ServiceRequestsManager.test.tsx`
Expected: both new tests PASS.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ServiceRequestsManager.tsx src/components/AdminNewRequests.tsx src/components/AdminNewRequests.test.tsx src/components/ServiceRequestsManager.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): link service requests to their competitor-ads view

"شوف منافسين هاي الخدمة" on both the full queue (ServiceRequestsManager) and
the compact "needs action" preview (AdminNewRequests) — hidden on rows
without a serviceId (pre-migration requests, or the rare row where the
column genuinely wasn't set) so it never points at a broken filter.
EOF
)"
```

---

### Task 9: Translations (ar/en/ru/fa)

**Files:**
- Modify: `src/i18n/locales/ar.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/fa.json`

**Interfaces:**
- Produces: every `t('admin.competitors.*')`, `t('competitorAds.*')`, `t('admin.newRequests.competitors')`, `t('admin.serviceRequests.competitors')` key referenced in Tasks 5–8.

**Context:** All 4 locale files share the same nested-JSON shape (confirmed: `admin.serviceRequests` and `admin.newRequests` exist verbatim in all 4). Add `admin.competitors` next to the existing `admin.serviceRequests` block, `competitorAds` as a new top-level key next to `admin` (mirrors how `serviceOffer` sits alongside `admin` already — verify this placement pattern before inserting: run `grep -n '"serviceOffer"' src/i18n/locales/ar.json` and place `competitorAds` the same way, as a sibling top-level key, not nested under `admin`), and one new key each inside the existing `admin.newRequests` and `admin.serviceRequests` blocks.

- [ ] **Step 1: Confirm the top-level key placement pattern**

```bash
grep -n '"serviceOffer"' src/i18n/locales/ar.json
```

Expected: shows `serviceOffer` as a top-level key (same indentation level as `"admin"`). If instead it's nested inside `admin`, adjust Step 2 below to nest `competitorAds` under `admin` instead of top-level — the tests in Tasks 5–6 use `t('competitorAds.card.*')` and `t('competitorAds.manager.*')` (not `admin.competitorAds.*`), so whichever placement is chosen, the i18n JSON path must match `competitorAds.card.*` / `competitorAds.manager.*` exactly as referenced in the component code — if nesting under `admin` turns out to be the real convention, keep the JSON path prefix as `admin.competitorAds.*` in the JSON **and update the `t()` calls in `CompetitorAdCard.tsx` and `CompetitorAdsManager.tsx` from Tasks 5–6 to match** (do this now, in this task, rather than leaving the two inconsistent).

- [ ] **Step 2: Add the keys to `src/i18n/locales/ar.json`**

Inside `admin.serviceRequests`, add a new key after `"reject": "إغلاق الطلب",`:

```json
    "competitors": "شوف منافسين هاي الخدمة",
```

Add a new top-level `admin.competitors` block, placed as a sibling of `"serviceRequests"` inside `"admin"`:

```json
    "competitors": {
      "title": "المنافسون"
    },
```

Inside `admin.newRequests`, add a new key after `"callAria": "اتصل بـ {{name}} على {{phone}}"`:

```json
    "competitors": "شوف منافسين هاي الخدمة",
```

Add a new top-level `competitorAds` block (sibling of `"admin"` — adjust nesting per Step 1's finding):

```json
  "competitorAds": {
    "card": {
      "totalCount": "{{count}} إعلان",
      "activeCount": "{{count}} نشط",
      "seenBefore": "🔁 شفنا هاد الإعلان بنسخة سابقة",
      "openInLibrary": "افتح بمكتبة الإعلانات",
      "showMore": "عرض المزيد",
      "showLess": "عرض أقل"
    },
    "manager": {
      "pickService": "اختر خدمة لعرض منافسيها",
      "noDataYet": "لا يوجد بيانات منافسين لهاي الخدمة بعد",
      "importNew": "استيراد ملف جديد",
      "chooseFile": "اختر ملف Excel (.xlsx)",
      "previewCount": "{{count}} إعلان جاهز للاستيراد",
      "previewSkipped": "تم تجاهل {{count}} صف غير مكتمل",
      "confirmImport": "تأكيد الاستيراد",
      "previousVersions": "النسخ السابقة",
      "rowCount": "{{count}} إعلان"
    }
  },
```

- [ ] **Step 3: Add the equivalent keys to `src/i18n/locales/en.json`**

```json
    "competitors": "See this service's competitors",
```
(inside `admin.serviceRequests`, and identically inside `admin.newRequests`)

```json
    "competitors": {
      "title": "Competitors"
    },
```

```json
  "competitorAds": {
    "card": {
      "totalCount": "{{count}} ads",
      "activeCount": "{{count}} active",
      "seenBefore": "🔁 Seen in a previous import",
      "openInLibrary": "Open in Ads Library",
      "showMore": "Show more",
      "showLess": "Show less"
    },
    "manager": {
      "pickService": "Pick a service to see its competitors",
      "noDataYet": "No competitor data for this service yet",
      "importNew": "Import new file",
      "chooseFile": "Choose an Excel file (.xlsx)",
      "previewCount": "{{count}} ads ready to import",
      "previewSkipped": "{{count}} incomplete row(s) skipped",
      "confirmImport": "Confirm import",
      "previousVersions": "Previous versions",
      "rowCount": "{{count}} ads"
    }
  },
```

- [ ] **Step 4: Add the equivalent keys to `src/i18n/locales/ru.json`**

```json
    "competitors": "Смотреть конкурентов этой услуги",
```

```json
    "competitors": {
      "title": "Конкуренты"
    },
```

```json
  "competitorAds": {
    "card": {
      "totalCount": "{{count}} объявлений",
      "activeCount": "{{count}} активных",
      "seenBefore": "🔁 Уже встречалось в прошлом импорте",
      "openInLibrary": "Открыть в библиотеке объявлений",
      "showMore": "Показать больше",
      "showLess": "Показать меньше"
    },
    "manager": {
      "pickService": "Выберите услугу, чтобы увидеть конкурентов",
      "noDataYet": "Пока нет данных о конкурентах для этой услуги",
      "importNew": "Импортировать новый файл",
      "chooseFile": "Выберите файл Excel (.xlsx)",
      "previewCount": "{{count}} объявлений готовы к импорту",
      "previewSkipped": "{{count}} неполных строк пропущено",
      "confirmImport": "Подтвердить импорт",
      "previousVersions": "Предыдущие версии",
      "rowCount": "{{count}} объявлений"
    }
  },
```

- [ ] **Step 5: Add the equivalent keys to `src/i18n/locales/fa.json`**

```json
    "competitors": "مشاهده رقبای این خدمت",
```

```json
    "competitors": {
      "title": "رقبا"
    },
```

```json
  "competitorAds": {
    "card": {
      "totalCount": "{{count}} آگهی",
      "activeCount": "{{count}} فعال",
      "seenBefore": "🔁 در بارگذاری قبلی هم دیده شد",
      "openInLibrary": "باز کردن در کتابخانه آگهی‌ها",
      "showMore": "نمایش بیشتر",
      "showLess": "نمایش کمتر"
    },
    "manager": {
      "pickService": "برای مشاهده رقبا یک خدمت را انتخاب کنید",
      "noDataYet": "هنوز داده‌ای از رقبا برای این خدمت وجود ندارد",
      "importNew": "بارگذاری فایل جدید",
      "chooseFile": "یک فایل اکسل انتخاب کنید (.xlsx)",
      "previewCount": "{{count}} آگهی آماده بارگذاری",
      "previewSkipped": "{{count}} ردیف ناقص نادیده گرفته شد",
      "confirmImport": "تأیید بارگذاری",
      "previousVersions": "نسخه‌های قبلی",
      "rowCount": "{{count}} آگهی"
    }
  },
```

- [ ] **Step 6: Validate all 4 files are still well-formed JSON**

```bash
node -e "['ar','en','ru','fa'].forEach(l => { JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json','utf8')); console.log(l, 'OK'); })"
```

Expected: `ar OK`, `en OK`, `ru OK`, `fa OK` — a JSON syntax error (typically a missing/extra comma from manual editing) throws instead and must be fixed before continuing.

- [ ] **Step 7: Re-run every test touched in this plan**

```bash
npx vitest run src/lib/adminRequestOwner.test.ts src/lib/competitorAdsApi.test.ts src/lib/competitorAdsImport.test.ts src/components/admin/CompetitorAdCard.test.tsx src/components/admin/CompetitorAdsManager.test.tsx src/components/AdminNewRequests.test.tsx src/components/ServiceRequestsManager.test.tsx
```

Expected: all PASS (these tests use a mocked `t()` that echoes keys, so they don't depend on the real translation strings — this step is a final regression check, not a translation-content check).

- [ ] **Step 8: Commit**

```bash
git add src/i18n/locales/ar.json src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/fa.json
git commit -m "$(cat <<'EOF'
feat(admin): add ar/en/ru/fa translations for the competitor-ads feature
EOF
)"
```

---

### Task 10: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```

Expected: no errors anywhere in the project.

- [ ] **Step 2: Full test suite**

```bash
npx vitest run
```

Expected: every test passes, including everything unrelated to this feature (confirms nothing else regressed — e.g. `ServiceRequest` gaining a required-in-tests `serviceId` field could break an unrelated test that constructs a `ServiceRequest` literal without it; search and fix any such spot if this step fails).

If this step fails on an unrelated file constructing a bare `ServiceRequest`-shaped object, grep for other call sites before assuming Task 2 is complete:

```bash
grep -rln "serviceTitle:" src --include="*.test.ts" --include="*.test.tsx"
```

Add `serviceId: null` (or a realistic value) to any literal this turns up that Task 2/8 didn't already touch.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: builds cleanly. This also runs `generate-sitemap.mjs` / `generate-seo-pages.mjs` / `check-seo-build.mjs` as prebuild/postbuild steps (per `package.json`'s `build` script) — confirm those still pass too; they are unrelated to this feature and a failure here would indicate an unrelated regression, not something this plan should attempt to fix.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Sign in as an admin and walk through:
1. `/admin?tab=competitors` → pick "إقامة سياحية" (or whichever service you have real data for) → see the empty state → "استيراد ملف جديد" → pick the real `.xlsx` file → confirm the preview count and skip count look right → confirm import → see company cards appear, sorted by active-ad count.
2. Expand a card → confirm ad details, the Ads Library link, and (on a second import for the same service, if you have one) the "🔁 seen before" badge.
3. `/admin?tab=serviceRequests` → confirm a request row with a known service shows "شوف منافسين هاي الخدمة" and navigates correctly with the service pre-selected.
4. Switch the site language to `en`/`ru`/`fa` and re-check the Competitors tab renders real translated text, not raw `admin.competitors.title`-style keys.

- [ ] **Step 5: Remind whoever runs this plan about the manual migration step**

Task 1's migration file is committed but not applied. Before any of the above manual testing can show real data, `supabase/migrations/20260823_competitor_ads.sql` must be pasted into the Supabase SQL Editor by hand — this plan cannot do that step itself.

---

## Self-Review Notes

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-23-competitor-ads-admin-design.md` maps to a task — data model (Task 1), import flow (Tasks 3–4, 6), admin UI (Tasks 5–6), previous-versions + duplicate detection (Tasks 3, 6), service-request link (Tasks 2, 8), translations (Task 9). The one deliberate deviation (no server endpoint) is explained in the plan header, not silently dropped.

**Placeholder scan:** no TBD/TODO; every step shows complete code.

**Type consistency:** `CompetitorAdRow`/`CompetitorAdImport`/`CompetitorAd` field names are defined once in Task 3 and reused verbatim in Tasks 4–8 — cross-checked `adLibraryId`, `advertiserName`, `seenInPreviousImport`, `importedAt`, `rowCount` for spelling consistency across every task.
