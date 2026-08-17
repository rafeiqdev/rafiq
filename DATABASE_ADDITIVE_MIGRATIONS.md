# DATABASE_ADDITIVE_MIGRATIONS.md

Database plan for the Control Center. **Additive changes only.**

---

## 0. Ground rules (from the brief + project reality)

- **Migrations are applied by hand** on this project (pasted into the Supabase
  SQL Editor). A file existing in-repo does **not** mean the object exists live.
  Every reader tolerates a missing new table (loud, scoped error — never a fake
  empty).
- **Forbidden:** `DROP TABLE/COLUMN`, `RENAME` anything, changing a column type
  destructively, deleting old data, editing an existing RPC in place, or
  altering an existing RLS policy in a way that breaks current users.
- **Allowed:** new tables, new views / materialized views, new **nullable**
  columns, new indexes (after perf check), new RPCs, new policies on **new**
  tables, new triggers that don't touch old paths.
- Every migration: clear name, description header, `create ... if not exists` /
  `add column if not exists` guards, a documented **rollback**, and **no seed
  data into production**.

## 1. Phase A — NO database changes

Phase A (route + shell + Overview) is **100% read-only over existing tables**
(`profiles`, `subscriptions`, `bookings`, `leads`, `payments`,
`admin_audit_log`). It creates **zero** new DB objects. Rollback of Phase A is
purely code; the database is never touched.

> One operational note, not a change: the Analytics section depends on
> `public.events`, whose migration (`20260727_events_tracking.sql`) may not have
> been applied live yet. Applying that **existing** migration is what turns on
> first-party analytics collection — it is not new work introduced here.

## 2. Phase B/C — planned additive objects (all `cc_`-namespaced)

Each ships as its own idempotent migration file, applied by hand, with a rollback
of the form `drop ... if exists` (safe because nothing else depends on them).

| Object | Type | Purpose | Rollback |
|---|---|---|---|
| `cc_permissions` | table | (role/user → permission key) grants for the granular layer | `drop table if exists cc_permissions` |
| `cc_role_presets` | table | default role → permission sets | `drop table` |
| `cc_lead_metadata` | table | CRM overlay on `leads` (owner, pipeline_stage, tags, next_action, …) — **never** modifies `leads` | `drop table` |
| `cc_notification_templates` | table | email/in-app/WhatsApp templates (test-mode first) | `drop table` |
| `cc_notification_deliveries` | table | delivery log (status/opened/clicked) | `drop table` |
| `cc_audit_ext` (or reuse `admin_audit_log`) | table | extra audit fields if needed (before/after json, reason, ip_hash) | `drop table` |
| `cc_analytics_daily` | materialized view | pre-aggregated event/revenue rollups for fast dashboards | `drop materialized view` |
| `cc_operations_inbox` | view | unified read across service_requests/bookings/leads/offers/payments | `drop view` |
| `cc_finance_summary` | view | revenue by service/month/method/currency across payment tables | `drop view` |
| `cc_*` RPCs | functions | permission-checked reads/actions (verify/refund/reveal/export/approve) — **new** functions, never edits of existing ones | `drop function` |

Design notes:
- CRM/notification/permission data is stored in **new side tables** keyed by the
  existing row id (e.g. `cc_lead_metadata.lead_id`), so the original `leads` row
  and its creation path are untouched.
- New tables get RLS enabled with `is_admin()` (Phase A/B) then permission-scoped
  policies (Phase B/C). No existing policy is altered.
- New RPCs follow the existing `SECURITY DEFINER` + `set search_path = public` +
  server-side actor stamping pattern (mirroring `admin_audit_log_write`), with
  `revoke ... from anon` and explicit `grant ... to authenticated`.
- Sensitive actions log to audit **before** returning; messaging RPCs run in
  test-mode (admin recipient only) until explicitly published.

## 3. Migration checklist template

```
-- cc_<name> (YYYY-MM-DD)
-- WHAT / WHY:
-- ROLLBACK: drop ... if exists cc_<name>;
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run. Idempotent.
create table if not exists public.cc_<name> ( ... );
alter table public.cc_<name> enable row level security;
create policy ... on public.cc_<name> ...;   -- new table only
-- VERIFICATION (read-only): select ... ;
```

## 4. Current status

**No migration has been written or applied for this feature.** Phase A needs
none. The table above is the sanctioned plan for Phase B/C, to be authored and
hand-applied one file at a time, each with QA + sign-off, when those phases are
approved.
