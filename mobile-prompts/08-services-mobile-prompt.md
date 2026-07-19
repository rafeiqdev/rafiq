# Mobile redesign prompt — Services catalog page (8/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–7 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request) are already built — follow their pattern closely, described below.

This screen is the full services catalog (79 services across 12 categories) with search, a type filter, category chips, and grouped results — one of the more data-dense screens in the series.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileServices() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names used on this screen: `shield-check`, `check`, `clock`, `message-circle`, `search`, plus each category's own `icon` field and each service's own `icon` field (already valid `IconName`s, no need to look them up)
- NO Rafiq logo anywhere. There IS a decorative hero background image at `/img/services-hero.webp` on desktop — you may keep a smaller version of it behind the mobile header if it reads well, or drop it in favor of the standard navy header pattern below; your call, but don't add a logo either way.
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useSearchParams`)
- i18n: react-i18next, nested dot-path keys
- Data: `import { pickText, normalizeSearch, keywordsFor } from '../../data/services'; import type { ServiceItem, ServiceType } from '../../data/services'; import { useCatalog } from '../../data/catalogStore';` — `useCatalog()` returns `{ services, categories }`, pure data hooks, do not modify
- Reuse `<ServiceActionModal service={...} onClose={...} />` verbatim (`import { ServiceActionModal } from '../../components/ServiceActionModal';`) for the tap-a-service action sheet — it's already a portal-based `<Modal>` with 3 touch-sized choice cards (self-guide / AI / get a person), don't rebuild it, no restyling needed

## Design system (same tokens as screens 1–7)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — active/selected chips using `bg-gold` now render solid black, which is correct and intentional (keep using the `gold` token classes exactly as the desktop version does, don't swap them for navy — the black already reads as the "selected" accent post-rebrand). Navy + white otherwise dominate.
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.input`, `.icon-chip`, `rounded-btn` (12px), `rounded-card` (16px)

## Established mobile patterns (from MobileAuth/MobileHome/MobilePricing/MobileCheckout/MobileSmart/MobilePremium/MobileHelpRequest.tsx — follow these exactly)
- **Standard content-page header**: compact navy panel, `rounded-b-[28px]`, safe-area top padding, the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, title (`services.title`) and subtitle (`services.subtitle`). This is a top-level tab destination (reached from the bottom nav "Services" tab), so it does NOT need a back button the way sub-screens do — match the Home screen's header treatment (no back arrow) rather than the back-button content-header pattern, since this is itself a tab root. Optionally include the small trust-note pill (`shield-check` icon + `services.trustNote`) in the header like the desktop version.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobilePricing/MobileSmart/MobileHelpRequest (Home / AI chat / Map / Services / Profile) — the "Services" tab IS active here (`/services` route matches). Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Services catalog
Reference implementation (desktop, `src/pages/Services.tsx` — DO NOT change any logic, only restyle):

- `POPULAR_CATEGORY_IDS = ['residency', 'realestate', 'health', 'banking', 'translation', 'tourism']` — the default landing view (no search, `category==='all'`, `!showAllCategories`) shows only these 6 category chips plus a dashed "+ all categories" chip; picking a category or typing a search always shows the full set regardless
- State: `query` (seeded from `?q=`), `category` (default `'all'`), `typeFilter` (`'all' | 'direct' | 'partner'`), `active` (selected `ServiceItem | null`, opens the action modal), `showAllCategories`
- `matches` (memoized): filters `services` by `category`, `typeFilter`, and a forgiving search — `normalizeSearch(query)` split into ≥2-char tokens, matched as full-phrase OR any token against a normalized haystack of `title.ar/en/tr + desc.ar/en/tr + keywordsFor(id)`
- `trimToPopular = category==='all' && !query.trim() && !showAllCategories`; `chipCategories` = the 6 popular categories when trimmed, else all; `visibleCategories` = those chip categories filtered down to ones that actually have matches
- **Search bar**: a single input with a leading `search` icon, placeholder `services.searchPlaceholder`, bound to `query`
- **Type filter**: 3 pill buttons (`all`/`direct`/`partner`, labels `services.type.{tp}`), horizontally laid out (they fit on one row even on a phone — 3 short pills), active = filled navy + white text, inactive = white + border
- **Category chips**: horizontally SCROLLABLE row (`overflow-x-auto`, hide the scrollbar, snap is a nice touch but optional), each chip = category icon + `pickText(c.title, lang)`, active = filled `bg-gold` (black) + white text, inactive = white + border. Includes the "All" chip first (`services.allCategories`) and, depending on `trimToPopular`, either a dashed "+" chip to reveal all categories (`services.allCategories +`) or (when not trimmed and back at the untouched "all, no search" state) a dashed chip to collapse back (`common.showLess`) — reproduce this toggle logic exactly.
- **Results**: if `visibleCategories.length === 0`, an empty-state card (`search` icon-chip + `services.noResults`). Otherwise, for each visible category: a section header (icon-chip + `pickText(c.title, lang)` + a muted count), then that category's matching services as a SINGLE-COLUMN stack of cards (desktop uses a 2–3 column grid; on mobile stack full-width, one per row). Each card (tap opens the action modal via `onOpen={() => setActive(s)}`): icon-chip, title (`pickText(service.title, lang)`), description (`pickText(service.desc, lang)`), a type badge (`partner` → `shield-check` icon + `services.partnerBadge` in the black/gold-soft tint; `direct` → `check` icon + `services.directBadge` in brand-blue), an optional "priced on request" badge (`clock` icon + `services.onRequest`) if `service.onRequest`, and a full-width `message-circle` + `common.helpMe` visual affordance at the bottom (it's decorative/`pointer-events-none` on desktop since the whole card is the tap target — keep that same behavior).
- `{active && <ServiceActionModal service={active} onClose={() => setActive(null)} />}`

## What I need from you
Design and code a NEW component `MobileServices` (`src/pages/mobile/MobileServices.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/logic/memoized filtering — only JSX/styling changes plus the header + bottom tab bar, and collapsing the card grid to a single column
2. Search input, filter pills, category chips, and cards all sized and spaced for touch (48px+ row heights on chips/pills, cards easily tappable)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — nearly all strings already exist under `services.*`/`common.*`)

## Deliverable format
Give me the complete `MobileServices.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileServices = lazy(() => import('./pages/mobile/MobileServices').then((m) => ({ default: m.MobileServices })));`
2. Change the `/services` route from `<Route path="/services" element={<Services />} />` to `<Route path="/services" element={isMobile ? <MobileServices /> : <Services />} />`
```
