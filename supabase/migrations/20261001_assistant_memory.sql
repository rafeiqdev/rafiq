-- Smart assistant memory (2026-10-01)
--
-- One private row per signed-in visitor, written by the assistant itself
-- (api/ai-memory.ts, with the service role) after each of their messages:
--
--   facts  what they told us — who they are, where they are in the move to
--          Turkey, what they want, which services and pages interest them.
--   style  how they communicate in the chat (hurried, anxious, chatty, only
--          passing time…) and how serious they look. Admin eyes only.
--
-- The visitor can NEVER read their row: there is no select policy for them,
-- only for admins. The assistant reads it through the service role, which
-- bypasses row-level security, so it needs no policy either.
--
-- Until this is pasted in, the assistant still works — it just does not
-- remember anyone, and the admin panel shows "no notes yet".
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Idempotent: safe to run more than once.

create table if not exists public.assistant_memory (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  facts            jsonb not null default '{}'::jsonb,
  style            jsonb not null default '{}'::jsonb,
  -- how many of the visitor's messages have been read into this record
  message_count    integer not null default 0,
  last_analyzed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.assistant_memory enable row level security;

drop policy if exists "assistant memory admin read" on public.assistant_memory;
create policy "assistant memory admin read" on public.assistant_memory
  for select using (public.is_admin());
-- no insert / update / delete policy: only the service role (which bypasses
-- RLS) ever writes here, so nobody can edit or forge a visitor's profile.

revoke all on public.assistant_memory from anon, authenticated;
grant select on public.assistant_memory to authenticated;  -- RLS narrows this to admins

-- ============================================================================
-- VERIFICATION (read-only)
-- ----------------------------------------------------------------------------
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'assistant_memory';
-- select count(*) from public.assistant_memory;
-- ============================================================================
