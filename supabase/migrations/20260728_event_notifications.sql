-- ============================================================================
-- event notifications — the bell finally rings on its own.        2026-07-28
--
-- The notifications table, the bell UI, and the i18n strings (welcome,
-- bookingNew, paymentPending, ...) have all existed since the schema was
-- written, but NOTHING ever inserted a row except the admin's manual
-- broadcast. RLS allows only admins to insert, and no code path did — so
-- every user's bell has been silent since launch.
--
-- Fix: SECURITY DEFINER triggers on the event tables themselves. The row
-- change IS the event, so it works no matter which client or RPC caused it
-- (web app, admin panel, admin_resolve_payment, ...) and can't be skipped.
--
-- Every insert is wrapped in an exception guard: a broken bell must never
-- break the signup / booking / payment it is reporting on.
--
-- Keys used below must exist under notifications.* in src/i18n/locales/*:
--   welcome, bookingNew, bookingConfirmed, bookingDone, bookingCancelled,
--   adminNewBooking, paymentPending, paymentVerified, paymentRejected,
--   adminNewPayment, leadReceived, adminNewLead,
--   requestAccepted, requestDone, requestRejected.
--
-- Distinct from on_service_request_notify (the outbound Slack/email webhook)
-- — that one leaves the building, this one rings the in-app bell.
-- Safe to run more than once.
-- ============================================================================

-- The single writer every trigger goes through. Definer rights bypass the
-- admin-only insert policy; the revoke below keeps PostgREST /rpc callers
-- from spamming the table directly.
create or replace function public.app_notify(p_audience text, p_user uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (audience, user_id, key)
  values (p_audience, p_user, p_key);
exception when others then
  null; -- never let the bell break the event it reports
end $$;

revoke execute on function public.app_notify(text, uuid, text) from public, anon, authenticated;

-- ---------- 1. new account → welcome ----------------------------------------
-- profiles insert (via handle_new_user) = a new account, email or Google.

create or replace function public.notif_profile_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.app_notify('user', new.id, 'welcome');
  return new;
end $$;

drop trigger if exists trg_notif_profile_created on public.profiles;
create trigger trg_notif_profile_created after insert on public.profiles
  for each row execute function public.notif_profile_created();

-- ---------- 2. bookings: request in + every admin decision -------------------

create or replace function public.notif_booking_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.app_notify('user', new.user_id, 'bookingNew');
  perform public.app_notify('admins', null, 'adminNewBooking');
  return new;
end $$;

drop trigger if exists trg_notif_booking_created on public.bookings;
create trigger trg_notif_booking_created after insert on public.bookings
  for each row execute function public.notif_booking_created();

create or replace function public.notif_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'done', 'cancelled') then
    perform public.app_notify('user', new.user_id,
      case new.status
        when 'confirmed' then 'bookingConfirmed'
        when 'done'      then 'bookingDone'
        else                  'bookingCancelled'
      end);
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_booking_status on public.bookings;
create trigger trg_notif_booking_status after update on public.bookings
  for each row execute function public.notif_booking_status();

-- ---------- 3. payments: received + verified / rejected ----------------------

create or replace function public.notif_payment_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.app_notify('user', new.user_id, 'paymentPending');
  perform public.app_notify('admins', null, 'adminNewPayment');
  return new;
end $$;

drop trigger if exists trg_notif_payment_created on public.payments;
create trigger trg_notif_payment_created after insert on public.payments
  for each row execute function public.notif_payment_created();

create or replace function public.notif_payment_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('verified', 'rejected') then
    perform public.app_notify('user', new.user_id,
      case new.status when 'verified' then 'paymentVerified' else 'paymentRejected' end);
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_payment_status on public.payments;
create trigger trg_notif_payment_status after update on public.payments
  for each row execute function public.notif_payment_status();

-- ---------- 4. service requests: received + accepted / done / rejected -------
-- customer_id is null on anonymous submissions — the admin alert still fires,
-- there is just no signed-in bell to ring on the customer side.

create or replace function public.notif_service_request_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null then
    perform public.app_notify('user', new.customer_id, 'leadReceived');
  end if;
  perform public.app_notify('admins', null, 'adminNewLead');
  return new;
end $$;

drop trigger if exists trg_notif_service_request_created on public.service_requests;
create trigger trg_notif_service_request_created after insert on public.service_requests
  for each row execute function public.notif_service_request_created();

create or replace function public.notif_service_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null
     and new.status is distinct from old.status
     and new.status in ('accepted', 'done', 'rejected') then
    perform public.app_notify('user', new.customer_id,
      case new.status
        when 'accepted' then 'requestAccepted'
        when 'done'     then 'requestDone'
        else                 'requestRejected'
      end);
  end if;
  return new;
end $$;

drop trigger if exists trg_notif_service_request_status on public.service_requests;
create trigger trg_notif_service_request_status after update on public.service_requests
  for each row execute function public.notif_service_request_status();

-- ---------- 5. leads (real-estate / health / help) ---------------------------

create or replace function public.notif_lead_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.app_notify('user', new.user_id, 'leadReceived');
  perform public.app_notify('admins', null, 'adminNewLead');
  return new;
end $$;

drop trigger if exists trg_notif_lead_created on public.leads;
create trigger trg_notif_lead_created after insert on public.leads
  for each row execute function public.notif_lead_created();

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select tgname, tgrelid::regclass from pg_trigger
--  where not tgisinternal and tgname like 'trg_notif_%' order by tgname;
-- -- expect 7 rows over profiles, bookings, payments, service_requests, leads
-- ============================================================================
