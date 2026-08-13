-- Status-transition guardrails for Service Requests and Medical Tourism (2026-08-13)
--
-- Replaces the direct `.update({status})` calls (which accepted any value,
-- e.g. jumping a medical request straight from pending_review to paid) with
-- two RPCs that reject an illegal transition server-side, matching the exact
-- same map the admin UI now uses to filter the status control
-- (src/lib/statusTransitions.ts) — so a transition rejected in the UI is
-- also rejected at the database, not just hidden from the button.
--
-- Each RPC logs to admin_audit_log (20260813_admin_audit_log.sql) in the
-- same transaction as the status change, so every transition is traceable.
--
-- Bookings' 4-state flow is intentionally left alone (Stage 1 flagged it as
-- lower risk) — can get the same treatment later with the same pattern.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once.
-- Requires 20260813_admin_audit_log.sql to already be applied (calls
-- admin_audit_log_write()).

create or replace function public.set_service_request_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_allowed text[];
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select status into v_current from public.service_requests where id = p_id;
  if v_current is null then
    raise exception 'not_found';
  end if;

  v_allowed := case v_current
    when 'new'      then array['accepted', 'rejected']
    when 'accepted' then array['done', 'rejected']
    else array[]::text[]  -- 'done' and 'rejected' are terminal
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'invalid_transition: % -> %', v_current, p_status;
  end if;

  update public.service_requests set status = p_status where id = p_id;

  perform public.admin_audit_log_write('status_change', 'service_request', p_id,
    jsonb_build_object('from', v_current, 'to', p_status));
end;
$$;
revoke all on function public.set_service_request_status(uuid, text) from public, anon;
grant execute on function public.set_service_request_status(uuid, text) to authenticated;

create or replace function public.set_medical_request_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_allowed text[];
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select status into v_current from public.medical_requests where id = p_id;
  if v_current is null then
    raise exception 'not_found';
  end if;

  v_allowed := case v_current
    when 'pending_review'     then array['under_review', 'cancelled']
    when 'under_review'       then array['collecting_offers', 'cancelled']
    when 'collecting_offers'  then array['offers_available', 'cancelled']
    when 'offers_available'   then array['awaiting_payment', 'collecting_offers', 'cancelled']
    when 'awaiting_payment'   then array['paid', 'cancelled']
    when 'paid'                then array['booked', 'cancelled']
    when 'booked'              then array['cancelled']
    else array[]::text[]  -- 'cancelled' is terminal
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'invalid_transition: % -> %', v_current, p_status;
  end if;

  update public.medical_requests set status = p_status where id = p_id;

  perform public.admin_audit_log_write('status_change', 'medical_request', p_id,
    jsonb_build_object('from', v_current, 'to', p_status));
end;
$$;
revoke all on function public.set_medical_request_status(uuid, text) from public, anon;
grant execute on function public.set_medical_request_status(uuid, text) to authenticated;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select proname from pg_proc
--  where proname in ('set_service_request_status','set_medical_request_status');
-- -- Try an illegal jump manually, expect an error:
-- -- select set_medical_request_status('<id>', 'paid') where the row is pending_review.
-- ============================================================================
