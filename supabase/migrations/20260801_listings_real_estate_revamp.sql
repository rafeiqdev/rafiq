-- Real-estate revamp: optional columns on `listings`.
--
-- Every column is nullable with a safe default, and the front end already
-- reads them defensively, so the app keeps working whether or not this has
-- run. Apply it when you are ready to populate the new fields from the
-- admin panel or the import pipeline.
--
-- `citizenship` (existing boolean) keeps its meaning: true = meets the
-- citizenship threshold, false = NOT VERIFIED. The UI renders false as
-- "unknown", never as "ineligible" — do not repurpose it.

alter table public.listings
  add column if not exists listing_type text not null default 'sale',
  add column if not exists floor        int,
  add column if not exists total_floors int,
  add column if not exists build_status text,
  add column if not exists yield_pct    numeric,
  add column if not exists amenities    text[] not null default '{}',
  add column if not exists updated_at   timestamptz;

-- Guard the two enum-ish columns so a bad import cannot put the listings page
-- into a state where a row matches no tab and silently disappears.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_listing_type_chk') then
    alter table public.listings
      add constraint listings_listing_type_chk
      check (listing_type in ('sale', 'rent', 'commercial'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'listings_build_status_chk') then
    alter table public.listings
      add constraint listings_build_status_chk
      check (build_status is null or build_status in ('ready', 'under-construction'));
  end if;
end $$;

-- The listings page filters by type on every render; the index keeps that
-- cheap once the catalogue grows past a few hundred rows.
create index if not exists listings_listing_type_idx on public.listings (listing_type);

comment on column public.listings.listing_type is 'sale | rent | commercial — drives the tabs on /real-estate';
comment on column public.listings.yield_pct    is 'expected annual rental yield in percent; null = not advertised';
comment on column public.listings.updated_at   is 'last time this row was refreshed from its source; shown to buyers';
