-- ============================================================================
-- Storage buckets + object policies for every upload path in the app. 2026-07-19
--   documents      (private)  — user document locker,  path: <uid>/...
--   receipts       (private)  — payment receipts,      path: <uid>/...
--   listings       (public)   — real-estate photos, admin-managed
--   company-logos  (public)   — company logos,         path: <uid>/...
--   company-docs   (private)  — verification papers,   path: <uid>/...
-- Idempotent.
-- ============================================================================

insert into storage.buckets (id, name, public) values
  ('documents', 'documents', false),
  ('receipts', 'receipts', false),
  ('listings', 'listings', true),
  ('company-logos', 'company-logos', true),
  ('company-docs', 'company-docs', false)
on conflict (id) do nothing;

-- ---- documents: owner-only locker (admin may assist) -----------------------
drop policy if exists "docs owner all" on storage.objects;
create policy "docs owner all" on storage.objects for all
  using (bucket_id = 'documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'documents'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- receipts: owner uploads, owner/admin read (signed URLs) ---------------
drop policy if exists "receipts owner insert" on storage.objects;
create policy "receipts owner insert" on storage.objects for insert
  with check (bucket_id = 'receipts'
         and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "receipts read own or admin" on storage.objects;
create policy "receipts read own or admin" on storage.objects for select
  using (bucket_id = 'receipts'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---- listings: public bucket, admin writes ---------------------------------
drop policy if exists "listings admin insert" on storage.objects;
create policy "listings admin insert" on storage.objects for insert
  with check (bucket_id = 'listings' and public.is_admin());
drop policy if exists "listings admin delete" on storage.objects;
create policy "listings admin delete" on storage.objects for delete
  using (bucket_id = 'listings' and public.is_admin());

-- ---- company-logos: public bucket, owner-folder writes (upsert = ins+upd) --
drop policy if exists "logos owner insert" on storage.objects;
create policy "logos owner insert" on storage.objects for insert
  with check (bucket_id = 'company-logos'
         and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "logos owner update" on storage.objects;
create policy "logos owner update" on storage.objects for update
  using (bucket_id = 'company-logos'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'company-logos'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- company-docs: owner uploads, owner/admin read (signed URLs) -----------
drop policy if exists "cdocs owner insert" on storage.objects;
create policy "cdocs owner insert" on storage.objects for insert
  with check (bucket_id = 'company-docs'
         and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cdocs read own or admin" on storage.objects;
create policy "cdocs read own or admin" on storage.objects for select
  using (bucket_id = 'company-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
