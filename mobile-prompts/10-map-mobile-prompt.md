# Mobile redesign prompt — Map page (10/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–9 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail) are already built — follow their pattern closely, described below.

This is a real interactive map (react-leaflet + OpenStreetMap tiles) of trusted places in Istanbul, filterable by category, gated behind Pro/Elite, plus a directory list below it. This route (`/map`) IS one of the 5 bottom-tab destinations.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileMapPage() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `lock`, `search`, `map-pin`, `navigation`, plus `CATEGORY_ICON[...]` values (`utensils`, `hotel`, `stamp`, `stethoscope`, `landmark`, `shopping-bag` — already valid `IconName`s)
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`)
- i18n: react-i18next, nested dot-path keys
- `import { ApiError, places as placesApi } from '../../lib/api'; import type { Place } from '../../lib/types';`
- Reuse `<RequireAuth>` (`import { RequireAuth } from '../../components/Gates';`) wrapping the whole screen, unchanged, exactly like the desktop version
- The map itself uses react-leaflet — copy the `icon` (`L.icon(...)`, bundled marker assets), `Category`/`CATEGORY_ICON`/`TOPIC_TO_CATEGORY`/`categoryForQuery` helpers, and the `IstanbulMap` sub-component (`MapContainer`/`TileLayer`/`Marker`/`Popup`) VERBATIM from the desktop file — don't rebuild the map, just make sure the container it sits in is sized well for a phone (see layout below). Same imports: `import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'; import L from 'leaflet'; import 'leaflet/dist/leaflet.css'; import markerIcon from 'leaflet/dist/images/marker-icon.png'; import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'; import markerShadow from 'leaflet/dist/images/marker-shadow.png';`

## Design system (same tokens as screens 1–9)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — not really used on this screen beyond the shared component classes.
- Reuse: `.card`, `.card-hover`, `.btn-primary`/`.btn-secondary`, `.input`, `.icon-chip`

## Established mobile patterns (from MobileHome/MobilePricing/MobileSmart/MobileHelpRequest/MobileServices.tsx — follow these exactly)
- **Tab-root header** (this is a bottom-tab destination, NOT a sub-screen — no back button, same treatment as MobileHome/MobileServices): compact navy panel, `rounded-b-[28px]`, safe-area top padding, the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, title (`map.title`) and subtitle (`map.subtitle`). Desktop uses the `<IstanbulSkyline>` SVG banner as the hero background — you may skip it on mobile in favor of the plain navy panel (matching the rest of this series), that's the preferred/simpler choice, but if you think a small skyline silhouette adds a nice touch behind the header text feel free to keep it small; don't make it required.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobileServices (Home / AI chat / Map / Services / Profile) — the "Map" tab IS active here. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Map
Reference implementation (desktop, `src/pages/MapPage.tsx` — DO NOT change any logic, only restyle):

- State: `allPlaces` (`Place[] | null`, loaded via `placesApi.list()` on mount — a 402/401 `ApiError` sets `locked = true` instead, since POI data is server-gated to Pro/Elite), `category` (`Category | 'all'`, default `'all'`), `aiQuery`
- `visible` (memoized): `allPlaces` filtered by `category`
- `askAi()`: if `aiQuery.trim()`, sets `category = categoryForQuery(aiQuery)` (a small keyword/regex classifier — copy verbatim, don't touch)
- `cats = ['all', 'dining', 'hotels', 'notary', 'hospitals', 'government', 'shopping']`

### Locked state (`locked === true`)
A real BLURRED map behind an upsell card — reproduce this exact effect, it's an intentional "actually blurred real map" preview, not a placeholder image: `<IstanbulMap places={[]} interactive={false} />` wrapped in `blur-md pointer-events-none select-none`, with a centered card on top (`lock` icon-chip, `map.locked.title`, `map.locked.body`, a full-width primary button `Link to="/pricing"` with `map.locked.cta` + `DirArrow`). Still wrap this in the tab-root header + bottom tab bar shell.

### Unlocked state
- **AI search row**: a text input (`map.ai` placeholder, `Enter` triggers `askAi`) + a search button (`search` icon, label `map.aiGo` — on desktop the label is hidden below `sm:`, on mobile you can show it or keep it icon-only, your call, just keep it tappable at 48px+)
- **Category chips**: horizontally SCROLLABLE row (hide the scrollbar), one pill per `cats` entry (`map.categories.{c}`), active = filled navy + white text, inactive = white + border
- **The map itself**: `<IstanbulMap places={visible} interactive />` inside a rounded card container — on a phone this should be a prominent, generously-sized viewport (roughly 45–55% of viewport height reads well — your call, `50vh` is a reasonable default), full-bleed width within the content padding
- **Directory list** below the map: a header row (`map.directory.title` + a muted count `map.directory.count`), an empty state (`map.directory.empty`) if `visible.length === 0`, otherwise a SINGLE-COLUMN stack (desktop uses a 2–3 column grid) of place cards: icon-chip (`CATEGORY_ICON[p.category] ?? 'map-pin'`), name, optional address line (`map-pin` icon + `p.address`), a small category pill (`map.categories.{p.category}`), and a "directions" button — an external link to `https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=17/{lat}/{lng}` (`target="_blank" rel="noreferrer"`, `navigation` icon, `aria-label={t('map.directory.directions')}`) sized as a proper 44px+ tap target on the trailing edge of the card, not a tiny icon button.

## What I need from you
Design and code a NEW component `MobileMapPage` (`src/pages/mobile/MobileMapPage.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/logic/the map integration itself — only JSX/styling changes plus the header + bottom tab bar
2. Category chips, search button, and directions buttons all sized for touch (48px+, or 44px+ minimum for the compact directions button)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — nearly all strings already exist under `map.*`)

## Deliverable format
Give me the complete `MobileMapPage.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileMapPage = lazy(() => import('./pages/mobile/MobileMapPage').then((m) => ({ default: m.MobileMapPage })));`
2. Change the `/map` route from `<Route path="/map" element={<MapPage />} />` to `<Route path="/map" element={isMobile ? <MobileMapPage /> : <MapPage />} />`
```
