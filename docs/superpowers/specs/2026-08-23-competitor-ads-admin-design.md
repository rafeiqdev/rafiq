# Competitor Ads Admin Section — Design

**Date:** 2026-08-23
**Status:** Approved by user, pending implementation plan

## Purpose

The business already manually collects competitor advertising data from Meta
Ads Library for specific services (starting with "إقامة سياحية" / tourist
residence — see `C:\Users\muhmm\Downloads\ads_إقامة_سياحية_كامل.xlsx`, 291
ads across 161 advertisers). Staff want this data browsable inside the admin
panel, organized per competing company, and want a quick path to it from an
incoming customer request for that same service — so when handling a lead,
staff can immediately see who else is advertising the same service and how.

This must generalize: today only one service has data, but the import
mechanism needs to work for any service in the catalog going forward, with
staff self-serving new imports (no developer involvement needed per
refresh).

## Data source shape (confirmed from the real file)

Sheet `الإعلانات` (the only sheet imported — `الكلمات المفتاحية`, `الملخص`,
`التحقق` are collection-methodology sheets, not imported), columns in order:

1. اسم الخدمة (service name, free text — NOT used as the join key, see below)
2. اللغة المستخدمة بالبحث (search language)
3. الكلمة المفتاحية المستخدمة (search keyword)
4. رقم الإعلان Library ID (Meta's own ad ID — the natural unique key)
5. اسم الصفحة المعلنة (advertiser/page name — the grouping key)
6. حالة الإعلان (Active / Inactive)
7. تاريخ بداية عرض الإعلان (free text — format varies: "27 Jul 2021 - 27 Jul
   2021" vs "Started running on 9 Apr 2023". Store verbatim, do NOT attempt
   to parse into a strict date column — parsing would drop or corrupt data
   on the inconsistent rows)
8. المنصات (platforms, free text: "Facebook, Instagram, Messenger" etc.)
9. نوع المحتوى الإبداعي (صورة / فيديو / كاروسيل / نص فقط)
10. النص الكامل للإعلان (full ad copy — sometimes Meta's own removal notice,
    "This content was removed because it didn't follow our...", when the ad
    was taken down; store as-is)
11. رابط الإعلان المباشر (direct Ads Library URL)
12. المبلغ المصروف — **confirmed from real data: effectively always
    "غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية"**. Meta does not
    expose real spend for standard commercial ads (only political/issue
    ads). Store verbatim as a text note, not a currency amount — it is not
    a usable sorting/ranking signal.

## Data model (Supabase)

Two new tables, migration file `supabase/migrations/<date>_competitor_ads.sql`
following the existing style in `supabase/migrations/20260721_base_tables_reconstructed.sql`.

```sql
create table public.competitor_ad_imports (
  id           uuid primary key default gen_random_uuid(),
  service_id   text not null,       -- matches src/data/services.ts ids, e.g. 'res-tourist'
  file_name    text,
  row_count    int not null default 0,
  imported_by  uuid references public.profiles(id),
  imported_at  timestamptz not null default now()
);

create table public.competitor_ads (
  id                     uuid primary key default gen_random_uuid(),
  import_id              uuid not null references public.competitor_ad_imports(id) on delete cascade,
  service_id             text not null,   -- denormalized from the parent import, for direct filtering
  ad_library_id          text not null,   -- Meta's own ID; the cross-import duplicate-detection key
  advertiser_name        text not null,
  status                 text,            -- 'Active' | 'Inactive' | whatever Meta returned
  started_on             text,            -- free text, see note above — never parsed as a date
  platforms              text,
  content_type           text,
  ad_text                text,
  ad_url                 text,
  amount_spent           text,            -- free text note, not currency
  search_language        text,
  search_keyword         text,
  seen_in_previous_import boolean not null default false,
  created_at             timestamptz not null default now()
);

create index on public.competitor_ads (service_id, import_id);
create index on public.competitor_ads (service_id, ad_library_id);

alter table public.competitor_ad_imports enable row level security;
alter table public.competitor_ads enable row level security;

-- Admin-only, matching the existing service_requests RLS pattern
create policy "cai admin all" on public.competitor_ad_imports
  for all using (public.is_admin()) with check (public.is_admin());
create policy "ca admin all" on public.competitor_ads
  for all using (public.is_admin()) with check (public.is_admin());
```

**Old imports are never deleted or overwritten.** Every upload for a service
creates a NEW `competitor_ad_imports` row and a fresh batch of
`competitor_ads` rows tagged with that `import_id`. The admin UI's default
view shows only the latest import per service; older imports stay in the
database, reachable via a "النسخ السابقة" (previous versions) list.

**Cross-import duplicate detection.** At import time, for each parsed row,
the server checks whether `ad_library_id` already exists among
`competitor_ads` rows for the same `service_id` from any *earlier* import.
If so, the new row is inserted with `seen_in_previous_import = true`. This
is the "لقيناها قبل" signal — it tells staff which competitors are running
the same ad persistently across snapshots, not just which ads are newest.
It does not affect what gets stored (both the old and new rows for that ad
persist, each under its own `import_id`) — it is purely a display flag on
the new row.

## Import flow

1. Admin opens the new "المنافسون" (Competitors) admin tab, picks a service
   from the existing catalog (`SERVICES`/`SERVICE_CATEGORIES` from
   `src/data/services.ts` — the same source already used by
   `AdminServicesManager`), and clicks "استيراد ملف جديد".
2. Browser-side `.xlsx` parsing (new dependency: `xlsx` / SheetJS — chosen
   because it works client-side without a Node-runtime function, and
   because this admin route is already lazy-loaded via the app's existing
   `React.lazy` route splitting, so the parser only ships to whoever opens
   this one tab, not the shared shell bundle). Shows a quick preview: row
   count, first few advertiser names, so staff can sanity-check before
   committing.
3. On confirm, the parsed rows (as JSON) POST to a new admin API endpoint,
   `api/admin/competitor-ads-import.ts`, following the exact auth pattern
   already used by `api/admin/medical-translate.ts`: `Authorization: Bearer
   <caller's Supabase JWT>`, endpoint verifies the JWT against
   `profiles.role` (admin-only for this build, see Open Questions) via the
   service-role key server-side.
4. Server creates the `competitor_ad_imports` row, resolves
   `seen_in_previous_import` per row against existing data for that
   `service_id`, and bulk-inserts into `competitor_ads`.
5. Endpoint access is admin-only for this build (see Open Questions for the
   `medical_coordinator` role question).

## Admin UI

New component `src/components/admin/CompetitorAdsManager.tsx`, added as a
new tab in `Admin.tsx`'s `TABS` array (`'competitors'`), following the
existing one-component-per-tab pattern (e.g. `ServiceRequestsManager`,
`AdminServicesManager`).

- **Service picker** at the top (reuses the catalog, shows which services
  already have imported data vs. none yet).
- **Import button** (flow above).
- **"النسخ السابقة" control**: only shown when more than one import exists
  for the selected service. Opens a small list (date, row count) to switch
  the view to a historical snapshot (read-only).
- **Company cards**, grouped by `advertiser_name` within the selected
  import: name, total ad count, active-ad count, platforms seen (chips).
  Sorted by active-ad count descending (no real spend data to sort by, per
  the confirmed column analysis above).
- **Expanded card**: full list of that advertiser's ads — content-type
  icon, status badge, `started_on` text, platform tags, ad text
  (expandable/truncated), "افتح بمكتبة الإعلانات" link (`ad_url`),
  `amount_spent` shown as a small note (not styled as a real figure), and a
  "🔁 شفنا هاد الإعلان بنسخة سابقة" badge when `seen_in_previous_import` is
  true.

## Link from incoming service requests

`ServiceRequest` (in `src/lib/api.ts`) currently exposes `serviceTitle` and
`category` but not the raw catalog `service_id`, even though the underlying
`service_requests` table has a `service_id` column (confirmed in
`supabase/migrations/20260721_base_tables_reconstructed.sql`) — it's simply
not selected/mapped today. This spec adds `serviceId` to the `ServiceRequest`
interface and to the `select(...)` list wherever requests are fetched for
admin display (`ServiceRequestsManager`, `AdminNewRequests`).

Each request row gets a small "شوف منافسين هاي الخدمة" button/link,
navigating to `/admin?tab=competitors&service=<serviceId>` — the same
querystring-driven tab pattern already used elsewhere in `Admin.tsx` (e.g.
`?tab=bookings`). If no competitor data exists yet for that `service_id`,
the Competitors tab opens with an inline empty state ("لا يوجد بيانات
منافسين لهاي الخدمة بعد") plus a shortcut into the import flow, rather than
a dead-feeling blank page.

## Explicitly out of scope for this build

- Importing the `الكلمات المفتاحية` / `الملخص` / `التحقق` sheets — they're
  collection-methodology artifacts, not competitor data to browse.
- Any automatic re-scraping of Meta Ads Library — imports are always a
  manual file upload of data staff already collected themselves.
- Parsing `started_on` into a real date type, or treating `amount_spent` as
  a numeric/sortable value — both confirmed unreliable in the real data.
- Auto-matching the free-text "اسم الخدمة" column to a catalog service —
  staff explicitly pick the target service from the catalog at import time
  instead, since free-text matching risks silent mismatches.

## Open questions for the implementation plan

1. Should `medical_coordinator` role (which already has some admin-adjacent
   access elsewhere, e.g. `AdminMedical`) also get access to this tab, or is
   it admin-only? Default assumption: admin-only, matching the
   `service_requests` RLS pattern, unless corrected during planning.
2. Exact wording/copy for the empty states, badges, and buttons across the
   4 site languages (ar/en/ru/fa) — left for the implementation plan /
   translation pass, not blocking this design.
