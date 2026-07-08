-- ============================================================================
-- Rafiq Istanbul — B2B "Companies" system.  2026-07-01
-- Companies pay a fixed monthly subscription, get a self-service portal, and
-- compete on broadcast customer requests; the customer chooses one.
-- Idempotent where possible (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Run once in Supabase → SQL Editor.  Also create two Storage buckets:
--   • company-logos  (PUBLIC)
--   • company-docs   (PRIVATE)
-- ============================================================================

-- 'company' joins 'user'|'admin' in profiles.role (free text — no enum change).
create or replace function public.is_company()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'company' from public.profiles where id = auth.uid()), false);
$$;

-- ---- companies -------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  logo text,                                   -- public bucket URL
  contact jsonb not null default '{}',         -- {email, phone, whatsapp} — in-platform only
  categories text[] not null default '{}',     -- service category ids (services.ts)
  services   text[] not null default '{}',     -- service item ids
  areas      text[] not null default '{}',     -- Istanbul district ids
  documents  jsonb not null default '[]',      -- [{name, path}] verification docs (private bucket)
  admin_note text,
  status text not null default 'pending',              -- pending|approved|suspended
  subscription_status text not null default 'none',    -- none|active|expired
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists companies_owner_uniq on public.companies(owner_user_id);
alter table public.companies enable row level security;

drop policy if exists "companies read" on public.companies;
create policy "companies read" on public.companies for select using (
  owner_user_id = auth.uid() or public.is_admin()
  or (status = 'approved' and subscription_status = 'active')   -- public profile only when active
);
drop policy if exists "companies owner update" on public.companies;
create policy "companies owner update" on public.companies for update
  using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());
drop policy if exists "companies admin all" on public.companies;
create policy "companies admin all" on public.companies for all
  using (public.is_admin()) with check (public.is_admin());
-- no public INSERT: companies are created via register_company() only.

-- owners may edit profile fields but NOT status / subscription / note / owner.
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

-- ---- company_payments (mirror of the user-payments flow) -------------------
create table if not exists public.company_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan text not null default 'monthly',
  method text not null,                        -- card|bank_transfer|crypto
  amount int not null,
  status text not null default 'pending',      -- pending|confirmed|rejected
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

-- ---- extend service_requests (the broadcast lead) --------------------------
alter table public.service_requests
  add column if not exists area text,
  add column if not exists broadcast boolean not null default false,
  add column if not exists customer_id uuid references public.profiles(id)
       on delete set null default auth.uid();   -- auto-stamps the logged-in submitter
-- existing policies unchanged (anon INSERT, admin SELECT). Add: customer reads own.
drop policy if exists "sr customer read own" on public.service_requests;
create policy "sr customer read own" on public.service_requests for select
  using (customer_id = auth.uid());
-- companies never read this table directly (phone privacy) — they use company_leads().

-- ---- company_responses (offers) --------------------------------------------
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
-- the chosen flag is flipped only via choose_response().

-- ---- reviews (tied to a real, chosen transaction) --------------------------
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

-- ============================== RPCs ========================================
-- register / refresh the caller's company (pending) + promote to 'company' role.
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
   where public.companies.status <> 'approved'           -- can't edit a live company this way
  returning id into cid;
  if cid is null then
    select id into cid from public.companies where owner_user_id = auth.uid();
  end if;
  update public.profiles set role = 'company' where id = auth.uid() and role <> 'admin';
  return cid;
end; $$;

-- matching broadcast leads for the caller's ACTIVE company (phone REDACTED).
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

-- customer-facing: top 5 responses on MY lead, ranked by company rating.
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

-- customer picks one offer (sets chosen, clears siblings) — must own the lead.
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

-- admin confirms / rejects a company payment; confirm → activate one month.
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

-- ---- default fixed monthly company plan price (admin-editable later) --------
insert into public.settings (key, value)
  values ('company_plan', '{"monthly": 2000, "currency": "TL"}'::jsonb)
  on conflict (key) do nothing;
