-- ============================================================================
-- Admin ownership handover (2026-07-27)
--
-- Makes rafeiq.dev@gmail.com the project admin:
--   1. handle_new_user() bootstraps role='admin' for future signups.
--   2. The EXISTING rafeiq.dev@gmail.com profile row is promoted to 'admin'.
--   3. goldengt.tr@gmail.com (previous owner) is demoted to 'user' — but ONLY
--      if step 2 actually produced an admin, so the project can never end up
--      with zero admins.
--
-- WHY STEP 2 NEEDS THE TRIGGER DISABLED
-- ------------------------------------------------------------------
-- profiles has a BEFORE UPDATE trigger, trg_guard_role, whose function
-- guard_profile_role() silently reverts any role change when is_admin() is
-- false (it does `new.role := old.role` — it does NOT raise). is_admin()
-- resolves auth.uid(), which is NULL in the Supabase SQL Editor, so it returns
-- false there. A plain `update profiles set role='admin'` therefore reports
-- "Success. N rows affected" and changes NOTHING. The promotion below is
-- wrapped in disable/enable of trg_guard_role; the exception handler re-enables
-- it on every failure path.
--
-- HOW TO RUN THIS MANUALLY
-- ------------------------------------------------------------------
--   1. Supabase dashboard -> your project -> SQL Editor -> New query.
--   2. Paste this entire file and click Run. Safe to run more than once.
--   3. Read the NOTICE output in the Results pane. If it says the promotion
--      was skipped, rafeiq.dev@gmail.com has no profile row yet: sign that
--      account up first (Authentication -> Users, or register in the app),
--      then re-run this file.
--   4. Verify with:
--        select email, role from public.profiles
--         where lower(email) in ('rafeiq.dev@gmail.com','goldengt.tr@gmail.com');
--      Expect rafeiq.dev@gmail.com = admin, goldengt.tr@gmail.com = user
--      (or absent).
--   5. Sign out and back in in the app so the client re-reads the role.
--
-- Notes: profiles.role is a text column defaulting to 'user'; there is no
-- is_admin boolean column. is_admin() is defined as role = 'admin'.
-- ============================================================================

-- ---------- 1. bootstrap list for FUTURE signups -----------------------------
-- Mirrors supabase/schema.sql. SECURITY DEFINER + search_path preserved.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref_id uuid;
begin
  -- attribute referral if the signup carried a ref code in user metadata
  select id into ref_id from public.profiles
   where referral_code = upper(coalesce(new.raw_user_meta_data->>'ref_code',''))
   limit 1;

  insert into public.profiles (id, email, name, role, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    -- bootstrap admins here (edit the list to taste)
    case when lower(new.email) in ('rafeiq.dev@gmail.com','admin@rafiq.ist') then 'admin' else 'user' end,
    upper(substr(md5(random()::text || new.id::text), 1, 6)),
    ref_id
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- Re-assert the trigger wiring (idempotent — matches schema.sql).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2 + 3. promote the new owner, then demote the old one ------------

do $$
declare promoted boolean;
begin
  alter table public.profiles disable trigger trg_guard_role;

  update public.profiles
     set role = 'admin'
   where lower(email) = 'rafeiq.dev@gmail.com'
     and role is distinct from 'admin';

  -- Read the state back rather than trusting the row count: if the guard
  -- trigger were still active it would have silently reverted the write.
  select exists (
    select 1 from public.profiles
     where lower(email) = 'rafeiq.dev@gmail.com' and role = 'admin'
  ) into promoted;

  if promoted then
    raise notice 'rafeiq.dev@gmail.com is admin.';

    update public.profiles
       set role = 'user'
     where lower(email) = 'goldengt.tr@gmail.com'
       and role is distinct from 'user';

    raise notice 'goldengt.tr@gmail.com demoted to user (if the row existed).';
  else
    -- No profile row for the new owner: demoting the old one would leave the
    -- project with no admin at all. Refuse and tell the operator what to do.
    raise notice 'SKIPPED: no profile row with role=admin for rafeiq.dev@gmail.com. '
                 'Sign that account up first, then re-run this migration. '
                 'goldengt.tr@gmail.com was left as-is so the project keeps an admin.';
  end if;

  alter table public.profiles enable trigger trg_guard_role;
exception when others then
  -- Never exit with the role guard switched off. The failed subtransaction has
  -- already rolled the DISABLE back, so this is usually a no-op — it is here so
  -- the guard is restored even if that assumption ever stops holding.
  begin
    alter table public.profiles enable trigger trg_guard_role;
  exception when others then null;
  end;
  raise;
end $$;
