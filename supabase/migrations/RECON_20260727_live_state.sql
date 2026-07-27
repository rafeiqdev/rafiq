-- ============================================================================
-- READ-ONLY RECONNAISSANCE of the LIVE database.               2026-07-27
--
-- Run against project `jdtspvkhomctqkgdmjdn` (the ref in .env line 17).
-- NOT against `iseldofsfhwvpfzltqet`, which is the abandoned project and which
-- SUPABASE-SETUP.md still incorrectly names.
--
-- Nothing here writes. No DDL, no DML, no transaction needed.
-- Run each block and paste the output back.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- BLOCK 1 — identity and scale. Confirms which database answered.
-- ---------------------------------------------------------------------------
select current_database()                                        as db,
       current_setting('request.jwt.claims', true)               as jwt,
       (select count(*) from public.service_requests)            as service_requests_rows,
       (select max(created_at)::text from public.service_requests) as newest_request;


-- ---------------------------------------------------------------------------
-- BLOCK 2 — what actually exists. Anything present = false is real drift.
-- ---------------------------------------------------------------------------
with expected(kind, name, present) as (
  select 'table', n, to_regclass('public.' || n) is not null
    from unnest(array['service_requests','payments','companies','company_payments',
                      'company_responses','reviews','profiles','settings','subscriptions']) n
  union all
  select 'column service_requests.' || n, n,
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='service_requests' and column_name=n)
    from unnest(array['customer_id','email','area','broadcast','admin_note']) n
  union all
  select 'function', n, exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                                 where ns.nspname='public' and p.proname=n)
    from unnest(array['is_admin','is_company','register_company','company_leads','lead_responses',
                      'choose_response','admin_resolve_company_payment','admin_resolve_payment',
                      'notify_new_service_request','service_requests_rate_limit','guard_company_fields']) n
  union all
  select 'trigger', n, exists (select 1 from pg_trigger where not tgisinternal and tgname=n)
    from unnest(array['trg_service_requests_rate_limit','on_service_request_notify','trg_guard_company']) n
  union all
  select 'index', n, exists (select 1 from pg_indexes where schemaname='public' and indexname=n)
    from unnest(array['service_requests_customer_idx','service_requests_status_idx',
                      'service_requests_phone_recent_idx','companies_owner_uniq']) n
  union all
  select 'constraint', 'service_requests_status_chk',
         exists (select 1 from pg_constraint where conname='service_requests_status_chk')
  union all
  select 'extension', 'pg_net', exists (select 1 from pg_extension where extname='pg_net')
)
select kind, name, present from expected order by present, kind, name;


-- ---------------------------------------------------------------------------
-- BLOCK 3 — every live policy, with its full predicate. These are what the
-- DROP POLICY statements in Part A would overwrite. Compare before running.
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;


-- ---------------------------------------------------------------------------
-- BLOCK 4 — full source of every function Part B would overwrite.
-- This is the diff input. If any body here differs from Part B, the repo file
-- is NOT authoritative and Part B would be a regression, not a catch-up.
-- ---------------------------------------------------------------------------
select p.proname,
       pg_get_functiondef(p.oid) as live_definition
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('admin_resolve_payment','is_company','register_company','company_leads',
                     'lead_responses','choose_response','admin_resolve_company_payment',
                     'notify_new_service_request','service_requests_rate_limit',
                     'guard_company_fields','is_admin')
 order by p.proname;


-- ---------------------------------------------------------------------------
-- BLOCK 5 — which migrations this project believes it has applied.
-- Compare the version format against the filenames in supabase/migrations/.
-- ---------------------------------------------------------------------------
select version, name
  from supabase_migrations.schema_migrations
 order by version;


-- ---------------------------------------------------------------------------
-- BLOCK 6 — the blast radius question from the original diagnosis, asked of
-- the RIGHT database this time. Errors here are themselves the answer: if
-- customer_id does not exist, this fails and Block 2 already told you why.
-- ---------------------------------------------------------------------------
select count(*)                                          as total,
       count(*) filter (where customer_id is null)       as orphaned,
       count(*) filter (where customer_id is not null)   as owned,
       count(*) filter (where status in ('new','pending')) as unhandled
  from public.service_requests;
