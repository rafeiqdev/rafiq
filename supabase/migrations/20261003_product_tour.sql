-- Product tour: remember it per ACCOUNT, and count how it goes (2026-10-03)
--
-- The first-visit walkthrough (src/tour/) already remembers "seen" on the
-- device. This adds the two things the device alone cannot do:
--
--   1. user_tours_seen — one row per (signed-in visitor, tour). A visitor who
--      finished or closed the home tour on their phone is not shown it again
--      on their laptop. They read and write ONLY their own rows.
--
--   2. three new event types in public.events — tour_started, tour_completed,
--      tour_skipped (meta = {step, steps}) — so the admin can see whether
--      people finish the tour or close it, and at which step. The events
--      table has a CHECK listing every allowed event_type; without this
--      change the client never sends these (it probes the table below first),
--      because one rejected row would fail the whole batch insert.
--
-- Until this is pasted in, the tour keeps working exactly as today: device
-- memory only, no tour events.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once.

-- ----------------------------------------------------------------------------
-- 1. per-account "seen" state
-- ----------------------------------------------------------------------------
create table if not exists public.user_tours_seen (
  user_id  uuid not null references auth.users(id) on delete cascade,
  -- ids come from src/tour/tours.ts ('home', 'chat', 'services', …)
  tour_id  text not null check (char_length(tour_id) between 1 and 40),
  seen_at  timestamptz not null default now(),
  primary key (user_id, tour_id)
);

alter table public.user_tours_seen enable row level security;

drop policy if exists "tours seen: own rows read" on public.user_tours_seen;
create policy "tours seen: own rows read" on public.user_tours_seen
  for select using (auth.uid() = user_id);

drop policy if exists "tours seen: own rows write" on public.user_tours_seen;
create policy "tours seen: own rows write" on public.user_tours_seen
  for insert with check (auth.uid() = user_id);

-- No update/delete policy: a row only ever says "seen once"; re-inserting the
-- same (user, tour) is a no-op upsert on the primary key.
drop policy if exists "tours seen: own rows upsert" on public.user_tours_seen;
create policy "tours seen: own rows upsert" on public.user_tours_seen
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.user_tours_seen from anon, authenticated;
grant select, insert, update on public.user_tours_seen to authenticated;

-- ----------------------------------------------------------------------------
-- 2. let the events table accept the three tour events
-- ----------------------------------------------------------------------------
-- Guarded so this file still applies cleanly on a database where the events
-- migration (20260727_events_tracking.sql) was never run.
do $$
declare
  v_name text;
begin
  if to_regclass('public.events') is null then
    raise notice 'public.events not present - skipping event_type widening';
  else
    -- Drop whichever CHECK currently lists the event types (Postgres named the
    -- inline one events_event_type_check, but do not rely on that), then add
    -- the widened list under that canonical name.
    for v_name in
      select conname from pg_constraint
       where conrelid = 'public.events'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) ilike '%event_type%'
    loop
      execute format('alter table public.events drop constraint %I', v_name);
    end loop;

    alter table public.events add constraint events_event_type_check check (event_type in (
      'page_view', 'service_view', 'service_click', 'request_started', 'request_submitted',
      'chat_opened', 'chat_message_sent', 'login', 'signup', 'checkout_opened',
      'payment_submitted', 'whatsapp_clicked', 'lang_changed', 'guide_viewed', 'search_performed',
      'paywall_shown', 'upgrade_clicked',
      'tour_started', 'tour_completed', 'tour_skipped'
    ));
  end if;
end
$$;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'user_tours_seen';
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'events_event_type_check';
-- select tour_id, count(*) from public.user_tours_seen group by 1;
-- select event_type, meta->>'step' as step, count(*)
--   from public.events where event_type like 'tour_%' group by 1, 2 order by 1, 2;
-- ============================================================================
