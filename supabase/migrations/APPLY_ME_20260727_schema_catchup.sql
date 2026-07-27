-- ============================================================================
-- SCHEMA CATCH-UP — one consolidated, idempotent script.        2026-07-27
--
-- WHY THIS FILE EXISTS
-- ----------------------------------------------------------------------------
-- The live database had drifted badly behind the code. Five migration files in
-- this directory had never been applied, which is why:
--   • service_requests had no customer_id column at all, so EVERY request ever
--     submitted was orphaned and could never appear under any customer account;
--   • no owner-read RLS policy existed, so even with the column a customer
--     could not SELECT their own row;
--   • companies / company_payments / company_responses / reviews did not exist,
--     so the whole B2B and broadcast feature was writing into nothing;
--   • the anon-insert rate limit was not enforced.
--
-- This consolidates, IN DEPENDENCY ORDER:
--   1. 20260721_base_tables_reconstructed.sql
--   2. 20260701_companies_b2b.sql
--   3. 20260709_lead_capture_email.sql
--   4. 20260719_service_requests.sql
--   5. 20260727_service_request_rate_limit.sql
--
-- DELIBERATELY EXCLUDED: 20260727_events_tracking.sql — still being revised for
-- retention, to be run separately.
--
-- PROPERTIES
-- ----------------------------------------------------------------------------
--   • Idempotent. Every statement is IF NOT EXISTS / CREATE OR REPLACE /
--     DROP ... IF EXISTS + CREATE. Safe to run any number of times.
--   • Additive and non-destructive. No DROP TABLE, DROP COLUMN, TRUNCATE,
--     DELETE, ALTER COLUMN TYPE or RENAME. The single DROP CONSTRAINT IF EXISTS
--     in section 4 removes a constraint that does not exist yet and re-adds it
--     on the next line; it touches no data.
--   • Wrapped in one transaction, so a failure anywhere rolls back everything
--     and leaves the database exactly as it was.
--
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   Then run the verification query at the bottom of this file to confirm.
-- ============================================================================

begin;

-- ============================================================================
-- 1. BASE TABLES (from 20260721_base_tables_reconstructed.sql)
--    Both tables already exist live, so the CREATEs no-op. The policies below
--    use different names from the ones already present ("service_req ..." /
--    "payments own ..."); RLS permissive policies OR together and these
--    predicates are equivalent, so behaviour is unchanged.
-- ============================================================================

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

create or replace function public.admin_resolve_payment(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_tier text; v_billing text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('verified','rejected') then raise exception 'invalid_status'; end if;

  update public.payments set status = p_status
    where id = p_id
    returning user_id, tier, billing into v_user, v_tier, v_billing;

  if v_user is null then raise exception 'not_found'; end if;

  if p_status = 'verified' then
    insert into public.subscriptions (user_id, tier, billing, status, started_at, expires_at)
    values (v_user, v_tier, v_billing, 'active', now(),
            now() + case when v_billing = 'annual' then interval '1 year' else interval '1 month' end)
    on conflict (user_id) do update
      set tier = excluded.tier, billing = excluded.billing, status = 'active',
          started_at = now(), expires_at = excluded.expires_at;
  end if;
end; $$;

-- ============================================================================
-- 2. B2B COMPANIES (from 20260701_companies_b2b.sql)
--    Also adds area / broadcast / customer_id to service_requests, and the
--    owner-read policy that Problem 2 turned on.
-- ============================================================================

create or replace function public.is_company()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'company' from public.profiles where id = auth.uid()), false);
$$;

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

create or replace function public.guard_company_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := old.status;
    new.subscription_status := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.admin_note := old.admin_note;
    new.owner_user_id := old.owner_user_id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_company on public.companies;
create trigger trg_guard_company before update on public.companies
  for each row execute function public.guard_company_fields();

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

create or replace function public.register_company(
  p_name text, p_description text, p_contact jsonb,
  p_categories text[], p_services text[], p_areas text[], p_documents jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.companies (owner_user_id, name, description, contact, categories, services, areas, documents)
    values (auth.uid(), p_name, p_description, coalesce(p_contact, '{}'),
            coalesce(p_categories, '{}'), coalesce(p_services, '{}'),
            coalesce(p_areas, '{}'), coalesce(p_documents, '[]'))
  on conflict (owner_user_id) do update
     set name = excluded.name, description = excluded.description, contact = excluded.contact,
         categories = excluded.categories, services = excluded.services, areas = excluded.areas,
         documents = excluded.documents
   where public.companies.status <> 'approved'
  returning id into cid;
  if cid is null then
    select id into cid from public.companies where owner_user_id = auth.uid();
  end if;
  update public.profiles set role = 'company' where id = auth.uid() and role <> 'admin';
  return cid;
end; $$;

create or replace function public.company_leads()
returns table(id uuid, service_title text, category text, area text, message text,
              customer_name text, created_at timestamptz, responded boolean)
language sql stable security definer set search_path = public as $$
  select sr.id, sr.service_title, sr.category, sr.area, sr.message,
         split_part(coalesce(sr.name, ''), ' ', 1) as customer_name, sr.created_at,
         exists(select 1 from public.company_responses r where r.lead_id = sr.id and r.company_id = c.id)
  from public.service_requests sr
  join public.companies c on c.owner_user_id = auth.uid()
  where c.status = 'approved' and c.subscription_status = 'active'
    and (c.subscription_expires_at is null or c.subscription_expires_at > now())
    and sr.broadcast = true
    and sr.category = any(c.categories)
    and (sr.area is null or sr.area = any(c.areas))
  order by sr.created_at desc;
$$;

create or replace function public.lead_responses(p_lead_id uuid)
returns table(id uuid, company_id uuid, company_name text, logo text,
              quote int, message text, chosen boolean, rating numeric, reviews int)
language sql stable security definer set search_path = public as $$
  select r.id, r.company_id, c.name, c.logo, r.quote, r.message, r.chosen,
         coalesce(avg(rv.rating), 0)::numeric(3,2), count(rv.id)::int
  from public.company_responses r
  join public.companies c on c.id = r.company_id
  join public.service_requests sr on sr.id = r.lead_id
  left join public.reviews rv on rv.company_id = c.id
  where r.lead_id = p_lead_id and sr.customer_id = auth.uid()
  group by r.id, c.name, c.logo
  order by avg(rv.rating) desc nulls last, r.created_at asc
  limit 5;
$$;

create or replace function public.choose_response(p_response_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  select r.lead_id into v_lead from public.company_responses r
   join public.service_requests sr on sr.id = r.lead_id
   where r.id = p_response_id and sr.customer_id = auth.uid();
  if v_lead is null then raise exception 'not_found'; end if;
  update public.company_responses set chosen = (id = p_response_id) where lead_id = v_lead;
end; $$;

create or replace function public.admin_resolve_company_payment(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.company_payments set status = p_status where id = p_id returning company_id into v_company;
  if p_status = 'confirmed' then
    update public.companies
       set subscription_status = 'active',
           subscription_expires_at = greatest(coalesce(subscription_expires_at, now()), now()) + interval '1 month'
     where id = v_company;
  end if;
end; $$;

insert into public.settings (key, value)
  values ('company_plan', '{"monthly": 2000, "currency": "TL"}'::jsonb)
  on conflict (key) do nothing;

-- ============================================================================
-- 3. LEAD CAPTURE EMAIL + WEBHOOK (from 20260709_lead_capture_email.sql)
--    The webhook no-ops silently until app.lead_webhook_url is set, so this is
--    safe to install before you have a destination ready.
-- ============================================================================

alter table public.service_requests
  add column if not exists email text;

create extension if not exists pg_net;

create or replace function public.notify_new_service_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  webhook_url text := current_setting('app.lead_webhook_url', true);
begin
  if webhook_url is not null and webhook_url <> '' then
    perform net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'name', new.name,
        'phone', new.phone,
        'email', new.email,
        'message', new.message,
        'service_title', new.service_title,
        'category', new.category,
        'service_type', new.service_type,
        'lang', new.lang,
        'created_at', new.created_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_service_request_notify on public.service_requests;
create trigger on_service_request_notify
  after insert on public.service_requests
  for each row execute function public.notify_new_service_request();

-- ============================================================================
-- 4. SERVICE REQUEST WORKFLOW (from 20260719_service_requests.sql)
--    The DROP CONSTRAINT below removes a constraint that does not currently
--    exist and re-adds it on the next line. It touches no data. All 7 live
--    rows are status 'new' and satisfy the new check.
-- ============================================================================

alter table public.service_requests
  add column if not exists admin_note text;

alter table public.service_requests drop constraint if exists service_requests_status_chk;
alter table public.service_requests add constraint service_requests_status_chk
  check (status in ('new', 'pending', 'accepted', 'done', 'rejected'));

create index if not exists service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index if not exists service_requests_status_idx   on public.service_requests(status, created_at desc);

-- ============================================================================
-- 5. ANON INSERT RATE LIMIT (from 20260727_service_request_rate_limit.sql)
-- ============================================================================

create index if not exists service_requests_phone_recent_idx
  on public.service_requests (phone, created_at desc);

create or replace function public.service_requests_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_window constant interval := interval '1 hour';
  v_max    constant integer  := 5;
  v_count  integer;
begin
  select count(*) into v_count
    from public.service_requests
   where phone = new.phone
     and created_at > now() - v_window;

  if v_count >= v_max then
    raise exception 'service_request_rate_limit'
      using errcode = 'P0001',
            hint    = 'Too many service requests from this phone in the last hour.';
  end if;

  if new.customer_id is not null then
    select count(*) into v_count
      from public.service_requests
     where customer_id = new.customer_id
       and created_at > now() - v_window;

    if v_count >= v_max then
      raise exception 'service_request_rate_limit'
        using errcode = 'P0001',
              hint    = 'Too many service requests from this account in the last hour.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_requests_rate_limit on public.service_requests;
create trigger trg_service_requests_rate_limit
  before insert on public.service_requests
  for each row execute function public.service_requests_rate_limit();

commit;

-- ============================================================================
-- VERIFICATION (read-only) — run separately. Anything with present = false
-- sorts to the top. Expect zero false rows.
-- ============================================================================
-- with expected(kind, name, present) as (
--   select 'table', n, to_regclass('public.' || n) is not null
--     from unnest(array['service_requests','payments','companies','company_payments',
--                       'company_responses','reviews']) n
--   union all
--   select 'column service_requests.' || n, n,
--          exists (select 1 from information_schema.columns
--                   where table_schema='public' and table_name='service_requests' and column_name=n)
--     from unnest(array['customer_id','email','area','broadcast','admin_note']) n
--   union all
--   select 'policy', n, exists (select 1 from pg_policies where schemaname='public' and policyname=n)
--     from unnest(array['sr customer read own','sr anon insert','sr admin read','sr admin update',
--                       'companies read','companies owner update','companies admin all',
--                       'cpay read','cpay owner insert','cpay admin update',
--                       'resp read','resp company insert','resp admin all',
--                       'reviews public read','reviews customer insert','reviews admin all',
--                       'payments owner insert','payments owner/admin read','payments admin update']) n
--   union all
--   select 'trigger', n, exists (select 1 from pg_trigger where not tgisinternal and tgname=n)
--     from unnest(array['trg_service_requests_rate_limit','on_service_request_notify','trg_guard_company']) n
--   union all
--   select 'function', n, exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
--                                  where ns.nspname='public' and p.proname=n)
--     from unnest(array['is_company','register_company','company_leads','lead_responses','choose_response',
--                       'admin_resolve_company_payment','admin_resolve_payment',
--                       'notify_new_service_request','service_requests_rate_limit','guard_company_fields']) n
--   union all
--   select 'index', n, exists (select 1 from pg_indexes where schemaname='public' and indexname=n)
--     from unnest(array['service_requests_customer_idx','service_requests_status_idx',
--                       'service_requests_phone_recent_idx','companies_owner_uniq']) n
--   union all
--   select 'constraint', 'service_requests_status_chk',
--          exists (select 1 from pg_constraint where conname='service_requests_status_chk')
--   union all
--   select 'extension', 'pg_net', exists (select 1 from pg_extension where extname='pg_net')
-- )
-- select kind, name, present from expected order by present, kind, name;
