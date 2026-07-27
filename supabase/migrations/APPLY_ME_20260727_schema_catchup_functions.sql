-- ============================================================================
-- SCHEMA CATCH-UP — PART B of 2: FUNCTIONS AND THEIR TRIGGERS.  2026-07-27
--
-- !! DO NOT RUN UNTIL EVERY FUNCTION BELOW HAS BEEN DIFFED AGAINST LIVE. !!
--
-- WHY THIS IS SPLIT OUT
-- ----------------------------------------------------------------------------
-- Every statement in this file is CREATE OR REPLACE FUNCTION or a
-- DROP TRIGGER … / CREATE TRIGGER pair. Both are destructive by overwrite:
-- they replace whatever is live with no backup and nothing to restore from.
--
-- Migrations in this repo have been hand-pasted into the Supabase SQL Editor
-- for months, and the SQL Editor keeps no history. Any of these ten function
-- bodies may contain a hand-made fix on the live database that exists in NO
-- file in this repo. Running this file would silently revert it — including
-- admin_resolve_payment, which activates paid subscriptions, and
-- service_requests_rate_limit, which is the only real abuse control on an
-- anonymous insert path.
--
-- Triggers live here rather than in Part A because a CREATE TRIGGER cannot
-- resolve until its function exists, and because a DROP TRIGGER is not made
-- safe by the CREATE that follows it.
--
-- REQUIRED BEFORE RUNNING
-- ----------------------------------------------------------------------------
--   1. Run RECON_20260727_live_state.sql against the LIVE project
--      (jdtspvkhomctqkgdmjdn — see .env line 17, NOT iseldofsfhwvpfzltqet).
--   2. Diff each pg_get_functiondef() output against the body below.
--   3. Where they differ, the live body wins until proven otherwise: the file
--      is not authoritative, and installing it would be a regression.
--
-- FUNCTIONS REPLACED BY THIS FILE (10):
--   admin_resolve_payment              guard_company_fields
--   is_company                         register_company
--   company_leads                      lead_responses
--   choose_response                    admin_resolve_company_payment
--   notify_new_service_request         service_requests_rate_limit
--
-- TRIGGERS REPLACED BY THIS FILE (3):
--   trg_guard_company                  on_service_request_notify
--   trg_service_requests_rate_limit
-- ============================================================================

begin;

-- ===== from 20260721_base_tables_reconstructed.sql ==========================

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

-- ===== from 20260701_companies_b2b.sql ======================================

create or replace function public.is_company()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'company' from public.profiles where id = auth.uid()), false);
$$;

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

-- ===== from 20260709_lead_capture_email.sql =================================
-- No-ops until app.lead_webhook_url is set.

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

-- ===== from 20260727_service_request_rate_limit.sql =========================
-- Requires service_requests_phone_recent_idx and the customer_id column, both
-- created in PART A. Run Part A first.

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
