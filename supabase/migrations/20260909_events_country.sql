-- ============================================================================
-- Visitor country on the event log (2026-09-09)
--
-- WHY
-- ----------------------------------------------------------------------------
-- The admin traffic screen could say how many visits there were and what they
-- looked at, but not where in the world they came from — the owner asked for
-- the country. This adds ONE nullable two-letter column.
--
-- WHERE THE VALUE COMES FROM: the CDN edge resolves it from the request IP
-- (api/geo.ts reads Vercel's `x-vercel-ip-country` header) and returns only the
-- country code. The IP itself is never returned to the browser, never logged
-- and never stored — this table still has no IP column and never will. When the
-- edge cannot resolve it the column stays NULL; it is never guessed from the
-- browser's locale or timezone, which say where a device is CONFIGURED, not
-- where it is. NULL therefore means "not known", never "somewhere else".
--
-- NO BACKFILL IS POSSIBLE. Every event recorded before this migration is
-- applied keeps country = NULL, permanently: nothing in the existing rows says
-- where those visitors were. The dashboard shows those as "unknown" rather
-- than guessing.
--
-- SAFE TO APPLY LATE. The client tolerates this column not existing yet: if an
-- insert is rejected because of it, the batch is re-sent without the field, so
-- collection keeps working either way. Applying this migration is what turns
-- the country on, not a deploy.
--
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   1. Supabase dashboard -> SQL Editor -> New query.
--   2. Paste this whole file and Run. Safe to run more than once.
--   3. Run the VERIFICATION block at the bottom to confirm the column and its
--      constraint are in place.
-- ============================================================================

-- ── Column ───────────────────────────────────────────────────────────────────
--
-- ISO 3166-1 alpha-2, uppercase. Nullable, because "unknown" is a real and
-- common outcome (an unresolvable IP, a request that never reached the edge,
-- or any event recorded before today).
alter table public.events
  add column if not exists country text;

comment on column public.events.country is
  'ISO 3166-1 alpha-2 visitor country, resolved at the CDN edge from the request IP (the IP itself is never stored) or from the browser timezone as a fallback. NULL = not known, including every event recorded before 2026-09-09.';

-- ── Constraint ───────────────────────────────────────────────────────────────
--
-- Keeps the column a country code and nothing else: exactly two uppercase
-- letters, or NULL. Without this, one client bug could quietly fill the column
-- with locale strings ('ar-SA'), city names, or free text, and the breakdown
-- would be silently wrong rather than visibly broken.
--
-- `not valid` + `validate` is the two-step form: the ALTER takes a brief lock
-- to add the rule for NEW rows, then validation scans the existing rows
-- without blocking writes. Existing rows are all NULL, so validation is
-- trivially satisfied — this is about not taking a heavy lock on a table that
-- is being written to continuously.
--
-- Drop-then-add rather than a `do $$ ... $$` existence check, on purpose:
-- ADD CONSTRAINT has no IF NOT EXISTS, and scripts/validate-migrations.py
-- parses the bodies of CREATE FUNCTION only — an anonymous DO block would ship
-- unchecked, which is exactly how a whole migration file silently rolls back.
-- Plain statements are verifiable before delivery; a saved keystroke is not
-- worth that.
alter table public.events
  drop constraint if exists events_country_iso2;

alter table public.events
  add constraint events_country_iso2
  check (country is null or country ~ '^[A-Z]{2}$')
  not valid;

alter table public.events
  validate constraint events_country_iso2;

-- NO INDEX ON country, deliberately. The dashboard reads one date range and
-- tallies the countries in the browser; it never filters by country in SQL. An
-- index here would only add write cost to an append-heavy table for a query
-- nothing runs.

-- ============================================================================
-- VERIFICATION (read-only) — run after applying the migration above.
-- ============================================================================

-- 1) The column exists, is text, and is nullable.
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'events' and column_name = 'country';
-- expect: 1 row — country | text | YES

-- 2) The constraint exists AND is validated (convalidated = t).
-- select conname, convalidated, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.events'::regclass and conname = 'events_country_iso2';
-- expect: 1 row, convalidated = t,
--         CHECK (((country IS NULL) OR (country ~ '^[A-Z]{2}$'::text)))

-- 3) Once the site has been live for a few minutes, countries start arriving.
--    Before that, and for every older event, this is one row: null.
-- select coalesce(country, '(unknown)') as country, count(*)
--   from public.events
--  where created_at > now() - interval '1 day'
--  group by 1
--  order by 2 desc;
