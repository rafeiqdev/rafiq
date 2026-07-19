# Mobile redesign prompt — Real Estate page (13/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–12 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map, Referrals, Residency) are already built — follow their pattern closely, described below.

This is a curated real-estate listings screen: a photo-hero header (same "editorial content" family as Residency), a legal-verification note, a listing card grid, and a full-detail modal with an image gallery.

## IMPORTANT — a note from the previous screen in this series
The Residency screen's first draft included a fake iOS-style status bar row (a hardcoded "9:41" clock) baked into the header JSX. That was wrong and had to be removed — this is a real in-app component, not a static mockup screenshot; the phone's own OS renders the real status bar. Do NOT add any fake time/battery/signal indicators anywhere in this component. Only use `env(safe-area-inset-top)` padding to clear the real status bar area.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileRealEstate() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names used on this screen: `building`, `check`, `shield-check`, `arrow-right`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`useNavigate`)
- i18n: react-i18next, nested dot-path keys
- Data: `import { ApiError, leads, listings as listingsApi } from '../../lib/api'; import type { Listing } from '../../lib/types'; import { useApp } from '../../context/AppContext';`
- Reuse `<PageHero>` verbatim (`import { PageHero } from '../../components/PageHero';`, `import { BANNERS } from '../../lib/images';`, use `BANNERS.realEstate`) — same photo-hero treatment as the Residency screen: wrap it in the same `rounded-b-[28px]` shell with a circular back button overlaid (`start-4 top-[calc(env(safe-area-inset-top)+0.75rem)]`, `arrow-left` icon flipped in RTL, `navigate(-1)`), and give the hero enough top padding (`pt-[calc(env(safe-area-inset-top)+3.75rem)]` worked well last time) so the title clears the button.
- Reuse `<Modal>` (`import { Modal } from '../../components/Modal';`) for the listing detail sheet — already portal-based and mobile-safe, restyle only the CONTENTS for touch, don't rebuild the shell
- `import { LISTING_PHOTOS } from '../../lib/images';` for the photo-fallback chain

## Design system (same tokens as screens 1–12)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — not used on this screen.
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.icon-chip`, `rounded-card` (16px)

## Established mobile patterns (from MobileReferrals/MobileResidency.tsx — follow these exactly)
- **Photo-hero header** (see above) — same variant as Residency, not the plain navy panel.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileHome/MobileReferrals/MobileResidency (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Real Estate
Reference implementation (desktop, `src/pages/RealEstate.tsx` — DO NOT change any logic, only restyle):

- `ListingImage`: layered photo fallback — the listing's own `image` → a curated `LISTING_PHOTOS[index % LISTING_PHOTOS.length]` → (if both fail/missing) a navy gradient placeholder with a large `building` icon. Uses an `onError` handler to advance through the fallback chain. Copy this component's logic verbatim, just restyle sizing (desktop uses `h-40`, keep a similarly proportioned image on mobile cards).
- `imagesOf(listing, index)`: returns `listing.images` if present, else `[listing.image]` filtered, else a single `LISTING_PHOTOS` fallback — used by the gallery in the detail view.
- State: `listings` (loaded via `listingsApi.list()` on mount), `loading`, `requested` (map of listing id → bool, reconciled on mount from `leads.mine()` filtered to `kind==='realestate'` by matching district+rooms text — copy this reconciliation logic verbatim), `detail` (selected `Listing | null` for the modal)
- `request(listing)`: if no `user`, `navigate('/auth')`; else `leads.create('realestate', ...)` then marks that listing as requested; a 401 `ApiError` also redirects to `/auth`
- **Legal-verification note**: a `brand-blue`-tinted rounded banner (NOT amber — this one is informational, not a warning), `shield-check` icon + `realEstate.note`
- **Loading state**: while `loading`, show 3 pulsing skeleton cards (`animate-pulse bg-cream-dark/40`, roughly the height of a real card) — desktop uses a grid, stack them full-width on mobile
- **Listing cards** — desktop uses a responsive grid; on mobile stack SINGLE COLUMN, full width. The whole card is tappable (`onClick={() => setDetail(l)}`, plus `role="button"`/`tabIndex`/`onKeyDown` for Enter/Space — keep these accessibility props) to open the detail modal, EXCEPT the request button which calls `e.stopPropagation()` before its own handler. Each card: `<ListingImage>`, district name + citizenship badge (`realEstate.citizenshipBadge`, only if `l.citizenship`), a spec line (`rooms · m² · optional bathrooms`, `dir="ltr"` since it's numbers/units), price (`$X,XXX`, bold, `dir="ltr"`), a small "view details" affordance (`realEstate.viewDetails` + a trailing arrow), and a full-width request button at the bottom (`btn-primary`, disabled + `check` icon + `realEstate.requested` once requested, else `realEstate.cta`)
- **Detail modal** (`detail !== null`, via `<Modal onClose={...} labelId="listing-detail" maxWidth="max-w-2xl">`): a large hero photo (with the citizenship badge overlaid top-end if applicable) followed by a horizontally-scrollable thumbnail strip when there are multiple images (tap a thumbnail to switch the active photo, active one gets a navy border ring), then district name + price header, spec chips (rooms with `building` icon, `m²` value, optional bathrooms count, optional "furnished" tag), description text (`whitespace-pre-line` — it may contain line breaks), and the same request button pattern as the card (disabled + `check` icon once requested). Size everything for a comfortable mobile bottom-sheet-like reading experience inside the existing `Modal` shell — the thumbnail strip and request button especially need 44px+/48px+ touch targets.

## What I need from you
Design and code a NEW component `MobileRealEstate` (`src/pages/mobile/MobileRealEstate.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/handlers/logic (including the `leads.mine()` reconciliation and the fallback image chain) — only JSX/styling changes plus the photo-hero header + bottom tab bar
2. Cards, thumbnails, and buttons all sized for touch (48px+ primary actions, 44px+ thumbnails)
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — nearly all strings already exist under `realEstate.*`)

## Deliverable format
Give me the complete `MobileRealEstate.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileRealEstate = lazy(() => import('./pages/mobile/MobileRealEstate').then((m) => ({ default: m.MobileRealEstate })));`
2. Change the `/real-estate` route from `<Route path="/real-estate" element={<RealEstate />} />` to `<Route path="/real-estate" element={isMobile ? <MobileRealEstate /> : <RealEstate />} />`
```
