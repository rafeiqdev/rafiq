-- ============================================================================
-- Per-language news translations (2026-07-29)
--
-- The Telegram channel is Arabic-only, but the site is ar/en/ru/fa. Extends
-- news_posts with a single jsonb column instead of six flat columns, so the
-- read side (src/lib/api.ts) can just pick translations[currentLang] and fall
-- back to the original title/body when a language is missing:
--   translations  { "en": {"title": "...", "body": "..."}, "ru": {...}, "fa": {...} }
--   (the Arabic original stays in the existing title/body columns.)
--
-- Written by api/cron/telegram-sync.ts (Gemini translation, same call the AI
-- chat endpoint already uses) right after a post is parsed/upserted. Manual
-- admin posts (source = 'manual') simply have an empty translations object
-- and fall back to the Arabic text, same as today.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run. Idempotent.
-- ============================================================================

alter table public.news_posts
  add column if not exists translations jsonb not null default '{}'::jsonb;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'news_posts'
--    and column_name = 'translations';
-- ============================================================================
