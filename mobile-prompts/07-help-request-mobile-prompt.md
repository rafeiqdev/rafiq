# Mobile redesign prompt — Help Request page (7/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–6 (Auth, Home, Pricing, Checkout, Smart, Premium chat) are already built — follow their pattern closely, described below.

This is a short, friendly "help is on the way" landing screen reached from various "Help me with this" CTAs across the app. It shows a looping advisor video, then offers three paths.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileHelpRequest() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `file-text`, `message-circle`, `users`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useNavigate`, `useSearchParams`)
- i18n: react-i18next, nested dot-path keys
- Data/state: `useApp()` (`import { useApp } from '../../context/AppContext';`) — exposes `user`
- Reuse `<AdvisorScene>` verbatim (`import { AdvisorScene } from '../../components/AdvisorScene';`) — it's a self-contained looping muted video in a dark rounded card, already responsive (`max-h-[60vh] w-auto max-w-full`), no need to touch it, just make sure it fits nicely in the mobile layout width
- Reuse `<BookingModal>` verbatim (`import { BookingModal } from '../../components/BookingModal';`) for the "yes, I want help" flow — already portal-based and mobile-safe

## Design system (same tokens as screens 1–6)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — `gold`/`gold-dark` ≈ black, `gold-light` = white, `gold-soft` = light gray. Navy + white dominate; the `.btn-gold` class (used for this screen's highest-emphasis CTA, "yes I want help") now renders solid black — that's intentional, it's the one screen where the "reserve black for emphasis" rule applies directly, so keep using `.btn-gold` for that specific button, don't swap it for `.btn-primary`.
- Reuse: `.card`, `.btn` + `.btn-primary`/`.btn-secondary`/`.btn-gold`/`.btn-lg`, `.eyebrow`, `.section-title`

## Established mobile patterns (from MobileAuth/MobileHome/MobilePricing/MobileCheckout/MobileSmart/MobilePremium.tsx — follow these exactly)
- **Standard content-page header**: compact navy panel, `rounded-b-[28px]`, safe-area top padding, the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)`). This screen's content already carries an eyebrow/title/body (`help.eyebrow`/`help.title`/`help.body`) — you can either put the title in the header (matching the other content screens) or keep the centered hero-style eyebrow/title/body below the header like the desktop version; pick whichever reads better for this "big friendly moment" screen, but stay consistent with the navy-header + back-button mechanics established elsewhere.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobilePricing/MobileSmart (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Help Request
Reference implementation (desktop, `src/pages/HelpRequest.tsx` — DO NOT change any logic, only restyle):

- `topic = params.get('topic') ?? ''`, `summary = topic ? \`Help request — ${topic}\` : 'Help request'` (this English literal is intentional internal bookkeeping text sent with the booking, not shown to the user — keep it exactly as-is, don't translate it)
- `booking` state (boolean)
- `wantHelp()`: if no `user`, `navigate('/auth')`; otherwise `setBooking(true)`
- **Hero copy**: eyebrow (`help.eyebrow`), title (`help.title`), body (`help.body`), centered
- **Three CTAs**, stacked full-width on mobile (desktop shows them in a row — on a phone, stack vertically for easy tapping):
  1. Secondary button → `navigate('/services')`, `file-text` icon, label `help.selfGuide`
  2. Primary button → `navigate('/premium')`, `message-circle` icon, label `help.askAi`
  3. `.btn-gold` (now black) button → calls `wantHelp`, `users` icon, label `help.yes`, trailing `<DirArrow />`
  Below the three buttons, a small centered note (`help.note`)
- **Advisor scene**: `<AdvisorScene />` followed by a centered caption (`help.sceneCaption`)
- `{booking && <BookingModal problemSummary={summary} transcript={[]} onClose={() => setBooking(false)} />}`

## What I need from you
Design and code a NEW component `MobileHelpRequest` (`src/pages/mobile/MobileHelpRequest.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/handlers/logic — only JSX/styling changes plus the header + bottom tab bar
2. All three CTA buttons full-width, stacked, 48px+ tall, clearly ranked by visual weight (secondary → primary → gold/black, matching the desktop hierarchy)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely none needed — all strings already exist under `help.*`)

## Deliverable format
Give me the complete `MobileHelpRequest.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileHelpRequest = lazy(() => import('./pages/mobile/MobileHelpRequest').then((m) => ({ default: m.MobileHelpRequest })));`
2. Change the `/help` route from `<Route path="/help" element={<HelpRequest />} />` to `<Route path="/help" element={isMobile ? <MobileHelpRequest /> : <HelpRequest />} />`
```
