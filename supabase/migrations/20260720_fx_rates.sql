-- Server-side FX rates with validation, audit trail and manual override.
--
-- Replaces browser-side fetching: the client used to call open.er-api.com and
-- coingecko directly from the user's page. Now a daily cron writes here and the
-- client only ever reads this table.
--
-- Three tables, one job each:
--   fx_rates       current value per pair (what the ticker reads)
--   fx_rate_audit  append-only log of every change, automatic or manual
--   fx_sync_runs   one row per cron attempt — the source of "last successful update"
--
-- Safe to re-run.

-- ------------------------------------------------------------- fx_rates ----
create table if not exists public.fx_rates (
  pair              text primary key,               -- 'USD/TRY', 'BTC/USD', …
  rate              numeric(20, 6) not null check (rate > 0),
  source            text not null default 'provider',   -- provider | manual
  provider_name     text,                           -- which feed produced it
  validation_status text not null default 'ok',     -- ok | suspect | stale
  fetched_at        timestamptz,                    -- when the PROVIDER priced it
  updated_at        timestamptz not null default now(),
  -- Manual override state. `override_reason` is mandatory for a manual rate:
  -- an untraceable hand-edited exchange rate is exactly what the audit trail
  -- exists to prevent.
  override_reason   text,
  override_by       uuid references public.profiles(id) on delete set null,
  constraint fx_rates_source_check check (source in ('provider', 'manual')),
  constraint fx_rates_status_check check (validation_status in ('ok', 'suspect', 'stale')),
  constraint fx_rates_manual_needs_reason check (
    source <> 'manual'
    or (override_reason is not null and length(btrim(override_reason)) > 0)
  )
);

alter table public.fx_rates enable row level security;

-- Public read: the ticker is on every page, including for signed-out visitors.
drop policy if exists "fx_rates public read" on public.fx_rates;
create policy "fx_rates public read" on public.fx_rates for select using (true);

-- No client write path at all. The cron uses the service-role key (which
-- bypasses RLS); admins go through set_fx_override(), never a direct UPDATE.
drop policy if exists "fx_rates admin write" on public.fx_rates;
create policy "fx_rates admin write" on public.fx_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------- fx_rate_audit ----
create table if not exists public.fx_rate_audit (
  id                uuid primary key default gen_random_uuid(),
  pair              text not null,
  old_rate          numeric(20, 6),
  new_rate          numeric(20, 6),
  source            text not null,                  -- provider | manual
  validation_status text,
  reason            text,                           -- required for manual edits
  actor             uuid references public.profiles(id) on delete set null,  -- null = system
  created_at        timestamptz not null default now()
);

create index if not exists fx_rate_audit_pair_idx on public.fx_rate_audit (pair, created_at desc);

alter table public.fx_rate_audit enable row level security;

-- Admins only: the audit log names who changed what.
drop policy if exists "fx_rate_audit admin read" on public.fx_rate_audit;
create policy "fx_rate_audit admin read" on public.fx_rate_audit
  for select using (public.is_admin());

-- --------------------------------------------------------- fx_sync_runs ----
create table if not exists public.fx_sync_runs (
  id             uuid primary key default gen_random_uuid(),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null,                     -- success | partial | failed
  provider_name  text,
  pairs_updated  int not null default 0,
  pairs_rejected int not null default 0,
  error          text,
  -- Istanbul wall-clock at run time. Turkey is permanently UTC+3 (DST abolished
  -- 2016) so this should always read 09:05; recording it means a future DST
  -- change shows up as visible drift instead of a silently wrong schedule.
  local_time     text,
  constraint fx_sync_runs_status_check check (status in ('success', 'partial', 'failed'))
);

create index if not exists fx_sync_runs_started_idx on public.fx_sync_runs (started_at desc);

alter table public.fx_sync_runs enable row level security;

drop policy if exists "fx_sync_runs admin read" on public.fx_sync_runs;
create policy "fx_sync_runs admin read" on public.fx_sync_runs
  for select using (public.is_admin());

-- ------------------------------------------------- set_fx_override() RPC ----
-- The ONLY admin write path. Forces a reason and writes the audit row in the
-- same transaction, so a rate can never change without a traceable why.
create or replace function public.set_fx_override(
  p_pair   text,
  p_rate   numeric,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'invalid_rate';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  select rate into v_old from public.fx_rates where pair = p_pair;

  insert into public.fx_rates (pair, rate, source, validation_status, updated_at, override_reason, override_by)
  values (p_pair, p_rate, 'manual', 'ok', now(), btrim(p_reason), auth.uid())
  on conflict (pair) do update set
    rate = excluded.rate,
    source = 'manual',
    validation_status = 'ok',
    updated_at = now(),
    override_reason = excluded.override_reason,
    override_by = excluded.override_by;

  insert into public.fx_rate_audit (pair, old_rate, new_rate, source, validation_status, reason, actor)
  values (p_pair, v_old, p_rate, 'manual', 'ok', btrim(p_reason), auth.uid());
end;
$$;

-- Revoke from PUBLIC, not just anon: Postgres grants EXECUTE to PUBLIC by
-- default and anon inherits it, so `revoke ... from anon` alone is a no-op.
revoke all on function public.set_fx_override(text, numeric, text) from public, anon;
grant execute on function public.set_fx_override(text, numeric, text) to authenticated;

-- Releasing an override hands the pair back to the daily feed.
create or replace function public.clear_fx_override(p_pair text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select rate into v_old from public.fx_rates where pair = p_pair;

  -- Marked stale, not deleted: the ticker keeps showing the last known number
  -- (flagged) until the next sync, rather than blanking the pair.
  update public.fx_rates
     set source = 'provider',
         validation_status = 'stale',
         override_reason = null,
         override_by = null,
         updated_at = now()
   where pair = p_pair;

  insert into public.fx_rate_audit (pair, old_rate, new_rate, source, validation_status, reason, actor)
  values (p_pair, v_old, v_old, 'provider', 'stale', coalesce(nullif(btrim(p_reason), ''), 'override released'), auth.uid());
end;
$$;

revoke all on function public.clear_fx_override(text, text) from public, anon;
grant execute on function public.clear_fx_override(text, text) to authenticated;
