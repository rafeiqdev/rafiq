# Mobile redesign prompt — Home page (2/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul — residency permits, real estate, health tourism, and an AI assistant. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screen 1 (Auth) is already built and sets the visual pattern — follow it closely.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED exports (e.g. `export function MobileHome() { ... }`)
- Tailwind CSS v3 (utility classes + the existing `@layer components` classes — don't invent new component classes, don't use arbitrary color hexes)
- Icons: NOT raw lucide-react — wrap everything through `<AppIcon name="..." className="..." />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`). Only use icon names already registered in `src/components/AppIcon.tsx`.
- NO Rafiq logo anywhere on this screen — the brand mark is being redone separately, do not import or reference `Logo`.
- Animation: NO animation library — use the existing CSS keyframe classes in `src/index.css`: `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useNavigate`, `Link`)
- i18n: react-i18next, nested dot-path keys, e.g. `t('home.heroTitle')`
- Data/state: everything through `useApp()` (`import { useApp } from '../../context/AppContext';`) — exposes `profile`, `resetOnboarding`, among others. Never call Supabase directly.

## Design system (reuse these class names — same tokens as screen 1)
- `navy` #1a3a6b (DEFAULT) / `navy-dark` #12294d / `navy-light` #2c4f8a — primary brand color
- `cream` #faf8f0 (DEFAULT) / `cream-dark` #efeadb — background/borders
- `brand-red` #c0392b (errors only), `brand-blue` #e8f0fb (light info tint)
- `gold` token family = black/white/neutral now, NOT golden (`gold`/`gold-dark` render near-black to black, `gold-light` renders white, `gold-soft` renders light gray). Navy + white must visually dominate; use `gold`/`gold-dark` only for small emphasis accents.
- Radius: `rounded-btn` = 12px, `rounded-card` = 16px
- Reuse: `.card`, `.card-hover`, `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-gold` / `.btn-ghost`, `.input`, `.icon-chip` (black circle), `.icon-chip-gold` (light-gray circle), `.eyebrow`, `.section-title`, `.amber-note`

## Existing mobile pattern to match (already built — `src/pages/mobile/MobileAuth.tsx`, the reference for every mobile screen)
- Full-bleed navy header, rounded bottom corners (`rounded-b-[28px]`), safe-area top padding (`pt-[calc(env(safe-area-inset-top)+...)]`), a large faint decorative Arabic letter "ر" bleeding off the bottom-end corner at very low opacity (`text-white/5`) as a quiet brand texture — reuse this same watermark trick here, don't add anything else logo-like
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';` root wrapper `dir={isRTL ? 'rtl' : 'ltr'}`, spacing via logical classes (`ps-`, `pe-`, `start-`, `end-`)
- New mobile-only copy goes in a local `mobileCopy` record keyed by `en`/`ar`/`fa`/`ru`
- Generous touch targets (48px+), entrance via `animate-fade-up` / `animate-pop`
- Bottom-safe padding via `pb-[calc(env(safe-area-inset-bottom)+...)]` on the scrollable content, since a fixed bottom tab bar (see below) sits over the page

## NEW for this screen: bottom tab bar
Home is the hub, so this is the first screen that needs the app's primary navigation. Add a fixed bottom tab bar:
- `fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark`, safe-area bottom padding (`env(safe-area-inset-bottom, 0px)`)
- 5 tabs, icon (`AppIcon`) + tiny label: Home (`/`, active on this screen), AI chat (`/premium`, icon `message-circle`), Map (`/map`, icon `map`), Services (`/services`, icon `layers`), Profile (`/profile` if `useApp().user` else `/auth`, icon `user`)
- Active tab: navy icon + navy text. Inactive: `text-navy/40`
- This bar will be reused as-is (copy the exact same component/markup) on every future mobile screen, so make it a clean, self-contained block I can lift out later — it does not need to be a separate exported component right now, just keep its markup easy to copy.

## The screen to redesign: Home
Reference implementation (desktop, `src/pages/Home.tsx` — DO NOT change any logic, only restyle as a mobile screen):

- **Hero**: `<ImageCarousel images={CAROUSEL} intervalMs={3000} />` full-bleed background (`import { CAROUSEL } from '../../lib/images'; import { ImageCarousel } from '../../components/ImageCarousel';`), a `bg-navy/80` overlay on top, headline `t('home.heroTitle')`, subtitle `t('home.heroSubtitle')`, a trust-bar row of 4 pill chips (`TRUST` array: icons `languages`, `users`, `sparkles`, `shield-check`, labels `t('home.trustbar.languages'|'experts'|'free'|'secure')`) — on mobile make this a horizontally scrollable chip row instead of wrapping
- **Search**: controlled `query` state, `input` with live `suggestions` (derived via `useMemo` from `SERVICES` in `../../data/services` filtered by `normalizeSearch`/`keywordsFor` — reuse this exact logic, don't reimplement matching), pressing Enter or the search icon calls `goServices()` which navigates to `/services` or `/services?q=...`; tapping a suggestion navigates to `/services?q=<title>` (`pickText(s.title, i18n.language)`)
- **Personalized "For You" blocks**: `const blocks = useMemo(() => blocksFor(profile), [profile]);` from `../../blocks/registry`, filtered by `query` the same way as desktop, showing the first 3 by default with a "view all" reveal (`showAllBlocks` state) unless there's an active search query (never truncate matched results). Render each with the EXISTING `<BlockCard block={b} />` component (`import { BlockCard } from '../../blocks/BlockCard';`) — do not restyle BlockCard internals, just decide how to lay the cards out on a phone (a horizontally-scrollable snap carousel, one full-width card at a time, reads better on mobile than a stacked list — your call). Include the `resetOnboarding` "edit answers" action (`t('home.editAnswers')`) somewhere reachable near this section.
- **Services CTA**: a `Link to="/services"` gradient navy card — `t('home.servicesCta.title')` / `.body` / `.button`
- **How it works**: 3 numbered steps (`t('home.how.eyebrow')`, `.title`, `.subtitle`, then `s1`/`s2`/`s3` each with `.title`/`.desc`) — condense to a compact vertical stepper
- **About**: `t('home.about.eyebrow')`, `.title`, `.body`, 3 checklist points (`p1`/`p2`/`p3`), a `Link to="/premium"` CTA (`.cta`) — condense, image optional on mobile (skip the Bosphorus photo if space is tight, your call)
- **Testimonials**: reuse the EXISTING `<Testimonials />` component as-is (`import { Testimonials } from '../../components/sections/Testimonials';`) — it's already a `bg-navy` full-bleed section, don't rebuild it
- **FAQ**: 6 items (`FAQ_IDS`), each `t('home.faq.q1..q6.q')` / `.a` — collapsible accordion (reuse the native `<details>`/`<summary>` pattern from desktop, just restyle), plus a closing CTA card (`ctaTitle`/`ctaBody`/`ctaButton` → `Link to="/premium"`)

## What I need from you
Design and code a NEW component `MobileHome` (will live at `src/pages/mobile/MobileHome.tsx`, named export, no required props) that:
1. Implements every section above, preserving 100% of the existing state/logic/handlers (`query`, `focused`, `showAllBlocks`, `suggestions`, `blocks`, `visibleBlocks`, `hasMoreBlocks`, `goServices`, `resetOnboarding`) — only JSX/styling changes, plus the new bottom tab bar
2. Feels like scrolling through a real native app home feed — full-bleed hero, generous spacing between sections, one clear focal element per screen-height
3. RTL support exactly as MobileAuth does
4. No Rafiq logo anywhere
5. Any new mobile-only copy (tab labels, "view all" if wording differs, etc.) goes in a local `mobileCopy` object with at least `en` and `ar`
6. Bottom padding on the outermost scroll container clears the fixed bottom tab bar

## Deliverable format
Give me the complete `MobileHome.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileHome = lazy(() => import('./pages/mobile/MobileHome').then((m) => ({ default: m.MobileHome })));`
2. Change the `/` route from `<Route path="/" element={<Home />} />` to `<Route path="/" element={isMobile ? <MobileHome /> : <Home />} />` — note `Home` is currently a top-level (non-lazy) import in `App.tsx`, keep it that way, just add the ternary
```
