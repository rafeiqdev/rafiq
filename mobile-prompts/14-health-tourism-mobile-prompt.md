# Mobile redesign prompt — Health Tourism page (14/19) — ENHANCED TRIAL

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–13 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map, Referrals, Residency, Real Estate) are already built as faithful ports of their desktop equivalent.

THIS SCREEN IS DIFFERENT — it's a trial run of a richer treatment: on top of the faithful port, ADD a real photo hero, a "why choose Istanbul" trust strip, a "how it works" process timeline, and more visually engaging service cards and buttons. Every ORIGINAL piece of functionality/data below must still work exactly as described — you're adding new presentational sections around it, not replacing or removing anything real.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileHealthTourism() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names for the ORIGINAL 3 services: `scissors`, `smile`, `stethoscope`. For the NEW trust-strip chips, use `shield-check` (accredited hospitals), `heart-pulse` (modern medical care), and `trending-up` (lower cost than Europe) — all already registered, don't invent new icon names.
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useNavigate`)
- i18n: react-i18next, nested dot-path keys
- Data: `import { ApiError, leads } from '../../lib/api'; import { useApp } from '../../context/AppContext';`
- Reuse `<MedicalTourismTypes />` verbatim, UNCHANGED (`import { MedicalTourismTypes } from '../../components/MedicalTourismTypes';`) — a separate, already-built interactive directory (search + grouped cards with emoji glyphs by design). Don't touch its internals, just place it below your new sections.
- Reuse `<PageHero>` for the new photo hero (`import { PageHero } from '../../components/PageHero';`) — same treatment as the Residency/Real Estate screens: wrap it in a `rounded-b-[28px]` shell with a circular back button overlaid (`start-4 top-[calc(env(safe-area-inset-top)+0.75rem)]`, `arrow-left` icon flipped in RTL, `navigate(-1)`), hero content padded with `pt-[calc(env(safe-area-inset-top)+3.75rem)]`. **NO fake status bar/clock — the phone renders its own, never hardcode one.**
- For the photo, use a REAL already-bundled Istanbul photo that exists in this codebase for this exact page: `import { EXPLORE_PHOTOS } from '../../lib/images';` then `image={EXPLORE_PHOTOS['/health-tourism']}` (a real hospital-themed Istanbul photo already used elsewhere in the app for this same page's "explore" card — do not invent a different image path).

## Design system (same tokens as screens 1–13)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — not used on this screen.
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.icon-chip`, `.section-title`, `.amber-note`

## Established mobile patterns (from MobileResidency/MobileRealEstate.tsx — follow these exactly)
- **Photo-hero header** (see above) — same variant as Residency/Real Estate, not the plain navy panel this page used to have on desktop.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobileReferrals/MobileRealEstate (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- No Rafiq logo, no fake status bar, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## PART 1 — the original screen, preserve exactly (data/logic must not change)
Reference implementation (desktop, `src/pages/HealthTourism.tsx`):

- `SERVICES = [{id:'hair',icon:'scissors'}, {id:'dental',icon:'smile'}, {id:'checkup',icon:'stethoscope'}]` — copy verbatim
- `requested` state (map of service id → bool), reconciled on mount from `leads.mine()` filtered to `kind==='health'` (matching `l.item.startsWith(s.id)`) — copy this reconciliation logic verbatim
- `request(id)`: if no `user`, `navigate('/auth')`; else `leads.create('health', \`${id} — ${t('health.services.' + id + '.title')}\`)` then marks requested; a 401 `ApiError` also redirects to `/auth`
- **3 service cards**, one per `SERVICES` entry: title (`health.services.{id}.title`), body (`health.services.{id}.body`), and a request button (disabled + `check` icon + `health.requested` once requested, else `health.cta`). Make these feel more premium/interactive than a bare icon-chip card: give each a distinct subtle accent tint (e.g. a soft tinted icon-chip background per service, larger icon, a bit more visual weight), and give the button itself a nice pressed/active state — you have creative freedom here as long as the underlying data/handler stays identical.
- **Medical tourism directory**: `<MedicalTourismTypes />` below everything else, unmodified.

## PART 2 — new additions for this trial (presentational only, no fabricated external facts)
- **Photo hero**: `<PageHero image={EXPLORE_PHOTOS['/health-tourism']} title={t('health.title')} subtitle={t('health.subtitle')} />` in the established back-button shell.
- **"Why Istanbul" trust strip** — 3 short chips/cards directly below the hero, using ONLY claims already consistent with this app's existing copy (the app already says "World-class treatment at Istanbul prices" in `health.subtitle` and "significantly below EU prices" in the dental service body — stay qualitative, don't invent specific percentages or certification-body names):
  - `shield-check` — internationally accredited hospitals
  - `heart-pulse` — modern facilities, English-speaking medical staff
  - `trending-up` — significantly lower cost than Western Europe
  Add these as new local `mobileCopy` strings (not existing i18n keys), at least `en`/`ar`.
- **"How it works" process timeline** — a new 4-step numbered list (same circular-badge pattern used elsewhere in the app, e.g. MobileSmart/MobileReferrals), describing Rafiq's own real quote process (this mirrors the real `health.requested` copy — "Quote request sent! We'll reply within 24 hours." — so it's describing the actual product flow, not inventing external facts):
  1. Tell us what treatment you're looking for
  2. Get matched with a vetted clinic + a quote within 24 hours
  3. We coordinate your trip and treatment door-to-door
  4. Ongoing aftercare support once you're back home
  Add these as new local `mobileCopy` strings, at least `en`/`ar`.
- Place these two new sections between the photo hero and the 3 service cards (trust strip first, then either before or after the service cards — your call on the most natural flow, just keep the original service cards and directory intact and functional).

## What I need from you
Design and code a NEW component `MobileHealthTourism` (`src/pages/mobile/MobileHealthTourism.tsx`, named export) that:
1. Implements the original logic in Part 1 exactly as-is, plus the new Part 2 sections as pure additions
2. All cards and buttons sized and styled for touch (48px+), with a genuinely more polished/interactive feel than a plain port — nice icon treatments, tactile button states, real photography
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar`, covering both existing UI chrome text (back button, tab labels) AND the new trust-strip/how-it-works copy

## Deliverable format
Give me the complete `MobileHealthTourism.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileHealthTourism = lazy(() => import('./pages/mobile/MobileHealthTourism').then((m) => ({ default: m.MobileHealthTourism })));`
2. Change the `/health-tourism` route from `<Route path="/health-tourism" element={<HealthTourism />} />` to `<Route path="/health-tourism" element={isMobile ? <MobileHealthTourism /> : <HealthTourism />} />`
```
