-- ============================================================================
-- SCHEMA CATCH-UP — PART A of 2: ADDITIVE DDL ONLY.            2026-07-27
--
-- !! DO NOT RUN YET. NOT VERIFIED AGAINST THE LIVE DATABASE. !!
-- The state this was originally written against came from project
-- `iseldofsfhwvpfzltqet`, which is the ABANDONED project. The live project is
-- `jdtspvkhomctqkgdmjdn` (see .env line 17). Run RECON_20260727_live_state.sql
-- first and re-derive this from its output before running anything here.
--
-- WHAT IS IN THIS PART
-- ----------------------------------------------------------------------------
-- Tables, columns, indexes, constraints and policies only. Every statement is
-- create-if-absent or drop-then-recreate of an RLS policy.
--
-- Functions and the triggers bound to them live in PART B
-- (APPLY_ME_20260727_schema_catchup_functions.sql) and must NOT be run until
-- the live function bodies have been diffed. Triggers are in Part B rather than
-- here because a CREATE TRIGGER cannot resolve until its function exists.
--
-- ============================================================================
-- DESTRUCTIVE-STATEMENT SCAN LIST (permanent — scan for ALL of these)
-- ----------------------------------------------------------------------------
--   DROP TABLE            DROP COLUMN          TRUNCATE
--   DELETE                ALTER COLUMN … TYPE  RENAME
--   DROP SCHEMA           DROP INDEX           DROP CONSTRAINT
--
--   CREATE OR REPLACE FUNCTION      <-- destructive by overwrite
--   CREATE OR REPLACE VIEW          <-- destructive by overwrite
--   DROP POLICY                     <-- destructive by overwrite
--   DROP TRIGGER                    <-- destructive by overwrite
--
-- The last four do not look destructive and are the more dangerous for it.
-- Migrations in this repo have been hand-pasted into the Supabase SQL Editor
-- for months, and the SQL Editor keeps no history. A live function body, policy
-- predicate or trigger definition may therefore contain a hand-made fix that
-- exists in NO file in this repo. CREATE OR REPLACE and DROP-then-CREATE
-- overwrite it silently, with nothing to restore from.
--
-- A DROP followed by a CREATE is NOT made safe by the CREATE. If the recreated
-- version differs from what was live, production behaviour has changed and
-- there is no record of what was there before.
--
-- RULE: never include any statement from this list without first dumping the
-- live definition and diffing it against what is about to be installed.
-- ============================================================================
--
-- The policies in this part are DROP-then-CREATE and therefore fall under that
-- rule. They have NOT been diffed against the live database yet.
--
-- Consolidates (in dependency order) the DDL half of:
--   1. 20260721_base_tables_reconstructed.sql
--   2. 20260701_companies_b2b.sql
--   3. 20260709_lead_capture_email.sql
--   4. 20260719_service_requests.sql
--   5. 20260727_service_request_rate_limit.sql
-- 20260727_events_tracking.sql is deliberately excluded.
--
-- KNOWN DUPLICATE POLICY NAMES (decide, do not let this happen silently):
-- the files below create "sr anon insert" / "sr admin read" / "sr admin update"
-- and "payments owner insert" / "payments owner/admin read" /
-- "payments admin update". On the abandoned project the live names were
-- "service_req anyone insert" / "service_req admin read" /
-- "service_req admin update" and "payments own insert" / "payments own read" /
-- "payments admin write". If the live project matches that, running this adds a
-- SECOND set alongside the first rather than replacing it. Permissive policies
-- OR together so behaviour is unchanged, but the table ends up with six.
-- No drops for the old names are included here — that is your call to make.
-- ============================================================================

begin;

-- ===== 1. BASE TABLES =======================================================

create table if not exists public.service_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text not null,
  message       text,
  service_id    text,
  service_title text,
  category      text,
  service_type  text,
  lang          text,
  status        text not null default 'new',
  created_at    timestamptz not null default now()
);
alter table public.service_requests enable row level security;

drop policy if exists "sr anon insert" on public.service_requests;
create policy "sr anon insert" on public.service_requests for insert with check (true);

drop policy if exists "sr admin read" on public.service_requests;
create policy "sr admin read" on public.service_requests for select using (public.is_admin());

drop policy if exists "sr admin update" on public.service_requests;
create policy "sr admin update" on public.service_requests for update
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  email        text,
  tier         text not null,
  billing      text not null default 'monthly',
  method       text not null,
  amount       int not null,
  status       text not null default 'pending',
  receipt_path text,
  receipt_name text,
  created_at   timestamptz not null default now()
);
alter table public.payments enable row level security;

drop policy if exists "payments owner insert" on public.payments;
create policy "payments owner insert" on public.payments for insert
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "payments owner/admin read" on public.payments;
create policy "payments owner/admin read" on public.payments for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments admin update" on public.payments;
create policy "payments admin update" on public.payments for update
  using (public.is_admin()) with check (public.is_admin());

-- ===== 2. B2B COMPANIES — tables, columns, indexes, policies ================

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  logo text,
  contact jsonb not null default '{}',
  categories text[] not null default '{}',
  services   text[] not null default '{}',
  areas      text[] not null default '{}',
  documents  jsonb not null default '[]',
  admin_note text,
  status text not null default 'pending',
  subscription_status text not null default 'none',
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists companies_owner_uniq on public.companies(owner_user_id);
alter table public.companies enable row level security;

drop policy if exists "companies read" on public.companies;
create policy "companies read" on public.companies for select using (
  owner_user_id = auth.uid() or public.is_admin()
  or (status = 'approved' and subscription_status = 'active')
);
drop policy if exists "companies owner update" on public.companies;
create policy "companies owner update" on public.companies for update
  using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());
drop policy if exists "companies admin all" on public.companies;
create policy "companies admin all" on public.companies for all
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.company_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan text not null default 'monthly',
  method text not null,
  amount int not null,
  status text not null default 'pending',
  receipt_path text, receipt_name text,
  created_at timestamptz not null default now()
);
alter table public.company_payments enable row level security;
drop policy if exists "cpay read" on public.company_payments;
create policy "cpay read" on public.company_payments for select using (
  public.is_admin() or exists (select 1 from public.companies c
    where c.id = company_id and c.owner_user_id = auth.uid()));
drop policy if exists "cpay owner insert" on public.company_payments;
create policy "cpay owner insert" on public.company_payments for insert with check (
  status = 'pending' and exists (select 1 from public.companies c
    where c.id = company_id and c.owner_user_id = auth.uid()));
drop policy if exists "cpay admin update" on public.company_payments;
create policy "cpay admin update" on public.company_payments for update
  using (public.is_admin()) with check (public.is_admin());

-- The column whose absence orphans every request from its customer.
alter table public.service_requests
  add column if not exists area text,
  add column if not exists broadcast boolean not null default false,
  add column if not exists customer_id uuid references public.profiles(id)
       on delete set null default auth.uid();

drop policy if exists "sr customer read own" on public.service_requests;
create policy "sr customer read own" on public.service_requests for select
  using (customer_id = auth.uid());

create table if not exists public.company_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.service_requests(id) on delete cascade,
  quote int, message text,
  chosen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, lead_id)
);
alter table public.company_responses enable row level security;
drop policy if exists "resp read" on public.company_responses;
create policy "resp read" on public.company_responses for select using (
  public.is_admin()
  or exists (select 1 from public.companies c where c.id = company_id and c.owner_user_id = auth.uid())
  or exists (select 1 from public.service_requests sr where sr.id = lead_id and sr.customer_id = auth.uid()));
drop policy if exists "resp company insert" on public.company_responses;
create policy "resp company insert" on public.company_responses for insert with check (
  exists (select 1 from public.companies c
    where c.id = company_id and c.owner_user_id = auth.uid()
      and c.status = 'approved' and c.subscription_status = 'active'
      and (c.subscription_expires_at is null or c.subscription_expires_at > now()))
  and exists (select 1 from public.service_requests sr where sr.id = lead_id and sr.broadcast = true));
drop policy if exists "resp admin all" on public.company_responses;
create policy "resp admin all" on public.company_responses for all
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text text,
  linked_lead_id uuid references public.service_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (customer_id, linked_lead_id)
);
alter table public.reviews enable row level security;
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);
drop policy if exists "reviews customer insert" on public.reviews;
create policy "reviews customer insert" on public.reviews for insert with check (
  customer_id = auth.uid()
  and exists (select 1 from public.company_responses r
    join public.service_requests sr on sr.id = r.lead_id
    where r.company_id = reviews.company_id and r.chosen
      and sr.customer_id = auth.uid() and sr.id = reviews.linked_lead_id));
drop policy if exists "reviews admin all" on public.reviews;
create policy "reviews admin all" on public.reviews for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.settings (key, value)
  values ('company_plan', '{"monthly": 2000, "currency": "TL"}'::jsonb)
  on conflict (key) do nothing;

-- ===== 3. LEAD EMAIL COLUMN + pg_net ========================================
-- The notify trigger and its function are in PART B.

alter table public.service_requests
  add column if not exists email text;

create extension if not exists pg_net;

-- ===== 4. REQUEST WORKFLOW ==================================================
-- DROP CONSTRAINT is on the scan list. It is included because the drop-then-add
-- pair is the only way to make an ADD CONSTRAINT idempotent. Verify against the
-- live database that no hand-made variant of this constraint exists before
-- running: a live constraint permitting a status value this one forbids would
-- start rejecting writes that currently succeed.

alter table public.service_requests
  add column if not exists admin_note text;

alter table public.service_requests drop constraint if exists service_requests_status_chk;
alter table public.service_requests add constraint service_requests_status_chk
  check (status in ('new', 'pending', 'accepted', 'done', 'rejected'));

create index if not exists service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index if not exists service_requests_status_idx   on public.service_requests(status, created_at desc);

-- ===== 5. RATE LIMIT — index only; function and trigger are in PART B ======

create index if not exists service_requests_phone_recent_idx
  on public.service_requests (phone, created_at desc);

commit;
