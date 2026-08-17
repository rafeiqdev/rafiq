# ADMIN_ADDITIVE_AUDIT.md

Phase 0 audit for the **Admin Control Center** additive project. Nothing in the
existing system is modified by this document — it only records what is there
today so the new work can be layered on top without breaking it.

- **Date:** 2026-08-17
- **Branch:** `feature/admin-control-center-additive`
- **Rule enforced throughout:** additive only. No rename/drop of any existing
  table, column, route, component, or RPC. No change to existing Admin
  permissions or behavior.
- **Data-source note:** all database facts below are read from the migration
  SQL in `supabase/migrations/` and from `src/lib/api.ts`. The live Supabase
  project is **not** queried here (the connected Supabase/Vercel MCP accounts
  are the wrong account for this project, and migrations are applied by hand —
  so a migration existing in-repo does **not** guarantee the object exists live;
  see §9).

---

## 1. Current technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, Vite 5, TypeScript ~5.6, React Router v6.28 (per-language `basename`), react-i18next 15 (ar/en/ru/fa), TailwindCSS 3.4, framer-motion 13, lucide-react |
| Data access (browser) | `@supabase/supabase-js` v2 talking **directly** to Supabase (PostgREST + RPC), RLS-enforced. Centralized in `src/lib/api.ts`. There is no bespoke REST backend for the app in production. |
| Serverless (Vercel functions) | `api/` — `ai-chat.ts` (Google Gemini), `payments/*` (Whop webhooks + checkout), `cron/rates-sync.ts`, `cron/telegram-sync.ts`, `news-photo.ts`, `place-photo.ts`, `places-search.ts`, `admin/medical-translate.ts`, `_lib/{fx,gemini,whop}.ts` |
| Legacy/dev server | `server/index.mjs` (Express 5) — used by `npm run dev:server` and `server/test.mjs`. Not the production path (Vercel is). |
| Auth | Supabase Auth (email/password + Google OAuth). Session in browser. |
| Database | Supabase Postgres, RLS + `SECURITY DEFINER` RPCs. **Migrations are applied manually** by pasting SQL into the Supabase SQL Editor. |
| Build/test | `tsc -b` + `vite build`; `vitest` unit tests (74 files / 793 tests today) + `node --test server/test.mjs`; i18n parity checker. |

---

## 2. Routes (from `src/App.tsx`)

Public / user routes (all under a language segment `/ar|/en|/ru|/fa`):
`/`, `/auth`, `/reset-password`, `/premium`, `/chat`→redirect, `/help`,
`/services`, `/services/:id`, `/guides/:id`, `/map`, `/referrals`, `/wallet`,
`/real-estate`, `/real-estate/investments`, `/real-estate/investments/:slug`,
`/real-estate/:id`, `/real-estate/:id/services`, `/health-tourism`,
`/medical-request`, `/tricks`, `/tricks/:id`, `/news`, `/news/:id`, `/profile`,
`/onboarding`, `/home`, `/journey`, `/account`→redirect, `/requests`,
`/companies/:id`, `/company`, `/company/register`, `/company/profile`,
`/company/billing`, `/notifications`, `/terms`, `/privacy`, `/refund`, `*`.

**Admin routes (must remain byte-for-byte unchanged):**

| Route | Component | Gate |
|---|---|---|
| `/admin` | `pages/Admin.tsx` (`Admin`) | `RequireAdmin` (`user.isAdmin`) |
| `/admin?tab=<tab>` | same, section via `?tab=` query | `RequireAdmin` |
| `/admin/bookings` | `<Navigate to="/admin?tab=bookings" replace />` | — |
| `/admin/medical` | `pages/AdminMedical.tsx` (`AdminMedical`) | `RequireMedicalCoordinator` (coordinator **or** admin) |

**New route to be added (additive):** `/admin/control-center` — see the
architecture doc. It is added as one new `<Route>` + one lazy import and is
gated by a feature flag (**on** by default, with a `"false"` kill-switch), so
whenever the flag is switched off it renders the `NotFound` fallback and the app
is unchanged.

---

## 3. Admin components (existing — do not restyle/move)

`src/pages/Admin.tsx` is a single tabbed page. Its 19 tabs:
`overview, users, bookings, serviceRequests, payments, paymentSettings, rates,
cancellations, leads, companies, companyPayments, broadcast, newsFeed, catalog,
listings, investments, places, news, auditLog`.

Tab → component map (the pieces the Control Center will *read from*, never
rewrite):

- `overview` → inline stat cards + `AdminNewRequests`
- `users` → inline `UserRow` table (`adminUsers.list/detail`), tier + coordinator role controls
- `bookings` → `AdminBookings.tsx` `AdminBookingsPanel`
- `serviceRequests` → `ServiceRequestsManager.tsx`
- `payments` → inline (`adminPayments.list/resolve/openReceipt`)
- `paymentSettings` → `components/admin/PaymentSettingsPanel.tsx`
- `rates` → `components/admin/FxRatesPanel.tsx`
- `cancellations` → inline (`adminUsers.cancellations`)
- `leads` → inline (`leads.adminList`)
- `companies` → `AdminCompaniesManager.tsx` (currently hidden from nav)
- `companyPayments` → `AdminCompanyPaymentsManager.tsx` (hidden from nav)
- `broadcast` → `AdminBroadcastManager.tsx`
- `newsFeed` → `components/admin/NewsFeedManager.tsx`
- `catalog` → `AdminServicesManager.tsx`
- `listings` / `investments` / `places` → `AdminManagers.tsx` + `components/admin/InvestmentsManager.tsx`
- `news` → inline (`notifications.publish/broadcasts`)
- `auditLog` → `components/admin/AdminAuditLog.tsx`

Supporting admin UI primitives (reusable, safe to *consume*):
`components/admin/ConfirmActionModal.tsx`, `components/admin/RevealField.tsx`
(masked PII with reveal + audit), `components/SectionState.tsx`,
`hooks/useAsyncSection.ts`, `components/RequestStatusPill.tsx`.
Medical admin: `pages/AdminMedical.tsx`.

---

## 4. Database tables (from migrations)

Confirmed by migration files in `supabase/migrations/`:

`profiles`, `subscriptions`, `payments`, `service_requests`, `bookings`,
`leads`, `notifications` (+ `notification_reads`), `settings`, `companies`,
`company_payments`, `company_responses`, `reviews`, `fx_rates`, `places`
(Google Maps overlay + favorites), `listings` (real-estate),
`investment_opportunities` (+ contacts), `news_posts` (+ translations,
Telegram sync), `service_offers`, `service_payments`, `referrals`/wallet
(`referral_clicks`, commissions, wallet — `20260816_referrals_and_wallet.sql`),
`events` (analytics — see §7/§9), `admin_audit_log`, and the medical suite
(`medical_requests`, `medical_offers`, `medical_payments`, `medical_specialties`,
`medical_services`, medical landing content tables, `medical_audit_log`).

**Tables with no dedicated admin screen today** (candidates the Control Center
surfaces read-only): `events` (never had a dashboard), `referral_clicks` /
commissions / wallet (no admin view — only the user-facing `/referrals` &
`/wallet`), `service_offers` / `service_payments` (managed inline per-request,
no aggregate view), `notification_reads` (delivery, no view).

---

## 5. RPC functions & API endpoints (existing — do not modify in place)

Key `SECURITY DEFINER` RPCs referenced by `src/lib/api.ts`:
`is_admin()`, `is_company()`, `admin_set_tier(p_user,p_tier)`,
`admin_resolve_payment(...)`, `admin_resolve_company_payment(...)`,
`register_company(...)`, `company_leads(...)`, `lead_responses(...)`,
`choose_response(...)`, `admin_audit_log_write(p_action,p_target_type,p_target_id,p_meta)`,
`_admin_audit_log_insert(...)` (internal, revoked from clients),
`medical_audit_log_write(...)`, `events_guard()` (trigger),
`events_apply_retention()`, plus medical offer/payment RPCs and referral/wallet
RPCs.

Vercel function endpoints: `/api/ai-chat`, `/api/places-search`,
`/api/place-photo`, `/api/news-photo`, `/api/payments/webhook`,
`/api/payments/service-pay`, `/api/payments/service-webhook`,
`/api/payments/medical-pay`, `/api/payments/medical-webhook`,
`/api/cron/rates-sync`, `/api/cron/telegram-sync`, `/api/admin/medical-translate`.

**Every new RPC introduced by this project will be a new function with a new
name** (e.g. `cc_*`), never an in-place edit of the above.

---

## 6. User roles (existing)

From `src/lib/types.ts` (`UserRole`) and `profiles.role`:

- `user` — default
- `admin` — full admin (`RequireAdmin`, `user.isAdmin`, DB `is_admin()`)
- `company` — B2B portal (`RequireCompany`)
- `medical_coordinator` — medical admin surface (`RequireMedicalCoordinator`; admins also pass)

Convenience flags on `User`: `isAdmin`, `isCompany`, `isMedicalCoordinator`.
Admin access is a **single boolean today** — there is no granular permission
system. The Control Center adds an *additive* granular permission layer on top
(see `ADMIN_PERMISSIONS_MATRIX.md`) that **defaults every existing admin to full
access** so nobody loses capability.

---

## 7. Analytics (existing)

Two channels, both already live in `src/lib/analytics.ts`:

1. **First-party `public.events` table** — append-only, 17 whitelisted
   `event_type` values, strict client-side PII guard (drops any event whose
   `target`/`meta` looks like an email or phone; `meta` must be flat
   identifiers/enums only, single documented exception: `search_performed`'s
   `meta.query`). RLS: public insert (own `user_id` or null), **admin-only
   read**. Rate-limited per session (300 / 5 min) + 4 KB `meta` cap via
   `events_guard()`. Retention via `events_apply_retention()` (manual — pg_cron
   not installed).
2. **Google Analytics 4** — `window.gtag`, loaded only after consent; event
   bridge in `sendGoogleEvent()`.

Consent gating: nothing is collected before `getConsent() === 'granted'`, and
nothing at all under Do-Not-Track.

**Critical finding:** `src/lib/analytics.ts` documents that `public.events` was
**never created in the live database** — `sinkMissing` flips on the first 404
and collection is disabled for that page load. So there may be **no historical
first-party event data** to build Analytics reports against yet. The Control
Center's Analytics section must therefore (a) verify the table exists, (b) show
an explicit "No data available / analytics not yet collecting" empty state
rather than inventing numbers, and (c) reuse this **same** taxonomy/event names
— not create a parallel, conflicting analytics system.

---

## 8. Field-name vs UI mismatches / gotchas

- DB is `snake_case`; the app maps to `camelCase` in `src/lib/api.ts` row
  mappers (`toListing`, `toBooking`, `toLead`, `toCompany`, …). New read code
  must go through the same mapping discipline.
- Aggregate counts that cannot be read are rendered **`—` (null), never `0`** —
  a deliberate, load-bearing convention (`AdminUser.bookings/leads/payments` are
  `number | null`). The Control Center must preserve this (never show a failed
  read as zero).
- `admin_users_overview()` RPC **does not exist** in the live DB; `adminUsers.list()`
  was rewritten to build the users table from `profiles` + 4 aggregate reads
  instead. Do not reintroduce a dependency on that RPC.
- `referral_clicks` stores only a code with **no `user_id`**, so per-user
  referral attribution is not derivable client-side (the old referral columns
  were removed for this reason). Referral analytics must respect this limit.
- `provider` on `AdminUser` is always `'email'` client-side (sign-in provider
  lives on `auth.users`, unreachable from the browser). Don't present it as fact.

---

## 9. RLS / permission / data-exposure risks to respect

- **Manual migrations:** a migration file in-repo is not proof the object exists
  live (per project memory: "deployed features can fail on tables that were
  never created"). Every new Control Center query must fail *loud but scoped*
  (per-section error state), never render emptiness as truth, and must tolerate
  a missing new table.
- **PII:** emails/phones are masked by default (`RevealField`) and every reveal
  is audit-logged (`logPiiReveal`). Documents live in private buckets behind
  short-lived signed URLs. The Control Center must keep PII masked by default,
  gate reveals behind an explicit (new, granular) permission, and audit-log
  every reveal/download/export.
- **Admin-only reads:** `events` and `admin_audit_log` are `is_admin()`-gated.
  New aggregate views/RPCs must keep the same `is_admin()` (or stricter,
  permission-scoped) gate — never anon-readable.
- **No secrets in analytics/audit:** never store passport/ID numbers, card data,
  passwords, raw documents, health details, or private chat text in
  `events.meta` or audit `meta` (already enforced client-side; keep it).

---

## 10. What this project will and will not touch

**Will add (additive):** a new `src/admin-control-center/` module, a new
`/admin/control-center` route behind a feature flag, a new read-only service
layer, new `cc_*` DB objects (tables/views/RPCs) applied by hand, a new granular
permission layer that defaults existing admins to full access, and standalone
docs.

**Will not touch:** `/admin`, `/admin/bookings`, `/admin/medical`, any existing
tab/component/manager, any existing table/column/RPC/RLS policy, existing admin
permissions, or any public/user page. If a desired feature appears to require
editing existing behavior, work stops and two options (additive vs. modifying)
are documented for approval — per the "conditions to stop" section of the brief.
