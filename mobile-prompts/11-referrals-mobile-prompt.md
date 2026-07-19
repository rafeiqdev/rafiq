# Mobile redesign prompt — Referrals page (11/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–10 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map) are already built — follow their pattern closely, described below.

This is a simple "invite & earn" referral screen: a copyable personal link, three stat tiles, a short how-it-works list, and a terms block.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileReferrals() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — this screen doesn't strictly need any beyond what you use for the header back button (`arrow-left`); feel free to add a small `copy`-style icon to the copy button if it reads well, otherwise plain text is fine (desktop uses no icon there)
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- i18n: react-i18next, nested dot-path keys
- Data: `import { referrals } from '../../lib/api'; import type { ReferralStats } from '../../lib/api';`
- Reuse `<RequireAuth>` (`import { RequireAuth } from '../../components/Gates';`) wrapping the whole screen, unchanged, exactly like the desktop version

## Design system (same tokens as screens 1–10)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — not used on this screen beyond shared component classes.
- Reuse: `.card`, `.btn-primary`, `.input`, `.icon-chip`, `rounded-btn` (12px)

## Established mobile patterns (from MobileSmart/MobileHelpRequest/MobileGuidePage.tsx — follow these exactly)
- **Standard content-page header**: compact navy panel, `rounded-b-[28px]`, safe-area top padding, the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)`), title (`referrals.title`) and subtitle (`referrals.subtitle`).
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobileServices/MobileMapPage (Home / AI chat / Map / Services / Profile) — none active on this screen (Referrals isn't one of the 5). Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Referrals
Reference implementation (desktop, `src/pages/Referrals.tsx` — DO NOT change any logic, only restyle):

- `stats` state (`ReferralStats`, default `{ clicks: 0, signups: 0, earnedTl: 0, code: '' }`), loaded via `referrals.stats()` on mount when `user` exists (silently ignore errors, exactly as-is)
- `copied` state, `link = \`${window.location.origin}/r/${stats.code || user?.referralCode || ''}\`\`
- **Link card**: label (`referrals.yourLink`), a monospace/`dir="ltr"` value box showing `link` (with horizontal scroll if it overflows, same as desktop) + a copy button (shows `common.copied` for 1.5s after tap, else `common.copy`) — stack these full-width on mobile if the link is long rather than forcing them onto one cramped row; your call on exact layout, but the button must stay a full 48px+ tap target
- **Stat tiles**: three tiles — `['invited', stats.clicks]`, `['signedUp', stats.signups]`, `['earned', \`${stats.earnedTl.toLocaleString()} ${t('common.tl')}\`]\` — desktop uses a 3-column grid; on a narrow phone either keep 3 narrow columns (numbers are short) or stack 3-across in a tighter grid, your call, but keep them visually tidy and equal width. Each tile: the value (bold, `dir="ltr"`) then the label (`referrals.{key}`)
- **How it works**: title (`referrals.how.title`), a numbered list of `step1`/`step2`/`step3` (`referrals.how.{step}`), each with a small circular number badge like the numbered lists on other screens (reuse the `.icon-chip` number-badge pattern from MobileSmart's "next steps")
- **Terms**: title (`referrals.terms.title`), body text (`referrals.terms.body`, note it contains `\n` line breaks — keep `whitespace-pre-line`)

## What I need from you
Design and code a NEW component `MobileReferrals` (`src/pages/mobile/MobileReferrals.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/logic — only JSX/styling changes plus the header + bottom tab bar
2. The copy button and any other interactive element sized for touch (48px+)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — nearly all strings already exist under `referrals.*`)

## Deliverable format
Give me the complete `MobileReferrals.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileReferrals = lazy(() => import('./pages/mobile/MobileReferrals').then((m) => ({ default: m.MobileReferrals })));`
2. Change the `/referrals` route from `<Route path="/referrals" element={<Referrals />} />` to `<Route path="/referrals" element={isMobile ? <MobileReferrals /> : <Referrals />} />`
```
