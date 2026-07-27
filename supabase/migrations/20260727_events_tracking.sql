-- ============================================================================
-- Event-tracking data layer — phase 1 (2026-07-27)
--
-- WHY
-- ----------------------------------------------------------------------------
-- Collection ships before the /admin dashboard on purpose: data needs to start
-- accumulating now so there is something real to build the dashboard against
-- later. This migration only creates the table, RLS and guards — no dashboard
-- UI reads from this table yet.
--
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   1. Supabase dashboard -> SQL Editor -> New query.
--   2. Paste this whole file and Run. Safe to run more than once.
--   3. Run the VERIFICATION block at the bottom to confirm RLS, policies,
--      indexes and the trigger are all in place.
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────
--
-- Append-only. No row here is ever updated or deleted by the app — a wrong
-- event is superseded by a later one, never edited in place, so the trail
-- stays honest for anyone auditing it later.
--
-- EVENT TAXONOMY — exactly these 15 event_type values, nothing else (a CHECK
-- constraint enforces this so a typo can't silently create a category nobody
-- ever sees in the dashboard). For each: which fields are populated, and what
-- `target` means.
--
--   page_view          path=route, target=null, meta=null.
--                       Auto-captured on every route change.
--   service_view        target=service id, meta={category,type}.
--                       Fires when the AI-vs-person choice screen opens for a
--                       service (ServiceActionModal).
--   service_click       target=service id, meta={category}.
--                       Fires when a service card is tapped in a catalog list.
--   request_started     target=service id, meta={category,broadcast}.
--                       Fires when the request form opens (before submit).
--   request_submitted   target=service id, meta={category,broadcast,request_id}.
--                       Fires only after the insert actually succeeds. Never
--                       carries name/phone/email/message.
--   chat_opened          target=topic service id or null, meta={source}.
--                       Fires when the AI chat screen mounts.
--   chat_message_sent    target=null, meta={message_count}.
--                       Fires when the user sends a chat message. Never
--                       carries the message text itself.
--   login                target='email'|'google', meta=null.
--   signup               target='email'|'google', meta=null.
--   checkout_opened      target=plan tier, meta={billing}.
--   payment_submitted    target=method ('card'|'bank'|'crypto'), meta={tier,billing}.
--                       Fires only after the payment row is actually recorded.
--   whatsapp_clicked     target=source ('floating_button'|'service_request_modal'),
--                       meta=null.
--   lang_changed         target=new language code, meta={from}.
--   guide_viewed         target=service slug, meta=null.
--                       Fires when a full guide page (/services/:slug) mounts.
--   search_performed     target=null, meta={query_len,result_count}.
--                       NEVER carries the raw query text the user typed — see
--                       the "never send free text" rule in src/lib/analytics.ts.
--   paywall_shown         target=gated feature/service id, meta={tier}.
--                       Fires when a non-subscriber hits the Pro-content
--                       paywall for a guide (UpgradePaywall). Currently dead
--                       code client-side — see AI_FREE_PERIOD in src/lib/api.ts.
--   upgrade_clicked        target=tier being offered, meta={source}.
--                       Fires when the paywall's upgrade button is tapped,
--                       before the redirect to /checkout.
--
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: anonymous visitors generate events too. Set once a visitor signs
  -- in; earlier events in the same browser session keep user_id null but share
  -- session_id, so the pre-login journey is still visible by joining on it.
  user_id uuid references auth.users(id) on delete set null,
  -- Client-generated (sessionStorage), survives login, groups one visit.
  session_id text not null check (char_length(session_id) between 8 and 100),
  event_type text not null check (event_type in (
    'page_view', 'service_view', 'service_click', 'request_started', 'request_submitted',
    'chat_opened', 'chat_message_sent', 'login', 'signup', 'checkout_opened',
    'payment_submitted', 'whatsapp_clicked', 'lang_changed', 'guide_viewed', 'search_performed',
    'paywall_shown', 'upgrade_clicked'
  )),
  path text not null check (char_length(path) <= 300),
  -- Which service/button/method — never free text the visitor typed.
  target text check (target is null or char_length(target) <= 200),
  -- Identifiers and enums ONLY — see the client-side hard rule. Small on
  -- purpose; the size guard trigger below also rejects an oversized payload.
  meta jsonb,
  locale text not null check (char_length(locale) <= 10),
  device text not null check (device in ('mobile', 'desktop')),
  -- Origin only (scheme+host), never the full referring URL — a full URL can
  -- carry a third party's own query string, which may itself hold PII we have
  -- no business storing.
  referrer text check (referrer is null or char_length(referrer) <= 300),
  created_at timestamptz not null default now()
);

comment on table public.events is
  'Append-only product-analytics event log (phase 1 — collection only, no dashboard yet). Never anon-readable: behavioural data about identifiable people.';

-- ── Indexes for the queries the dashboard will actually run ──────────────────
create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_user_created_idx on public.events (user_id, created_at desc);
create index if not exists events_type_created_idx on public.events (event_type, created_at desc);
create index if not exists events_session_idx on public.events (session_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.events enable row level security;

-- Public site: both anonymous and signed-in visitors generate events. The
-- with_check below is the one deviation from the service_requests precedent
-- (which is `with check (true)`) — it stops a crafted anon-key request from
-- attributing an event to someone else's account. NULL (anonymous) is always
-- allowed; a non-null user_id must match the caller's own auth.uid().
drop policy if exists "events public insert" on public.events;
create policy "events public insert" on public.events for insert
  with check (user_id is null or user_id = auth.uid());

-- SELECT is admin-only, full stop. Unlike settings (anon-readable) this table
-- holds behavioural data about identifiable people — it must never be
-- anon-readable, not even in aggregate, not even for a "public stats" widget.
drop policy if exists "events admin read" on public.events;
create policy "events admin read" on public.events for select using (public.is_admin());

-- No UPDATE or DELETE policy for anyone (including admin) — events are
-- append-only. RLS defaults to deny, so this is enforced by omission; the
-- retention statement below is the one sanctioned exception, and it is run by
-- hand from the SQL Editor, never from the app.

-- ── Rate-limit / size guard ───────────────────────────────────────────────────
--
-- CHOICE OF A PER-SESSION CAP (not per-phone like trg_service_requests_rate_limit)
-- ----------------------------------------------------------------------------
-- service_requests is rate-limited per phone/customer_id because each row is a
-- deliberate, identity-bearing submission — a handful per hour is already a lot
-- for a real person. Events are the opposite: a single normal page load can
-- fire several (page_view + a couple of clicks), batched client-side and
-- flushed every ~10s, so "per identity" would need a far looser number anyway.
-- session_id is the one field every event always has — anonymous or signed
-- in — and it is exactly the unit a flood script would need to fabricate to
-- get past this, which is a meaningfully higher bar than replaying a phone
-- number. 300 events per 5 minutes is generous for genuine use (dozens of page
-- views and clicks) while still stopping a script that opens the anon insert
-- endpoint in a loop.
--
-- SECURITY DEFINER is REQUIRED here: the anon role cannot SELECT from events
-- (reads are admin-only), so a counting query running as the caller would
-- always see zero rows and never fire.
create or replace function public.events_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window constant interval := interval '5 minutes';
  v_max    constant integer  := 300;
  v_count  integer;
begin
  if new.meta is not null and pg_column_size(new.meta) > 4096 then
    raise exception 'events_payload_too_large'
      using errcode = 'P0001',
            hint    = 'meta jsonb payload exceeds 4KB — meta must hold identifiers/enums only.';
  end if;

  select count(*) into v_count
    from public.events
   where session_id = new.session_id
     and created_at > now() - v_window;

  if v_count >= v_max then
    raise exception 'events_rate_limit'
      using errcode = 'P0001',
            hint    = 'Too many events from this session in the last 5 minutes.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_guard on public.events;
create trigger trg_events_guard
  before insert on public.events
  for each row execute function public.events_guard();

-- ============================================================================
-- VERIFICATION (read-only) — run after applying the migration above.
-- ============================================================================

-- 1) RLS is enabled.
-- select relrowsecurity from pg_class where oid = 'public.events'::regclass;
-- expect: t

-- 2) Exactly two policies: insert (public) and select (admin-only) — no
--    update/delete policy should exist.
-- select policyname, cmd, qual, with_check
--   from pg_policies
--  where schemaname = 'public' and tablename = 'events'
--  order by cmd;
-- expect: 2 rows — ("events public insert", INSERT, null, "(user_id IS NULL) OR (user_id = auth.uid())")
--                   ("events admin read", SELECT, "is_admin()", null)

-- 3) Indexes.
-- select indexname, indexdef
--   from pg_indexes
--  where schemaname = 'public' and tablename = 'events'
--  order by indexname;
-- expect: events_created_at_idx, events_pkey, events_session_idx,
--         events_type_created_idx, events_user_created_idx

-- 4) Trigger is present and enabled.
-- select t.tgname, t.tgenabled, p.proname, p.prosecdef
--   from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--   join pg_proc  p on p.oid = t.tgfoid
--  where not t.tgisinternal
--    and c.relname = 'events'
--    and t.tgname  = 'trg_events_guard';
-- expect: 1 row, tgenabled = 'O', prosecdef = t

-- ============================================================================
-- RETENTION — run by hand periodically (pg_cron is not installed on this
-- project, so this is NOT scheduled automatically; see the analytics feature
-- notes for the proposed cadence and period).
-- ============================================================================
-- delete from public.events where created_at < now() - interval '14 months';
