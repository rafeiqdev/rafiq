-- ============================================================================
-- Per-language listing translations (2026-08-04)
--
-- listings.description holds a single Turkish string (agency marketing copy
-- imported from Sahibinden). Same pattern already proven on
-- news_posts.translations (20260729_news_translations.sql): one jsonb column
-- instead of per-language flat columns, so the read side (src/lib/api.ts +
-- src/components/realestate/DescriptionBox.tsx) just picks
-- translations[currentLang].description and falls back to the raw Turkish
-- description when a language is missing.
--
--   translations  { "ar": {"title": "...", "description": "..."},
--                    "en": {...}, "fa": {...}, "ru": {...} }
--
-- Written ONCE per listing by scripts/translate-listings.mjs (Gemini), which
-- translates the CONDENSED description (condenseDescription output), not the
-- raw scraped text — the raw text is agency marketing and translating it
-- wholesale would just produce a wall of Turkish sales copy in another
-- script. District names (Gaziosmanpasa, Bagcilar, Kagithane...) are proper
-- nouns and are left in Latin script, never machine-translated.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run. Idempotent.
-- ============================================================================

alter table public.listings
  add column if not exists translations jsonb not null default '{}'::jsonb;

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'listings'
--    and column_name = 'translations';
-- ============================================================================
