-- 2026-06-21 — CRITICAL SECURITY FIX
-- Remove the "demo" card-checkout RPC that activated a paid subscription with no
-- payment and no admin approval. It was callable directly with the public anon
-- key (supabase.rpc('checkout_card_demo', ...)), so any visitor could self-grant
-- Pro/Elite. The client no longer calls it; this drops it from the database too.
--
-- After this, a paid plan can ONLY be activated by the admin-approval RPC
-- `admin_resolve_payment` (which sets payments.status='verified' + the
-- subscription). The card path now records a PENDING payment like bank/crypto.
--
-- Idempotent: safe to run multiple times.

drop function if exists public.checkout_card_demo(text, text);
drop function if exists public.checkout_card_demo(p_tier text, p_billing text);

-- Defensive: revoke execute from anon/authenticated in case a differently-typed
-- overload lingers (no-op if the function is already gone).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'checkout_card_demo'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;
