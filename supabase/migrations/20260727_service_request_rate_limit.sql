-- ============================================================================
-- Rate-limit anonymous service_requests inserts (2026-07-27)
--
-- WHY
-- ----------------------------------------------------------------------------
-- The "sr anon insert" policy is `with check (true)` — deliberately, because a
-- logged-out visitor must be able to submit. That also means anyone with the
-- public anon key and a loop can fill the table, and there is no admin surface
-- that survives that: the /admin queue is how requests are seen at all.
--
-- The client-side cooldown (src/lib/submitThrottle.ts) stops double-taps and
-- casual repeats, but it lives in the visitor's own localStorage and is trivial
-- to bypass. This trigger is the part that actually enforces a limit.
--
-- CHOICE OF N = 5 PER HOUR
-- ----------------------------------------------------------------------------
-- The client already caps a well-behaved browser at 3/hour, so 5 sits
-- deliberately above it: this trigger is here to stop a script that bypassed
-- the client, not to second-guess a real person who cleared their storage or
-- switched device mid-enquiry. A genuine customer asking about two or three
-- different services back to back stays comfortably under it, and someone who
-- does hit it gets a message saying we already have their requests rather than
-- an error implying they failed. Raise it if a real customer ever complains;
-- lower it only if you actually see abuse.
--
-- Counted separately for phone and (when signed in) customer_id, so rotating
-- one does not reset the other.
--
-- SECURITY DEFINER is REQUIRED here: the anon role cannot SELECT from
-- service_requests (reads are admin-only), so a counting query running as the
-- caller would always see zero rows and never fire.
--
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   1. Supabase dashboard -> SQL Editor -> New query.
--   2. Paste this whole file and Run. Safe to run more than once.
--   3. Confirm with the SELECT at the bottom.
-- ============================================================================

-- Makes the per-phone window lookup an index scan rather than a seq scan.
-- (customer_id already has service_requests_customer_idx from 20260719.)
create index if not exists service_requests_phone_recent_idx
  on public.service_requests (phone, created_at desc);

create or replace function public.service_requests_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep these two in sync with the comment block above.
  v_window constant interval := interval '1 hour';
  v_max    constant integer  := 5;
  v_count  integer;
begin
  select count(*) into v_count
    from public.service_requests
   where phone = new.phone
     and created_at > now() - v_window;

  if v_count >= v_max then
    -- The client matches on this exact string (src/lib/api.ts fail()) to show
    -- the "we already have your request" copy instead of a generic failure.
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

-- ============================================================================
-- VERIFICATION (read-only) — expect exactly one row, tgenabled = 'O'
-- ----------------------------------------------------------------------------
-- select t.tgname, t.tgenabled, p.proname, p.prosecdef
--   from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--   join pg_proc  p on p.oid = t.tgfoid
--  where not t.tgisinternal
--    and c.relname = 'service_requests'
--    and t.tgname  = 'trg_service_requests_rate_limit';
-- ============================================================================
