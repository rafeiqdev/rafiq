# Mobile redesign prompt — Pricing page (3/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1 (Auth) and 2 (Home) are already built — follow their pattern closely, described below.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobilePricing() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — NOTE the desktop `Pricing.tsx` incorrectly imports `Check`/`Gift` directly from `lucide-react`; do NOT copy that, use `<AppIcon name="check" />` and `<AppIcon name="gift" />` instead (both already registered)
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useNavigate`)
- i18n: react-i18next, nested dot-path keys
- Data/state: everything through `useApp()` (`import { useApp } from '../../context/AppContext';`) — exposes `user`, `tier`, `subscription`, `refresh`
- Reuse the existing `<Modal>` component (`import { Modal } from '../../components/Modal';`) for the cancel-subscription flow — it's already a portal-based, mobile-safe dialog (focus trap, Escape, backdrop click, scroll lock). Don't rebuild it, just restyle its CONTENTS for touch.

## Design system (same tokens as screens 1–2)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — `gold`/`gold-dark` ≈ black, `gold-light` = white, `gold-soft` = light gray. Navy + white dominate; black only for small emphasis.
- Reuse: `.card`, `.card-hover`, `.btn` + `.btn-primary`/`.btn-secondary`/`.btn-danger`, `.input`, `.icon-chip`, `.eyebrow`, `.section-title`, `.amber-note`, `rounded-btn` (12px), `rounded-card` (16px)

## Established mobile patterns (from MobileAuth.tsx and MobileHome.tsx — follow these exactly)
- **Standard content-page header** (NEW — this screen establishes it; most remaining mobile screens will reuse this, as opposed to Home's big hero or Auth's centered hero): a shorter navy panel, `rounded-b-[28px]`, safe-area top padding (`pt-[calc(env(safe-area-inset-top)+...)]`), the same faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)` — NOT a hardcoded route, since Pricing is reached from multiple places) plus the page title (`t('pricing.title')`) and subtitle (`t('pricing.subtitle')`). Keep it compact — roughly header-only height, no full hero image.
- **Bottom tab bar**: copy the exact same fixed 5-tab `<nav>` block verbatim from `MobileHome.tsx` (Home / AI chat / Map / Services / Profile) — none of the tabs are "active" on this screen since Pricing isn't one of the 5, that's fine, just render them all inactive. Remember the bottom-safe padding wrapper on the scrollable content (`pb-[calc(env(safe-area-inset-bottom)+88px)]`).
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Pricing
Reference implementation (desktop, `src/pages/Pricing.tsx` — DO NOT change any logic, only restyle):

- `TIERS = ['light', 'pro', 'elite']` (this order), `ORDER` ranks `free < light < pro < elite`, `CANCEL_REASONS = ['tooExpensive', 'notUsing', 'missingFeatures', 'movedAway', 'other']`
- State: `billing` (`'monthly' | 'annual'`), `cancelling`, `reason`, `comment`, `cancelDone`
- `choose(plan)` → `navigate('/checkout?plan=' + plan + '&billing=' + billing)`
- `confirmCancel()` → `subscriptions.cancel(reason, comment)` then `refresh()`, closes the cancel modal, sets `cancelDone`
- `daysRemaining` computed from `subscription.expiresAt`
- **Active subscription card** (only if `subscription && tier !== 'free'`): current plan name, renewal date (`pricing.active.renews` with `{ date }`), a days-remaining pill (`pricing.active.daysRemaining` with `{ count }`), and either a "cancel" button or (if already cancelled/`cancelDone`) an `.amber-note` saying so
- **Billing toggle**: monthly/annual segmented control — reuse the exact segmented-control visual pattern from MobileAuth's sign-in/register toggle (pill container, `role="tablist"`, active segment white bg + navy text). When `annual` is selected, show the savings note (`pricing.annualNote`) with the gift icon.
- **Plan cards**, one per `TIERS` entry: monthly price from `PLAN_PRICES[plan]` (`import { PLAN_PRICES } from '../../lib/types';`), annual price computed as `Math.round((monthly * 10) / 12)`, `isCurrent = ORDER[tier] === ORDER[plan]`, `isUpgrade = ORDER[plan] > ORDER[tier]`, `recommended = plan === 'pro'` (visually emphasize this one — border/ring + a "recommended" badge, `common.recommended`), feature list from `t('pricing.' + plan + '.features', { returnObjects: true })` (a string array, map with a check icon per line), price shown with `t('common.tl')` / `t('common.perMonth')`, annual mode also shows `t('checkout.perYear', { price })`. CTA button: disabled + `pricing.current` label if `isCurrent`, else `pricing.upgrade`/`pricing.downgrade` (both take `{ plan: t('pricing.' + plan + '.name') }`) depending on `isUpgrade`.
- **Cancel modal** (`cancelling` state, via `<Modal onClose={...} labelId="cancel-title">`): title (`pricing.cancelFlow.title`), a radio list of `CANCEL_REASONS` (`pricing.cancelFlow.{reason}`), a comment textarea (`pricing.cancelFlow.comments`), and two actions — "keep" (closes modal, `pricing.cancelFlow.keep`) and "confirm" (`confirmCancel`, `pricing.cancelFlow.confirm`, danger style)

## What I need from you
Design and code a NEW component `MobilePricing` (`src/pages/mobile/MobilePricing.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/handlers/logic — only JSX/styling changes plus the header + bottom tab bar
2. Plan cards: stack vertically, full width, one clearly readable at a time (recommended plan visually stands out) — this reads better than a 3-column grid on a phone; a horizontal snap carousel is acceptable too if you think it's clearly better, your call
3. Radio buttons and all tap targets in the cancel modal sized for touch (48px+ rows)
4. RTL exactly as established, no logo
5. New mobile-only copy → local `mobileCopy`, at least `en`/`ar`

## Deliverable format
Give me the complete `MobilePricing.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobilePricing = lazy(() => import('./pages/mobile/MobilePricing').then((m) => ({ default: m.MobilePricing })));`
2. Change the `/pricing` route from `<Route path="/pricing" element={<Pricing />} />` to `<Route path="/pricing" element={isMobile ? <MobilePricing /> : <Pricing />} />`
```
