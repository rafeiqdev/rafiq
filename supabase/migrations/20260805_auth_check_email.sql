-- ============================================================================
-- Email-first sign-in: let the client know before showing a form whether an
-- email is already registered, and if so, which providers it uses (2026-08-05)
--
-- WHY
-- ----------------------------------------------------------------------------
-- The login screen now asks for the email first. Depending on what comes
-- back it either shows password+name+phone (new account) or just password
-- (existing email/password account), or points the user at the Google
-- button (existing Google-only account). None of that is decidable from the
-- browser — auth.users/auth.identities are not exposed via PostgREST — so a
-- SECURITY DEFINER function does the lookup and returns only the minimum:
-- whether the email exists, and its provider list. No other user data leaks.
--
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   Supabase dashboard -> SQL Editor -> paste this whole file -> Run.
--   Idempotent: safe to run more than once.
-- ============================================================================

create or replace function public.check_email_providers(p_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_uid uuid;
  v_providers text[];
begin
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;

  if v_uid is null then
    return jsonb_build_object('exists', false, 'providers', '[]'::jsonb);
  end if;

  select coalesce(array_agg(distinct provider), array[]::text[])
    into v_providers
    from auth.identities
   where user_id = v_uid;

  return jsonb_build_object('exists', true, 'providers', to_jsonb(v_providers));
end $$;

-- Must be callable by a signed-out visitor (that's the whole point — it runs
-- before sign-in), but never by anything else: revoke first, then grant only
-- EXECUTE, which exposes nothing beyond the boolean+provider-list result.
revoke all on function public.check_email_providers(text) from public;
grant execute on function public.check_email_providers(text) to anon, authenticated;

-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
-- ----------------------------------------------------------------------------
-- select public.check_email_providers('someone@example.com');
-- select public.check_email_providers('nobody-with-this-address@example.com');
-- ============================================================================
