# Mobile redesign prompt — Istanbul Tricks page (15/19) — enhanced treatment

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–14 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map, Referrals, Residency, Real Estate, Health Tourism) are already built.

Like the Health Tourism screen, give this one the enhanced treatment: a real photo hero, nicer icon/badge styling, and tactile interactive buttons. This page already has good bones on desktop (photo hero + tip cards + a full searchable apps directory + a closing CTA), so you don't need to invent whole new sections the way Health Tourism did — just make the existing pieces feel more premium and native on mobile.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileTricks() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `smartphone`, `receipt`, `alert-triangle`, `download`, `message-circle`. Note: the reused `<IstanbulApps>` component internally uses emoji glyphs (`cat.icon`) for its category headers by design — that's intentional existing content, not something to convert to `AppIcon`.
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`)
- i18n: react-i18next, nested dot-path keys
- Reuse `<PageHero>` verbatim (`import { PageHero } from '../../components/PageHero';`, `import { BANNERS } from '../../lib/images';`, use `BANNERS.tricks` — a real already-bundled Istanbul photo) — same photo-hero treatment established on Residency/Real Estate/Health Tourism: wrap in the `rounded-b-[28px]` shell with a circular back button overlaid (`start-4 top-[calc(env(safe-area-inset-top)+0.75rem)]`, `arrow-left` icon flipped in RTL, `navigate(-1)`), hero content padded `pt-[calc(env(safe-area-inset-top)+3.75rem)]`. **NO fake status bar/clock — never hardcode one, the phone renders its own.**
- Reuse `<IstanbulApps />` verbatim, UNCHANGED (`import { IstanbulApps } from '../../components/IstanbulApps';`) — a separate, already-built searchable/categorized directory of Istanbul apps (web/Android/iOS links, install-as-PWA button when supported). Don't touch its internals, just place it in the flow below your tip cards.

## Design system (same tokens as screens 1–14)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — `.btn-gold` (used inside `IstanbulApps` for its install button) now renders solid black, which is fine and intentional, don't change it.
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.icon-chip`, `.section-title`

## Established mobile patterns (from MobileResidency/MobileRealEstate/MobileHealthTourism.tsx — follow these exactly)
- **Photo-hero header** (see above) — same variant as the last three screens.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobileReferrals/MobileHealthTourism (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, ALL FOUR languages: `en`/`ar`/`fa`/`ru` (a previous screen in this series shipped without the `ru` entry and had to be fixed — don't skip it this time)
- No Rafiq logo, no fake status bar, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Istanbul Tricks
Reference implementation (desktop, `src/pages/Tricks.tsx` — preserve all logic/data, only restyle + polish):

- `TRICKS = [{id:'esim',icon:'smartphone',kind:'tip'}, {id:'vergi',icon:'receipt',kind:'tip'}, {id:'taxiCaution',icon:'alert-triangle',kind:'tip'}]` (all currently `kind: 'tip'` — the `Trick` interface also supports `kind: 'app'` with an optional `url` + `featured` flag for a full-width highlighted card, though no current entries use it; support that branch in your JSX anyway in case content is added later, exactly as the desktop version does)
- **Trick cards** — desktop uses a responsive grid; on mobile stack single-column, full width. Each: icon-chip, title (`tricks.items.{id}.title`) + a small kind badge (`tricks.appBadge`/`tricks.tipBadge` — apps get a navy badge, tips get an amber badge, keep this color distinction, it's meaningful), body (`tricks.items.{id}.body`). If `kind==='app'` and `trick.url` is set, a full-width external-link button (`download` icon, `tricks.openApp`, `target="_blank" rel="noreferrer"`). Give these a bit more visual polish than a bare port — nicer icon-chip treatment, comfortable padding, maybe a subtle accent per kind — your call, keep it tasteful and on-brand (navy/cream/white, no new colors).
- **Istanbul apps directory**: `<IstanbulApps />` rendered as-is below the trick cards.
- **Closing CTA card**: icon-chip (`message-circle`), title (`tricks.ctaTitle`), body (`tricks.ctaBody`), a button `Link to="/premium"` (`tricks.ctaButton` + `DirArrow`) — make this feel like a natural, inviting closing moment (full-width on mobile, comfortable spacing).

## What I need from you
Design and code a NEW component `MobileTricks` (`src/pages/mobile/MobileTricks.tsx`, named export) that:
1. Implements everything above, preserving 100% of the `TRICKS` data/logic — only JSX/styling changes plus the photo-hero header + bottom tab bar, with a genuinely polished, native-feeling presentation
2. All cards and buttons sized for touch (48px+)
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, ALL FOUR languages (`en`/`ar`/`fa`/`ru`)

## Deliverable format
Give me the complete `MobileTricks.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileTricks = lazy(() => import('./pages/mobile/MobileTricks').then((m) => ({ default: m.MobileTricks })));`
2. Change the `/tricks` route from `<Route path="/tricks" element={<Tricks />} />` to `<Route path="/tricks" element={isMobile ? <MobileTricks /> : <Tricks />} />`
```
