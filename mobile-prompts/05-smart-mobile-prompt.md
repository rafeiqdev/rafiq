# Mobile redesign prompt — Smart Consultation page (5/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–4 (Auth, Home, Pricing, Checkout) are already built — follow their pattern closely, described below.

Note on naming: this screen's route is `/smart` and the desktop component is called `Smart`, but it is NOT a chat interface — it's a small profile-completeness DASHBOARD (a progress ring, a missing-items list, and recommended next steps). The actual AI chat lives on the separate `/premium` route (a later screen in this series). Don't design a chat UI here.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileSmart() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `check`, `circle`, `check-circle`, `alert-triangle`, `message-circle`, plus each block's own `icon` field (already a valid `IconName`, no need to look it up)
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`)
- i18n: react-i18next, nested dot-path keys
- Data/state: everything through `useApp()` (`import { useApp } from '../../context/AppContext';`) — exposes `profile`
- `import { blocksFor } from '../../blocks/registry';` — pure data helper, do not modify

## Design system (same tokens as screens 1–4)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — `gold`/`gold-dark` ≈ black, `gold-light` = white, `gold-soft` = light gray. Navy + white dominate; black only for small emphasis.
- Reuse: `.card`, `.card-hover`, `.btn` + `.btn-primary`/`.btn-secondary`, `.icon-chip`, `.amber-note`, `rounded-btn` (12px), `rounded-card` (16px)

## Established mobile patterns (from MobileAuth/MobileHome/MobilePricing/MobileCheckout.tsx — follow these exactly)
- **Standard content-page header**: compact navy panel, `rounded-b-[28px]`, safe-area top padding (`pt-[calc(env(safe-area-inset-top)+...)]`), the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)`) plus title (`t('smart.title')`) and subtitle (`t('smart.subtitle')`).
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobilePricing (Home / AI chat / Map / Services / Profile) — none active on this screen, that's fine. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Smart Consultation
Reference implementation (desktop, `src/pages/Smart.tsx` — DO NOT change any logic, only restyle):

- `hasItems = [['turkishPhone', profile.has.turkishPhone], ['taxNumber', profile.has.taxNumber], ['residencePermit', profile.has.residencePermit], ['bankAccount', profile.has.bankAccount]] as const`
- `owned = hasItems.filter(([, v]) => v).length`, `pct = Math.round((owned / hasItems.length) * 100)`
- `missing = hasItems.filter(([, v]) => !v)`
- `nextBlocks = blocksFor(profile).slice(0, 4)`
- **Completeness card**: an SVG ring progress indicator (`viewBox="0 0 36 36"`, `-rotate-90`, a background track circle `stroke="#dceaf6"` and a foreground progress circle `stroke="#1d5f9e"` with `strokeDasharray={\`${pct} 100\`}` and `strokeLinecap="round"`), centered `{pct}%` label overlaid, plus a checklist beside/below it listing each `hasItems` entry with a `check`/`circle` icon (green text if owned, muted navy if not) and label `t('onboarding.q3.' + key + '.title')`. On a narrow phone, stack the ring above the checklist rather than side-by-side if that reads better — your call, keep it compact.
- **Missing items card**: title `smart.missing`. If `missing.length === 0`, show a green success line (`check-circle` icon + `smart.noMissing`). Otherwise list each missing item as an `.amber-note` row (`alert-triangle` icon + `t('onboarding.q3.' + key + '.title')`). Below the list (or below the success message), a full-width primary button → `Link to="/premium"` with a `message-circle` icon, label `smart.askAi`.
- **Next steps card**: title `smart.nextSteps`. Render `nextBlocks` as a list of tappable rows, each `Link to={b.ctaTo}`: a numbered chip (`i + 1`, reuse `.icon-chip` sizing) OR the block's own `<AppIcon name={b.icon}>` — pick whichever reads better on mobile, and a `DirArrow` at the trailing edge. Label is `t('blocks.' + b.id + '.title')`. On mobile this reads better as a single stacked list (not desktop's 2-column grid).

## What I need from you
Design and code a NEW component `MobileSmart` (`src/pages/mobile/MobileSmart.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/logic (all pure derived values — no local state needed) — only JSX/styling changes plus the header + bottom tab bar
2. All tappable rows/buttons sized for touch (48px+)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely none needed beyond existing i18n keys — only add copy if you introduce new UI text)

## Deliverable format
Give me the complete `MobileSmart.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileSmart = lazy(() => import('./pages/mobile/MobileSmart').then((m) => ({ default: m.MobileSmart })));`
2. Change the `/smart` route from `<Route path="/smart" element={<Smart />} />` to `<Route path="/smart" element={isMobile ? <MobileSmart /> : <Smart />} />`
```
