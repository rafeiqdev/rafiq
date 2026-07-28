# Supabase setup — Rafiq Istanbul

## 🔒 SECURITY HARDENING (2026-06-21) — read first

Project ref confirmed: `.env` `VITE_SUPABASE_URL` → **`jdtspvkhomctqkgdmjdn`**, anon key is the
project's public JWT (browser-safe). ✅

> ⚠️ **`iseldofsfhwvpfzltqet` is an ABANDONED project. Never run anything against it.**
> This document named it as the live ref in six places until 2026-07-27, which sent
> migrations into a database nobody uses. `.env` line 17 is the only authority on which
> project is live — check it, don't trust prose. A third ref, `tzcqnqzltrjemdnkzpzn`,
> also appeared here historically and is likewise not this app's project.

### CRITICAL — run now (2026-07-28): lock the internal RPCs
A live probe on 2026-07-28 found `_activate_sub`, `_credit_referrer` and `checkout_card_demo`
still executable by `anon`/`authenticated` through `/rest/v1/rpc/*` — the 2026-06-21 drop below
was never applied to `jdtspvkhomctqkgdmjdn`. Run
**`supabase/migrations/20260728_lock_internal_rpcs.sql`** in SQL Editor. It revokes the internal
helpers from the public API, drops `checkout_card_demo`, adds an in-function authorization guard
to `_activate_sub`, pins the advisor-flagged `search_path`s, tightens the
`referral_clicks` / `service_requests` insert policies, drops the file-listing policy on the
public `listings` bucket, and drops the dead `dukk` table. Verification queries are at the bottom
of the file; afterwards re-run **Database → Advisors → Security** and confirm the
`anon_security_definer_function_executable` entries are gone.

Two things it cannot do from SQL:
1. **Auth → Settings → enable Leaked Password Protection** (dashboard toggle).
   While there, add the password-reset landing pages to **Authentication → URL
   Configuration → Redirect URLs** (the 2026-07-28 reset flow sends recovery
   emails to them): `https://rafiq.ist/reset-password`,
   `https://rafiq-istanbul.vercel.app/reset-password`,
   `http://localhost:5173/reset-password`.
2. `_credit_referrer`'s body lives only in the live DB — paste the same guard used in
   `_activate_sub` (the `current_setting('role')` / `is_admin()` check) at the top of its body
   via **Database → Functions**.

### CRITICAL — run now: close the free-upgrade hole
Card checkout used an RPC `checkout_card_demo` that activated Pro/Elite **with no payment and no
admin approval**, callable directly with the public anon key. The app no longer calls it; remove it
from the DB too: run **`supabase/migrations/20260621_secure_checkout.sql`** in SQL Editor.
Verify: `select proname from pg_proc where proname='checkout_card_demo';` → **0 rows**.
After this, a plan is activated **only** by `admin_resolve_payment` (admin approval); the card path
now records a **pending** payment like bank/crypto.

### Verify RLS live (Database → Advisors → Security)
Confirm **every** table has RLS **enabled WITH policies** (no "RLS enabled, no policy"; no
`USING (true)` on writes except the intentional public `service_requests` INSERT). Key expectations:
- `payments`: owner insert (`status='pending'`), owner/admin select, **admin-only update**.
- `service_requests`: **anon INSERT allowed**, **SELECT admin-only** (protects names/phones).
- `subscriptions`: changed only via RPC; owner/admin select; admin update.
- `ai_usage`: users **cannot UPDATE** (see HIGH task 4 — move the limit into a `consume_ai_message()` SECURITY DEFINER RPC).
- admin RPCs (`admin_users_overview`, `admin_set_tier`, `admin_resolve_payment`) must `raise exception` when `not is_admin()`.

### schema.sql is NOT authoritative — regenerate it
`supabase/schema.sql` doesn't match the live DB (e.g. `checkout_card_demo` existed only live; some
RPC bodies were created in the dashboard). Don't trust it for a from-scratch rebuild. Regenerate the
real one and commit it:
```bash
supabase login && supabase link --project-ref jdtspvkhomctqkgdmjdn
supabase db dump --schema public --file supabase/schema.sql
```
Keep future changes as files under `supabase/migrations/`.

---

## 🏢 B2B COMPANIES SYSTEM (2026-07-01) — migration required before deploy

The Companies feature (company portal, broadcast leads, responses, reviews, admin
sections) needs DB objects that the frontend already depends on. **The frontend
must NOT be deployed until this runs**, because `serviceRequests.create()` now
sends `area` + `broadcast` (and relies on a `customer_id` default) — columns that
don't exist until the migration is applied, which would break the existing
"Help me with this" request flow.

1. **Run the migration** in the **correct project** (`jdtspvkhomctqkgdmjdn`) →
   SQL Editor → paste **`supabase/migrations/20260701_companies_b2b.sql`** → Run.
   It's additive + idempotent (companies, company_payments, company_responses,
   reviews, the service_requests columns, RLS, the `register_company` /
   `company_leads` / `lead_responses` / `choose_response` /
   `admin_resolve_company_payment` RPCs, and the `company_plan` price setting).
2. **Create two Storage buckets** (Storage → New bucket):
   - `company-logos` — **public** (company logos shown on public profiles)
   - `company-docs` — **private** (verification documents; admin opens via signed URL)
   Company payment receipts reuse the existing private `receipts` bucket.
3. The fixed monthly price defaults to **2000 TL** (settings key `company_plan`,
   editable later). Change it with:
   `update public.settings set value='{"monthly":2500,"currency":"TL"}' where key='company_plan';`

> Note: the Supabase MCP connector available to Claude is authorized only for the
> abandoned `iseldofsfhwvpfzltqet` project, so migrations cannot be applied
> automatically — run them yourself in `jdtspvkhomctqkgdmjdn`, or authorize the
> connector for that project. Until then, treat any schema claim Claude makes from
> the connector as describing the wrong database.

---

## 📨 LEAD-CAPTURE EMAIL + INSTANT NOTIFY (2026-07-09) — migration required

The no-login "Help me with this" flow (services + hub guides) now collects an
optional email, and every new `service_requests` row can ping an external
webhook instantly instead of relying on someone checking the admin dashboard.

1. **Run the migration** in `jdtspvkhomctqkgdmjdn` → SQL Editor → paste
   **`supabase/migrations/20260709_lead_capture_email.sql`** → Run. Adds the
   `email` column, enables `pg_net`, and installs an `AFTER INSERT` trigger on
   `service_requests`. Additive + idempotent — safe to run any time.
2. **Activate the webhook** (optional — the trigger silently no-ops until this
   is set): pick any URL that accepts a JSON POST (Slack incoming webhook,
   Zapier "Catch Hook", Make webhook, your own endpoint), then in SQL Editor:
   ```sql
   alter database postgres set app.lead_webhook_url = 'https://your-webhook-url';
   ```
   Each new lead posts `{name, phone, email, message, service_title, category,
   service_type, lang, created_at}` as JSON.

---

## ✅ STATUS — wiring is DONE

The app now runs **fully on Supabase** (Auth + Postgres + Storage). The old
Express/SQLite backend is no longer used by the website.

- **Project:** `jdtspvkhomctqkgdmjdn` — schema + RLS + triggers + RPCs + storage
  buckets all applied; demo listings/places seeded.
- **Keys:** already in `.env` and set as **Vercel** production env vars.
- **Live:** <https://rafiq-istanbul.vercel.app> (re-deployed with Supabase baked in).
- **Verified:** listings read from Postgres, the auto-create-profile trigger fires
  on signup, referral codes generate, live FX feeds the rate bar.

### 🔧 Two toggles only YOU can flip (Supabase has no API for auth config):

1. **Enable Google sign-in.** Authentication → Providers → **Google** → enable,
   paste a Google Cloud **OAuth client ID + secret** (see step 4 below), and add
   `https://rafiq-istanbul.vercel.app` + `http://localhost:5173` under
   Authentication → **URL Configuration → Redirect URLs**. Until this is on,
   "Continue with Google" will error — email/password already works.
2. **(Optional) Email confirmation** is currently **ON**, so a new email signup
   must click a confirmation link before the first sign-in (the app shows a
   "check your email" notice). To allow instant signup, turn it off under
   Authentication → Providers → **Email → Confirm email**. Note: Supabase requires
   passwords **≥ 6 characters** (the old "admin" 5-char password won't be accepted).

> Fastest way to get your **admin** account in: either (a) enable Google and sign
> in with `rafeiq.dev@gmail.com`, or (b) register that email with a ≥6-char
> password and click the confirmation email. Either way the trigger auto-grants
> it admin.

---

## Reference — the original full setup (for context)

---

## 1. Create / open your Supabase project
- Go to <https://supabase.com> → sign in → **New project** (free tier is fine).
- Pick a name + a strong database password (save it). Region: closest to Türkiye/EU.

## 2. Run the database schema
- In the project, open **SQL Editor → New query**.
- Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
- It creates every table (profiles, subscriptions, listings, places, bookings,
  leads, referrals, notifications, documents, settings, ai_usage), the
  Row-Level-Security policies, the auto-create-profile trigger, and seeds the
  demo listings/places. If any statement errors, copy the message back to me.
- **Admin:** the trigger makes `rafeiq.dev@gmail.com` an admin automatically on
  first sign-in. (Edit the email list in the SQL if you want others.)

## 3. Get the two public keys → paste into `.env`
- **Project Settings → API**. Copy:
  - **Project URL** → `VITE_SUPABASE_URL`
  - **anon public** key → `VITE_SUPABASE_ANON_KEY`
- Put them in `rafiq-istanbul/.env` (placeholders are already there). These are
  public/browser-safe.

## 4. Enable Google sign-in
This is the part that fixes Google. Two sub-steps:

**a) Create a Google OAuth client** (Google Cloud Console):
- <https://console.cloud.google.com> → APIs & Services → **Credentials** →
  *Create credentials* → **OAuth client ID** → *Web application*.
- Under **Authorized redirect URIs** add the Supabase callback (copy the exact
  URL shown in Supabase → Authentication → Providers → Google):
  `https://<your-project-ref>.supabase.co/auth/v1/callback`
- Copy the generated **Client ID** and **Client secret**.

**b) Turn it on in Supabase:**
- Supabase → **Authentication → Providers → Google** → enable → paste the
  **Client ID** + **Client secret** → Save.

**c) Allow your app URLs:**
- Supabase → **Authentication → URL Configuration** → set **Site URL** to
  `http://localhost:5173`, and add BOTH of these to **Redirect URLs**:
  - `http://localhost:5173`
  - your Vercel URL (e.g. `https://rafiq-istanbul.vercel.app`) once it exists.
- In Google Cloud → your OAuth client → **Authorized JavaScript origins**, add
  `http://localhost:5173` and the Vercel URL too.

## 5. (Optional) Document locker storage
- Supabase → **Storage → New bucket** → name it `documents`, keep it **private**.
- I'll add per-user access policies when we wire the locker.

---

## What I need back from you
Just paste me these (or put the two `VITE_*` into `.env` yourself and say "done"):

1. `VITE_SUPABASE_URL` = `https://xxxxx.supabase.co`
2. `VITE_SUPABASE_ANON_KEY` = `eyJ...` (the long anon public key)
3. Confirm the schema ran without errors, and that you enabled the Google provider.

Then I'll: wire the app's auth (email + **Google**) and data layer to Supabase,
keep all 4 languages/RTL intact, run the build, and verify sign-in end-to-end.

> Note: a few server-only features (the AI chat stream, the payment webhook) will
> stay on the small Node server for now, or move to **Supabase Edge Functions** in
> a later phase — I'll flag that when we get there.

---

## 6. Deploy to Vercel (after Supabase is wired)
Vercel is already connected. Once the app talks to Supabase, it's a static SPA and
deploys cleanly. When we get there:

- **Project → Root Directory** must be set to `rafiq-istanbul` (this repo has more
  than one app under it). `vercel.json` (SPA rewrites + Vite preset) is already in
  this folder.
- **Vercel → Project → Settings → Environment Variables** — add the same public
  vars used locally:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `VITE_WHATSAPP_NUMBER`, `VITE_CONTACT_EMAIL`
- After the first deploy, copy the Vercel URL back into Supabase **Redirect URLs**
  and the Google OAuth **authorized origins** (step 4c) so Google works in prod.

I'll trigger the deploy and walk these settings with you once auth + data are on
Supabase.
