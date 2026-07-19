# Mobile redesign prompt — Guide detail page (9/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–8 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog) are already built — follow their pattern closely, described below.

This route is `/services/:slug` — a long-form step-by-step guide for one specific service (how to get a tax number, how to open a bank account, etc.), reached by drilling into a service from the catalog.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileGuidePage() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, and NO invalid/duplicate spacing utilities like `pb-5.5 pb-6` in the same class string — every class must be either a real Tailwind scale value or an arbitrary-value bracket like `pb-[22px]`)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `file-text`, `users`, `file-check`, `check`, `check-circle`, `alert-triangle`, `shield-check`, `message-circle`, `clock`, `receipt`, plus `category?.icon` (already a valid `IconName`)
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`, `useParams`)
- i18n: react-i18next, nested dot-path keys
- `import { getGuideContent, isTranslated, SERVICE_FOR_SLUG } from '../../data/guides'; import { SERVICE_CATEGORIES, pickText } from '../../data/services';` — pure data helpers, do not modify
- Reuse `<ServiceRequestModal>` verbatim (`import { ServiceRequestModal } from '../../components/ServiceRequestModal';`) for the "request this service" flow — already portal-based and mobile-safe
- Preserve the two `useEffect`s exactly as-is: the analytics `track('guide_viewed_full', ...)` call, and the SEO effect that temporarily sets `document.title` and the meta description while the guide is mounted (restores both on unmount) — these have no visual output, just keep the logic

## Design system (same tokens as screens 1–8)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — `gold-soft`/`gold-dark` (partner badge tint), `gold-light` (small icon accents on the navy hero), and `.btn-gold` (now solid black) all keep their existing usages exactly as the desktop version uses them, just restyled for mobile sizing.
- Reuse: `.card`, `.btn` + `.btn-primary`/`.btn-secondary`/`.btn-gold`, `.icon-chip`, `.amber-note`, `rounded-card` (16px)
- The desktop mistakes section uses raw `bg-amber-50`/`border-amber-200`/`text-amber-900` (Tailwind's built-in amber palette, not a Rafiq token) — keep using those as-is, they're intentional and unrelated to the gold rebrand.

## Established mobile patterns (from MobileAuth/MobileHome/MobilePricing/MobileCheckout/MobileSmart/MobilePremium/MobileHelpRequest/MobileServices.tsx — follow these exactly)
- **Standard content-page header**: replaces the desktop's big gradient hero section. Compact navy panel, `rounded-b-[28px]`, safe-area top padding, the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)`). Fold the hero content INTO this header: a small breadcrumb row (All services → category → title, using `DirArrow` as the separator, same as desktop), a category-icon avatar + the guide title + the partner/direct badge, the intro paragraph, and the duration/cost stat chips — all in white/white-70 text on the navy panel, sized down for mobile (don't try to fit the full desktop hero verbatim, condense it).
- **No bottom 5-tab nav bar on this screen** — like Checkout/Premium, this is a focused drill-down flow, not a tab destination. The desktop version already has its own mobile-specific sticky bottom CTA bar (`sm:hidden fixed bottom-0 ... p-3`, a `message-circle` + `services.request` primary button) — keep that pattern as the ONLY bottom bar here (restyled to match our button conventions and safe-area inset padding), don't add the 5-tab nav on top of it.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Guide detail
Reference implementation (desktop, `src/pages/GuidePage.tsx` — DO NOT change any logic, only restyle):

- `slug` from `useParams()`, `guide = getGuideContent(slug, lang)`, `service = SERVICE_FOR_SLUG[slug]`, `category = service ? SERVICE_CATEGORIES.find(c => c.id === service.category) : undefined`, `title = service ? pickText(service.title, lang) : (guide?.name ?? slug)`, `isPartner = service ? service.type === 'partner' : (guide?.type?.includes('شريك') ?? false)`, `requesting` state
- **Not-found state**: if `!guide`, show a centered card (`file-text` icon-chip, `guide.notAvailable` text, a full-width primary button `Link to="/services"` labeled `nav.allServices`) — still wrap this in the standard header/back-button shell, just with no guide content below it.
- **Header content** (folded into the navy panel, see above): breadcrumb (`nav.allServices` → `pickText(category.title, lang)` if present → `title`), category icon avatar, `title` + partner/direct badge (`services.partnerBadge`/`services.directBadge`), `guide.intro`, and stat chips for `guide.duration` (`clock` icon, label `serviceGuides.duration`) and `guide.cost` (`receipt` icon, label `serviceGuides.cost`) — only render each chip if that field is truthy. Note `<bdi>` wrapping on the duration/cost VALUES in the original — keep using `<bdi>` for any raw guide-content strings (they may contain mixed-direction text like prices or dates).
- **Translation notice**: if `!isTranslated(slug, lang) && lang !== 'ar'`, an `.amber-note` row: `serviceGuides.translationNote` text + a small secondary button `Link to={\`/premium?topic=${encodeURIComponent(service?.id ?? '')}\`}` (`message-circle` icon, `guide.choice.ai.label`)
- **Who it's for**: if `guide.whoFor`, a `SectionCard` (icon `users`, title `serviceGuides.whoFor`) with the text
- **Required documents**: if `guide.documents.length > 0`, a `SectionCard` (icon `file-check`, title `serviceGuides.documents`) — a checklist, each item a small navy check-badge + `<bdi>{doc}</bdi>`
- **Steps**: if `guide.steps.length > 0`, a `SectionCard` (icon `check-circle`, title `serviceGuides.steps`) — a numbered vertical timeline (circled step number + connecting line between steps, exactly like the desktop version), each `<bdi>{step}</bdi>`
- **Common mistakes**: if `guide.mistakes.length > 0`, an amber-tinted card (raw `bg-amber-50`/`border-amber-200`, `alert-triangle` icon, title `serviceGuides.mistakes`), a bulleted list of `<bdi>{mistake}</bdi>` items
- **Disclaimer**: small muted text, `serviceGuides.disclaimer`
- **"How Rafiq helps" card**: navy-filled card, `shield-check` icon + title `serviceGuides.rafiqHelp` + the same partner/direct badge, body text `guide.rafiqHelp`, a full-width `.btn-gold` button (`message-circle` icon, `services.request` label) that calls `service ? setRequesting(true) : navigate('/services')`
- **Independent note**: centered muted text, `serviceGuides.independent`
- **Sticky bottom CTA** (mobile-only on desktop too — reuse this exact behavior): fixed bottom bar, primary button (`message-circle` icon, `services.request`), same `service ? setRequesting(true) : navigate('/services')` handler
- `{requesting && service && <ServiceRequestModal source={{ id: service.id, title, category: service.category, type: service.type }} onClose={() => setRequesting(false)} />}`

## What I need from you
Design and code a NEW component `MobileGuidePage` (`src/pages/mobile/MobileGuidePage.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/logic/effects — only JSX/styling changes plus the header (no 5-tab bottom nav, just the sticky request-CTA bar)
2. All checklist rows, step badges, and buttons sized for touch (48px+ where interactive)
3. RTL exactly as established, no logo, correct `<bdi>` usage preserved for raw guide-content strings
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — nearly all strings already exist under `guide.*`/`serviceGuides.*`/`services.*`)

## Deliverable format
Give me the complete `MobileGuidePage.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileGuidePage = lazy(() => import('./pages/mobile/MobileGuidePage').then((m) => ({ default: m.MobileGuidePage })));`
2. Change the `/services/:slug` route from `<Route path="/services/:slug" element={<GuidePage />} />` to `<Route path="/services/:slug" element={isMobile ? <MobileGuidePage /> : <GuidePage />} />`
```
