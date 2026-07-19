-- ============================================================================
-- Intake assistant
-- Turns the AI chat into a case-intake agent that hands off to the admin:
--   * a phone number stored once on the account (asked only if missing)
--   * phone + uploaded media (photos / video / PDF) attached to each booking
--   * a private Storage bucket for that media
--
-- Run ONCE in Supabase → SQL Editor of the app's project (iseldofsfhwvpfzltqet).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- 1) Phone number on the account. Asked once during intake, then reused.
alter table public.profiles add column if not exists phone text;

-- 2) Phone + uploaded media snapshot stored on the booking (the case handoff).
--    media = jsonb array of { path, name, mime, size } (path = booking-media object).
alter table public.bookings add column if not exists phone text;
alter table public.bookings add column if not exists media jsonb not null default '[]';

-- 3) Private Storage bucket for the intake media.
insert into storage.buckets (id, name, public)
values ('booking-media', 'booking-media', false)
on conflict (id) do nothing;

-- 4) Storage RLS — each user uploads only into their own "<uid>/..." folder;
--    the owner and admins can read (needed to mint signed view URLs).
drop policy if exists "booking-media owner insert" on storage.objects;
create policy "booking-media owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'booking-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "booking-media owner/admin read" on storage.objects;
create policy "booking-media owner/admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "booking-media owner delete" on storage.objects;
create policy "booking-media owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'booking-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
