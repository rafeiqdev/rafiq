-- ============================================================================
-- service_requests — bring the live table up to what the app sends. 2026-07-19
--
-- The table already exists with real rows (status 'new'). This migration is
-- purely ADDITIVE: it adds the columns the client posts (email, area,
-- broadcast, customer_id) — without them EVERY "ساعدني في هذا" submission
-- fails — plus the fields behind the request-tracking UI (admin_note, richer
-- status workflow) and an owner-read policy so a signed-in customer can follow
-- their own request live.
--
-- Existing admin read/update policies are left untouched.
-- No data is deleted or rewritten. Safe to run more than once.
-- ============================================================================

alter table public.service_requests
  add column if not exists email       text,
  add column if not exists area        text,                     -- customer's district id
  add column if not exists broadcast   boolean not null default false,
  -- stamped from the session; anonymous submissions stay null
  add column if not exists customer_id uuid references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists admin_note  text;

-- Workflow: new/pending → accepted (offer ready) → done   |   rejected.
-- 'new' is kept because existing rows use it as the pending state.
alter table public.service_requests drop constraint if exists service_requests_status_chk;
alter table public.service_requests add constraint service_requests_status_chk
  check (status in ('new', 'pending', 'accepted', 'done', 'rejected'));

create index if not exists service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index if not exists service_requests_status_idx   on public.service_requests(status, created_at desc);

-- A signed-in customer may read ONLY their own request (drives the live
-- "broadcasting → waiting → ready" state). Names/phones of other people stay
-- admin-only, exactly as before.
drop policy if exists "sr customer read own" on public.service_requests;
create policy "sr customer read own" on public.service_requests for select
  using (customer_id = auth.uid());

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='service_requests'
--    and column_name in ('email','area','broadcast','customer_id','admin_note');
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='service_requests' order by policyname;
-- ============================================================================
