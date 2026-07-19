# Mobile redesign prompt — Profile / account page (18/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–17 (Auth, Home, Pricing, Checkout, Smart, Premium chat, Help Request, Services catalog, Guide detail, Map, Referrals, Residency, Real Estate, Health Tourism, Tricks, Guides Hub, Hub detail) are already built.

This is the user's own account screen — the densest screen in the series, with six distinct sections. It is also a TAB-ROOT screen (the "Profile" tab in the bottom bar points here), so it gets NO back button and the Profile tab renders ACTIVE. Give it the enhanced treatment: a navy header with a real Istanbul photo behind a heavy overlay (identity screen — the photo should sit back, not compete with the avatar), tactile section cards, and interactive controls that feel native. Don't invent new data or new sections; this screen already has plenty. Focus on making the existing six sections scannable and thumb-friendly in a single column.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobileProfilePage() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes, no invalid/duplicate spacing utilities in one class string, e.g. never write `pt-4.5 pt-5` together — pick one valid value)
- Icons: ONLY through `<AppIcon name="..." className="..." />` and `<DirArrow />` (`import { AppIcon, DirArrow } from '../../components/AppIcon';`) — valid names used on this screen: `check`, `check-circle`, `pencil`, `file-text`, `download`, `upload`, `inbox`, `calendar`, `mail`, `lock`, `home`, `message-circle`, `map`, `layers`, `user`
- NO Rafiq logo anywhere
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`
- Routing: react-router-dom v6 (`Link`, `useLocation`)
- i18n: react-i18next, nested dot-path keys
- Real photo: `import { ISTANBUL } from '../../lib/images';` then `ISTANBUL.bosphorus` — an already-bundled, real Istanbul photo. Render it via `<SiteImage>` (`import { SiteImage } from '../../components/SiteImage';`) absolutely positioned inside the header with a heavy `bg-navy/85` overlay on top, so the header reads as navy with a hint of real scenery — NOT as a photo hero. Do not use `<PageHero>` on this screen.
- Reuse `<RequireAuth>` verbatim (`import { RequireAuth } from '../../components/Gates';`) — same wrapper structure as the desktop page: an inner component with all the content, and `export function MobileProfilePage() { return <RequireAuth><MobileProfileInner /></RequireAuth>; }`
- **No fake status bar/clock — never hardcode one, the phone renders its own.**

## Design system (same tokens as screens 1–17)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral — do not use gold anywhere on this screen
- Reuse: `.card`, `.card-hover`, `.btn-primary`, `.btn-secondary`, `.icon-chip`, `.input`

## Established mobile patterns (follow these exactly)
- **Tab-root header** (like MobileHome/MobileServices — NO back button): `rounded-b-[28px]`, safe-area-aware top padding (`pt-[calc(env(safe-area-inset-top)+0.75rem)]`), the real photo + `bg-navy/85` overlay described above, and a faint decorative Arabic "ر" watermark bleeding off one corner (`text-white/5`, huge, `absolute -bottom-12 -end-3.5`, `pointer-events-none select-none`).
- **Bottom tab bar**: copy the exact fixed 5-tab `<nav>` block verbatim from MobileTricks.tsx (Home / AI chat / Map / Services / Profile) — on THIS screen the Profile tab is active (the existing `active` logic handles it via `location.pathname.startsWith(tab.to)`). Wrap scrollable content in `pb-[calc(env(safe-area-inset-bottom)+88px)]`.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, ALL FOUR languages: `en`/`ar`/`fa`/`ru` — every screen must include all four, no exceptions
- No Rafiq logo, no fake status bar, 48px+ touch targets, entrance via `animate-fade-up`/`stagger`

## The screen to redesign: Profile
Reference implementation (desktop, `src/pages/ProfilePage.tsx` — preserve ALL logic, data fetching, and handlers exactly; only JSX/styling changes). Keep these helpers verbatim:

```tsx
function isoToDisplay(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}
function displayToIso(v: string): string | undefined {
  const digits = v.replace(/\D/g, '').slice(0, 8); // DDMMYYYY
  if (digits.length < 8) return undefined;
  const d = digits.slice(0,2), m = digits.slice(2,4), y = digits.slice(4,8);
  const dt = new Date(`${y}-${m}-${d}`);
  return isNaN(dt.getTime()) ? undefined : `${y}-${m}-${d}`;
}
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
```

State and effects (keep exactly):
```tsx
const { user, profile, updateProfile, resetOnboarding, signOut } = useApp();   // from '../../context/AppContext'
const [docs, setDocs] = useState<StoredDocument[]>([]);
const [myBookings, setMyBookings] = useState<Booking[]>([]);
const [myLeads, setMyLeads] = useState<Lead[]>([]);
useEffect(() => {
  if (!user) return;
  documents.list().then(setDocs).catch(() => {});
  bookings.mine().then(setMyBookings).catch(() => {});
  leads.mine().then(setMyLeads).catch(() => {});
}, [user]);
// imports: { bookings, documents, leads } from '../../lib/api'
//          type { Booking, Lead, StoredDocument } from '../../lib/types'
//          { pickCity } from '../../data/turkeyCities'

const hasItems = [
  ['turkishPhone', profile.has.turkishPhone],
  ['taxNumber', profile.has.taxNumber],
  ['residencePermit', profile.has.residencePermit],
  ['bankAccount', profile.has.bankAccount],
] as const;
const done = hasItems.filter(([, v]) => v).length;

const upload = async (file?: File) => {
  if (!user || !file) return;
  await documents.upload(file);
  setDocs(await documents.list());
};

const renewalRows = (['residence', 'insurance', 'passport'] as const).map((k) => ({
  key: k, date: profile.renewals[k], days: daysUntil(profile.renewals[k]),
}));
```

Sections, in this order, all single-column full-width on mobile:

1. **Header** — title `profile.title`, and a sign-out button (`common.signOut`, calls `signOut()`) — put sign-out as a small ghost/outline button in the header's top row, white-on-navy styling.
2. **Account summary card** — avatar circle (`user.avatarUrl` in an `<img>` if present, else `(user?.name?.[0] ?? 'R').toUpperCase()` on a navy circle), `user.name`, `user.email` (`dir="ltr"`, break-all). Then three stat rows: `account.situation` → `profile.situation ? t(\`situationStatus.${profile.situation}\`) : t('account.notSet')`; `account.city` → `profile.city ? pickCity(profile.city, i18n.language) : t('account.notSet')`; `account.onboardingStatus` → `user?.onboardingCompleted ? t('account.completed') : t('account.notCompleted')`. On mobile show these as a clean 3-row list or a 3-up chip grid, your call. Then two full-width buttons: `Link to="/journey"` (`check-circle` + `account.myJourney`, primary) and `Link to="/onboarding"` (`pencil` + `account.editAnswers`, secondary). Then small text links to `/terms` (`nav.terms`) and `/privacy` (`nav.privacy`).
3. **Persona card** — heading `profile.persona.title`; three label/value rows: `profile.persona.path` → `profile.path ? t(\`onboarding.q1.${profile.path}.title\`) : '—'`, `profile.persona.reason` → `profile.reason ? t(\`onboarding.q2.${profile.reason}.title\`) : '—'`, `profile.persona.family` → `profile.family ? t(\`common.${profile.family}\`) : '—'`. Then a full-width `btn-secondary` calling `resetOnboarding` (`pencil` + `profile.persona.edit`).
4. **Checklist card** — heading `profile.checklist.title`, progress line `t('profile.checklist.progress', { done, total: hasItems.length })`, a progress bar (`h-2 rounded-full bg-cream-dark` track, `bg-navy` fill, `width: ${(done / hasItems.length) * 100}%`), then the four items as full-width tappable rows calling `updateProfile({ has: { ...profile.has, [k]: !v } })`. Checked = filled navy checkbox + `line-through text-navy/60`; unchecked = outlined box. Label is `t(\`onboarding.q3.${k}.title\`)`. Make these rows generous (48px+) — they're the most-tapped thing on the page.
5. **Renewal tracker card** — heading `profile.renewals.title`, one row per `renewalRows` entry: label `t(\`profile.renewals.${r.key}\`)`, status line (expired → `profile.renewals.expired` in `text-brand-red`; `< 30` days → amber; else green — using `t('profile.renewals.daysLeft', { count: r.days ?? 0 })` plus `new Date(r.date).toLocaleDateString(i18n.language)`), or `profile.renewals.noDate` when unset. Each row has a date `<input type="text" inputMode="numeric" dir="ltr" placeholder="DD/MM/YYYY" defaultValue={isoToDisplay(r.date)} onChange={(e) => updateProfile({ renewals: { ...profile.renewals, [r.key]: displayToIso(e.target.value) } })} aria-label={t('profile.renewals.set')} />`. On mobile stack the input UNDER the label/status (full width), don't squeeze it beside them.
6. **Document locker card** — heading `profile.locker.title`; if `docs.length === 0` show `profile.locker.empty`, else a list: `file-text` icon, `d.name` (truncate), upload date `new Date(d.uploadedAt).toLocaleDateString(i18n.language)`, and a download button calling `documents.open(d.id)` (`download` icon + `profile.locker.download`). Then a full-width upload control — keep it as a `<label className="btn-primary ...">` wrapping a hidden `<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => upload(e.target.files?.[0])} />` (`upload` icon + `profile.locker.upload`).
7. **Pipeline card** — heading `profile.pipeline.title` with a `Link to="/requests"` button (`inbox` + `nav.myRequests`). If both `myBookings` and `myLeads` are empty show `profile.pipeline.empty`; otherwise list bookings (`calendar` icon, `b.problemSummary`, status pill `t(\`adminBookings.statuses.${b.status}\`)`) then leads (`mail` icon, `${t(\`leads.kind.${l.kind}\`)} — ${l.item}`, date `new Date(l.createdAt).toLocaleDateString(i18n.language)`).

## What I need from you
Design and code a NEW component `MobileProfilePage` (`src/pages/mobile/MobileProfilePage.tsx`, named export) that:
1. Implements everything above, preserving 100% of the data fetching, handlers, and helper functions — only JSX/styling changes plus the header + bottom tab bar
2. All controls sized for touch (48px+), inputs full-width
3. RTL exactly as established, no logo, no fake status bar
4. New mobile-only copy → local `mobileCopy`, ALL FOUR languages (`en`/`ar`/`fa`/`ru`)
5. Wraps the inner content in `<RequireAuth>` exactly like the desktop page does

## Deliverable format
Give me the complete `MobileProfilePage.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobileProfilePage = lazy(() => import('./pages/mobile/MobileProfilePage').then((m) => ({ default: m.MobileProfilePage })));`
2. Change the `/profile` route from `<Route path="/profile" element={<ProfilePage />} />` to `<Route path="/profile" element={isMobile ? <MobileProfilePage /> : <ProfilePage />} />`
```
