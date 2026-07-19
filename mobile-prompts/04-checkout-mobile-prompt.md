# Mobile redesign prompt — Checkout page (4/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–3 (Auth, Home, Pricing) are already built — follow their pattern closely, described below.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileCheckout() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names used on this screen: `check-circle`, `hourglass`, `x-circle`, `credit-card`, `paperclip`, `shield-check`, `arrow-left`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useNavigate`, `useSearchParams`)
- i18n: react-i18next, nested dot-path keys
- Data/state: everything through `useApp()` (`import { useApp } from '../../context/AppContext';`) — exposes `refresh`
- Reuse the existing `<Modal>` component (`import { Modal } from '../../components/Modal';`) for the "confirm payment" dialog — it's already a portal-based, mobile-safe dialog (focus trap, Escape, backdrop click, scroll lock). Don't rebuild it, just restyle its CONTENTS for touch.
- Reuse the existing `<RequireAuth>` gate (`import { RequireAuth } from '../../components/Gates';`) — wrap the whole screen in it exactly like the desktop version does, unchanged. It already shows its own sign-in wall for logged-out users, so you don't need to design a separate "please log in" state.

## Design system (same tokens as screens 1–3)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — `gold`/`gold-dark` ≈ black, `gold-light` = white, `gold-soft` = light gray. Navy + white dominate; black only for small emphasis.
- Reuse: `.card`, `.card-hover`, `.btn` + `.btn-primary`/`.btn-secondary`/`.btn-danger`, `.input`, `.icon-chip`, `.eyebrow`, `.section-title`, `rounded-btn` (12px), `rounded-card` (16px)

## Established mobile patterns (from MobileAuth.tsx, MobileHome.tsx, MobilePricing.tsx — follow these exactly)
- **Standard content-page header**: a compact navy panel, `rounded-b-[28px]`, safe-area top padding (`pt-[calc(env(safe-area-inset-top)+...)]`), the same faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)`) plus the page title (`t('checkout.title')`). This screen is reached with a plan already chosen (from Pricing), so no subtitle is required — keep it short.
- **No bottom tab bar on this screen** — Checkout is a focused, linear payment flow (like Auth), not a tab destination. Do NOT include the 5-tab nav bar here.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Checkout
Reference implementation (desktop, `src/pages/Checkout.tsx` — DO NOT change any logic, only restyle). This screen is wrapped by `RequireAuth`; the inner component reads `plan`/`billing` from the URL query string.

- `plan = params.get('plan') ?? 'pro'`, `billing = params.get('billing') ?? 'monthly'`
- `monthly = PLAN_PRICES[plan] ?? PLAN_PRICES.pro` (`import { PLAN_PRICES } from '../../lib/types';`), `total = billing === 'annual' ? monthly * 10 : monthly`, `fmt = (n) => n.toLocaleString()`
- State: `tab` (`'card' | 'bank' | 'crypto'`, default `'card'`), `receipt` (`File | null`), `verifyOpen`, `state` (`'idle' | 'redirecting' | 'pendingManual' | 'checking' | 'success' | 'failed'`), `bank` (`{ iban, holder, wallet, network } | null`, loaded on mount via `checkout.config()`)
- On mount: also checks `?result=success|failed&payment=ID` in the URL (return from a payment gateway) and polls `checkout.paymentStatus(paymentId)` up to 10 times / 1.5s apart, moving `state` through `checking` → `success`/`failed`/`pendingManual`. Preserve this effect exactly as-is, no UI needed for the polling itself (just react to `state`).
- `payByCard()` → sets `state='redirecting'`, calls `checkout.manual(plan, billing, 'card')`, then `refresh()`, then `state='pendingManual'` (or `'failed'` on error)
- `confirmManualPaid()` → calls `checkout.manual(plan, billing, tab, receipt ?? undefined)`, then `refresh()`, closes the verify modal, sets `state='pendingManual'` (or `'failed'` on error)
- **Order summary card**: plan name (`pricing.{plan}.name`), billing (`common.{billing}`), and total — if annual, show `checkout.perYear` with `{ price: fmt(total) }` plus a smaller `checkout.approxMonthly` line with `{ price: fmt(Math.round(total/12)) }`; if monthly, show `{fmt(total)} {t('common.tl')}`. Keep this visible above the state-dependent content below, like the desktop version — it's useful context throughout the flow.
- **Result states** (each replaces the summary+tabs area with a centered icon-chip card):
  - `success`: `check-circle` icon, `checkout.success` text, primary button → `navigate('/')`, label `nav.home`
  - `checking`: `hourglass` icon (pulsing), `checkout.result.checking` text, no button
  - `pendingManual`: `hourglass` icon, `checkout.pending` text, primary button → `navigate('/')`, label `nav.home`
  - `failed`: `x-circle` icon, `checkout.result.failed` text, primary button resets `state='idle'`, label `chat.retry`
- **Payment method tabs** (shown when `state` is `idle` or `redirecting`): 3-way segmented tabs `card`/`bank`/`crypto` (`checkout.tabs.{m}`), reuse the pill/segmented visual pattern from MobileAuth/MobilePricing, `role="tablist"`
  - `card` tab: note text (`checkout.card.note`), primary button `checkout.card.pay` with `credit-card` icon, calls `payByCard`, disabled while `state==='redirecting'`
  - `bank` tab: title (`checkout.bank.title`), two copy-to-clipboard fields for IBAN (`checkout.bank.iban`) and account holder (`checkout.bank.holder`) — each is a label + a monospace/`dir="ltr"` value box + a "copy" button that shows `common.copied` for 1.5s after tap (reuse this small `CopyField`-style pattern, touch-sized), a file upload button (`checkout.bank.upload`, or `checkout.bank.uploaded: {filename}` once a file is chosen, `paperclip` icon, accepts `image/png,image/jpeg,image/webp,application/pdf`), then a primary button `checkout.paid` that opens the verify modal
  - `crypto` tab: title (`checkout.crypto.title`), one copy field for the wallet address (label = `checkout.crypto.network` + " — " + the live network name, value = wallet address), then the same `checkout.paid` primary button opening the verify modal
- **Verify modal** (`verifyOpen`, via `<Modal onClose={...} labelId="verify-title" maxWidth="max-w-sm">`): centered `shield-check` icon-chip, title (`checkout.verify.title`), body (`checkout.verify.body`), a primary "confirm" button (`checkout.verify.confirm`, calls `confirmManualPaid`) and a secondary "cancel" button (`common.cancel`, just closes the modal) — both full-width, stacked, 48px+ tall

## What I need from you
Design and code a NEW component `MobileCheckout` (`src/pages/mobile/MobileCheckout.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/handlers/logic — only JSX/styling changes plus the header (no bottom tab bar on this screen)
2. All buttons, the file-upload control, and the modal's confirm/cancel sized for touch (48px+)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar`

## Deliverable format
Give me the complete `MobileCheckout.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileCheckout = lazy(() => import('./pages/mobile/MobileCheckout').then((m) => ({ default: m.MobileCheckout })));`
2. Change the `/checkout` route from `<Route path="/checkout" element={<Checkout />} />` to `<Route path="/checkout" element={isMobile ? <MobileCheckout /> : <Checkout />} />`
```
