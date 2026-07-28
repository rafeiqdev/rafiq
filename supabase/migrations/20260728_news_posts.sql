-- ============================================================================
-- Public news feed (2026-07-28)
--
-- The owner posts updates on a Telegram channel and wants the same items on
-- the site's home page. Telegram offers no supported way for a browser to
-- read a channel's history, so the flow is: post on Telegram as usual, add
-- the item in /admin (its "news" card), and the home page shows the latest
-- items with a "follow on Telegram" button.
--
-- This is distinct from the existing broadcast notifications (the bell),
-- which reach signed-in users only. news_posts is public marketing content.
--
-- The channel URL itself lives in the existing public.settings table under
-- the key 'telegram' as {"channel": "https://t.me/..."} — settings is
-- already public-read / admin-write, exactly the policy this needs.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.news_posts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) between 1 and 200),
  body       text check (length(coalesce(body, '')) <= 2000),
  -- Link for "read more" — usually the Telegram post's t.me URL.
  url        text check (url is null or url ~ '^https://'),
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.news_posts enable row level security;

-- Anyone (including logged-out visitors) may read what is published.
drop policy if exists "news public read" on public.news_posts;
create policy "news public read" on public.news_posts for select
  using (published);

-- Only admins write; they may also read unpublished drafts.
drop policy if exists "news admin all" on public.news_posts;
create policy "news admin all" on public.news_posts for all
  using (public.is_admin()) with check (public.is_admin());

create index if not exists news_posts_recent_idx
  on public.news_posts (published, created_at desc);

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'news_posts';
-- ============================================================================
