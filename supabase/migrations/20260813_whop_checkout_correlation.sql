-- ============================================================================
-- Whop checkout correlation columns for medical_payments / service_payments.
-- 2026-08-13. Idempotent — safe to run more than once.
-- Run in the Supabase dashboard -> SQL Editor -> New query -> Run.
--
-- WHY: the original design correlated a Whop webhook back to our row via
-- `metadata.paymentId` echoed on the checkout_configuration. Verified against
-- the live Whop API: metadata sent at checkout_configuration creation is
-- silently dropped (comes back `null`, both on the create response and on a
-- follow-up GET) — contradicts the documented behaviour, but that's what the
-- production API actually does with this account's key. Don't depend on it.
--
-- Instead: store the checkout_configuration's own id (`ch_...`, returned by
-- POST /checkout_configurations and echoed back on every payment.succeeded /
-- payment.failed webhook as `data.checkout_configuration_id`) and correlate
-- on that. Also store the actual USD amount charged (checkout amounts are
-- always USD — see api/_lib/fx.ts — while `amount` on the row stays in the
-- offer's original currency, e.g. TL), so the webhook's amount check compares
-- against what we told Whop to charge, not a reconverted-at-webhook-time
-- figure that could drift from the rate used at checkout creation.
-- ============================================================================

alter table public.medical_payments add column if not exists whop_checkout_id text;
alter table public.medical_payments add column if not exists charged_amount numeric;
create unique index if not exists medical_payments_whop_checkout_uniq
  on public.medical_payments (whop_checkout_id) where whop_checkout_id is not null;

alter table public.service_payments add column if not exists whop_checkout_id text;
alter table public.service_payments add column if not exists charged_amount numeric;
create unique index if not exists service_payments_whop_checkout_uniq
  on public.service_payments (whop_checkout_id) where whop_checkout_id is not null;
