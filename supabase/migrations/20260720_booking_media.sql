-- ============================================================================
-- Booking attachments — fixes two live errors.  2026-07-20
--
-- 1) Attaching a file in the AI chat failed because the client uploads to a
--    `booking-media` bucket that does not exist (only documents/receipts/
--    listings do).
-- 2) Confirming an appointment failed because the client writes `phone` and
--    `media` to public.bookings and neither column exists.
--
-- Purely additive. No data is deleted. Safe to run more than once.
-- ============================================================================

-- ---- 1. the missing columns -------------------------------------------------
alter table public.bookings
  add column if not exists phone text,
  add column if not exists media jsonb not null default '[]'::jsonb;

-- ---- 2. the missing private bucket ------------------------------------------
insert into storage.buckets (id, name, public)
values ('booking-media', 'booking-media', false)
on conflict (id) do nothing;

-- Objects live under "<user-id>/<file>", so the first path segment is the owner.
-- Customers upload and read their OWN files; admins can read all of them to
-- review what the customer sent before the appointment.
drop policy if exists "booking media owner insert" on storage.objects;
create policy "booking media owner insert" on storage.objects for insert
  with check (
    bucket_id = 'booking-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "booking media read own or admin" on storage.objects;
create policy "booking media read own or admin" on storage.objects for select
  using (
    bucket_id = 'booking-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "booking media owner delete" on storage.objects;
create policy "booking media owner delete" on storage.objects for delete
  using (
    bucket_id = 'booking-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='bookings'
--    and column_name in ('phone','media');
-- select id, public from storage.buckets where id = 'booking-media';
-- select policyname, cmd from pg_policies
--  where schemaname='storage' and tablename='objects'
--    and policyname like 'booking media%' order by policyname;
-- ============================================================================
