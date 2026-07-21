-- ============================================================================
-- Base tables reconstructed for the account migration (2026-07-21).
--
-- service_requests and payments existed in the old live project but were
-- created directly in the Supabase dashboard and never committed as a
-- migration (see SUPABASE-SETUP.md: "schema.sql is NOT authoritative").
-- Reconstructed here from actual usage in src/lib/api.ts so a brand-new
-- project can be bootstrapped from schema.sql + migrations/ alone.
--
-- Run AFTER schema.sql and BEFORE 20260701_companies_b2b.sql /
-- 20260719_service_requests.sql (both ALTER these tables).
-- Idempotent.
-- ============================================================================

-- ---------- service_requests ("Help me with this" leads, anon-submittable) --
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

-- ---------- payments (subscription checkout: card/bank/crypto) --------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  email        text,
  tier         text not null,                    -- light | pro | elite
  billing      text not null default 'monthly',  -- monthly | annual
  method       text not null,                     -- card | bank_transfer | crypto
  amount       int not null,
  status       text not null default 'pending',   -- pending | verified | rejected
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

-- Admin verifies/rejects a payment; verified (re)activates the subscription.
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
