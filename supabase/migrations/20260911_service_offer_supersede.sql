-- ============================================================================
-- Fix: one live ("sent") offer per request.
--
-- 2026-09-11. Before this, adminServiceOffers.createOffer did a plain INSERT
-- with status='sent' and never touched the previous offer, so a request could
-- carry SEVERAL simultaneously-actionable offers. The customer page then
-- rendered a pay button on every one of them, and service_payments has a
-- uniqueness guard on offer_id only — so two offers on one request meant a
-- customer could start (and pay) two separate checkouts for the same work.
-- Nothing in the schema or code ever wrote status='superseded'; the value
-- existed but was dead, which is exactly why the supersede step belonged in
-- the same statement that inserts the new offer.
--
-- admin_create_service_offer() replaces the raw client INSERT:
--   * SECURITY DEFINER, admin-only (same trust boundary as the old RLS-gated
--     insert — the client no longer writes the table directly at all);
--   * locks the request row so two admins sending at the same instant are
--     serialized into "the later one supersedes the earlier one";
--   * refuses to send a new offer while a currently-sent offer still has a
--     pending/verified payment, so a live checkout is never stranded;
--   * marks every remaining 'sent' offer on the request 'superseded' before
--     inserting the replacement.
--
-- Idempotent (CREATE OR REPLACE + guarded UPDATE). Safe to re-run.
-- Requires: public.is_admin() (schema.sql).
-- Run in the Supabase dashboard -> SQL Editor -> New query -> Run.
-- ============================================================================

-- 1. One-off cleanup for rows created before this rule: keep only the newest
--    'sent' offer per request; older duplicates become 'superseded' — but only
--    when they carry no live payment, so a real pending/verified checkout is
--    never orphaned.
update public.service_offers o
   set status = 'superseded'
 where o.status = 'sent'
   and exists (
     select 1 from public.service_offers n
      where n.request_id = o.request_id
        and n.status = 'sent'
        and (n.created_at, n.id) > (o.created_at, o.id)
   )
   and not exists (
     select 1 from public.service_payments pay
      where pay.offer_id = o.id and pay.status in ('pending', 'verified')
   );

-- 2. The only path that creates a service offer now.
create or replace function public.admin_create_service_offer(
  p_request_id uuid,
  p_price      numeric,
  p_currency   text,
  p_details    text,
  p_image_paths jsonb,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_live integer;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_price is null or p_price <= 0 then raise exception 'invalid_price'; end if;

  -- Serialize concurrent sends on the same request: the second caller blocks
  -- here until the first has superseded + inserted, then supersedes that one.
  perform 1 from public.service_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;

  -- Never strand a live checkout: if the offer a customer is currently paying
  -- (or has paid) is still 'sent', a replacement offer is refused.
  select count(*) into v_live
    from public.service_offers o
    join public.service_payments pay on pay.offer_id = o.id
   where o.request_id = p_request_id
     and o.status = 'sent'
     and pay.status in ('pending', 'verified');
  if v_live > 0 then raise exception 'offer_payment_in_progress'; end if;

  update public.service_offers
     set status = 'superseded'
   where request_id = p_request_id and status = 'sent';

  insert into public.service_offers
    (request_id, price, currency, details, image_paths, expires_at, status, created_by)
  values (
    p_request_id,
    p_price,
    coalesce(nullif(p_currency, ''), 'TL'),
    coalesce(p_details, ''),
    coalesce(p_image_paths, '[]'::jsonb),
    p_expires_at,
    'sent',
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end; $$;

-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
--   select proname from pg_proc where proname = 'admin_create_service_offer'; -- 1 row
--   -- every request has at most one live offer:
--   select request_id, count(*) from public.service_offers
--    where status = 'sent' group by request_id having count(*) > 1; -- 0 rows
-- ============================================================================
