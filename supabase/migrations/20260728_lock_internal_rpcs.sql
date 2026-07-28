-- ============================================================================
-- Lock the internal RPCs + tighten permissive RLS (2026-07-28)
--
-- WHY
-- ----------------------------------------------------------------------------
-- Three SECURITY DEFINER functions were executable by `anon` and
-- `authenticated` through /rest/v1/rpc/* on the live project:
--
--   _activate_sub(uuid,text,text,integer)  — no authorization check at all:
--                                            an anonymous visitor could grant
--                                            any account any tier.
--   checkout_card_demo(text,text)          — "demo" checkout that inserted a
--                                            payments row with status
--                                            'verified' and activated a plan
--                                            with no payment.
--   _credit_referrer(uuid,text,integer)    — minted 30% cash referral
--                                            commissions for any account.
--
-- These are internal helpers; nothing in src/ calls them (the client's card
-- path records a PENDING payment like bank/crypto — see
-- 20260621_secure_checkout.sql). They must not be reachable from the public
-- REST API at all.
--
-- Also in this file: search_path pins flagged by the security advisor, the
-- WITH CHECK (true) policies on referral_clicks and service_requests, the
-- over-broad listing policy on the public `listings` storage bucket, and the
-- dead `dukk` table.
--
-- DASHBOARD-ONLY (cannot be done in SQL — do these by hand):
--   * Auth -> Settings -> enable Leaked Password Protection.
--
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   Supabase dashboard -> SQL Editor -> paste this whole file -> Run.
--   Idempotent: safe to run more than once, and safe on a fresh dev database
--   where the live-only functions do not exist.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Internal helpers must never be reachable from the public REST API.
--    (Wrapped in existence checks: these functions exist live but not in a
--    database built only from this repo's migrations.)
-- ----------------------------------------------------------------------------
do $$
declare sig text;
begin
  foreach sig in array array[
    'public._activate_sub(uuid, text, text, integer)',
    'public._credit_referrer(uuid, text, integer)',
    'public._plan_price(text, text)'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke execute on function %s from anon, authenticated, public', sig);
    end if;
  end loop;
end $$;

-- Dev-only checkout must not exist in production. Drop every overload,
-- whatever its argument types.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'checkout_card_demo'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 2. Defence in depth: even if EXECUTE is ever re-granted, _activate_sub
--    refuses to run unprivileged. Only the service_role (gateway webhook),
--    the superuser, or an admin session may activate a subscription.
-- ----------------------------------------------------------------------------
create or replace function public._activate_sub(p_uid uuid, p_tier text, p_billing text, p_days integer)
  returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if current_setting('role', true) not in ('service_role', 'postgres') and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  insert into public.subscriptions (user_id, tier, billing, status, started_at, expires_at)
  values (p_uid, p_tier, p_billing, 'active', now(), now() + make_interval(days => p_days))
  on conflict (user_id) do update
    set tier = excluded.tier, billing = excluded.billing, status = 'active',
        started_at = now(), expires_at = excluded.expires_at,
        cancel_reason = null, cancel_comment = null;
end $$;
revoke execute on function public._activate_sub(uuid, text, text, integer) from anon, authenticated, public;

-- _credit_referrer's body exists only on the live project (this repo never
-- carried it), so it cannot be recreated here without inventing money logic.
-- The REVOKE above already removes it from the REST surface. To add the same
-- in-function guard: dashboard -> Database -> Functions -> _credit_referrer
-- -> paste the first three lines of _activate_sub's body (the
-- current_setting/is_admin check) at the top of its body and save.
do $$
begin
  if to_regprocedure('public._credit_referrer(uuid, text, integer)') is not null then
    execute $sql$alter function public._credit_referrer(uuid, text, integer) set search_path to 'public'$sql$;
  end if;
end $$;

-- Pin the two functions flagged by the advisor for a mutable search_path.
do $$
begin
  if to_regprocedure('public._plan_price(text, text)') is not null then
    execute $sql$alter function public._plan_price(text, text) set search_path to 'public'$sql$;
  end if;
  if to_regprocedure('public.event_trigger_fn()') is not null then
    execute $sql$alter function public.event_trigger_fn() set search_path to 'public'$sql$;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 3. referral_clicks: INSERT was WITH CHECK (true) — unbounded click
--    inflation for any string. Now a click must name a code that actually
--    belongs to someone, and each code takes at most 30 clicks per hour.
-- ----------------------------------------------------------------------------

-- anon cannot SELECT profiles, so the existence check must run as definer.
create or replace function public.referral_code_exists(p_code text)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.profiles where referral_code = p_code);
$$;
-- Only usable as a boolean check; exposes nothing about whose code it is.
grant execute on function public.referral_code_exists(text) to anon, authenticated;

drop policy if exists "clicks anyone insert" on public.referral_clicks;
create policy "clicks anyone insert" on public.referral_clicks for insert
  with check (
    code = upper(code)
    and code ~ '^[A-Z0-9]{4,12}$'
    and public.referral_code_exists(code)
  );

-- Same per-window pattern as trg_service_requests_rate_limit (20260727).
-- 30/hour/code: a genuinely shared link absorbs a group-chat spike, while a
-- looped script stops inflating the referrer's stats after the first page.
create index if not exists referral_clicks_code_recent_idx
  on public.referral_clicks (code, created_at desc);

create or replace function public.referral_clicks_rate_limit()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_window constant interval := interval '1 hour';
  v_max    constant integer  := 30;
  v_count  integer;
begin
  select count(*) into v_count
    from public.referral_clicks
   where code = new.code
     and created_at > now() - v_window;
  if v_count >= v_max then
    raise exception 'referral_click_rate_limit'
      using errcode = 'P0001',
            hint = 'Too many clicks recorded for this code in the last hour.';
  end if;
  return new;
end $$;

drop trigger if exists trg_referral_clicks_rate_limit on public.referral_clicks;
create trigger trg_referral_clicks_rate_limit
  before insert on public.referral_clicks
  for each row execute function public.referral_clicks_rate_limit();


-- ----------------------------------------------------------------------------
-- 4. service_requests: INSERT stays open to logged-out visitors (that is the
--    product), but the row must at least look like a real enquiry. The 5/hour
--    limit from 20260727_service_request_rate_limit.sql stays in force on top.
-- ----------------------------------------------------------------------------
drop policy if exists "sr anon insert" on public.service_requests;
create policy "sr anon insert" on public.service_requests for insert
  with check (
    length(trim(name))  between 1 and 160
    and length(trim(phone)) between 6 and 40
    and length(coalesce(service_title, '')) <= 200
    and length(coalesce(message, ''))       <= 4000
  );


-- ----------------------------------------------------------------------------
-- 5. Storage: the public `listings` bucket serves files by URL; it does not
--    need a SELECT policy on storage.objects, and the broad one it has lets
--    any client enumerate every file. Drop whatever it is called live.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'SELECT'
      and coalesce(qual, '') like '%listings%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 6. public.dukk: RLS enabled, zero policies, zero references anywhere in the
--    codebase — unreachable by every role. Dead; drop it.
-- ----------------------------------------------------------------------------
drop table if exists public.dukk;


-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
-- ----------------------------------------------------------------------------
-- 1. Expect ZERO rows (nothing grants these to anon/authenticated any more):
-- select p.proname, a.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
--   join pg_roles a on a.oid = acl.grantee
--  where n.nspname = 'public'
--    and p.proname in ('_activate_sub', '_credit_referrer', '_plan_price', 'checkout_card_demo')
--    and a.rolname in ('anon', 'authenticated');
--
-- 2. Expect 0 rows (function gone):
-- select proname from pg_proc where proname = 'checkout_card_demo';
--
-- 3. Expect the tightened policies:
-- select policyname, cmd, with_check from pg_policies
--  where tablename in ('referral_clicks', 'service_requests') and cmd = 'INSERT';
--
-- 4. Expect no SELECT policy mentioning listings:
-- select policyname from pg_policies
--  where schemaname = 'storage' and tablename = 'objects'
--    and cmd = 'SELECT' and coalesce(qual, '') like '%listings%';
--
-- 5. Re-run the Supabase security advisor: the
--    anon_security_definer_function_executable entries for _activate_sub,
--    _credit_referrer and checkout_card_demo must be gone.
-- ============================================================================
