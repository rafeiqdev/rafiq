# Rafiq Istanbul

A multilingual digital-services hub for foreigners (expats, students, investors, tourists)
moving to, arriving in, or living in Istanbul.

## Stack

- **Web:** React 18 + TypeScript + Vite, React Router 6, Tailwind CSS
  (brand: navy `#1a3a6b`, cream `#faf8f0`, red `#c0392b`)
- **i18n:** i18next — 4 fully translated languages with enforced key parity:
  Arabic (RTL), English, Russian, Farsi (RTL)
- **API server:** Express 5 + SQLite (built-in `node:sqlite`, zero native deps),
  bcrypt password hashing, httpOnly cookie sessions, multer uploads
- **Map:** React-Leaflet with bundled assets (no runtime CDN)

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

npm run build            # type-check + production bundle
npm test                 # API integration tests (node:test, in-memory DB)
npm run check:i18n       # fails if ar/en/ru/fa key sets diverge
```

## Architecture

The client (`src/lib/api.ts`) is a thin typed fetch layer — **all trust
decisions live server-side** (`server/index.mjs`):

- **Identity:** real registration/login with bcrypt hashes; sign-in is distinct
  from sign-up (404 / 401 / 409); sessions are server-stored and invalidated on
  logout. Google OAuth activates when `GOOGLE_CLIENT_ID` is set.
- **Authorization:** the admin role is assigned server-side from `ADMIN_EMAILS`
  (env); `/api/admin/*` returns 403 for non-admins. Paid features (AI chat, map
  POIs) are enforced by the server — editing client state unlocks nothing.
- **Payments:** card checkout creates a gateway session and the subscription is
  activated **only by a signed webhook** (`/api/webhooks/payment`, HMAC-SHA256
  with `PAYMENT_WEBHOOK_SECRET`). Without real gateway keys, a dev simulator
  page stands in for the hosted checkout and delivers the same signed webhook.
  Bank transfer / crypto stay as manual-verification rails (details from env,
  receipts uploaded and viewable by admin).
- **Uploads:** receipts and locker documents go through multer (type/size
  validated, random filenames) and are served only via owner/admin-checked
  endpoints.
- **AI assistant:** `/api/ai/chat` streams via SSE. With `ANTHROPIC_API_KEY` it
  calls the real model using the booking-policy `SYSTEM_PROMPT`
  (`server/ai-policy.mjs`); without a key it falls back to a deterministic dev
  engine. Escalation to a free human appointment fires on explicit requests,
  complexity markers, or a user circling the same topic — with a server-side
  safety net on top of the model's decision. Free/Light users get
  `FREE_CHAT_MESSAGES` as a preview, enforced server-side.
- **Referrals:** `/r/:code` (or `?r=CODE`) records the click; sign-ups carry the
  attribution and verified payments credit 30% to the referrer.
- **Notifications:** per-user read state (`notification_reads`); admin alerts go
  to an `admins` audience queue, not to per-admin copies.

## Key files

```
server/index.mjs       all API routes, auth, authz, webhooks, uploads
server/ai-policy.mjs   SYSTEM_PROMPT + escalation triggers + dev fallback
server/db.mjs          SQLite schema (node:sqlite)
server/test.mjs        integration tests — run with `npm test`
src/lib/api.ts         typed fetch client (the seam)
src/blocks/registry.ts profile-driven homepage blocks (showIf + priority)
src/components/Modal.tsx  a11y dialog shell (focus trap, Esc, backdrop)
scripts/check-i18n-parity.mjs  locale key-set guard (also in CI)
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

