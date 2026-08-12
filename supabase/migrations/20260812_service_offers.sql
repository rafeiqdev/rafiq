-- ============================================================================
-- Service offers + payments — single admin-sent price offer per request,
-- for the REGULAR ("طلباتي") service_requests table (not medical_requests).
-- 2026-08-12.
--
-- Mirrors medical_offers / medical_payments (see 20260806_medical_tourism.sql)
-- deliberately, as a near-duplicate rather than a shared abstraction, so the
-- two payment domains never share a failure mode — same reasoning
-- api/payments/medical-webhook.ts documents for its own near-duplicate of
-- api/payments/webhook.ts.
--
-- Differences from the medical model (intentional, not oversights):
--   - one flat price, no booking-percentage deposit — the customer pays the
--     full offer amount, once, or not at all.
--   - no "hidden identity until paid" split table — a regular service has
--     nothing analogous to a medical center's identity to protect.
--   - the customer can REJECT a sent offer (medical has no reject: a medical
--     offer either gets paid or expires). Rejecting does not touch
--     service_requests.status — the existing new/pending/accepted/done/
--     rejected workflow (20260719_service_requests.sql) is untouched and
--     orthogonal to offers; the admin just sees the request needs a new
--     offer because its latest offer is 'rejected'.
--
-- Run once in the Supabase dashboard -> SQL Editor -> New query -> Run.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Requires: public.is_admin() (schema.sql), public.touch_updated_at()
-- (20260801_investment_opportunities.sql) — both already live.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. service_offers — price/details/images. Customer-readable once sent.
-- ---------------------------------------------------------------------------
create table if not exists public.service_offers (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.service_requests(id) on delete cascade,
  price        numeric not null check (price > 0),
  currency     text not null default 'TL',
  details      text not null default '',
  image_paths  jsonb not null default '[]'::jsonb,
  expires_at   timestamptz,
  status       text not null default 'sent',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.service_offers
  add constraint service_offers_status_chk
  check (status in ('sent', 'rejected', 'expired', 'superseded')) not valid;
create index if not exists service_offers_request_idx on public.service_offers (request_id, created_at desc);
alter table public.service_offers enable row level security;

-- Customer sees every offer ever sent on their own request (full history —
-- unlike medical_offers there is no secret to withhold on a rejected offer).
drop policy if exists "soffers owner/admin read" on public.service_offers;
create policy "soffers owner/admin read" on public.service_offers for select
  using (public.is_admin()
    or exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = auth.uid()));

drop policy if exists "soffers admin write" on public.service_offers;
create policy "soffers admin write" on public.service_offers for all
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists service_offers_touch on public.service_offers;
create trigger service_offers_touch before update on public.service_offers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. service_payments — gateway-agnostic pending/verified/rejected, same
--    shape as medical_payments minus the booking-percentage snapshot.
-- ---------------------------------------------------------------------------
create table if not exists public.service_payments (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references public.service_requests(id) on delete cascade,
  offer_id            uuid not null references public.service_offers(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  amount              numeric not null check (amount > 0),
  currency            text not null,
  status              text not null default 'pending',
  gateway_session_id  text,
  created_at          timestamptz not null default now(),
  verified_at         timestamptz
);
alter table public.service_payments
  add constraint service_payments_status_chk
  check (status in ('pending', 'verified', 'rejected')) not valid;

-- one live (pending or verified) payment per offer — no duplicate/double pay.
create unique index if not exists service_payments_offer_live_uniq
  on public.service_payments (offer_id) where status in ('pending', 'verified');
create index if not exists service_payments_user_idx on public.service_payments (user_id, created_at desc);
create unique index if not exists service_payments_session_uniq on public.service_payments (gateway_session_id);

alter table public.service_payments enable row level security;

drop policy if exists "spay owner/admin read" on public.service_payments;
create policy "spay owner/admin read" on public.service_payments for select
  using (user_id = auth.uid() or public.is_admin());

-- inserts only via create_service_payment_session(); no direct customer
-- insert grant, so a forged amount can never be written.
drop policy if exists "spay admin manage" on public.service_payments;
create policy "spay admin manage" on public.service_payments for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------

-- Computes the amount SERVER-SIDE from the live offer row; the client never
-- supplies a price. SECURITY DEFINER so it can insert on the caller's behalf
-- while the offer/payment tables themselves stay admin-write-only.
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

  select o.* into v_offer
    from public.service_offers o
    join public.service_requests r on r.id = o.request_id
   where o.id = p_offer_id and r.customer_id = v_uid and o.status = 'sent';
  if v_offer.id is null then raise exception 'offer_not_found'; end if;

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

-- Customer rejects a sent offer with no live payment attached — the request
-- itself is untouched; admin sees the rejection and can send a new offer.
create or replace function public.customer_reject_service_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  if not exists (
    select 1 from public.service_offers o
    join public.service_requests r on r.id = o.request_id
    where o.id = p_offer_id and r.customer_id = v_uid and o.status = 'sent'
  ) then
    raise exception 'offer_not_found';
  end if;

  if exists (select 1 from public.service_payments
              where offer_id = p_offer_id and status in ('pending', 'verified')) then
    raise exception 'payment_in_progress';
  end if;

  update public.service_offers set status = 'rejected' where id = p_offer_id;
end; $$;

-- Staff-callable ONLY for 'rejected' (block an abandoned/failed attempt).
-- 'verified' is deliberately NOT an accepted value — the only path that can
-- ever set 'verified' is the signed webhook (api/payments/service-webhook.ts).
create or replace function public.admin_set_service_payment_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_current text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_status <> 'rejected' then raise exception 'invalid_status'; end if;

  select status into v_current from public.service_payments where id = p_id;
  if v_current is null then raise exception 'not_found'; end if;
  if v_current <> 'pending' then raise exception 'invalid_transition'; end if;

  update public.service_payments set status = p_status where id = p_id;
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket — public, image-only, for offer photos (before/after,
--    quotes, screenshots). Same pattern as 'medical-media'.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('service-offer-media', 'service-offer-media', true)
on conflict (id) do nothing;

drop policy if exists "service-offer-media admin insert" on storage.objects;
create policy "service-offer-media admin insert" on storage.objects for insert
  with check (bucket_id = 'service-offer-media' and public.is_admin());
drop policy if exists "service-offer-media admin update" on storage.objects;
create policy "service-offer-media admin update" on storage.objects for update
  using (bucket_id = 'service-offer-media' and public.is_admin())
  with check (bucket_id = 'service-offer-media' and public.is_admin());
drop policy if exists "service-offer-media admin delete" on storage.objects;
create policy "service-offer-media admin delete" on storage.objects for delete
  using (bucket_id = 'service-offer-media' and public.is_admin());

-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
-- ----------------------------------------------------------------------------
-- 1. select id, public from storage.buckets where id = 'service-offer-media'; -- public = true
-- 2. select proname from pg_proc where proname in
--    ('create_service_payment_session','customer_reject_service_offer',
--     'admin_set_service_payment_status'); -- expect 3 rows
-- 3. As a non-owner/non-admin session: select * from public.service_offers;
--    -- expect zero rows for someone else's request.
-- ============================================================================
