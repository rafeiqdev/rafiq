-- ============================================================================
-- Rafiq Istanbul — User identity → onboarding → "مسيرتي" (journey) slice.
-- 2026-07-18
--
-- Adds structured onboarding fields to profiles and a per-user journey
-- checklist with owner-only RLS. Idempotent (IF NOT EXISTS / OR REPLACE).
--
-- Reversal: see the "-- ROLLBACK" block at the bottom (commented out).
-- ============================================================================

-- ---- 1. profiles: structured onboarding fields -----------------------------
-- The existing `onboarding` jsonb column stays the source of truth for the
-- legacy recommendation engine (blocks/registry.ts). These columns mirror the
-- key answers so they can be queried/indexed and read without parsing jsonb.
alter table public.profiles
  add column if not exists avatar_url           text,
  add column if not exists city                 text,
  add column if not exists situation            text,     -- planning|arrived|visiting|student|resident|long_resident
  add column if not exists family_status        text,     -- alone|family
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists updated_at           timestamptz not null default now();

-- ---- 2. user_journey_items -------------------------------------------------
create table if not exists public.user_journey_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  task_key           text not null,                       -- stable key (turkishPhone, taxNumber, ...)
  title_ar           text not null,
  description_ar     text,
  status             text not null default 'todo',        -- todo | done
  sort               int  not null default 0,             -- priority / display order
  related_route      text,                                -- in-app route for the CTA
  related_service_id text,                                -- services.ts id when relevant
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint user_journey_items_status_chk check (status in ('todo', 'done')),
  unique (user_id, task_key)                              -- one row per task per user
);
create index if not exists user_journey_items_user_idx on public.user_journey_items(user_id, sort);

alter table public.user_journey_items enable row level security;

-- Owner-only. Identity is derived from the session (auth.uid()), never from a
-- client-supplied user_id: the WITH CHECK blocks writing rows for anyone else.
drop policy if exists "journey owner all" on public.user_journey_items;
create policy "journey owner all" on public.user_journey_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "journey admin read" on public.user_journey_items;
create policy "journey admin read" on public.user_journey_items for select
  using (public.is_admin());

-- keep updated_at fresh + stamp/clear completed_at when status flips.
-- SECURITY INVOKER (the default) is correct here: it touches no tables, so it
-- needs no elevated rights. The fixed search_path prevents resolution hijacking.
create or replace function public.touch_journey_item()
returns trigger language plpgsql
security invoker
set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status = 'todo' then
    new.completed_at := null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_touch_journey_item on public.user_journey_items;
create trigger trg_touch_journey_item before update on public.user_journey_items
  for each row execute function public.touch_journey_item();

-- ---- 3. seed the caller's journey (idempotent) -----------------------------
-- Runs as SECURITY DEFINER so the four default tasks are created atomically for
-- the *authenticated* user only. Tasks the user already reported during
-- onboarding (profiles.onboarding->'has') start as completed.
create or replace function public.ensure_my_journey()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_has jsonb;
  v_done boolean;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select coalesce(onboarding->'has', '{}'::jsonb) into v_has
    from public.profiles where id = v_uid;
  v_has := coalesce(v_has, '{}'::jsonb);

  for r in
    select * from (values
      ('turkishPhone',   'الحصول على رقم هاتف تركي', 'شريحة تركية باسمك — تحتاجها لتفعيل الحسابات والتطبيقات الرسمية.', 1, '/services?q=%D8%B4%D8%B1%D9%8A%D8%AD%D8%A9', 'tel-sim'),
      ('taxNumber',      'استخراج الرقم الضريبي',   'رقم ضريبي (Vergi No) — مطلوب لفتح حساب بنكي وأغلب المعاملات.', 2, '/services?q=%D8%B6%D8%B1%D9%8A%D8%A8%D9%8A',   'res-tax'),
      ('residencePermit','مراجعة وضع الإقامة',      'تحقّق من إقامتك: تقديم أول مرة أو تجديد قبل انتهاء الصلاحية.',   3, '/residency',                                  'res-tourist'),
      ('bankAccount',    'فتح حساب بنكي',           'حساب بنكي تركي لاستقبال التحويلات ودفع الفواتير.',                4, '/services?q=%D8%A8%D9%86%D9%83',              'bank-account')
    ) as t(task_key, title_ar, description_ar, sort, related_route, related_service_id)
  loop
    v_done := coalesce((v_has ->> r.task_key)::boolean, false);
    insert into public.user_journey_items
      (user_id, task_key, title_ar, description_ar, status, sort, related_route, related_service_id, completed_at)
    values
      (v_uid, r.task_key, r.title_ar, r.description_ar,
       case when v_done then 'done' else 'todo' end,
       r.sort, r.related_route, r.related_service_id,
       case when v_done then now() else null end)
    -- Re-running (e.g. the user edits their onboarding answers) may only
    -- UPGRADE todo → done. Rules:
    --   • a task the user ticked manually is NEVER reverted;
    --   • a completed task contradicted by new answers stays completed
    --     (manual progress always wins over inferred onboarding state);
    --   • missing tasks are inserted with their stable task_key.
    -- completed_at is stamped by the touch_journey_item trigger.
    on conflict (user_id, task_key) do update
       set status = 'done'
     where excluded.status = 'done'
       and user_journey_items.status = 'todo';
  end loop;
end; $$;

-- ---- 4. privileges ---------------------------------------------------------
-- Least privilege: only signed-in users may seed/sync their own journey. The
-- function still derives identity from auth.uid() and takes no user argument,
-- so it can never be pointed at another account.
revoke all on function public.ensure_my_journey() from public;
revoke all on function public.ensure_my_journey() from anon;
grant execute on function public.ensure_my_journey() to authenticated;

-- ============================================================================
-- VERIFICATION (read-only — safe to run after applying; mutates nothing)
-- ----------------------------------------------------------------------------
-- 1) profile columns added (expect 6 rows)
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='profiles'
--    and column_name in ('avatar_url','city','situation','family_status',
--                        'onboarding_completed','updated_at')
--  order by column_name;
--
-- 2) journey table exists and RLS is ENABLED (expect relrowsecurity = true)
-- select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where oid = 'public.user_journey_items'::regclass;
--
-- 3) policies (expect: "journey owner all" ALL, "journey admin read" SELECT)
-- select policyname, cmd, qual, with_check
--   from pg_policies
--  where schemaname='public' and tablename='user_journey_items'
--  order by policyname;
--
-- 4) function security state (expect ensure_my_journey prosecdef = true,
--    touch_journey_item prosecdef = false, both with search_path=public)
-- select p.proname, p.prosecdef, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('ensure_my_journey','touch_journey_item');
--
-- 5) function privileges (expect: authenticated=EXECUTE; NO row for anon/PUBLIC)
-- select grantee, privilege_type
--   from information_schema.routine_privileges
--  where routine_schema='public' and routine_name='ensure_my_journey'
--  order by grantee;
--
-- 6) constraints + index (expect unique (user_id, task_key) + status CHECK)
-- select conname, contype, pg_get_constraintdef(oid)
--   from pg_constraint where conrelid='public.user_journey_items'::regclass;
-- select indexname, indexdef from pg_indexes
--  where schemaname='public' and tablename='user_journey_items';
--
-- ============================================================================
-- ROLLBACK (run manually if this slice must be reverted)
-- ----------------------------------------------------------------------------
-- drop function if exists public.ensure_my_journey();
-- drop trigger if exists trg_touch_journey_item on public.user_journey_items;
-- drop function if exists public.touch_journey_item();
-- drop table if exists public.user_journey_items;
-- alter table public.profiles
--   drop column if exists avatar_url,
--   drop column if exists city,
--   drop column if exists situation,
--   drop column if exists family_status,
--   drop column if exists onboarding_completed,
--   drop column if exists updated_at;
-- ============================================================================
