-- ============================================================================
-- Telegram auto-sync for the news feed (2026-07-28)
--
-- Extends news_posts (20260728_news_posts.sql — run that first) so posts can
-- come from the channel sync, not only the admin form:
--   tg_id     "channel/123" from t.me — the idempotency key: re-syncing the
--             same post updates it instead of duplicating it.
--   image_url the post's photo (Telegram CDN URL, hotlinked).
--   source    'manual' | 'telegram' — the admin card labels synced rows.
--
-- Writes happen ONLY from api/cron/telegram-sync.ts with the service-role
-- key (daily cron + the admin's "sync now" button). RLS is unchanged:
-- visitors read published rows, admins write, service_role bypasses.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run. Idempotent.
-- ============================================================================

alter table public.news_posts
  add column if not exists tg_id     text,
  add column if not exists image_url text,
  add column if not exists source    text not null default 'manual';

-- A plain UNIQUE constraint: NULLs never collide in Postgres, so manual posts
-- (tg_id = null) are unaffected — and unlike a partial index, PostgREST's
-- on_conflict=tg_id upsert can actually target it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'news_posts_tg_id_key'
  ) then
    alter table public.news_posts add constraint news_posts_tg_id_key unique (tg_id);
  end if;
end $$;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'news_posts'
--    and column_name in ('tg_id', 'image_url', 'source');
-- ============================================================================
