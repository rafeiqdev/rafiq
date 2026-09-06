-- ============================================================================
-- Rafiq Istanbul — make the referral wallet actually pay out (2026-09-07)
--
-- 20260816_referrals_and_wallet.sql built the ledger but left the chain open
-- in three places, so a commission could be earned and then never move:
--
--   1. credit_referral_commission() writes every commission as 'pending' with
--      available_at = now() + 7 days — and NOTHING ever flipped it to
--      'available'. No cron, no trigger, no RPC. So "المتاح للسحب" was
--      permanently 0 and the wallet's payout button (disabled when
--      available <= 0) could never be pressed by anyone, ever.
--   2. There was no way for an admin to action a payout request. The row
--      landed in payout_requests as 'under_review' and stopped there — the
--      Control Center only READS it, and the classic /admin had no payout
--      section at all.
--   3. Nothing tied a payout back to the commissions it pays. Marking a
--      payout 'paid' would have left those commissions 'available' forever,
--      so the same balance could be withdrawn again and again.
--
-- This migration closes all three, and keeps one deliberate simplification:
-- A PAYOUT IS ALWAYS THE WHOLE AVAILABLE BALANCE OF ONE CURRENCY. Partial
-- amounts would mean splitting a single commission row across two payouts —
-- the usual source of "the numbers don't add up" in a hand-run ledger. Whole
-- balances keep every commission attached to exactly one payout, which is
-- also what the owner can actually verify by eye against a bank transfer.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------- 1. Tie each commission to the payout that settles it -------------
-- Without this link a payout is just a number: nothing says WHICH earnings it
-- covers, so nothing can stop them being withdrawn twice.

alter table public.referral_commissions
  add column if not exists payout_id uuid references public.payout_requests(id) on delete set null;

create index if not exists referral_commissions_payout_idx
  on public.referral_commissions (payout_id) where payout_id is not null;

-- Money that is spoken for: attached to a payout that hasn't failed.
create index if not exists referral_commissions_available_idx
  on public.referral_commissions (referrer_id, currency, status) where status = 'available';


-- ---------- 2. Release commissions whose hold has expired --------------------
-- The missing step. p_user null = every user (for a cron); a uuid = just that
-- person, which is what my_wallet_summary() calls so the wallet self-heals on
-- open and does not depend on a scheduled job existing at all.

create or replace function public.release_due_commissions(p_user uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.referral_commissions
  set status = 'available',
      updated_at = now()
  where status = 'pending'
    and available_at is not null
    and available_at <= now()
    and (p_user is null or referrer_id = p_user);

  get diagnostics v_count = row count;
  return v_count;
end;
$$;

revoke execute on function public.release_due_commissions(uuid) from anon, public;
grant execute on function public.release_due_commissions(uuid) to authenticated, service_role;


-- ---------- 3. my_wallet_summary: release first, then report -----------------
-- Same return shape as before (the app's parser is unchanged) — it just no
-- longer reports a balance that is stale by up to forever. `available` also
-- now excludes anything already attached to an open payout request, so the
-- number on screen is genuinely withdrawable rather than double-counted.

create or replace function public.my_wallet_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_res jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object(
      'total_commissions', 0, 'pending', 0, 'available', 0, 'paid', 0,
      'currencies', jsonb_build_object(), 'total_count', 0
    );
  end if;

  -- the step that was missing entirely
  perform public.release_due_commissions(v_uid);

  select jsonb_build_object(
    'total_commissions', coalesce(sum(commission_amount) filter (where status in ('pending', 'available', 'paid')), 0),
    'pending', coalesce(sum(commission_amount) filter (where status = 'pending'), 0),
    -- withdrawable = available AND not already claimed by an open payout
    'available', coalesce(sum(commission_amount) filter (where status = 'available' and payout_id is null), 0),
    'paid', coalesce(sum(commission_amount) filter (where status = 'paid'), 0),
    'currencies', coalesce(
      (
        select jsonb_object_agg(
          currency,
          jsonb_build_object(
            'total', coalesce(sum(commission_amount) filter (where status in ('pending', 'available', 'paid')), 0),
            'pending', coalesce(sum(commission_amount) filter (where status = 'pending'), 0),
            'available', coalesce(sum(commission_amount) filter (where status = 'available' and payout_id is null), 0),
            'paid', coalesce(sum(commission_amount) filter (where status = 'paid'), 0)
          )
        )
        from public.referral_commissions
        where referrer_id = v_uid
        group by currency
      ),
      jsonb_build_object()
    ),
    'total_count', count(*) filter (where status <> 'reversed')
  )
  into v_res
  from public.referral_commissions
  where referrer_id = v_uid;

  return coalesce(v_res, jsonb_build_object(
    'total_commissions', 0, 'pending', 0, 'available', 0, 'paid', 0,
    'currencies', jsonb_build_object(), 'total_count', 0
  ));
end;
$$;

grant execute on function public.my_wallet_summary() to authenticated;


-- ---------- 4. The user asks to withdraw -------------------------------------
-- Replaces the raw client INSERT, which trusted a client-supplied amount and
-- could be sent twice for the same balance. Here the amount is computed
-- server-side from the ledger and the covering commissions are attached in
-- the same transaction, so a double-click cannot withdraw twice.

create or replace function public.request_payout(
  p_currency text,
  p_method text default 'bank_transfer',
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_amount numeric;
  v_id uuid;
  v_open integer;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'auth_required'; end if;
  if coalesce(trim(p_currency), '') = '' then raise exception 'currency_required'; end if;

  perform public.release_due_commissions(v_uid);

  -- One open request per currency: a second one would race the first for the
  -- same commissions.
  select count(*) into v_open
  from public.payout_requests
  where user_id = v_uid and currency = p_currency
    and status in ('under_review', 'approved', 'processing');
  if v_open > 0 then raise exception 'payout_already_pending'; end if;

  select coalesce(sum(commission_amount), 0) into v_amount
  from public.referral_commissions
  where referrer_id = v_uid and currency = p_currency
    and status = 'available' and payout_id is null;

  if v_amount <= 0 then raise exception 'nothing_to_withdraw'; end if;

  insert into public.payout_requests (user_id, amount, currency, payout_method, payout_details, status)
  values (v_uid, v_amount, p_currency, coalesce(p_method, 'bank_transfer'), coalesce(p_details, '{}'::jsonb), 'under_review')
  returning id into v_id;

  -- Claim exactly the commissions this payout covers.
  update public.referral_commissions
  set payout_id = v_id, updated_at = now()
  where referrer_id = v_uid and currency = p_currency
    and status = 'available' and payout_id is null;

  return v_id;
end;
$$;

grant execute on function public.request_payout(text, text, jsonb) to authenticated;


-- ---------- 5. What the admin sees -------------------------------------------
-- The payout row alone doesn't say who to pay. This joins the person on.

create or replace function public.admin_list_payouts()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  referral_code text,
  amount numeric,
  currency text,
  payout_method text,
  payout_details jsonb,
  status text,
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  return query
  select r.id, r.user_id, p.name, p.email, p.referral_code,
         r.amount, r.currency, r.payout_method, r.payout_details,
         r.status, r.admin_notes, r.processed_at, r.created_at
  from public.payout_requests r
  left join public.profiles p on p.id = r.user_id
  order by
    case r.status when 'under_review' then 0 when 'approved' then 1 when 'processing' then 2 else 3 end,
    r.created_at desc;
end;
$$;

grant execute on function public.admin_list_payouts() to authenticated;


-- ---------- 6. The admin actions it -----------------------------------------
-- The step that did not exist. 'paid' is what finally moves the attached
-- commissions out of the balance; 'cancelled'/'failed' hands them back so the
-- user can request again rather than losing the money.

create or replace function public.admin_set_payout_status(
  p_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_user uuid;
  v_amount numeric;
  v_currency text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_status not in ('approved', 'processing', 'paid', 'cancelled', 'failed') then
    raise exception 'invalid_status';
  end if;

  select status, user_id, amount, currency
    into v_current, v_user, v_amount, v_currency
  from public.payout_requests where id = p_id
  for update;

  if v_current is null then raise exception 'not_found'; end if;

  -- A settled payout is final: reopening it would put money that has already
  -- left the bank back into a withdrawable balance.
  if v_current in ('paid', 'cancelled', 'failed', 'reversed') then
    raise exception 'invalid_transition';
  end if;
  if p_status = 'paid' and v_current not in ('approved', 'processing') then
    raise exception 'approve_before_paying';
  end if;

  update public.payout_requests
  set status = p_status,
      admin_notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), admin_notes),
      processed_at = case when p_status in ('paid', 'cancelled', 'failed') then now() else processed_at end,
      updated_at = now()
  where id = p_id;

  if p_status = 'paid' then
    update public.referral_commissions
    set status = 'paid', paid_at = now(), updated_at = now()
    where payout_id = p_id and status = 'available';
  elsif p_status in ('cancelled', 'failed') then
    -- release the claim: the money becomes withdrawable again
    update public.referral_commissions
    set payout_id = null, updated_at = now()
    where payout_id = p_id;
  end if;

  perform public.admin_audit_log_write(
    'payout.' || p_status, 'payout_request', p_id,
    jsonb_build_object('user_id', v_user, 'amount', v_amount, 'currency', v_currency, 'from', v_current)
  );
end;
$$;

grant execute on function public.admin_set_payout_status(uuid, text, text) to authenticated;


-- ============================================================================
-- VERIFICATION (read-only) — run after applying:
-- ----------------------------------------------------------------------------
-- 1. select proname from pg_proc where proname in
--      ('release_due_commissions','request_payout','admin_list_payouts',
--       'admin_set_payout_status','my_wallet_summary');   -- expect 5 rows
--
-- 2. select column_name from information_schema.columns
--     where table_name = 'referral_commissions' and column_name = 'payout_id'; -- 1 row
--
-- 3. How much is stuck on hold right now, and how much this unlocks:
--    select status, count(*), sum(commission_amount)
--      from public.referral_commissions group by status;
--
-- 4. Release everything already past its hold date, for everyone, once:
--    select public.release_due_commissions();   -- returns how many moved
-- ============================================================================
