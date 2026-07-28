# Rafiq Istanbul

A multilingual digital-services hub for foreigners (expats, students, investors, tourists)
moving to, arriving in, or living in Istanbul.

## Stack

- **Web:** React 18 + TypeScript + Vite, React Router 6, Tailwind CSS
  (brand: navy `#1a3a6b`, cream `#faf8f0`, red `#c0392b`). Every page lives
  under a language URL segment (`/ar` `/en` `/ru` `/fa`).
- **i18n:** i18next — 4 fully translated languages with enforced key parity:
  Arabic (RTL), English, Russian, Farsi (RTL). Locale bundles are lazy-loaded
  per language.
- **Backend (production):** Supabase — Auth (email/password + Google OAuth,
  password recovery), Postgres reached directly from the browser through
  PostgREST with **RLS as the enforcement layer**, Storage buckets, RPCs.
  Plus a handful of Vercel functions (`api/`): AI chat, Places proxy,
  payment webhook, FX cron.
- **Map:** Google Maps JS API (`@googlemaps/js-api-loader`), lazy-loaded only
  past the Pro gate.

## Required Vercel environment variables

The daily FX-rate sync (`api/cron/rates-sync.ts`, scheduled in `vercel.json`)
**does not run at all** unless BOTH of these are set in the Vercel dashboard
(Settings → Environment Variables, Production). Without them the currency bar
keeps showing the last stored rates forever:

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` on scheduled runs; the endpoint refuses without it. Any long random string. |
| `SUPABASE_SERVICE_ROLE_KEY` | Lets the cron write `fx_rates` (bypasses RLS). Supabase → Settings → API. **Server-only — never expose to the client.** |

See `.env.example` for the full annotated list (Google Maps keys, provider
overrides, alert webhook).

## Run

```bash
npm install
cp .env.example .env     # then edit (admin emails, webhook secret, keys)
npm run dev:all          # web on :5173 + API on :8787 (proxied via /api)

npm run build            # sitemap + type-check + production bundle
npm test                 # vitest unit suite + legacy server contract tests
npm run check:i18n       # fails if ar/en/ru/fa key sets diverge
```

## Architecture

**What actually ships** (rafiq.ist, Vercel): a static SPA whose browser bundle
talks to Supabase directly. There is **no Express server in production** — the
decision, made 2026-07-28, is option (b): commit to Supabase and keep every
trust decision in the database and in server-side functions. Anything
`server/index.mjs` enforces is inert in production; treat it as a local dev
stand-in only (see below).

Where each trust decision lives:

- **Identity:** Supabase Auth — email/password (with `/reset-password`
  recovery flow) and Google OAuth. Sessions are Supabase JWTs; the client
  never sees a password hash. Login failure is a single generic message by
  design: the API cannot distinguish unknown-email from wrong-password, and
  the copy must not confirm which emails have accounts.
- **Authorization:** Postgres RLS on every table, `public.is_admin()` for the
  admin surfaces, `has_pro()`-style checks for paid data (map places). The
  browser holds only the public anon key; editing client state unlocks
  nothing that RLS doesn't allow.
- **Internal RPCs:** `_activate_sub` and friends are revoked from
  `anon`/`authenticated` and additionally refuse to run unless called by
  `service_role`/an admin (see
  `supabase/migrations/20260728_lock_internal_rpcs.sql`). The one-time
  `checkout_card_demo` backdoor is dropped.
- **Payments:** bank transfer and crypto are manual rails — the client records
  a **pending** `payments` row, the admin verifies it in `/admin` (RPC
  `admin_resolve_payment`). Card payments activate **only** through
  `api/payments/webhook.ts`: HMAC-SHA256 over the raw body with
  `PAYMENT_WEBHOOK_SECRET`, idempotent pending→verified transition, activation
  via `_activate_sub` with the service-role key. Wiring a real gateway
  (iyzico/Stripe) means pointing its webhook at that endpoint — see
  SUPABASE-SETUP.md.
- **AI assistant:** `api/ai-chat.ts` (Vercel function) → Google Gemini with a
  deterministic fallback (`src/lib/ai-fallback.ts`) when unavailable.
- **Referrals:** `/r/:code` (or `?r=CODE`) records the click — the insert
  policy requires a real code and rate-limits per code; commissions are
  credited on verified payments.
- **FX rates:** `api/cron/rates-sync.ts` (daily Vercel cron) is the only
  writer of `fx_rates`; the browser reads them through RLS.
- **Headers:** clickjacking/MIME/referrer/HSTS protections plus a
  Content-Security-Policy (report-only until the report stream is clean) live
  in `vercel.json`.

### `server/` — local dev stand-in, not the product

`server/index.mjs` (Express + SQLite) predates the Supabase migration. It is
**not deployed** and must not be documented as the security model. It stays in
the repo for two reasons only: `npm run dev:all` proxies `/api` to it during
local development, and `server/test.mjs` pins executable contracts (the
payment-webhook shape now mirrored by `api/payments/webhook.ts`). Do not add
product features there. When local dev no longer needs it, delete the
directory.

Known gap of the static-SPA choice: every route returns HTTP 200, so /404 is a
soft 404 (mitigated with its own title + noindex). A real 404 status and
reliable Bing/Yandex indexing would require prerendering or SSR — that is the
next architecture decision, not an oversight.

## Key files

```
src/lib/api.ts          typed Supabase data layer (the seam — all reads/writes)
src/lib/supabase.ts     the single Supabase client
supabase/migrations/    the database as code — run in the dashboard SQL editor
api/                    Vercel functions: ai-chat, places, payment webhook, cron
src/i18n/index.ts       language URLs, lazy locale chunks, direction handling
src/blocks/registry.ts  profile-driven homepage blocks (showIf + priority)
src/components/Modal.tsx  a11y dialog shell (focus trap, Esc, backdrop)
scripts/check-i18n-parity.mjs  locale key-set guard (also in CI)
scripts/generate-sitemap.mjs   per-language sitemap + robots (build step)
server/                 local dev stand-in + contract tests — NOT deployed
```

## Naming note

The product ships as **Rafiq Istanbul** everywhere (locales, logo, titles). The
"Mawadda / مودة" rebrand is still an open business decision, not yet executed.
This is a full impact map of what a rename actually touches, so the decision
can be made with the real blast radius in view — no changes below are made
until the rename is decided.

**Trivial — single string, no design work:**
- `common.appName` in the four locale files (`src/i18n/locales/*.json`) — the
  one key the current note already called out.
- `package.json` → `"name": "rafiq-istanbul"` (npm package name, cosmetic).
- Header comments in `src/data/services.ts` and similar source files.

**Requires real design/content work, not just find-and-replace:**
- `public/logo.svg` — the wordmark "RAFIQ" is drawn directly into the SVG
  (`<text>` element), not just a filename. A rename means a new logo design,
  not a text swap.
- `public/logo-rafiq.webp`, `public/logo-rafiq-square.png` — actual logo
  image assets; filenames and the images themselves both need replacing.
  Referenced from `src/components/Logo.tsx` (`src` + `alt` text) and
  `index.html` (favicon link).
- `public/og-cover.png` — the social-share preview image likely has the
  current wordmark baked in visually; needs re-export, not just a rename.
- `public/manifest.webmanifest` — `name`/`short_name` control what shows on a
  user's home screen if the site is installed as a PWA. Existing installs
  won't auto-update this until the manifest is refetched.
- `index.html` — `<title>`, canonical URL, `og:title`, `og:url`, `og:image`,
  `twitter:title`, `twitter:image`. Several of these are also tied to the
  **deployed domain** (see below), not just visible text.
- `src/data/guides-ar.json` — the brand name appears **32 times** inline in
  long-form Arabic guide prose (not a single reusable key), so this is a real
  editorial pass through real sentences, not a mechanical replace. The
  equivalent en/ru/fa guide content should be checked too.
- `server/ai-policy.mjs` → `SYSTEM_PROMPT` literally instructs the AI: *"You
  are Rafiq, the multilingual assistant of Rafiq Istanbul..."* — without
  updating this, the chat assistant keeps introducing itself as "Rafiq" after
  a UI rebrand. Also note `chat.greeting`/`chat.typing`/`chat.disclaimer` in
  all four locale files use "Rafiq" as the assistant's own first-person name,
  separately from `common.appName`.

**Business/legal decisions, not app changes:**
- `.env` → `BANK_HOLDER` is currently `"Rafiq Istanbul Danışmanlık Ltd. Şti."`
  — this is the **registered legal company name** shown to customers making
  manual bank transfers. A brand rename does NOT change this unless the legal
  entity itself is renamed, which is a separate, much bigger corporate step.
  Shipping a "Mawadda" UI while bank transfers still show "Rafiq Istanbul
  Danışmanlık Ltd. Şti." is a legitimate scenario to plan for, not a bug.
- **Deployed domain**: the live site is `rafiq-istanbul.vercel.app`
  (`.vercel/project.json` → `projectName: "rafiq-istanbul"`). A UI rename
  without a new custom domain means the address bar still reads
  "rafiq-istanbul.vercel.app" under a "Mawadda" brand — a real, easy-to-miss
  mismatch that undermines the rebrand unless a new domain is purchased and
  configured (and the old one redirected).

**Intentionally out of scope for any rename:**
- `CHANGES.md`, `rafiq-audit.md` — historical records; rewriting the brand
  name into past changelog/audit entries would falsify history and should not
  happen even after a rename ships.

