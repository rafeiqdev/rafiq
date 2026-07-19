-- Google Maps map page: the Rafiq overlay on top of Google Places results.
--
-- Model: Google Places is the DISCOVERY pool (never stored wholesale — that
-- would violate Google's caching terms and go stale). `public.places` is our
-- own thin overlay, joined to a Google result by `google_place_id`, carrying
-- only what Google cannot tell us: whether Rafiq vetted the place, whether we
-- recommend it, why, and when a human last looked at it.
--
-- Safe to re-run.

-- ---------------------------------------------------------------- places ----
alter table public.places
  add column if not exists google_place_id      text,
  add column if not exists verified_status      text not null default 'unverified',
  add column if not exists recommended          boolean not null default false,
  add column if not exists recommendation_reason text,
  add column if not exists last_reviewed_at     timestamptz,
  add column if not exists reviewed_by          uuid references public.profiles(id) on delete set null;

comment on column public.places.google_place_id is
  'Google Places resource id, e.g. "ChIJ…". Links our overlay to a live Google result.';
comment on column public.places.recommendation_reason is
  'Why Rafiq recommends this place, shown to the user. Required when recommended = true.';

-- One overlay row per Google place. Partial so legacy rows without a Google id
-- (the six hand-entered demo places) stay valid.
create unique index if not exists places_google_place_id_key
  on public.places (google_place_id)
  where google_place_id is not null;

-- Category filter + "recommended first" ordering are the two hot paths.
create index if not exists places_recommended_idx
  on public.places (recommended, category)
  where recommended;

do $$ begin
  alter table public.places
    add constraint places_verified_status_check
    check (verified_status in ('unverified', 'verified', 'rejected'));
exception when duplicate_object then null; end $$;

-- THE core rule: "لا تعرض أي مكان تلقائيًا كموصى به دون مراجعة إدارية".
-- Enforced in the database, not just the UI — a place cannot be flagged as
-- recommended unless a human verified it, wrote a reason, and stamped a review
-- date. No code path (admin form, script, bulk import) can bypass this.
do $$ begin
  alter table public.places
    add constraint places_recommendation_requires_review
    check (
      not recommended
      or (
        verified_status = 'verified'
        and recommendation_reason is not null
        and length(btrim(recommendation_reason)) > 0
        and last_reviewed_at is not null
      )
    );
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------- place_favorites ----
-- The user's saved places. Denormalised on purpose: a favourite must render in
-- the list without spending a Places Details call on every page load.
create table if not exists public.place_favorites (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  google_place_id text not null,
  name            text not null,
  category        text,
  address         text,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz not null default now(),
  unique (user_id, google_place_id)
);

create index if not exists place_favorites_user_idx
  on public.place_favorites (user_id, created_at desc);

alter table public.place_favorites enable row level security;

-- Ownership only. Deliberately NOT gated on has_pro(): the map is Pro-gated at
-- the route, but a lapsed subscriber must never be locked out of data they
-- themselves saved.
drop policy if exists "place_favorites owner all" on public.place_favorites;
create policy "place_favorites owner all" on public.place_favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "place_favorites admin read" on public.place_favorites;
create policy "place_favorites admin read" on public.place_favorites
  for select using (public.is_admin());
