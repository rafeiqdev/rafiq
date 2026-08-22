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
