-- Wire the legacy hand-set USD/SYP rate into fx_rates (2026-08-13)
--
-- USD/SYP used to live in settings.rates.sypusd, set from a bespoke admin
-- form. Nothing ever read that column back out — it was write-only. It now
-- becomes a normal manual-only pair in fx_rates, edited through the same
-- set_fx_override()/clear_fx_override() RPCs and override UI as every other
-- pair, and shown on the public ticker (TopRatesBar renders any pair present
-- in fx_rates, no code change needed there).
--
-- This migration only backfills the admin's last-entered number, if any, so
-- they don't have to re-type it blind. It does NOT delete the old
-- settings.rates row or touch usdtry/eurtry — both were already unused
-- (moved to fx_rates months ago) and are left alone as dead, harmless data.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once (ON CONFLICT DO NOTHING — a rate
-- an admin has already set through the new UI is never overwritten by an
-- old backfilled value).

insert into public.fx_rates (pair, rate, source, validation_status, override_reason, updated_at)
select
  'USD/SYP',
  (value ->> 'sypusd')::numeric,
  'manual',
  'ok',
  'Migrated from legacy settings.rates on 2026-08-13',
  now()
from public.settings
where key = 'rates'
  and (value ->> 'sypusd') is not null
  and (value ->> 'sypusd')::numeric > 0
on conflict (pair) do nothing;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select * from public.fx_rates where pair = 'USD/SYP';
-- ============================================================================
