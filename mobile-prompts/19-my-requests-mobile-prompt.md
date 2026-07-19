# Mobile redesign prompt — My Requests page (19/20)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–18 are already built (most recently the Profile screen, which links here).

This is the customer's request inbox: each request they submitted can be expanded to reveal competing quotes from partner companies, one of which they pick, and afterwards they can leave a review. It's a compact screen — don't invent new sections, just make the expand/collapse and the quote cards feel native and tappable.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileMyRequests() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string, e.g. never write `pt-4.5 pt-5` together — pick one valid value)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names used on this screen: `arrow-right`, `arrow-left`, `map-pin`, `check-circle`, `star`, `inbox`, `alert-triangle`, `home`, `message-circle`, `map`, `layers`, `user`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useNavigate`, `useLocation`)
- i18n: react-i18next, nested dot-path keys
- Reuse VERBATIM, do not touch their internals: `<RequireAuth>` (`'../../components/Gates'`), `<Modal>` (`'../../components/Modal'`), `<ReviewStars>` and `<StarRatingInput>` (`'../../components/ReviewStars'`). Note `ReviewStars`/`StarRatingInput` internally use `text-gold-dark` — the gold family now renders as neutral/black site-wide, which is intentional; leave it alone.
- Real photo in the header: `import { EXPLORE_PHOTOS } from '../../lib/images';` then `EXPLORE_PHOTOS['/referrals']` — an already-bundled real photo. Render via `<SiteImage>` (`import { SiteImage } from '../../components/SiteImage';`).
- **CRITICAL — how to position SiteImage.** `<SiteImage>`'s own root element already carries `relative overflow-hidden`. Never pass `absolute` in its `className` — Tailwind emits `.relative` after `.absolute`, so `relative` wins and the photo drops into the layout flow and breaks the header. Always wrap it, exactly like `PageHero` does:
  `<div className="absolute inset-0"><SiteImage src={...} alt="" className="h-full w-full" /></div>`
  This exact mistake shipped on the previous screen and had to be fixed — do not repeat it.
- **No fake status bar/clock — never hardcode one, the phone renders its own.**

## Design system (same tokens as screens 1–18)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.icon-chip`, `.input`, `.amber-note`

## Established mobile patterns (follow these exactly)
- **Header**: `rounded-b-[28px]`, safe-area-aware top padding (`pt-[calc(env(safe-area-inset-top)+0.75rem)]`), the real photo wrapped as described above with a heavy `bg-navy/85` overlay on top, a faint decorative Arabic "ر" watermark bleeding off one corner (`text-white/5`, huge, `absolute -bottom-12 -end-3.5`, `pointer-events-none select-none`), and a circular back button (`bg-white/10`, `arrow-left` icon flipped in RTL via `rotate-180`, `onClick={() => navigate(-1)}`). Below the back button: title `requests.title` and subtitle `requests.subtitle`, both white.
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileProfilePage.tsx (Home / AI chat / Map / Services / Profile) — none active on this screen. Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, ALL FOUR languages: `en`/`ar`/`fa`/`ru` — no exceptions
- 48px+ touch targets, entrance via `animate-fade-up`/`stagger`

## The screen to redesign: My Requests
Reference implementation (desktop, `src/pages/MyRequests.tsx` — preserve ALL logic, data fetching and handlers exactly; only JSX/styling changes).

Outer component + data:
```tsx
// imports: { customerRequests, reviews } from '../../lib/api'
//          type { CompanyResponse, CustomerRequest } from '../../lib/types'
//          { pickArea } from '../../data/istanbulAreas'
const [rows, setRows] = useState<CustomerRequest[] | null>(null);
useEffect(() => { customerRequests.mine().then(setRows).catch(() => setRows([])); }, []);
```
Three states:
- `rows === null` → a centred spinner (`w-10 h-10 rounded-full border-4 border-cream-dark border-t-navy animate-spin`, `role="status"`)
- `rows.length === 0` → empty card: `icon-chip` with `inbox`, text `requests.empty`, full-width `Link to="/services"` (`requests.browseServices`)
- otherwise → the list of `RequestRow`s

Per-row component (keep this logic verbatim):
```tsx
const [open, setOpen] = useState(false);
const [responses, setResponses] = useState<CompanyResponse[] | null>(null);
const [reviewing, setReviewing] = useState<{ companyId: string; companyName: string } | null>(null);
const load = () => customerRequests.responses(req.id).then(setResponses).catch(() => setResponses([]));
const toggle = () => { const next = !open; setOpen(next); if (next && responses === null) load(); };
const choose = async (responseId: string) => { await customerRequests.choose(responseId); await load(); };
```
- **Collapsed row** — a full-width tappable header (`aria-expanded={open}`, 48px+): a chevron (`arrow-right` icon, `rotate-90` when open, and it must also flip in RTL), `req.serviceTitle` in bold, and a meta line with `req.area && <>{map-pin icon}{pickArea(req.area, lang)}</>` plus `new Date(req.createdAt).toLocaleDateString(i18n.language)`.
- **Expanded body** — separated by `border-t border-cream-dark`. If `responses === null` show `common.loading`; if empty show `requests.noResponses`; else a heading `t('requests.responsesTitle', { count: responses.length })`, a small note `requests.capped`, then one card per response:
  - company name as `Link to={`/companies/${r.companyId}`}`, `<ReviewStars rating={r.rating} count={r.reviews} />`, and if `r.quote != null` the price `{r.quote.toLocaleString()} {t('common.tl')}` with `dir="ltr"`
  - optional `r.message` paragraph (`break-anywhere`)
  - if `r.chosen`: a green "chosen" marker (`check-circle` + `requests.chosen`) and a button opening the review modal (`star` + `requests.leaveReview`); the chosen card gets `border-navy bg-brand-blue/40`, others `border-cream-dark bg-cream`
  - if not chosen: a `choose(r.id)` button (`requests.choose`)
  On mobile, stack these bits vertically rather than crowding one row — the buttons should be comfortable full-width or near-full-width taps.

**Review modal** (keep verbatim, restyled for mobile): rendered inside `<Modal onClose={onClose} labelId="review-title" maxWidth="max-w-sm">`, with local state `rating` (default 5), `text`, `busy`, `error`; title `reviews.leaveTitle`, the company name, label `reviews.ratingLabel` + `<StarRatingInput value={rating} onChange={setRating} />`, a textarea (`reviews.text` label, `reviews.textPh` placeholder), an `amber-note` error block with `alert-triangle` + `reviews.error` when `error`, and Cancel (`common.cancel`) / Submit (`reviews.submit`, `reviews.submitting` while busy, `disabled={busy}`) buttons. Submit body:
```tsx
await reviews.create({ companyId, rating, text: text.trim() || undefined, leadId });
onDone(); onClose();
```
`leadId` is the parent `req.id`, and `onDone` is the parent's `load`.

## What I need from you
Design and code a NEW component `MobileMyRequests` (`src/pages/mobile/MobileMyRequests.tsx`, named export) that:
1. Implements everything above, preserving 100% of the data fetching and handlers — only JSX/styling changes plus the header + bottom tab bar
2. All controls sized for touch (48px+)
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, ALL FOUR languages (`en`/`ar`/`fa`/`ru`)
5. Wraps the inner content in `<RequireAuth>` exactly like the desktop page does

## Deliverable format
Give me the complete `MobileMyRequests.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileMyRequests = lazy(() => import('./pages/mobile/MobileMyRequests').then((m) => ({ default: m.MobileMyRequests })));`
2. Change the `/requests` route from `<Route path="/requests" element={<MyRequests />} />` to `<Route path="/requests" element={isMobile ? <MobileMyRequests /> : <MyRequests />} />`
```
