-- ============================================================================
-- Medical Tourism rebuild — full schema (2026-08-06)
--
-- Rafiq coordinates (does not provide) medical care in Istanbul: a patient
-- submits a case, Rafiq forwards it to suitable centers, the centers' own
-- doctors produce a treatment plan + price, and the customer compares offers
-- BEFORE ever learning which center/doctor made them. That "before payment"
-- boundary is the one thing in this file that must be bulletproof, so it is
-- enforced the same way 20260801_investment_opportunities.sql enforces its
-- "never leak the sales office contact" boundary: two tables, not one table
-- with a hidden flag, because RLS has no column-level granularity and a
-- careless `select('*')` must be structurally impossible to leak from.
--
-- Run once in the Supabase dashboard -> SQL Editor -> New query -> Run.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Also creates one Storage bucket: medical-files (PRIVATE, 10MB cap,
-- pdf/jpg/jpeg/png only — enforced by the bucket itself, not just the client).
-- ============================================================================

-- gen_random_bytes() (session-token minting below) needs pgcrypto; every
-- Supabase project ships it, this just makes the migration self-contained.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Role: 'medical_coordinator' joins 'user'|'admin'|'company' in
--    profiles.role (free text column, no enum — same approach is_company()
--    used). Coordinators see ONLY medical-tourism data; is_admin() already
--    passes everywhere so admins need no separate grant.
-- ---------------------------------------------------------------------------
create or replace function public.is_medical_coordinator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'medical_coordinator' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_medical_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_medical_coordinator();
$$;

-- ---------------------------------------------------------------------------
-- 1. medical_requests — the patient's case intake.
-- ---------------------------------------------------------------------------
create table if not exists public.medical_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  specialty            text not null,
  description          text not null,
  expected_travel_date date,
  budget_estimate      numeric,
  notes                text,
  consent_at           timestamptz not null,
  status               text not null default 'pending_review',
  internal_note        text,
  customer_note        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.medical_requests
  add constraint medical_requests_status_chk
  check (status in ('pending_review','under_review','collecting_offers','offers_available',
                     'awaiting_payment','paid','booked','cancelled')) not valid;

create index if not exists medical_requests_user_idx on public.medical_requests (user_id, created_at desc);
create index if not exists medical_requests_status_idx on public.medical_requests (status, created_at desc);
create index if not exists medical_requests_specialty_idx on public.medical_requests (specialty);

alter table public.medical_requests enable row level security;

drop policy if exists "mreq owner insert" on public.medical_requests;
create policy "mreq owner insert" on public.medical_requests for insert
  with check (user_id = auth.uid()
    and length(trim(description)) between 1 and 4000
    and consent_at is not null);

drop policy if exists "mreq owner/staff read" on public.medical_requests;
create policy "mreq owner/staff read" on public.medical_requests for select
  using (user_id = auth.uid() or public.is_medical_staff());

drop policy if exists "mreq staff update" on public.medical_requests;
create policy "mreq staff update" on public.medical_requests for update
  using (public.is_medical_staff()) with check (public.is_medical_staff());

-- owners may never edit their own request post-submission (status/notes are
-- staff-owned); this mirrors guard_company_fields()'s pattern.
create or replace function public.guard_medical_request_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_medical_staff() then
    new.status := old.status;
    new.internal_note := old.internal_note;
    new.customer_note := old.customer_note;
    new.user_id := old.user_id;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists trg_guard_medical_request on public.medical_requests;
create trigger trg_guard_medical_request before update on public.medical_requests
  for each row execute function public.guard_medical_request_fields();

-- rate limit, same shape as trg_service_requests_rate_limit (20260727): stop a
-- scripted flood without punishing a real patient submitting a couple of cases.
create or replace function public.medical_requests_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_window constant interval := interval '1 hour';
  v_max    constant integer  := 5;
  v_count  integer;
begin
  select count(*) into v_count from public.medical_requests
   where user_id = new.user_id and created_at > now() - v_window;
  if v_count >= v_max then
    raise exception 'medical_request_rate_limit'
      using errcode = 'P0001', hint = 'Too many medical requests from this account in the last hour.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_medical_requests_rate_limit on public.medical_requests;
create trigger trg_medical_requests_rate_limit
  before insert on public.medical_requests
  for each row execute function public.medical_requests_rate_limit();

-- ---------------------------------------------------------------------------
-- 2. medical_request_files — metadata only; bytes live in Storage.
-- ---------------------------------------------------------------------------
create table if not exists public.medical_request_files (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.medical_requests(id) on delete cascade,
  storage_path     text not null,
  original_filename text not null,
  mime_type        text not null,
  size_bytes       bigint not null,
  created_at       timestamptz not null default now()
);
create index if not exists medical_request_files_request_idx on public.medical_request_files (request_id);
alter table public.medical_request_files enable row level security;

drop policy if exists "mfiles owner/staff read" on public.medical_request_files;
create policy "mfiles owner/staff read" on public.medical_request_files for select
  using (public.is_medical_staff()
    or exists (select 1 from public.medical_requests r where r.id = request_id and r.user_id = auth.uid()));

drop policy if exists "mfiles owner insert" on public.medical_request_files;
create policy "mfiles owner insert" on public.medical_request_files for insert
  with check (
    mime_type in ('application/pdf','image/jpeg','image/jpg','image/png')
    and size_bytes > 0 and size_bytes <= 10485760
    and length(original_filename) <= 200
    and exists (select 1 from public.medical_requests r where r.id = request_id and r.user_id = auth.uid()));

drop policy if exists "mfiles staff delete" on public.medical_request_files;
create policy "mfiles staff delete" on public.medical_request_files for delete
  using (public.is_medical_staff());

-- ---------------------------------------------------------------------------
-- 3. medical_optional_services — transport/interpreter/accommodation/etc.
-- ---------------------------------------------------------------------------
create table if not exists public.medical_optional_services (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.medical_requests(id) on delete cascade,
  service_type text not null,
  status       text not null default 'requested',
  notes        text,
  created_at   timestamptz not null default now()
);
alter table public.medical_optional_services
  add constraint medical_opt_services_type_chk
  check (service_type in ('transport','interpreter','accommodation','companion','nursing')) not valid;
alter table public.medical_optional_services
  add constraint medical_opt_services_status_chk
  check (status in ('requested','confirmed','declined','cancelled')) not valid;
create index if not exists medical_opt_services_request_idx on public.medical_optional_services (request_id);
alter table public.medical_optional_services enable row level security;

drop policy if exists "mopt owner/staff read" on public.medical_optional_services;
create policy "mopt owner/staff read" on public.medical_optional_services for select
  using (public.is_medical_staff()
    or exists (select 1 from public.medical_requests r where r.id = request_id and r.user_id = auth.uid()));

drop policy if exists "mopt owner insert" on public.medical_optional_services;
create policy "mopt owner insert" on public.medical_optional_services for insert
  with check (exists (select 1 from public.medical_requests r where r.id = request_id and r.user_id = auth.uid()));

drop policy if exists "mopt staff update" on public.medical_optional_services;
create policy "mopt staff update" on public.medical_optional_services for update
  using (public.is_medical_staff()) with check (public.is_medical_staff());

-- ---------------------------------------------------------------------------
-- 4. Offers, split for structural non-leakage — see file header.
--    medical_offers        -> price/plan/inclusions. Customer-readable.
--    medical_offer_centers -> center identity. STAFF ONLY at the table level;
--    the only customer path is get_offer_center(), gated on verified payment.
-- ---------------------------------------------------------------------------
create table if not exists public.medical_offers (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.medical_requests(id) on delete cascade,
  treatment_plan   text not null,
  total_price      numeric not null check (total_price > 0),
  currency         text not null default 'USD',
  included         jsonb not null default '[]'::jsonb,
  excluded         jsonb not null default '[]'::jsonb,
  sessions_or_days text,
  expires_at       timestamptz,
  booking_percentage numeric not null default 20 check (booking_percentage > 0 and booking_percentage <= 100),
  status           text not null default 'sent',
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.medical_offers
  add constraint medical_offers_status_chk check (status in ('draft','sent','expired')) not valid;
create index if not exists medical_offers_request_idx on public.medical_offers (request_id);
alter table public.medical_offers enable row level security;

drop policy if exists "moffers owner/staff read" on public.medical_offers;
create policy "moffers owner/staff read" on public.medical_offers for select
  using (public.is_medical_staff()
    or (status = 'sent'
        and exists (select 1 from public.medical_requests r where r.id = request_id and r.user_id = auth.uid())));

drop policy if exists "moffers staff write" on public.medical_offers;
create policy "moffers staff write" on public.medical_offers for all
  using (public.is_medical_staff()) with check (public.is_medical_staff());

drop trigger if exists medical_offers_touch on public.medical_offers;
create trigger medical_offers_touch before update on public.medical_offers
  for each row execute function public.touch_updated_at();

create table if not exists public.medical_offer_centers (
  offer_id           uuid primary key references public.medical_offers(id) on delete cascade,
  center_name        text not null default '',
  doctor_name        text not null default '',
  address            text not null default '',
  phone              text not null default '',
  website            text not null default '',
  map_url            text not null default '',
  image_paths        jsonb not null default '[]'::jsonb,
  appointment_details text not null default '',
  updated_at         timestamptz not null default now()
);
alter table public.medical_offer_centers enable row level security;

-- No customer grant here at all, on purpose (see file header) — only staff,
-- and only the SECURITY DEFINER RPC below for a paying customer.
drop policy if exists "mcenters staff all" on public.medical_offer_centers;
create policy "mcenters staff all" on public.medical_offer_centers for all
  using (public.is_medical_staff()) with check (public.is_medical_staff());

drop trigger if exists medical_offer_centers_touch on public.medical_offer_centers;
create trigger medical_offer_centers_touch before update on public.medical_offer_centers
  for each row execute function public.touch_updated_at();

comment on table public.medical_offer_centers is
  'INTERNAL ONLY until a verified payment exists for the offer. Never selected directly by a customer session — see get_offer_center().';

-- ---------------------------------------------------------------------------
-- 5. medical_payments — the booking-deposit payment, gateway-agnostic (same
--    pending/verified/rejected shape as public.payments, plus a manual
--    refund workflow since automatic Whop refunds are not wired up).
-- ---------------------------------------------------------------------------
create table if not exists public.medical_payments (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.medical_requests(id) on delete cascade,
  offer_id          uuid not null references public.medical_offers(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  amount            numeric not null check (amount > 0),
  currency          text not null,
  booking_percentage_snapshot numeric not null,
  status            text not null default 'pending',
  gateway_session_id text,
  created_at        timestamptz not null default now(),
  verified_at       timestamptz
);
alter table public.medical_payments
  add constraint medical_payments_status_chk
  check (status in ('pending','verified','rejected','refund_requested','refunded')) not valid;

-- one live (pending or verified) payment per offer — no duplicate/double pay.
create unique index if not exists medical_payments_offer_live_uniq
  on public.medical_payments (offer_id) where status in ('pending','verified');
create index if not exists medical_payments_user_idx on public.medical_payments (user_id, created_at desc);
-- the dev/staging payment simulator (api/payments/medical-pay.ts) looks a
-- payment up by this opaque token, exactly like server/index.mjs's existing
-- gateway_session column for subscription checkout.
create unique index if not exists medical_payments_session_uniq on public.medical_payments (gateway_session_id);

alter table public.medical_payments enable row level security;

drop policy if exists "mpay owner/staff read" on public.medical_payments;
create policy "mpay owner/staff read" on public.medical_payments for select
  using (user_id = auth.uid() or public.is_medical_staff());

-- inserts only via create_medical_payment_session(); customer role has no
-- direct INSERT grant so a forged amount/percentage can never be written.
drop policy if exists "mpay staff manage" on public.medical_payments;
create policy "mpay staff manage" on public.medical_payments for all
  using (public.is_medical_staff()) with check (public.is_medical_staff());

-- customer may ask for a refund on their own verified payment (status flip
-- only, never touches amount) — everything else stays staff-only.
drop policy if exists "mpay owner request refund" on public.medical_payments;
create policy "mpay owner request refund" on public.medical_payments for update
  using (user_id = auth.uid() and status = 'verified')
  with check (user_id = auth.uid() and status = 'refund_requested');

-- Computes the amount SERVER-SIDE from the live offer row; the client never
-- supplies price or percentage. SECURITY DEFINER so it can read the (staff-
-- only-selectable) offer row and insert on the caller's behalf.
--
-- Also mints the opaque gateway_session_id the checkout redirect is keyed on
-- (api/payments/medical-pay.ts) — same role as server/index.mjs's existing
-- `gateway_session` column for subscription checkout: a session id the
-- customer's browser carries, which is NOT itself proof of anything. Only
-- the signed webhook (api/payments/medical-webhook.ts), running with the
-- service-role key, may flip status to 'verified'.
create or replace function public.create_medical_payment_session(p_offer_id uuid)
returns table(payment_id uuid, amount numeric, currency text, gateway_session_id text)
language plpgsql security definer set search_path = public as $$
declare
  v_offer public.medical_offers%rowtype;
  v_uid uuid := auth.uid();
  v_amount numeric;
  v_id uuid;
  v_session text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select o.* into v_offer
    from public.medical_offers o
    join public.medical_requests r on r.id = o.request_id
   where o.id = p_offer_id and r.user_id = v_uid and o.status = 'sent';
  if v_offer.id is null then raise exception 'offer_not_found'; end if;

  if exists (select 1 from public.medical_payments
              where offer_id = p_offer_id and status in ('pending','verified')) then
    raise exception 'payment_already_exists';
  end if;

  v_amount := round(v_offer.total_price * v_offer.booking_percentage / 100.0, 2);
  v_session := encode(gen_random_bytes(16), 'hex');

  insert into public.medical_payments
    (request_id, offer_id, user_id, amount, currency, booking_percentage_snapshot, status, gateway_session_id)
  values (v_offer.request_id, p_offer_id, v_uid, v_amount, v_offer.currency, v_offer.booking_percentage, 'pending', v_session)
  returning id into v_id;

  update public.medical_requests set status = 'awaiting_payment'
   where id = v_offer.request_id and status in ('offers_available','collecting_offers');

  return query select v_id, v_amount, v_offer.currency, v_session;
end; $$;

-- The customer-facing read of "is this offer's center revealed yet". Returns
-- one row on success, zero rows otherwise — never raises for the "not paid
-- yet" case so the client can render a plain locked state.
create or replace function public.get_offer_center(p_offer_id uuid)
returns table(center_name text, doctor_name text, address text, phone text,
              website text, map_url text, image_paths jsonb, appointment_details text)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_found boolean := false;
begin
  return query
    select c.center_name, c.doctor_name, c.address, c.phone, c.website, c.map_url,
           c.image_paths, c.appointment_details
    from public.medical_offer_centers c
    join public.medical_offers o on o.id = c.offer_id
    join public.medical_requests r on r.id = o.request_id
    where c.offer_id = p_offer_id
      and r.user_id = v_uid
      and exists (select 1 from public.medical_payments p
                   where p.offer_id = p_offer_id and p.status = 'verified');
  get diagnostics v_found = row_count;
  -- Not a "staff action" (the caller is the paying customer), so this logs via
  -- the unrestricted internal writer rather than medical_audit_log_write().
  if v_found and v_uid is not null then
    perform public._medical_audit_log_insert(v_uid, 'center_disclosed', 'medical_offer', p_offer_id, '{}'::jsonb);
  end if;
end; $$;

-- Staff-only: admin_resolve_payment/admin_resolve_company_payment's sibling.
-- Staff-callable ONLY for 'rejected' (block an abandoned/failed attempt) and
-- 'refunded' (post-hoc refund of an already-verified payment, per the refund
-- policy). 'verified' is deliberately NOT an accepted value here — that
-- would be exactly the "admin marks it paid" shortcut the redaction design
-- exists to prevent. The only path that can ever set 'verified' is the
-- signed webhook (api/payments/medical-webhook.ts), which writes directly
-- with the service-role key and never calls this function.
create or replace function public.admin_set_medical_payment_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_request uuid; v_current text;
begin
  if not public.is_medical_staff() then raise exception 'not_authorized'; end if;
  if p_status not in ('rejected','refunded') then raise exception 'invalid_status'; end if;

  select status into v_current from public.medical_payments where id = p_id;
  if v_current is null then raise exception 'not_found'; end if;
  if p_status = 'refunded' and v_current <> 'refund_requested' then
    raise exception 'invalid_transition';
  end if;
  if p_status = 'rejected' and v_current <> 'pending' then
    raise exception 'invalid_transition';
  end if;

  update public.medical_payments set status = p_status where id = p_id returning request_id into v_request;

  perform public.medical_audit_log_write('payment_change', 'medical_payment', p_id,
    jsonb_build_object('status', p_status));
end; $$;

-- ---------------------------------------------------------------------------
-- 6. Audit log — insert-only, staff-write (via the wrapper below), admin read.
-- ---------------------------------------------------------------------------
create table if not exists public.medical_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,
  target_type text not null,
  target_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists medical_audit_log_target_idx on public.medical_audit_log (target_type, target_id, created_at desc);
alter table public.medical_audit_log enable row level security;

drop policy if exists "maudit admin read" on public.medical_audit_log;
create policy "maudit admin read" on public.medical_audit_log for select using (public.is_admin());
-- no direct insert policy: writes only happen via medical_audit_log_write()
-- (SECURITY DEFINER), so a staff member cannot forge someone else's actor_id.

-- Unrestricted writer, NOT granted to anon/authenticated — only callable from
-- inside another SECURITY DEFINER function (e.g. get_offer_center logging a
-- system-triggered disclosure, which is not a "staff action" and must not
-- require is_medical_staff()).
create or replace function public._medical_audit_log_insert(p_actor uuid, p_action text, p_target_type text, p_target_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.medical_audit_log (actor_id, action, target_type, target_id, meta)
  values (p_actor, p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb));
end; $$;
revoke execute on function public._medical_audit_log_insert(uuid, text, text, uuid, jsonb) from anon, authenticated, public;

-- Staff-facing wrapper: logs the CALLING staff member's own action.
create or replace function public.medical_audit_log_write(p_action text, p_target_type text, p_target_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_medical_staff() then raise exception 'not_authorized'; end if;
  perform public._medical_audit_log_insert(auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb));
end; $$;
grant execute on function public.medical_audit_log_write(text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Public content, admin-editable — specialties / services / FAQs /
--    testimonials / section visibility. Localised fields are jsonb
--    { ar, en, ru, fa } exactly like investment_opportunities' name/summary.
-- ---------------------------------------------------------------------------
create table if not exists public.medical_specialties (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  icon       text,
  sort       int not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.medical_services (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  icon       text,
  sort       int not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.medical_faqs (
  id         uuid primary key default gen_random_uuid(),
  question   jsonb not null default '{}'::jsonb,
  answer     jsonb not null default '{}'::jsonb,
  sort       int not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.medical_testimonials (
  id             uuid primary key default gen_random_uuid(),
  author_name    text not null,
  quote          jsonb not null default '{}'::jsonb,
  image_path     text,
  status         text not null default 'draft',
  consent_given  boolean not null default false,
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.medical_testimonials
  add constraint medical_testimonials_status_chk check (status in ('draft','published')) not valid;
alter table public.medical_testimonials
  add constraint medical_testimonials_consent_chk check (status <> 'published' or consent_given) not valid;

create table if not exists public.medical_page_sections (
  section_key text primary key,
  visible     boolean not null default true,
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['medical_specialties','medical_services','medical_faqs',
                            'medical_testimonials','medical_page_sections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('drop policy if exists "%s staff write" on public.%I', t, t);
  end loop;
end $$;

create policy "medical_specialties public read" on public.medical_specialties for select using (visible or public.is_medical_staff());
create policy "medical_specialties staff write" on public.medical_specialties for all using (public.is_medical_staff()) with check (public.is_medical_staff());

create policy "medical_services public read" on public.medical_services for select using (visible or public.is_medical_staff());
create policy "medical_services staff write" on public.medical_services for all using (public.is_medical_staff()) with check (public.is_medical_staff());

create policy "medical_faqs public read" on public.medical_faqs for select using (visible or public.is_medical_staff());
create policy "medical_faqs staff write" on public.medical_faqs for all using (public.is_medical_staff()) with check (public.is_medical_staff());

create policy "medical_testimonials public read" on public.medical_testimonials for select using (status = 'published' or public.is_medical_staff());
create policy "medical_testimonials staff write" on public.medical_testimonials for all using (public.is_medical_staff()) with check (public.is_medical_staff());

create policy "medical_page_sections public read" on public.medical_page_sections for select using (true);
create policy "medical_page_sections staff write" on public.medical_page_sections for all using (public.is_medical_staff()) with check (public.is_medical_staff());

drop trigger if exists medical_specialties_touch on public.medical_specialties;
create trigger medical_specialties_touch before update on public.medical_specialties for each row execute function public.touch_updated_at();
drop trigger if exists medical_services_touch on public.medical_services;
create trigger medical_services_touch before update on public.medical_services for each row execute function public.touch_updated_at();
drop trigger if exists medical_faqs_touch on public.medical_faqs;
create trigger medical_faqs_touch before update on public.medical_faqs for each row execute function public.touch_updated_at();
drop trigger if exists medical_testimonials_touch on public.medical_testimonials;
create trigger medical_testimonials_touch before update on public.medical_testimonials for each row execute function public.touch_updated_at();

-- seed the section order once (idempotent — ON CONFLICT DO NOTHING)
insert into public.medical_page_sections (section_key, sort) values
  ('hero',0),('trust',1),('about',2),('how_it_works',3),('specialties',4),
  ('center_evaluation',5),('supporting_services',6),('testimonials',7),
  ('faq',8),('disclaimer',9),('final_cta',10)
on conflict (section_key) do nothing;

-- seed specialties/services/faqs from the spec as editable rows, not hardcoded TSX
insert into public.medical_specialties (slug, name, sort) values
  ('hair_transplant', '{"en":"Hair Transplantation","ar":"زراعة الشعر","ru":"Пересадка волос","fa":"کاشت مو"}', 0),
  ('dental', '{"en":"Dental Treatment & Cosmetic Dentistry","ar":"علاج الأسنان وتجميلها","ru":"Стоматология и эстетическая стоматология","fa":"دندانپزشکی و زیبایی دندان"}', 1),
  ('bariatric', '{"en":"Obesity Surgery & Gastric Sleeve","ar":"جراحة السمنة وتكميم المعدة","ru":"Бариатрическая хирургия и рукавная гастропластика","fa":"جراحی چاقی و اسلیو معده"}', 2),
  ('eye_care', '{"en":"Eye Care & Vision Correction","ar":"رعاية العيون وتصحيح النظر","ru":"Офтальмология и коррекция зрения","fa":"مراقبت چشم و اصلاح بینایی"}', 3),
  ('oncology', '{"en":"Oncology","ar":"الأورام","ru":"Онкология","fa":"انکولوژی"}', 4),
  ('cardiology', '{"en":"Cardiology","ar":"أمراض القلب","ru":"Кардиология","fa":"قلب و عروق"}', 5),
  ('checkup', '{"en":"Comprehensive Health Checkups","ar":"الفحص الطبي الشامل","ru":"Комплексное обследование","fa":"چکاپ جامع سلامت"}', 6),
  ('other', '{"en":"Request another specialty","ar":"طلب تخصص آخر","ru":"Запросить другую специализацию","fa":"درخواست تخصص دیگر"}', 7)
on conflict (slug) do nothing;

insert into public.medical_services (slug, name, sort) values
  ('translation', '{"en":"Medical report translation","ar":"ترجمة التقارير الطبية","ru":"Перевод медицинских документов","fa":"ترجمه گزارش پزشکی"}', 0),
  ('outreach', '{"en":"Center outreach & offer comparison","ar":"التواصل مع المراكز ومقارنة العروض","ru":"Связь с клиниками и сравнение предложений","fa":"ارتباط با مراکز و مقایسه پیشنهادها"}', 1),
  ('appointment', '{"en":"Appointment coordination","ar":"تنسيق المواعيد","ru":"Координация записи на приём","fa":"هماهنگی نوبت‌دهی"}', 2),
  ('transport', '{"en":"Airport transfer & VIP transportation","ar":"نقل من وإلى المطار ومواصلات VIP","ru":"Трансфер из аэропорта и VIP-транспорт","fa":"ترانسفر فرودگاهی و حمل‌ونقل VIP"}', 3),
  ('accommodation', '{"en":"Hotel / accommodation booking","ar":"حجز الفندق والإقامة","ru":"Бронирование отеля/проживания","fa":"رزرو هتل و اقامت"}', 4),
  ('interpreter', '{"en":"Medical interpreter","ar":"مترجم طبي مرافق","ru":"Медицинский переводчик","fa":"مترجم پزشکی"}', 5),
  ('companion', '{"en":"Personal companion","ar":"مرافق شخصي","ru":"Личный сопровождающий","fa":"همراه شخصی"}', 6),
  ('medication', '{"en":"Medication delivery","ar":"توصيل الأدوية","ru":"Доставка лекарств","fa":"تحویل دارو"}', 7),
  ('nursing', '{"en":"Home nursing in Istanbul","ar":"تمريض منزلي في إسطنبول","ru":"Патронажный уход в Стамбуле","fa":"پرستاری در منزل در استانبول"}', 8),
  ('visa', '{"en":"Flight/visa assistance (when available)","ar":"مساعدة في الطيران والتأشيرة (عند توفرها)","ru":"Помощь с авиабилетами/визой (при наличии)","fa":"کمک در پرواز/ویزا (در صورت امکان)"}', 9)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Storage bucket — private, 10MB cap, 3 mime types enforced by the
--    bucket itself (Supabase enforces file_size_limit/allowed_mime_types on
--    upload, before RLS on medical_request_files is ever reached).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-files', 'medical-files', false, 10485760,
        array['application/pdf','image/jpeg','image/jpg','image/png'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mfiles storage owner insert" on storage.objects;
create policy "mfiles storage owner insert" on storage.objects for insert
  with check (bucket_id = 'medical-files'
    and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "mfiles storage read own or staff" on storage.objects;
create policy "mfiles storage read own or staff" on storage.objects for select
  using (bucket_id = 'medical-files'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_medical_staff()));

drop policy if exists "mfiles storage staff delete" on storage.objects;
create policy "mfiles storage staff delete" on storage.objects for delete
  using (bucket_id = 'medical-files' and public.is_medical_staff());

-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
-- ----------------------------------------------------------------------------
-- 1. select count(*) from public.medical_specialties;              -- expect 8
-- 2. select count(*) from public.medical_services;                 -- expect 10
-- 3. select id, public from storage.buckets where id = 'medical-files'; -- public = false
-- 4. As a non-staff/non-owner session: select * from public.medical_offer_centers;
--    -- expect zero rows / permission denied, never actual center data.
-- 5. select proname from pg_proc where proname in
--    ('get_offer_center','create_medical_payment_session','admin_set_medical_payment_status',
--     'medical_audit_log_write','is_medical_coordinator','is_medical_staff');  -- expect 6 rows
-- ============================================================================
