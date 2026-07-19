# Mobile redesign prompt — Auth page (1/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul — residency permits, real estate, health tourism, and an AI assistant. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. This is the FIRST mobile screen being built — it sets the visual pattern every later mobile screen will follow.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED exports (e.g. `export function MobileAuth() { ... }`) — this codebase does not use default exports for pages
- Tailwind CSS v3 (utility classes + the existing `@layer components` classes below — don't invent new component classes, don't use arbitrary color hexes)
- Icons: NOT raw lucide-react — this app wraps every icon through a central `<AppIcon name="..." className="..." />` component (`import { AppIcon } from '../../components/AppIcon';`). Only use icon names that already exist in `src/components/AppIcon.tsx` (e.g. `mail`, `alert-triangle`, `arrow-left`, `x`, `lock`, `check-circle`).
- Logo: `import { Logo } from '../../components/Logo';` — `<Logo size={64} variant="navy" | "white" />`
- Animation: NO animation library installed (no framer-motion/motion) — use the existing CSS keyframe utility classes already defined in `src/index.css`: `animate-fade-up`, `animate-pop`, `animate-fade-in`, or plain Tailwind `transition-*` classes
- Routing: react-router-dom v6 (`useNavigate`, `Link`)
- i18n: react-i18next, nested dot-path keys, e.g. `t('auth.errors.userNotFound')`
- Auth/data layer: NOT Firebase, NOT direct Supabase calls — everything goes through a context hook `useApp()` (`import { useApp } from '../../context/AppContext';`) which exposes `user, login, register, googleSignIn, signOut`. Never call `supabase` directly from a page.

## Design system (Tailwind config tokens already defined in tailwind.config.js — reuse these class names)
- `navy` = #1a3a6b (DEFAULT), `navy-dark` = #12294d, `navy-light` = #2c4f8a — primary brand color, used for headings, primary buttons, hero backgrounds
- `cream` = #faf8f0 (DEFAULT), `cream-dark` = #efeadb — page background / soft borders
- `brand-red` = #c0392b (errors/danger only), `brand-blue` = #e8f0fb (very light blue tint, used for info banners and secondary buttons)
- IMPORTANT — the `gold` token family was just repainted from warm gold to a black/white/neutral scheme: `gold` (DEFAULT) = #111111 near-black, `gold-dark` = #000000 pure black, `gold-light` = #ffffff white, `gold-soft` = #f1f1f1 light gray. So classes like `bg-gold`, `text-gold-dark`, `.btn-gold`, `.icon-chip-gold` now render BLACK/WHITE/GRAY, not golden. Navy + white must visually dominate the screen; use the black (`gold`/`gold-dark`) tokens only for small emphasis/urgent accents, never as the main screen color.
- Fonts: Latin = Inter, Arabic/Farsi = "IBM Plex Sans Arabic" (auto-applied by the root `html[dir='rtl']` rule — you don't need to set font-family yourself)
- Radius: `rounded-btn` = 12px, `rounded-card` = 16px
- Reuse these existing component classes, don't reinvent them: `.card` (white rounded card with border+shadow), `.btn` + variants — `.btn-primary` (navy bg/white text), `.btn-secondary` (light blue bg/navy text), `.btn-gold` (black bg/white text — use sparingly for emphasis), `.btn-ghost` (outline), `.input` (44px-tall bordered input), `.icon-chip` (48px black circle), `.icon-chip-gold` (48px light-gray circle), `.eyebrow` (small bold uppercase label), `.amber-note` (warning banner)

## Existing mobile pattern to match
There isn't one yet — this is the first dedicated mobile screen. Establish these conventions (all future mobile prompts will reference this file as the pattern):
- RTL support: read language via `i18n.language`; Arabic (`ar`) and Farsi (`fa`) are RTL — root wrapper sets `dir={isRTL ? 'rtl' : 'ltr'}`, and spacing/positioning uses logical Tailwind classes (`ps-`, `pe-`, `start-`, `end-`) instead of `pl-`/`pr-`/`left-`/`right-`
- Large, comfortable touch targets (48px+ tall) for inputs and primary buttons — bigger than the desktop 44px `.input`/`.btn` default
- Full-bleed screens that feel like a real native app, not a shrunk desktop layout — generous whitespace, one clear primary action per screen
- New UI copy that isn't already an i18n key (e.g. a back-button aria-label) goes in a local `mobileCopy` object keyed by language code (`en`, `ar` at minimum — add `fa`, `ru` if you have good translations), not hardcoded strings

## The screen to redesign: Auth (sign in / register)
Reference implementation (desktop, `src/pages/Auth.tsx` — works fine functionally, DO NOT change any of this logic, only restyle it as a full mobile screen):

- `useApp()` gives `user, login, register, googleSignIn, signOut`
- Local state: `mode` (`'signin' | 'register'`), `email`, `name` (register mode only), `password`, `busy`, `error`, `nameError`, `notice`
- `isValidName(name)` validates the name field only in register mode (min 3 chars, at least 2 letters) — sets `nameError` and blocks submit if invalid
- `continueWithGoogle()`: calls `googleSignIn()` (Supabase OAuth, full-page redirect — nothing else runs client-side on success); on failure sets `error` to `'auth.errors.generic'`
- `submit()`: in `'signin'` mode calls `login(email, password)` then `navigate('/')`; in `'register'` mode calls `register(email, password, name)` — if it returns `needsConfirmation: true`, sets `notice` to `'auth.checkEmail'` and switches back to `'signin'` mode; otherwise navigates to `/`. Errors from `ApiError` are mapped via a local `ERROR_KEYS` lookup (`user_not_found`, `wrong_password`, `email_exists`, `weak_password`, `bad_email` → specific i18n keys), falling back to `'auth.errors.generic'`
- Edge case: if `user` is already truthy (already signed in), show a simple "signed in as {email}" state with a sign-out button instead of the form
- Existing i18n keys already used — REUSE these exactly, don't rename them: `common.signIn`, `common.signOut`, `common.register`, `common.email`, `common.password`, `common.name`, `common.nameInvalid`, `auth.title`, `auth.registerTitle`, `auth.subtitle`, `auth.registerSubtitle`, `auth.google`, `auth.or`, `auth.noAccount`, `auth.haveAccount`, `auth.signedInAs`, `auth.checkEmail`, `auth.errors.userNotFound`, `auth.errors.wrongPassword`, `auth.errors.emailExists`, `auth.errors.weakPassword`, `auth.errors.generic`

## What I need from you
Design and code a NEW component `MobileAuth` (will live at `src/pages/mobile/MobileAuth.tsx`, named export) that:

1. Feels like a dedicated full-screen native app auth flow, not a centered card on a page — e.g. a compact navy hero brand moment up top (the `Logo` component with `variant="white"` in a navy panel, or a navy rounded badge), then the form area on a white/cream background filling the rest of the viewport
2. Has a clear back/close affordance (`AppIcon name="arrow-left"` or `x`) that navigates to `/` — this screen has no bottom tab bar, it's a pre-auth flow
3. Uses large, comfortable touch targets (48px+ tall) for inputs, the primary submit button, and the Google button — bigger than the desktop defaults
4. Keeps the login/register toggle, but make it feel native: either a segmented control at the top or a clear bottom link (current pattern: `auth.noAccount` / `auth.haveAccount`) — your call on which reads better on mobile
5. Preserves 100% of the existing state/handlers/logic (`mode`, `email`, `name`, `password`, `busy`, `error`, `nameError`, `notice`, `isValidName`, `continueWithGoogle`, `submit`, the already-signed-in branch, the Google icon SVG) — only the JSX/markup/styling changes
6. Implements RTL support as described above (`isRTL`, `dir` attribute, logical spacing classes) — this is the reference for every later screen
7. Uses the existing CSS animation utility classes (`animate-fade-up` / `animate-pop`) for entrance and for the error/notice banners appearing — no new dependency
8. Any new UI copy (e.g. back-button aria-label) goes in a local `mobileCopy` object with at least `en` and `ar`, following the convention above
9. Reuses `.btn-primary`, `.btn-secondary`, `.input`, `AppIcon`, `Logo` — don't invent new component classes

## Deliverable format
Give me the complete `MobileAuth.tsx` file, plus the two small edits needed to wire it in (`src/App.tsx`):
1. Add near the other lazy page imports: `const MobileAuth = lazy(() => import('./pages/mobile/MobileAuth').then((m) => ({ default: m.MobileAuth })));`
2. Change the existing `/auth` route from:
   `<Route path="/auth" element={<Auth />} />`
   to:
   `<Route path="/auth" element={isMobile ? <MobileAuth /> : <Auth />} />`
   (`isMobile` comes from `useIsMobile()`, already added at `src/hooks/useIsMobile.ts` — just call the hook near the top of `App.tsx`)
```
