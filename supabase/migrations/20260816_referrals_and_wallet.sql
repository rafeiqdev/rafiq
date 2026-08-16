-- ============================================================================
-- Rafiq Istanbul — 5% Referral Commission & User Wallet Migration
-- Idempotent, multi-currency, secure with Row-Level Security (RLS)
-- ============================================================================

-- ---------- 1. Referral Commissions Table -----------------------------------

create table if not exists public.referral_commissions (
  id                  uuid primary key default gen_random_uuid(),
  referrer_id         uuid not null references public.profiles(id) on delete cascade,
  referred_user_id    uuid references public.profiles(id) on delete set null,
  order_id            text,
  payment_id          text,
  service_type        text not null default 'service',           -- 'service' | 'medical' | 'realestate' | 'subscription'
  service_name        text not null,
  transaction_amount  numeric(12,2) not null,
  currency            text not null default 'USD',               -- 'USD' | 'EUR' | 'TRY' | etc.
  commission_rate     numeric(5,4) not null default 0.05,        -- Fixed 5% (0.0500)
  commission_amount   numeric(12,2) not null,                    -- transaction_amount * commission_rate
  status              text not null default 'pending',           -- 'pending' | 'available' | 'paid' | 'reversed' | 'failed' | 'cancelled'
  hold_until          timestamptz,
  available_at        timestamptz,
  paid_at             timestamptz,
  reversal_of_id      uuid references public.referral_commissions(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Ensure status validity
alter table public.referral_commissions
  drop constraint if exists referral_commissions_status_chk;
alter table public.referral_commissions
  add constraint referral_commissions_status_chk
  check (status in ('pending', 'available', 'paid', 'reversed', 'failed', 'cancelled'));

-- Indexes for performance & security
create index if not exists referral_commissions_referrer_idx
  on public.referral_commissions (referrer_id, created_at desc);

create index if not exists referral_commissions_status_idx
  on public.referral_commissions (status, created_at desc);

-- Unique index to prevent duplicate commissions on the same payment (Idempotency)
create unique index if not exists referral_commissions_payment_uniq
  on public.referral_commissions (payment_id)
  where payment_id is not null and reversal_of_id is null;

alter table public.referral_commissions enable row level security;

drop policy if exists "commissions own read" on public.referral_commissions;
create policy "commissions own read" on public.referral_commissions
  for select using (referrer_id = auth.uid() or public.is_admin());

drop policy if exists "commissions admin all" on public.referral_commissions;
create policy "commissions admin all" on public.referral_commissions
  for all using (public.is_admin()) with check (public.is_admin());


-- ---------- 2. Payout Requests Table ----------------------------------------

create table if not exists public.payout_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  amount              numeric(12,2) not null,
  currency            text not null default 'USD',
  payout_method       text not null default 'bank_transfer',     -- 'bank_transfer' | 'crypto' | 'wise' | etc.
  payout_details      jsonb not null default '{}',               -- { iban, account_holder, bank_name, swift, etc. }
  status              text not null default 'under_review',      -- 'draft' | 'under_review' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'reversed'
  admin_notes         text,
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.payout_requests
  drop constraint if exists payout_requests_status_chk;
alter table public.payout_requests
  add constraint payout_requests_status_chk
  check (status in ('draft', 'under_review', 'approved', 'processing', 'paid', 'failed', 'cancelled', 'reversed'));

create index if not exists payout_requests_user_idx
  on public.payout_requests (user_id, created_at desc);

alter table public.payout_requests enable row level security;

drop policy if exists "payouts own read" on public.payout_requests;
create policy "payouts own read" on public.payout_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payouts own insert" on public.payout_requests;
create policy "payouts own insert" on public.payout_requests
  for insert with check (user_id = auth.uid());

drop policy if exists "payouts admin all" on public.payout_requests;
create policy "payouts admin all" on public.payout_requests
  for all using (public.is_admin()) with check (public.is_admin());


-- ---------- 3. RPC: my_wallet_summary ---------------------------------------

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
      'total_commissions', 0,
      'pending', 0,
      'available', 0,
      'paid', 0,
      'currencies', jsonb_build_object(),
      'total_count', 0
    );
  end if;

  select jsonb_build_object(
    'total_commissions', coalesce(sum(commission_amount) filter (where status in ('pending', 'available', 'paid')), 0),
    'pending', coalesce(sum(commission_amount) filter (where status = 'pending'), 0),
    'available', coalesce(sum(commission_amount) filter (where status = 'available'), 0),
    'paid', coalesce(sum(commission_amount) filter (where status = 'paid'), 0),
    'currencies', coalesce(
      (
        select jsonb_object_agg(
          currency,
          jsonb_build_object(
            'total', coalesce(sum(commission_amount) filter (where status in ('pending', 'available', 'paid')), 0),
            'pending', coalesce(sum(commission_amount) filter (where status = 'pending'), 0),
            'available', coalesce(sum(commission_amount) filter (where status = 'available'), 0),
            'paid', coalesce(sum(commission_amount) filter (where status = 'paid'), 0)
          )
        )
        from public.referral_commissions
        where referrer_id = v_uid
        group by currency
      ),
      jsonb_build_object()
    ),
    'total_count', count(*) filter (where status != 'reversed')
  )
  into v_res
  from public.referral_commissions
  where referrer_id = v_uid;

  return coalesce(v_res, jsonb_build_object(
    'total_commissions', 0,
    'pending', 0,
    'available', 0,
    'paid', 0,
    'currencies', jsonb_build_object(),
    'total_count', 0
  ));
end;
$$;

grant execute on function public.my_wallet_summary() to authenticated;


-- ---------- 4. RPC: credit_referral_commission ------------------------------

create or replace function public.credit_referral_commission(
  p_referrer_id uuid,
  p_referred_user_id uuid,
  p_order_id text,
  p_payment_id text,
  p_service_type text,
  p_service_name text,
  p_transaction_amount numeric,
  p_currency text default 'USD',
  p_commission_rate numeric default 0.05
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission_amount numeric;
  v_comm_id uuid;
begin
  -- Idempotency check: don't create duplicate commission if payment_id already credited
  if p_payment_id is not null then
    select id into v_comm_id
    from public.referral_commissions
    where payment_id = p_payment_id and reversal_of_id is null;

    if v_comm_id is not null then
      return v_comm_id;
    end if;
  end if;

  -- 5% calculation: commission = amount * rate
  v_commission_amount := round((p_transaction_amount * coalesce(p_commission_rate, 0.05))::numeric, 2);

  insert into public.referral_commissions (
    referrer_id,
    referred_user_id,
    order_id,
    payment_id,
    service_type,
    service_name,
    transaction_amount,
    currency,
    commission_rate,
    commission_amount,
    status,
    hold_until,
    available_at
  ) values (
    p_referrer_id,
    p_referred_user_id,
    p_order_id,
    p_payment_id,
    coalesce(p_service_type, 'service'),
    coalesce(p_service_name, 'Rafiq Service'),
    p_transaction_amount,
    coalesce(p_currency, 'USD'),
    coalesce(p_commission_rate, 0.05),
    v_commission_amount,
    'pending',
    now() + interval '7 days',
    now() + interval '7 days'
  )
  returning id into v_comm_id;

  return v_comm_id;
end;
$$;

grant execute on function public.credit_referral_commission(uuid, uuid, text, text, text, text, numeric, text, numeric) to service_role;


-- ---------- 5. RPC: reverse_referral_commission -----------------------------

create or replace function public.reverse_referral_commission(
  p_commission_id uuid,
  p_reversal_amount numeric default null,
  p_reason text default 'Refund/Cancellation'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig public.referral_commissions%rowtype;
  v_rev_amount numeric;
  v_new_id uuid;
begin
  select * into v_orig
  from public.referral_commissions
  where id = p_commission_id;

  if v_orig.id is null then
    raise exception 'commission_not_found';
  end if;

  -- If original was already reversed, do not duplicate
  if v_orig.status = 'reversed' then
    return v_orig.id;
  end if;

  v_rev_amount := coalesce(p_reversal_amount, v_orig.commission_amount);

  -- Mark original as reversed or create explicit reversal entry
  update public.referral_commissions
  set status = 'reversed',
      notes = concat_ws(' | ', notes, p_reason),
      updated_at = now()
  where id = p_commission_id;

  insert into public.referral_commissions (
    referrer_id,
    referred_user_id,
    order_id,
    payment_id,
    service_type,
    service_name,
    transaction_amount,
    currency,
    commission_rate,
    commission_amount,
    status,
    reversal_of_id,
    notes
  ) values (
    v_orig.referrer_id,
    v_orig.referred_user_id,
    v_orig.order_id,
    v_orig.payment_id,
    v_orig.service_type,
    concat('Reversal: ', v_orig.service_name),
    -1 * v_orig.transaction_amount,
    v_orig.currency,
    v_orig.commission_rate,
    -1 * v_rev_amount,
    'reversed',
    v_orig.id,
    p_reason
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.reverse_referral_commission(uuid, numeric, text) to service_role;
