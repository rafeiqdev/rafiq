-- General admin audit log (2026-08-13)
--
-- Same shape and security pattern as medical_audit_log
-- (20260806_medical_tourism.sql) — insert-only, staff-write via a
-- SECURITY DEFINER wrapper that stamps the CALLING user as actor (so nobody
-- can forge someone else's action), admin-only read. This one covers the
-- rest of the admin surface: tier/role changes, payment verify/reject,
-- PII reveal, content deletes, news publish/unpublish. Medical Tourism
-- keeps its own separate log (different staff role, already exists).
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once.

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,
  target_type text not null,
  target_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id, created_at desc);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;

drop policy if exists "admin audit read" on public.admin_audit_log;
create policy "admin audit read" on public.admin_audit_log for select using (public.is_admin());
-- no direct insert policy: writes only happen via admin_audit_log_write()
-- (SECURITY DEFINER), so nobody can forge another admin's actor_id.

create or replace function public._admin_audit_log_insert(p_actor uuid, p_action text, p_target_type text, p_target_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, meta)
  values (p_actor, p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb));
end; $$;
revoke execute on function public._admin_audit_log_insert(uuid, text, text, uuid, jsonb) from anon, authenticated, public;

-- Admin-facing wrapper: logs the CALLING admin's own action.
create or replace function public.admin_audit_log_write(p_action text, p_target_type text, p_target_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  perform public._admin_audit_log_insert(auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb));
end; $$;
grant execute on function public.admin_audit_log_write(text, text, uuid, jsonb) to authenticated;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'admin_audit_log';
-- select proname from pg_proc
--  where proname in ('admin_audit_log_write','_admin_audit_log_insert');
-- ============================================================================
