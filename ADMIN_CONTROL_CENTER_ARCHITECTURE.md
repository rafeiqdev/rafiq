# ADMIN_CONTROL_CENTER_ARCHITECTURE.md

Architecture of the additive **Admin Control Center** (`/admin/control-center`),
built beside — never replacing — the classic `/admin`.

---

## 1. Principles (non-negotiable)

1. **Additive only.** No edit to existing behavior, tables, columns, routes,
   components, RPCs, RLS, or permissions.
2. **Dark by default.** Behind a feature flag; off ⇒ the app is unchanged.
3. **Read-first.** Phase A is 100% read-only. Writes (Phase B/C) are added later,
   each behind the granular permission layer + confirmation + audit.
4. **One source of truth.** Reuse existing `lib/api.ts` reads; never fork a
   second query path for data that already has one.
5. **Honesty over completeness.** Unreadable ⇒ `—` (never 0). Missing ⇒ explicit
   "no data" / "in progress". **Never** mock data in a report meant to be real.

## 2. Where things live

```
src/admin-control-center/          ← the entire module (isolated)
  flag.ts            feature flag
  i18n.ts            module-local ar/en dictionary + RTL helper + useCC()
  sections.ts        section registry (id, label, icon, implemented)
  ControlCenter.tsx  RequireAdmin gate + ?section= section router
  components/        CCShell (chrome), CCState (loading/error/empty)
  pages/             Overview (real data), Placeholder (reserved sections)
  api/               read-only service layer → delegates to src/lib/api.ts
```

Wiring into the existing app is three small additive hunks (`App.tsx` route,
`Admin.tsx` link, `.env.example` var) — see `ADMIN_BACKWARD_COMPATIBILITY.md`.

## 3. Routing & navigation

- **One route:** `/admin/control-center`, registered only when the flag is on.
- **Sections via query:** `?section=<id>` (mirrors how `/admin` uses `?tab=`), so
  bookmarks/refresh/shared links land on the right section without adding nested
  routes to the app router.
- **Gate:** `RequireAdmin` (the same gate as `/admin`). No UI grants new access;
  every underlying read is `is_admin()`-scoped by Postgres RLS.

## 4. Data flow

```
Overview page
  └─ useAsyncSection(fetcher)          per-card: independent loading/error/empty
       └─ admin-control-center/api/overview.ts   (READ-ONLY wrappers)
            └─ src/lib/api.ts  adminUsers.list / adminPayments.list /
               adminUsers.cancellations / adminAuditLog.list   (existing, proven)
                 └─ Supabase (PostgREST/RPC), RLS-enforced
```

- Pure rollups (`computeUserKpis`) are separated from async fetchers so the
  null-safe totals are unit-tested without a database.
- Each card owns its request/status/retry (`useAsyncSection` + `CCState`), so one
  failed read can never blank the others or masquerade as "empty".

## 5. i18n / RTL

- Module-local dictionary (Arabic primary + English; ru/fa fall back to English)
  so the four shared locale files and their parity test stay untouched.
- Direction derives from the app language via the existing `RTL_LANGS` (ar/fa →
  rtl). The shell sets `dir` and lays the sidebar as the first flex child so it
  sits on the reading-start side in both directions.

## 6. Section roadmap (structure is in place from day one)

All twelve sections are **built and reading real data** (Phase A, read-only).

| Section | Status | Reads from |
|---|---|---|
| Overview | **Done** | profiles, subscriptions, bookings, leads, payments, admin_audit_log |
| Analytics & Insights | **Done** (read) | `public.events` — sessions, page views, funnel, top pages/referrers/services, device + locale |
| Unified Operations | **Done** (read) | service_requests, bookings, leads — merged, with open/overdue |
| CRM & Leads | **Done** (read) | leads (pipeline metadata still needs `cc_lead_metadata`) |
| Notifications | **Done** (read) | notifications broadcasts — history only, no sending |
| Documents & Privacy | **Done** (metadata only) | medical_request_files — name/type/size/date, no reveal or download |
| Finance Control Center | **Done** (read) | payments, service_payments, medical_payments, company_payments |
| Journey & Onboarding | **Done** (read) | user_journey_items — completion rate per step |
| Referrals & Wallet | **Done** (read) | referral_commissions, payout_requests |
| Content & Localization | **Done** (read) | listings, investment_opportunities, news_posts (+ translation coverage) |
| Security & Audit | **Done** (read) | admin_audit_log |
| System Health | **Done** (read) | fx_sync_runs, fx_rates |

**Deliberately still absent (Phase C):** verify / reject / refund, commission
approval, payout release, document reveal or download, sending notifications,
publishing content, role and tier changes. Each needs the granular permission
layer plus confirmation plus an audit entry before it is offered at all; until
then those actions remain in the classic Admin, which every row deep-links to.

Adding a section = implement its page, flip `implemented: true` in
`sections.ts`, point the router at it. No shell/route changes.

## 7. Launch plan (from the brief)

- **Phase A — Read-only:** route, Overview, Analytics (read), Unified Operations
  (read), Audit (read), System Health (read). Flag off in prod by default.
- **Phase B — Management:** granular permissions, CRM metadata, assign owner,
  notes, tags, limited export.
- **Phase C — Sensitive actions:** notifications, payment actions, document
  reveal, refunds, commission approval, content publishing. Each gated by
  permission + confirmation + audit, and (for messaging) test-mode first.

Each phase needs QA + sign-off before its flag/permissions are enabled.

## 8. What's implemented now (Phase A, first slice)

Route + shell + i18n/RTL + feature flag + read-only service layer + a working
**Overview** (real KPIs and cards, per-card loading/error/empty, no mock data) +
honest placeholders for the other 11 sections + unit tests + green regression.
