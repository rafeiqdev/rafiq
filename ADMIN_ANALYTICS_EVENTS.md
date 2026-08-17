# ADMIN_ANALYTICS_EVENTS.md

The event taxonomy the Control Center's Analytics section **reuses**. It does not
create a parallel analytics system — that would produce two sets of numbers that
disagree. It reads the existing first-party `public.events` table and GA4.

---

## 1. Existing schema (source of truth)

Table `public.events` — `supabase/migrations/20260727_events_tracking.sql`.
Append-only; **admin-only read** (`is_admin()`); public insert restricted to own
`user_id` or null; per-session rate limit (300 / 5 min) + 4 KB `meta` cap.

Columns: `id, user_id (nullable), session_id, event_type, path, target, meta
(jsonb), locale, device, referrer, created_at`.

Client: `src/lib/analytics.ts` — consent-gated (`getConsent() === 'granted'`),
Do-Not-Track honored, strict PII screen (drops any event whose `target`/`meta`
looks like an email/phone; `meta` must be flat identifiers/enums only).

## 2. Existing event_type values (17, CHECK-constrained)

`page_view, service_view, service_click, request_started, request_submitted,
chat_opened, chat_message_sent, login, signup, checkout_opened,
payment_submitted, whatsapp_clicked, lang_changed, guide_viewed,
search_performed, paywall_shown, upgrade_clicked`.

## 3. Brief's requested events → existing names

The brief lists a wishlist of events; map to the existing taxonomy rather than
renaming. Gaps become **new** `event_type` values (added additively to the CHECK
constraint via a new migration — never a rename of an existing one).

| Brief event | Existing equivalent | Action |
|---|---|---|
| page_view | `page_view` | reuse |
| signup_started / signup_completed | `signup` | reuse (add `_started` later if needed) |
| onboarding_completed | — | add (new type) |
| service_view / service_click | `service_view` / `service_click` | reuse |
| service_request_started | `request_started` | reuse |
| lead_created / generate_lead | `request_submitted` (+ GA4 `generate_lead`) | reuse |
| booking_created / booking_cancelled | — | add |
| property_view / property_favorite | — | add |
| news_view / guide_view | `guide_viewed` (+ add `news_view`) | reuse/add |
| chat_started | `chat_opened` | reuse |
| offer_sent / offer_accepted | — | add |
| payment_started / payment_verified / payment_rejected | `payment_submitted` (+ add verified/rejected) | reuse/add |
| service_completed | — | add |
| referral_click / referral_signup | (referral_clicks table) | reuse table |
| commission_approved | — | add |
| document_uploaded / appointment_created | — | add |

Any additions go through a new migration that **appends** allowed values to the
`event_type` CHECK — the 17 existing values are never removed or renamed.

## 4. Hard rules (kept, not relaxed)

Never store in `events.meta` (or any audit meta): passport/ID numbers, passwords,
card data, raw documents, health details, or private chat text. `search_performed`'s
`meta.query` is the single documented free-text exception (normalized, capped,
still PII-screened, stripped after 90 days).

## 5. CRITICAL operational finding

`src/lib/analytics.ts` documents that `public.events` **was never created in the
live database** — the client flips `sinkMissing` on the first 404 and stops
collecting for that page load. Consequences for the Analytics section:

1. There may be **little or no historical first-party data** yet.
2. The Analytics UI must first check the table exists and is readable, and show
   an explicit **"analytics not yet collecting / no data available"** state
   (already drafted in the module i18n as `analytics.notCollecting.*`) instead of
   rendering zeros or invented figures.
3. To start collecting: apply `20260727_events_tracking.sql` in the Supabase SQL
   Editor (migrations are manual on this project). Collection then resumes on the
   next page load with **no redeploy** (the `sinkMissing` guard is per page-load,
   not persisted).

## 6. Reports (planned, Phase A/B — all read-only, from `events` + existing tables)

Acquisition (source/medium/campaign/referrer/locale/device → visits, signups,
leads, requests, payments, revenue), Page Performance, Service Performance,
Funnel (`page_view → service_view → request_started → request_submitted →
booking → payment_submitted → payment_verified → service_completed`), Retention
(1/7/30-day, monthly cohort), Referrals. Every report supports the standard
period filters + CSV export (export is permission-gated and audit-logged).

Note: `referral_clicks` carries **no `user_id`**, so per-user referral
attribution is not derivable client-side — referral analytics respects that
limit rather than inventing attribution.
