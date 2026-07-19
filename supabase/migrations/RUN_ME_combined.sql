-- ============================================================================
-- RUN THIS ONCE in the Supabase SQL editor.
--   https://supabase.com/dashboard/project/iseldofsfhwvpfzltqet/sql/new
--
-- Combines the two pending migrations:
--   20260719_service_requests.sql  → broadcast animation + live waiting state
--   20260720_booking_media.sql     → file attachments + full booking data
--
-- Purely ADDITIVE. Nothing is deleted or rewritten. Safe to run more than once.
-- ============================================================================


-- ==== PART 1 — service_requests ============================================
-- Without these columns every "ساعدني في هذا" submission fails.

alter table public.service_requests
  add column if not exists email       text,
  add column if not exists area        text,                     -- customer's district id
  add column if not exists broadcast   boolean not null default false,
  -- stamped from the session; anonymous submissions stay null
  add column if not exists customer_id uuid references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists admin_note  text;

-- Workflow: new/pending → accepted (offer ready) → done   |   rejected.
-- 'new' is kept because existing rows already use it as the pending state.
alter table public.service_requests drop constraint if exists service_requests_status_chk;
alter table public.service_requests add constraint service_requests_status_chk
  check (status in ('new', 'pending', 'accepted', 'done', 'rejected'));

create index if not exists service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index if not exists service_requests_status_idx   on public.service_requests(status, created_at desc);

-- A signed-in customer may read ONLY their own request (drives the live
-- "broadcasting → waiting → ready" state). Other people's names and phones
-- stay admin-only, exactly as before.
drop policy if exists "sr customer read own" on public.service_requests;
create policy "sr customer read own" on public.service_requests for select
  using (customer_id = auth.uid());


-- ==== PART 2 — booking attachments =========================================
-- Fixes: attaching a file in the AI chat, and confirming an appointment.

alter table public.bookings
  add column if not exists phone text,
  add column if not exists media jsonb not null default '[]'::jsonb;

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


-- ==== VERIFY — run this after, expect 8 rows ===============================
select 'bucket: ' || id as result from storage.buckets where id = 'booking-media'
union all
select 'bookings.' || column_name from information_schema.columns
 where table_schema='public' and table_name='bookings' and column_name in ('phone','media')
union all
select 'service_requests.' || column_name from information_schema.columns
 where table_schema='public' and table_name='service_requests'
   and column_name in ('email','area','broadcast','customer_id','admin_note')
order by 1;
