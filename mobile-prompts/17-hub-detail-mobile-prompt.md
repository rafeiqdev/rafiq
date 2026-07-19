# Mobile redesign prompt — Guide detail page (17/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–16 are already built, most recently the Guides Hub list page, which this screen is the detail view for (tapping a guide card on the Hub list opens this).

This is a small, text-focused detail screen — a single guide's explanation plus a "help me" CTA that opens a lead-capture modal. Follow the same shell pattern as the earlier "Guide detail" screen (MobileGuidePage.tsx, screen 9) — a plain navy header panel (no photo, this one doesn't need it, the list page above it already has the photo), back button, icon avatar, content card, sticky bottom CTA. Keep it clean and readable; this page doesn't need new sections, just a polished native presentation.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileHubDetail() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string)
- Icons: ONLY through `<AppIcon name="..." className="..." />` — valid names used on this screen: `bus`, `smartphone`, `id-card`, `receipt`, `landmark`, `map`, `arrow-left`, `message-circle`, `file-text`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`, `useParams`)
- i18n: react-i18next, nested dot-path keys
- Reuse `<ServiceRequestModal>` verbatim (`import { ServiceRequestModal } from '../../components/ServiceRequestModal';`) — do not touch its internals, just open it in a `{requesting && <ServiceRequestModal .../>}` block like the reference below
- **No fake status bar/clock — never hardcode one, the phone renders its own.**

## Design system (same tokens as screens 1–16)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b
- `gold` family is now black/white/neutral — do not use gold anywhere on this screen
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.icon-chip`

## Established mobile patterns (from MobileGuidePage.tsx — follow this shell exactly)
- **Plain navy header panel** (NOT a photo hero — this screen doesn't use one): `rounded-b-[28px]`, `bg-gradient-to-br from-navy to-navy-light`, safe-area-aware top padding (`pt-[calc(env(safe-area-inset-top)+0.75rem)]`), a faint decorative Arabic "ر" watermark bleeding off one corner (`text-white/5`, huge size, `absolute -bottom-12 -end-3.5`), a circular back button (`bg-white/10`, `arrow-left` icon flipped in RTL, `navigate(-1)`), then below it an icon avatar (circle, `border border-white/25 bg-white/15`) + the guide title.
- **Sticky bottom CTA** (this screen has NO bottom tab bar — it's a sub-screen, matches Guide Detail/Checkout/Premium): a `fixed bottom-0` bar, `bg-white/95 backdrop-blur`, `border-t border-cream-dark`, padded for safe-area-inset-bottom, containing one full-width `btn-primary` button (`message-circle` icon + `common.helpMe`) that opens the modal. Wrap scrollable content in enough bottom padding to clear it (`pb-[calc(env(safe-area-inset-bottom)+84px)]` or similar).
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, ALL FOUR languages: `en`/`ar`/`fa`/`ru` — every screen must include all four, no exceptions (only needed here for `back`, since the rest reuses existing i18n keys)
- No Rafiq logo, no fake status bar, 48px+ touch targets

## The screen to redesign: Guide detail
Reference implementation (desktop, `src/pages/Hub.tsx`, the `HubDetail` export — preserve all logic exactly, only restyle + polish):

```tsx
export const GUIDE_SLUGS = ['istanbulkart', 'esim', 'ikamet', 'vergi', 'bank', 'districts'] as const;
const ICONS: Record<string, IconName> = {
  istanbulkart: 'bus', esim: 'smartphone', ikamet: 'id-card',
  vergi: 'receipt', bank: 'landmark', districts: 'map',
};

export function HubDetail() {
  const { slug } = useParams<{ slug: string }>();
  const valid = slug && (GUIDE_SLUGS as readonly string[]).includes(slug);
  const [helping, setHelping] = useState(false);
  // if !valid: centered error state — t('common.error') + a button back to /hub (t('nav.hub'))
  // if valid: icon-chip (ICONS[slug]) + title (hub.guides.{slug}.title) + body (hub.guides.{slug}.body)
  //   + a button that opens the modal (common.helpMe)
  // modal source: { id: `hub:${slug}`, title: t(`hub.guides.${slug}.title`), category: 'hub', type: 'guide' }
}
```

Build both states:
1. **Invalid slug** — same plain navy header shell (with just the back button, no title yet), then a centered card below: an icon-chip with `file-text`, `common.error` text, and a full-width button `Link to="/hub"` (label `nav.hub`).
2. **Valid guide** — header with icon avatar (`ICONS[slug]`) + title (`hub.guides.{slug}.title`), then a content card below with the body text (`hub.guides.{slug}.body`, comfortable line-height for a full paragraph), then the sticky bottom CTA that sets `helping = true`, and `{helping && <ServiceRequestModal source={{ id: `hub:${slug}`, title: t(`hub.guides.${slug}.title`), category: 'hub', type: 'guide' }} onClose={() => setHelping(false)} />}`.

## What I need from you
Design and code a NEW component `MobileHubDetail` (`src/pages/mobile/MobileHubDetail.tsx`, named export) that:
1. Implements everything above, preserving 100% of the logic (slug validation, modal source object) — only JSX/styling changes plus the header shell + sticky CTA
2. All buttons sized for touch (48px+)
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, ALL FOUR languages (`en`/`ar`/`fa`/`ru`)

## Deliverable format
Give me the complete `MobileHubDetail.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileHubDetail = lazy(() => import('./pages/mobile/MobileHubDetail').then((m) => ({ default: m.MobileHubDetail })));`
2. Change the `/hub/:slug` route from `<Route path="/hub/:slug" element={<HubDetail />} />` to `<Route path="/hub/:slug" element={isMobile ? <MobileHubDetail /> : <HubDetail />} />`
```
