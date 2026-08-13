-- ============================================================================
-- Fix: lock the offer row before check-then-write in the two customer-facing
-- service-offer RPCs, closing a race between "pay" and "reject" fired at
-- nearly the same instant (two concurrent calls could both pass their
-- status='sent' check before either writes, leaving a payment session
-- created on an offer that then also gets marked rejected, or vice versa).
-- 2026-08-13. Idempotent (CREATE OR REPLACE) — safe to run more than once.
-- Run in the Supabase dashboard -> SQL Editor -> New query -> Run.
-- ============================================================================

create or replace function public.create_service_payment_session(p_offer_id uuid)
returns table(payment_id uuid, amount numeric, currency text, gateway_session_id text)
language plpgsql security definer set search_path = public as $$
declare
  v_offer public.service_offers%rowtype;
  v_uid uuid := auth.uid();
  v_id uuid;
  v_session text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- lock the offer row first so a concurrent reject can't slip in between
  -- this check and the insert below.
  select o.* into v_offer
    from public.service_offers o
    join public.service_requests r on r.id = o.request_id
   where o.id = p_offer_id and r.customer_id = v_uid
   for update of o;
  if v_offer.id is null then raise exception 'offer_not_found'; end if;
  if v_offer.status <> 'sent' then raise exception 'offer_not_found'; end if;

  if v_offer.expires_at is not null and v_offer.expires_at < now() then
    raise exception 'offer_expired';
  end if;

  if exists (select 1 from public.service_payments
              where offer_id = p_offer_id and status in ('pending', 'verified')) then
    raise exception 'payment_already_exists';
  end if;

  v_session := encode(gen_random_bytes(16), 'hex');

  insert into public.service_payments
    (request_id, offer_id, user_id, amount, currency, status, gateway_session_id)
  values (v_offer.request_id, p_offer_id, v_uid, v_offer.price, v_offer.currency, 'pending', v_session)
  returning id into v_id;

  return query select v_id, v_offer.price, v_offer.currency, v_session;
end; $$;

create or replace function public.customer_reject_service_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.service_offers%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select o.* into v_offer
    from public.service_offers o
    join public.service_requests r on r.id = o.request_id
   where o.id = p_offer_id and r.customer_id = v_uid
   for update of o;
  if v_offer.id is null then raise exception 'offer_not_found'; end if;
  if v_offer.status <> 'sent' then raise exception 'offer_not_found'; end if;

  if exists (select 1 from public.service_payments
              where offer_id = p_offer_id and status in ('pending', 'verified')) then
    raise exception 'payment_in_progress';
  end if;

  update public.service_offers set status = 'rejected' where id = p_offer_id;
end; $$;

-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
--   select proname from pg_proc where proname in
--   ('create_service_payment_session','customer_reject_service_offer'); -- 2 rows
-- ============================================================================
