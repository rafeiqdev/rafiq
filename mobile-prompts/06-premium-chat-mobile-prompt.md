# Mobile redesign prompt — Premium / AI chat page (6/19)

Paste everything in the code block below into your design tool.

```
You are redesigning ONE screen of an existing bilingual web app called "Rafiq Istanbul" (رفيق اسطنبول) as a native-feeling MOBILE screen. Rafiq helps foreigners (mostly Arabic-speaking) navigate life in Istanbul. It currently only has a desktop/browser design; I'm rebuilding it page by page for phones. Screens 1–5 (Auth, Home, Pricing, Checkout, Smart) are already built — follow their pattern closely, described below.

This route is `/premium` and `/chat` (both point at the same component) and IS the real AI chat interface — Rafiq's AI assistant. It should feel like a native mobile chat screen (think a compact messaging-app layout), not a desktop card with a chat box inside it.

## Tech stack (must match exactly)
- React 18 + TypeScript, functional components only, NAMED export `export function MobilePremium() { ... }`
- Tailwind CSS v3 (utility classes + existing `@layer components` classes — no new component classes, no arbitrary color hexes)
- Icons: ONLY through `<AppIcon name="..." className="..." />` (`import { AppIcon } from '../../components/AppIcon';`) — valid names used on this screen: `calendar`, `alert-triangle`, `sparkles`. There is NO 'mic' icon in the registry — copy the inline `MicGlyph` SVG component verbatim from the desktop file (it's a small hand-drawn mic glyph, not from lucide-react).
- NO Rafiq logo anywhere — the desktop header uses `<Logo size={44} />`, DO NOT include it. Replace that header slot with just the title (see header pattern below) — nothing needs to visually replace the logo, don't invent a substitute avatar/icon for it, just drop it.
- No animation library — use `animate-fade-up`, `animate-pop`, `animate-fade-in`, `stagger`, or Tailwind `transition-*`, plus whatever subtle pulse/typing-indicator treatment you think reads best for the streaming placeholder bubble (a few bouncing dots or similar is fine, your call)
- Routing: react-router-dom v6 (`Link`, `useSearchParams`)
- i18n: react-i18next, nested dot-path keys
- Data/state: everything through `useApp()` (`import { useApp } from '../../context/AppContext';`) — exposes `user`, `tier`, `appConfig`
- `import { ai, ApiError } from '../../lib/api';`, `import type { ChatMessage } from '../../lib/types';`
- Reuse `<RequireAuth>` (`import { RequireAuth } from '../../components/Gates';`) wrapping the whole screen, unchanged, exactly like the desktop version
- Reuse `<BookingModal>` (`import { BookingModal } from '../../components/BookingModal';`) as-is for the "book a free appointment" flow — it's already portal-based and mobile-safe, don't rebuild it, no restyling needed
- `import { SERVICES, pickText } from '../../data/services';` for the topic-prefill effect

## Design system (same tokens as screens 1–5)
- `navy` #1a3a6b / `navy-dark` #12294d / `navy-light` #2c4f8a, `cream` #faf8f0 / `cream-dark` #efeadb, `brand-red` #c0392b, `brand-blue` #e8f0fb
- `gold` family is now black/white/neutral (NOT golden) — `gold`/`gold-dark` ≈ black, `gold-light` = white, `gold-soft` = light gray. Navy + white dominate; black only for small emphasis.
- Reuse: `.card`, `.btn` + `.btn-primary`/`.btn-ghost`, `.input`, `.icon-chip`, `.amber-note`, `rounded-btn` (12px), `rounded-card` (16px)

## Established mobile patterns (from MobileAuth/MobileHome/MobilePricing/MobileCheckout/MobileSmart.tsx — follow these exactly)
- **Standard content-page header**, adapted to a chat screen: compact navy panel, `rounded-b-[28px]`, safe-area top padding, the faint decorative "ر" watermark bleeding off the bottom-end corner at `text-white/5`, a back button (`AppIcon name="arrow-left"`, flipped `rotate-180` in RTL, calling `navigate(-1)`), title (`t('chat.title')`) and subtitle (`t('chat.subtitle')`) — NO logo. If `!isPro`, also show the small "{{count}} free messages left" pill (`chat.previewLeft`) somewhere in or just below the header — your call on exact placement, keep it unobtrusive.
- **No bottom tab bar on this screen** — like Checkout, this is a focused full-screen flow (chat input needs the space, and the tab bar would fight with the keyboard on mobile). Do NOT include the 5-tab nav bar here.
- The chat transcript area should be the dominant, flexible-height part of the screen (`flex-1`, internal scroll only — never scroll the whole page when a message arrives, exactly like the desktop version's `scrollRef` behavior), with a fixed input bar pinned above the safe-area bottom inset.
- RTL: `const lang = (i18n.language || 'en').split('-')[0]; const isRTL = lang === 'ar' || lang === 'fa';`, root `dir={isRTL ? 'rtl' : 'ltr'}`, logical spacing classes (`ps-`/`pe-`/`start-`/`end-`)
- New mobile-only copy → local `mobileCopy` object, at least `en`/`ar`
- No Rafiq logo, 48px+ touch targets, entrance via `animate-fade-up`/`animate-pop`

## The screen to redesign: Premium (AI chat)
Reference implementation (desktop, `src/pages/Premium.tsx` — DO NOT change any logic, only restyle). Preserve every piece of this exactly:

- `SPEECH_LANG` map, the inline `MicGlyph` SVG, `UiMessage` type (`ChatMessage` + `offerBooking?`, `problemSummary?`, `streaming?`), `chatKey(userId)` / `loadChat(userId)` (reads/writes `localStorage` under `rafiq_chat_history_{userId}`)
- State: `messages` (seeded from `loadChat(userId)`), `input`, `busy`, `error`, `paywalled`, `remaining`, `lastFailed`, `booking`, `listening`, plus `scrollRef` and `seededRef`
- `isPro = tier === 'pro' || tier === 'elite'`
- `SR = window.SpeechRecognition || window.webkitSpeechRecognition` — only render the mic button if `SR` exists
- Effect: persists non-streaming `messages` to `localStorage` on every change, and scrolls `scrollRef.current` to bottom (the chat box's own scroll container, never `window.scrollTo`)
- `ask(text, alreadyAppended)`: appends the user message (unless `alreadyAppended`), appends a `streaming: true` placeholder assistant bubble, calls `ai.chat(history, i18n.language, onPartialToken)` which streams tokens into that placeholder, then on success replaces it with the final text and (if `result.offerBooking`) appends a follow-up assistant bubble offering a booking (text = `problemSummary + '\n\n' + t('chat.bookOffer')`, with `offerBooking: true` and `problemSummary`); on a 402 `ApiError` sets `paywalled`, otherwise sets `error='chat.error'` and `lastFailed=text` and removes the placeholder
- `send()`: trims `input`, no-ops if empty/busy/paywalled, clears the input, calls `ask(text)`
- `retry()`: re-asks `lastFailed` with `alreadyAppended=true`
- Topic-prefill effect: if arriving with `?topic=<serviceId>` and chat is empty, auto-sends a seeded message once (`seededRef`) using `t('chat.topicSeed', { service: pickText(svc.title, i18n.language) })` where `svc = SERVICES.find(s => s.id === topic)`
- `startVoice()`: guards on `SR`/`listening`/`paywalled`, starts speech recognition with `SPEECH_LANG[i18n.language] ?? 'en-US'`, `interimResults=false`, fills `input` from the result, toggles `listening`

### Layout
- **Header**: as described above (no logo)
- **Transcript** (scrollable, internal only): always starts with a static greeting bubble (`chat.greeting`, assistant-style). Then map `messages`: user bubbles align end-side (navy bg, white text), assistant bubbles align start-side (brand-blue bg, navy text, `whitespace-pre-line`). A `streaming` bubble shows its partial text plus a small blinking/typing cursor indicator. A bubble with `offerBooking` shows a full-width button below its text (`calendar` icon, `chat.bookCta`) that opens the `BookingModal`. If `error`, show an `.amber-note` row (`alert-triangle` icon, `t(error)`, a small `chat.retry` button calling `retry`). If `paywalled`, show a centered upsell card: `sparkles` icon-chip, `chat.gate.title`, `chat.gate.body`, a full-width primary button `Link to="/pricing"` labeled `chat.gate.cta`.
- **Input bar** (pinned above the safe-area bottom inset, NOT inside the scrolling transcript): text input (`chat.placeholder`, disabled when `paywalled`, `Enter` key sends), the mic button when `SR` exists (disabled while `busy`/`paywalled`, tinted `brand-red` while `listening`), and a send button (`common.send`, disabled while `busy`/`paywalled`). Below it, a small centered disclaimer line (`chat.disclaimer`).

## What I need from you
Design and code a NEW component `MobilePremium` (`src/pages/mobile/MobilePremium.tsx`, named export) that:
1. Implements everything above, preserving 100% of state/handlers/logic verbatim — only JSX/styling changes plus the header (no bottom tab bar, no logo)
2. Chat bubbles, input, mic button, and send button all sized and spaced for a real mobile chat screen (48px+ tap targets on every button)
3. RTL exactly as established, no logo
4. New mobile-only copy → local `mobileCopy`, at least `en`/`ar` (likely minimal — most strings already exist under `chat.*`)

## Deliverable format
Give me the complete `MobilePremium.tsx` file, plus the wiring edit for `src/App.tsx`:
1. Add near the other lazy imports: `const MobilePremium = lazy(() => import('./pages/mobile/MobilePremium').then((m) => ({ default: m.MobilePremium })));`
2. Change BOTH routes from `<Route path="/premium" element={<Premium />} />` / `<Route path="/chat" element={<Premium />} />` to `element={isMobile ? <MobilePremium /> : <Premium />}`
```
