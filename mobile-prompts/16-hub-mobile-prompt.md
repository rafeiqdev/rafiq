# Mobile redesign prompt — Guides Hub list page (16/19) — enhanced treatment

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–15 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map, Referrals, Residency, Real Estate, Health Tourism, Tricks) are already built.

Give this one the enhanced treatment like the last four screens: a real photo hero and nicer, more tactile card styling. This is a simple 6-item list page on desktop, so keep it focused — just make it feel premium and native, no need to invent new sections.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileHub() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string, e.g. never write `pb-5.5 pb-6` together — pick one valid value)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `bus`, `smartphone`, `id-card`, `receipt`, `landmark`, `map`, `arrow-left`, `home`, `message-circle`, `layers`, `user`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`, `useLocation`)
- i18n: react-i18next, nested dot-path keys
- Real photo: `import { EXPLORE_PHOTOS } from '../../lib/images';` then `EXPLORE_PHOTOS['/hub']` — an already-bundled, real Istanbul photo (books/guides themed). Pass it to `<PageHero>` (`import { PageHero } from '../../components/PageHero';`).
- **No fake status bar/clock — never hardcode one, the phone renders its own. This is a hard rule broken once before on an earlier screen; do not repeat it.**

## Design system (same tokens as screens 1–15)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — do not use gold anywhere on this screen
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.icon-chip`, `.section-title`

## Established mobile patterns (from MobileResidency/MobileRealEstate/MobileHealthTourism/MobileTricks.tsx — follow these exactly)
- **Photo-hero header**: wrap in `rounded-b-[28px]` shell with `overflow-hidden`, a circular back button absolutely positioned ON TOP of the photo (`absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10`, `bg-white/20 backdrop-blur`, `arrow-left` icon flipped in RTL via `rotate-180`, `onClick={() => navigate(-1)}`), `<PageHero>` with `height="min-h-[14rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"` so the title clears the back button.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileTricks.tsx (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, ALL FOUR languages: `en`/`ar`/`fa`/`ru` — every screen must include all four, no exceptions
- No Rafiq logo, no fake status bar, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`/`stagger`

## The screen to redesign: Guides Hub (list)
Reference implementation (desktop, `src/pages/Hub.tsx`, the `Hub` export — preserve all logic/data, only restyle + polish):

```
export const GUIDE_SLUGS = ['istanbulkart', 'esim', 'ikamet', 'vergi', 'bank', 'districts'] as const;
const ICONS: Record<string, IconName> = {
  istanbulkart: 'bus', esim: 'smartphone', ikamet: 'id-card',
  vergi: 'receipt', bank: 'landmark', districts: 'map',
};
```

- Page heading `hub.title` / subtitle `hub.subtitle` — these go in the photo-hero title/subtitle props.
- Six guide cards, one per `GUIDE_SLUGS` entry: icon-chip (`ICONS[slug]`), title (`hub.guides.{slug}.title`), excerpt (`hub.guides.{slug}.excerpt`), and a `Link to={`/hub/${slug}`}` button (`hub.readMore` + `DirArrow`). On mobile stack these single-column, full width, with comfortable padding and a tactile icon-chip treatment (feel free to give each a subtle tint, consistent navy/cream/white — no new colors). Whole card should feel good to tap; the "read more" link can be a full-width bottom button like on Tricks/Services, or the whole card can be tappable with the button as a visual affordance — your call, keep it native-feeling.

## What I need from you
Design and code a NEW component `MobileHub` (`src/pages/mobile/MobileHub.tsx`, named export) that:
1. Implements everything above, preserving the `GUIDE_SLUGS` data/logic exactly — only JSX/styling changes plus the photo-hero header + bottom tab bar
2. All cards and buttons sized for touch (48px+)
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, ALL FOUR languages (`en`/`ar`/`fa`/`ru`) — don't skip `ru`, a previous screen shipped without it and had to be fixed

## Deliverable format
Give me the complete `MobileHub.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileHub = lazy(() => import('./pages/mobile/MobileHub').then((m) => ({ default: m.MobileHub })));`
2. Change the `/hub` route from `<Route path="/hub" element={<Hub />} />` to `<Route path="/hub" element={isMobile ? <MobileHub /> : <Hub />} />`
```
