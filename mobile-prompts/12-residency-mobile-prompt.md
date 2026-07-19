# Mobile redesign prompt — Residency page (12/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–11 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map, Referrals) are already built — follow their pattern closely, described below.

This screen explains the 4 residence-permit (İkamet) types with illustrated cards, plus an application-flow checklist. Note: this page and the next two in this series (Real Estate, Istanbul Tricks) share a REAL PHOTO hero banner (`<PageHero>`) instead of the plain solid-navy panel used on the tab/utility screens — that's an intentional visual distinction for this "editorial content" family of pages, keep it.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileResidency() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `alert-triangle`, `id-card`, `users`, `graduation-cap`, `landmark`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`)
- i18n: react-i18next, nested dot-path keys
- Reuse `<PageHero>` verbatim (`import { PageHero } from '../../components/PageHero';`) — it already renders a real photo (`SiteImage`) with a `bg-navy/75` overlay and white title/subtitle text, exactly the "photo hero" look this page needs; `import { BANNERS } from '../../lib/images';` and use `BANNERS.residency`
- Reuse `<IkametCard>` verbatim (`import { IkametCard } from '../../components/IkametCard';`) — a pure-SVG stylized residence-permit-card illustration, no photo dependency, already forces `dir="ltr"` internally so it never mirrors in RTL. Don't rebuild it, just size it well inside each mobile card.

## Design system (same tokens as screens 1–11)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — not used on this specific screen.
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.icon-chip`, `.amber-note`, `rounded-card` (16px)

## Established mobile patterns (from MobileSmart/MobileHelpRequest/MobileGuidePage/MobileReferrals.tsx — follow these exactly, adapted for the photo-hero variant)
- **Photo-hero header** (new variant for this page — the "editorial content" pages use this instead of the plain navy panel): wrap `<PageHero image={BANNERS.residency} title={t('residency.title')} subtitle={t('residency.subtitle')} />` in the same `rounded-b-[28px]` + safe-area-aware shell as the other headers, and add the same circular back button (`AppIcon name="arrow-left"`, flipped in RTL, `navigate(-1)`) positioned over the photo — `PageHero` accepts a `children` prop, so you can likely pass the back button in as a child positioned absolutely, or wrap the whole `PageHero` in a relative container and overlay the button on top. Keep the photo + navy/75 overlay exactly as `PageHero` already renders it, just adapt the sizing/corners for a compact mobile header (shorter height than desktop, e.g. via the `height` prop) and make sure it reads well behind status-bar safe-area padding.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobileServices/MobileReferrals (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Residency
Reference implementation (desktop, `src/pages/Residency.tsx` — DO NOT change any logic, only restyle):

- `TYPES = [{id:'shortTerm',icon:'id-card',accent:'#1d5f9e',label:'SHORT-TERM'}, {id:'family',icon:'users',accent:'#2f7fc4',label:'FAMILY'}, {id:'student',icon:'graduation-cap',accent:'#3d63a5',label:'STUDENT'}, {id:'longTerm',icon:'landmark',accent:'#163f6b',label:'LONG-TERM'}]` — copy this constant verbatim (it's pure static data, not translated — the `label` strings are baked into the `IkametCard` SVG illustration itself, not user-facing i18n copy)
- **Warning banner**: `.amber-note` row, `alert-triangle` icon + `residency.warning`
- **4 permit-type cards** — desktop uses a 2-column grid; on mobile stack full-width, one per row (or a clean 1-column list reads best on a phone). Each card: the `<IkametCard label={x.label} accent={x.accent} />` illustration inside a `dir="ltr"` tinted panel (`background: ${x.accent}14`, i.e. the accent color at low opacity — keep this exact hex+alpha pattern), then below it an icon-chip + title (`residency.types.{id}.title`), body text (`residency.types.{id}.body`), and a full-width primary button `Link to={\`/help?topic=residency-${id}\`}` (label `common.helpMe` + `DirArrow`)
- **Application flow card**: title (`residency.steps.title`), a numbered list of `s1`–`s4` (`residency.steps.{s}`) using the same circular-number-badge pattern as MobileSmart/MobileReferrals's "next steps"/"how it works" lists — desktop uses a 2-column grid, stack single-column on mobile

## What I need from you
Design and code a NEW component `MobileResidency` (`src/pages/mobile/MobileResidency.tsx`, named export) that:
1. Implements everything above, preserving 100% of the `TYPES` data and logic — only JSX/styling changes plus the photo-hero header + bottom tab bar
2. All 4 permit cards and the "help me" buttons sized and spaced for touch (48px+ buttons)
3. RTL exactly as established, no logo — but remember `IkametCard`'s illustration itself must stay `dir="ltr"` (it already handles this internally)
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — nearly all strings already exist under `residency.*`/`common.*`)

## Deliverable format
Give me the complete `MobileResidency.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileResidency = lazy(() => import('./pages/mobile/MobileResidency').then((m) => ({ default: m.MobileResidency })));`
2. Change the `/residency` route from `<Route path="/residency" element={<Residency />} />` to `<Route path="/residency" element={isMobile ? <MobileResidency /> : <Residency />} />`
```
