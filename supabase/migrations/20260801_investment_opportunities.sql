-- Investment opportunities, editable from the admin panel.
--
-- Two tables on purpose, not one with a "private" flag:
--
--   public.investment_opportunities — everything the website shows
--   public.investment_contacts      — sales-office email / phone / WhatsApp
--
-- The contact details exist so the Rafiq team can reach a developer's sales
-- office; they must never reach a visitor. Column-level security does not
-- exist in Postgres RLS, so a single table with a "hidden" column would be one
-- careless `select('*')` away from publishing a partner's private line. A
-- separate table whose RLS denies anon outright makes that leak impossible
-- rather than merely unlikely.

create table if not exists public.investment_opportunities (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  -- one accent colour per project; drives the card and page styling
  brand        text not null default '#1a3a6b',
  -- localised fields: { ar, en, fa, ru }
  name         jsonb not null default '{}'::jsonb,
  district     jsonb not null default '{}'::jsonb,
  type         jsonb not null default '{}'::jsonb,
  summary      jsonb not null default '{}'::jsonb,
  developer    text not null default '',
  side         text not null default 'european',
  min_usd      numeric not null default 0,
  -- null = quoted as "starting from", no published ceiling
  max_usd      numeric,
  -- arrays of localised objects
  pros         jsonb not null default '[]'::jsonb,
  cons         jsonb not null default '[]'::jsonb,
  -- [{ key, value }] where value is a string or a localised object
  extra_facts  jsonb not null default '[]'::jsonb,
  images       text[] not null default '{}',
  source       jsonb not null default '{}'::jsonb,
  sort         int not null default 0,
  -- unpublished rows stay editable in admin but never render publicly
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.investment_opportunities
  add constraint investment_opportunities_side_chk
  check (side in ('european', 'asian')) not valid;

create index if not exists investment_opportunities_sort_idx
  on public.investment_opportunities (sort, created_at);

-- ── internal only ──────────────────────────────────────────────────────────
create table if not exists public.investment_contacts (
  opportunity_id uuid primary key
    references public.investment_opportunities (id) on delete cascade,
  sales_email    text not null default '',
  sales_phone    text not null default '',
  whatsapp       text not null default '',
  official_url   text not null default '',
  press_url      text not null default '',
  -- 'none' | 'requested' | 'granted' | 'refused' — tracks the photo-permission
  -- conversation, so nobody has to remember who already replied
  permission     text not null default 'none',
  notes          text not null default '',
  updated_at     timestamptz not null default now()
);

alter table public.investment_contacts
  add constraint investment_contacts_permission_chk
  check (permission in ('none', 'requested', 'granted', 'refused')) not valid;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.investment_opportunities enable row level security;
alter table public.investment_contacts      enable row level security;

drop policy if exists investment_opportunities_read on public.investment_opportunities;
create policy investment_opportunities_read on public.investment_opportunities
  for select using (published or public.is_admin());

drop policy if exists investment_opportunities_write on public.investment_opportunities;
create policy investment_opportunities_write on public.investment_opportunities
  for all using (public.is_admin()) with check (public.is_admin());

-- No read policy for anon here, deliberately. Contact rows are admin-only in
-- every direction; there is no "public subset" of this table.
drop policy if exists investment_contacts_admin on public.investment_contacts;
create policy investment_contacts_admin on public.investment_contacts
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.investment_contacts is
  'INTERNAL ONLY — sales-office contact details. Never render on a public page. Kept in its own table so RLS can deny anon outright.';

-- keep updated_at honest without app-side bookkeeping
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists investment_opportunities_touch on public.investment_opportunities;
create trigger investment_opportunities_touch before update on public.investment_opportunities
  for each row execute function public.touch_updated_at();

drop trigger if exists investment_contacts_touch on public.investment_contacts;
create trigger investment_contacts_touch before update on public.investment_contacts
  for each row execute function public.touch_updated_at();
