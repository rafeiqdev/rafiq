# Mobile redesign prompt — Notifications page (20/20 — final screen)

Paste everything in the code block below into your design tool.

```
You are redesigning the LAST screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–19 are already built — this is the final one.

It's a simple notification inbox: a list of items, each read or unread, with a "mark all read" action. Small screen — don't invent new sections, just make the list feel native, and give the unread state a clear visual weight.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileNotifications() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string, e.g. never write `pt-4.5 pt-5` together — pick one valid value)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names used on this screen: `bell`, `megaphone`, `inbox`, `lock`, `arrow-left`, `home`, `message-circle`, `map`, `layers`, `user`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`, `useLocation`)
- i18n: react-i18next, nested dot-path keys
- Real photo in the header: `import { ISTANBUL } from '../../lib/images';` then `ISTANBUL.mosque` — an already-bundled real photo. Render via `<SiteImage>` (`import { SiteImage } from '../../components/SiteImage';`).
- **CRITICAL — how to position SiteImage.** `<SiteImage>`'s own root element already carries `relative overflow-hidden`. Never pass `absolute` in its `className` — Tailwind emits `.relative` after `.absolute`, so `relative` wins, the photo drops into the layout flow and the header breaks. Always wrap it, exactly like `PageHero` does:
  `<div className="absolute inset-0"><SiteImage src={...} alt="" className="h-full w-full" /></div>`
- **This project has NO RTL Tailwind variant** (`plugins: []` in tailwind.config.js) — `rtl:*` classes are silently dropped and do nothing. Flip things in JS with the `isRTL ? 'rotate-180' : ''` pattern instead. Both of these mistakes shipped on earlier screens and had to be fixed — don't repeat them.
- **No fake status bar/clock — never hardcode one, the phone renders its own.**

## Design system (same tokens as screens 1–19)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.icon-chip`

## Established mobile patterns (follow these exactly)
- **Header**: `rounded-b-[28px]`, safe-area-aware top padding (`pt-[calc(env(safe-area-inset-top)+0.75rem)]`), the real photo wrapped as described above under a heavy `bg-navy/85` overlay, a faint decorative Arabic "ر" watermark bleeding off one corner (`text-white/5`, huge, `absolute -bottom-12 -end-3.5`, `pointer-events-none select-none`), and a circular back button (`bg-white/10`, `arrow-left` flipped in RTL, `onClick={() => navigate(-1)}`). Below it: title `notifications.title` in white, and — only when at least one item is unread — a "mark all read" button (`notifications.markAll`) styled as a white-outline button on the navy, calling `markAll`.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileMyRequests.tsx (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, ALL FOUR languages: `en`/`ar`/`fa`/`ru` — no exceptions
- 48px+ touch targets, entrance via `animate-fade-up`/`stagger`

## The screen to redesign: Notifications
Reference implementation (desktop, `src/pages/Notifications.tsx` — preserve ALL logic and handlers exactly; only JSX/styling changes). Note this page does NOT use `<RequireAuth>` — it has its own inline signed-out state, keep that behaviour.

```tsx
// imports: { useApp } from '../../context/AppContext'
//          { notifications } from '../../lib/api'
//          type { AppNotification } from '../../lib/types'
const { user, refresh } = useApp();
const [items, setItems] = useState<AppNotification[]>([]);
const load = () => notifications.list().then(setItems).catch(() => setItems([]));
useEffect(() => {
  if (user) load();
  else setItems([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user]);
const markAll = async () => {
  await notifications.markAllRead();
  await load();
  await refresh();
};
```

Three states:
1. **Signed out** (`!user`) — the same header (title only, no mark-all button), then a centred card: `icon-chip` with `lock`, text `gates.authRequired.body`, and a full-width `Link to="/auth"` (`gates.authRequired.cta`).
2. **Empty** (`items.length === 0`) — centred card: `icon-chip` with `inbox`, text `notifications.empty`.
3. **List** — one card per notification:
   - icon chip: `n.key === 'custom' ? 'megaphone' : 'bell'`
   - body: if `n.key === 'custom'` a single paragraph `{n.customText}`; otherwise a bold title `t(\`notifications.${n.key}.title\`)` and a lighter body `t(\`notifications.${n.key}.body\`)`. Both need `break-anywhere`.
   - timestamp: `new Date(n.createdAt).toLocaleString(i18n.language)`
   - read items are dimmed (`opacity-60` on the card, as on desktop); unread items show a small `bg-brand-red` dot and should read as visually heavier — a subtly stronger card (e.g. a white surface with a faint navy edge, or an unread accent bar) is welcome, keep it tasteful and within the existing palette.
   The "mark all read" control lives in the header (see above) — don't duplicate it in the body.

## What I need from you
Design and code a NEW component `MobileNotifications` (`src/pages/mobile/MobileNotifications.tsx`, named export) that:
1. Implements everything above, preserving 100% of the data fetching and handlers — only JSX/styling changes plus the header + bottom tab bar
2. All controls sized for touch (48px+)
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, ALL FOUR languages (`en`/`ar`/`fa`/`ru`)

## Deliverable format
Give me the complete `MobileNotifications.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileNotifications = lazy(() => import('./pages/mobile/MobileNotifications').then((m) => ({ default: m.MobileNotifications })));`
2. Change the `/notifications` route from `<Route path="/notifications" element={<Notifications />} />` to `<Route path="/notifications" element={isMobile ? <MobileNotifications /> : <Notifications />} />`
```
