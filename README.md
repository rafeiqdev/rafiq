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

The product ships as **Rafiq Istanbul** everywhere (locales, logo, titles). If
the "Mawadda / مودة" rebrand is decided, change `common.appName` in the four
locale files, `public/logo.svg`, the `<title>`/OG tags in `index.html`, and the
`Logo` alt text together.
