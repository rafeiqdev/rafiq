# Fix prompt — Rafiq Istanbul

Paste this into a coding agent (Claude Code / Cursor) opened at the repo root.
Work top to bottom. **Do not start a later phase until the previous one is committed and verified.**

---

## Context you need first

Before writing any code, understand this — it is the root of most problems:

The `README` describes an Express server (`server/index.mjs`) that owns every trust
decision: bcrypt hashes, server-stored sessions, HMAC-signed payment webhooks, 402 on
paid features, 403 on admin routes. **That server is not deployed.** Production
(`rafiq.ist`, Vercel) ships only `api/ai-chat`, `api/places-search`, `api/place-photo`
and `api/cron/*`; the browser bundle loads `supabase-js` and talks to Postgres directly
through PostgREST. Every protection in `server/index.mjs` is therefore inert in production.

Your first job is to close the holes this created. Your second job is to make the
deployed architecture and the documented architecture the same thing.

Run `npm test`, `npm run typecheck` and `npm run check:i18n` after every phase. Do not
break the 479 unit tests or the 1240-key × 4-language parity check.

---

## PHASE 0 — Stop the paywall bypass (do this first, today)

Three database functions are `SECURITY DEFINER` and executable by the `anon` and
`authenticated` roles through `/rest/v1/rpc/*`. Verified against the live project.

### 0.1 `_activate_sub` — no authorization check at all

```sql
CREATE FUNCTION public._activate_sub(p_uid uuid, p_tier text, p_billing text, p_days integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$ begin
  insert into public.subscriptions (...) values (p_uid, p_tier, p_billing, 'active', ...)
  on conflict (user_id) do update set tier = excluded.tier, status = 'active', ...;
end $$;
```

No `is_admin()`, no `auth.uid()`. An anonymous visitor can grant any account any tier.

### 0.2 `checkout_card_demo` — grants a paid plan with no payment

Checks only that `auth.uid()` is not null, then inserts a `payments` row with
`status = 'verified'`, calls `_activate_sub`, and pays a referral commission.

### 0.3 `_credit_referrer` — mints referral commissions (30% cash) for any account

### Write this migration

Create `supabase/migrations/<today>_lock_internal_rpcs.sql`:

```sql
-- Internal helpers must never be reachable from the public REST API.
REVOKE EXECUTE ON FUNCTION public._activate_sub(uuid, text, text, integer)  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._credit_referrer(uuid, text, integer)     FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._plan_price(text, text)                   FROM anon, authenticated, public;

-- Dev-only checkout must not exist in production.
DROP FUNCTION IF EXISTS public.checkout_card_demo(text, text);

-- Defence in depth: even if EXECUTE is re-granted, refuse to run unprivileged.
CREATE OR REPLACE FUNCTION public._activate_sub(p_uid uuid, p_tier text, p_billing text, p_days integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if current_setting('role', true) not in ('service_role', 'postgres') and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  insert into public.subscriptions (user_id, tier, billing, status, started_at, expires_at)
  values (p_uid, p_tier, p_billing, 'active', now(), now() + make_interval(days => p_days))
  on conflict (user_id) do update
    set tier = excluded.tier, billing = excluded.billing, status = 'active',
        started_at = now(), expires_at = excluded.expires_at,
        cancel_reason = null, cancel_comment = null;
end $$;
```

Apply the same guard to `_credit_referrer`.

**Then find every caller of `checkout_card_demo` in `src/` and replace it** — the upgrade
button must not silently break. Until Phase 2 lands, point it at the bank-transfer /
crypto manual rail that already exists, so nobody gets a plan without a human verifying
a payment.

Also pin the two functions flagged for mutable search_path:

```sql
ALTER FUNCTION public._plan_price(text, text)   SET search_path TO 'public';
ALTER FUNCTION public.event_trigger_fn()        SET search_path TO 'public';
```

### 0.4 Tighten the permissive RLS policies

```sql
-- referral_clicks: INSERT policy is WITH CHECK (true) — unbounded click inflation.
-- service_requests: same.
```
Replace both with a policy that at minimum requires the referenced code / request to be
well-formed, and add a rate limit (there is already a
`20260727_service_request_rate_limit.sql` migration — extend that pattern).

### 0.5 Storage and auth settings

- Public bucket `listings` has a broad SELECT policy on `storage.objects` that lets
  clients list every file. Public buckets don't need it for URL access — drop it.
- Table `public.dukk` has RLS enabled and zero policies. Confirm it is dead and drop it.
- Enable **Leaked Password Protection** in Supabase Auth settings (dashboard, not code).

**Verify:** after applying, run the Supabase security advisor again and confirm the
`anon_security_definer_function_executable` entries for `_activate_sub`,
`_credit_referrer` and `checkout_card_demo` are gone.

---

## PHASE 1 — Visible breakage

### 1.1 Images are invisible on most page loads

`src/components/SiteImage.tsx` starts at `opacity-0` and only reaches `opacity-100`
inside `onLoad`. When the image comes from cache the `load` event fires **before** React
attaches the handler, so `onLoad` never runs and the image stays transparent forever with
the pulsing skeleton on top. Confirmed live: all four hero carousel images reported
`opacity: 0` with `complete: true`.

```tsx
const ref = useRef<HTMLImageElement>(null);
const [loaded, setLoaded] = useState(false);

useEffect(() => {
  const el = ref.current;
  if (el?.complete && el.naturalWidth > 0) setLoaded(true);
}, []);

<img ref={ref} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} ... />
```

Add a `priority?: boolean` prop. When true, render `loading="eager"` and
`fetchpriority="high"` instead of `loading="lazy"`, and pass it for the hero carousel in
`src/pages/Home.tsx` and `src/pages/mobile/MobileHome.tsx` — the hero is the LCP element
and is currently lazy-loaded.

Write a regression test that mounts `SiteImage` with an already-complete image and
asserts the img does not carry `opacity-0`.

### 1.2 No password reset anywhere

There is no reset UI, no server route, and no i18n key in any of the four locales.
Add, using Supabase Auth:

- "نسيت كلمة المرور؟" link on `/auth` (and `src/pages/mobile/MobileAuth.tsx`)
- A request screen calling `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- A `/reset-password` route handling the recovery session and calling `updateUser`
- Translation keys in **all four** locales (`ar`, `en`, `ru`, `fa`) — `check:i18n` enforces parity

### 1.3 Security headers

`vercel.json` has only `rewrites` and `crons`. I loaded `rafiq.ist` inside an iframe with
no resistance — clickjacking on the checkout and login pages is possible today.

```json
"headers": [{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Frame-Options",           "value": "DENY" },
    { "key": "X-Content-Type-Options",    "value": "nosniff" },
    { "key": "Referrer-Policy",           "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy",        "value": "geolocation=(self), camera=(), microphone=()" },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
  ]
}]
```

Add a `Content-Security-Policy` too. Start in `Content-Security-Policy-Report-Only` mode
and allow exactly what the app uses: Supabase, Google Maps, googletagmanager, `'self'`.
Promote to enforcing once the report is clean.

### 1.4 Main thread freezes

Navigating to `/map`, and switching language, repeatedly locked the renderer for 30–45s
(CDP `Runtime.evaluate` and `Page.captureScreenshot` both timed out, six-plus times).
Measured on the home page: `load` at 7,243 ms, ~995 KB decoded JS, largest chunk
`index-*.js` at 426 KB raw / 162 KB gzip, `supabase-js` 212 KB / 55 KB. TTFB is a healthy
130 ms, so this is all client-side.

- Profile `/map` with the Performance panel and fix whatever blocks the main thread.
- `/map` currently downloads `MapPage`, `MapExplorer` **and** `google-maps` chunks while
  logged out, because `RequireAuth`/`UpsellGate` sit *inside* the component. Move the gate
  outside and `React.lazy` the explorer so gated visitors fetch none of it.
- Split the 426 KB `index` chunk via `build.rollupOptions.output.manualChunks`.
- `Premium.tsx` and `MobilePremium.tsx` run `setInterval(…, 1000)` re-renders — drop to
  60s or move the countdown to CSS.

---

## PHASE 2 — Real payments

Replace `checkout_card_demo` with a real gateway (iyzico is the sensible choice for TRY
in Turkey; Stripe if you prefer). The contract that already exists in `server/index.mjs`
is correct and should be preserved — reuse its shape:

1. Client asks the server to create a checkout session; **price is computed server-side
   from the tier, never accepted from the request body**.
2. User pays on the gateway's hosted page.
3. Gateway calls a signed webhook. Verify the signature (HMAC-SHA256 with
   `PAYMENT_WEBHOOK_SECRET`) before trusting anything.
4. **Only the webhook activates the subscription**, via a Supabase Edge Function or Vercel
   function using the `service_role` key. The browser never activates anything.
5. Activation is idempotent — replaying the same webhook must not extend or duplicate.

The bank-transfer and crypto rails stay as manual-verification paths with admin approval.

While you are here, fix `/api/admin/payments/:id/resolve`:

```js
if (req.body?.status === 'verified') settleVerifiedPayment(p);
else db.prepare("UPDATE payments SET status = 'rejected' …").run(p.id);  // silent default
res.json({ ok: true });
```

Any unrecognised body **silently rejects a real payment and returns 200 `{ok:true}`**. I
hit this by accident sending `{"action":"approve"}`. Validate explicitly:

```js
const { status } = req.body ?? {};
if (!['verified', 'rejected'].includes(status)) return fail(res, 400, 'bad_status');
```

and return the resulting status in the response. Same treatment for
`POST /api/admin/users/:id/tier`, which returns `ok:true` for a non-existent user id and
creates an orphan subscription row — 404 if the user does not exist.

Add an admin payments **history** view. `/api/admin/payments` filters
`WHERE status = 'pending'`, so there is no way to see revenue, review a dispute, or trace
a referral commission. Add status + date filters and a total.

---

## PHASE 3 — SEO (this is the growth blocker)

Language lives only in `localStorage`; there is no language segment in the URL. Every
sitemap entry therefore points all four `hreflang` alternates at the same URL:

```xml
<loc>https://rafiq.ist/services</loc>
<xhtml:link rel="alternate" hreflang="ar" href="https://rafiq.ist/services" />
<xhtml:link rel="alternate" hreflang="en" href="https://rafiq.ist/services" />
<xhtml:link rel="alternate" hreflang="ru" href="https://rafiq.ist/services" />
<xhtml:link rel="alternate" hreflang="fa" href="https://rafiq.ist/services" />
```

Search engines index one version and discard the rest. You are paying for 1240 keys × 4
languages and harvesting organic traffic for one of them.

1. Introduce a language path segment: `/ar/services`, `/en/services`, `/ru/…`, `/fa/…`.
2. Redirect `/` to the best match from `Accept-Language`, falling back to `ar`.
3. Update `scripts/generate-sitemap.mjs` to emit one `<loc>` per language with correct
   alternates and a real `x-default`.
4. Keep old URLs working with 301s to the `ar` variant.
5. Fix `og:locale` — `ar_AR` in `index.html` is not a valid locale; use `ar_SA`.
6. Make `/404` return a real 404 status and set a `<title>` of its own; it currently
   returns 200 and keeps the home page title (soft 404).
7. Consider prerendering (`vite-plugin-prerender` or moving to Next.js) for the guide
   pages. The site ships Bing and Yandex verification files, and neither renders
   client-side JS reliably — those crawlers currently see an empty shell.

---

## PHASE 4 — UX and conversion

### 4.1 Language gate

First-time visitors see a blue screen with four buttons and nothing else — no value
proposition, no image, heavy vertical dead space. Detect `Accept-Language`, render the
site immediately, and rely on the language switcher that already exists in the header.
This removes a whole step from the funnel.

### 4.2 Locked pages have no preview

`/map` and `/journey` (and others) show an identical white card: padlock, "login
required", button. A visitor never learns the map contains vetted restaurants, hospitals
and banks, so there is no reason to sign up. A code comment says an earlier version had a
blurred preview — bring it back: blurred map, three visible pins, "unlock 50+ vetted
places". Give each gate page copy about what is actually behind it.

### 4.3 Mobile: language switcher unreachable

`MOBILE_CHROME_FREE_ROUTES` in `src/components/Layout.tsx` drops the header on mobile.
A compensating footer was added for scrollable routes, but these six have **neither
header nor footer**:

```
/auth  /checkout  /premium  /chat  /map  /help
```

A Farsi speaker landing on `/auth` on a phone — often the first screen they see — has no
way to change language. Add a fixed floating globe button on those routes.

### 4.4 Mobile layout

- The badge row under the hero ("٤ لغات / دعم خبراء / مكالمة مجانية…") is clipped at the
  viewport edge with no horizontal scroll affordance.
- The search submit button's corner radius does not match the input it sits against.
- `/services` renders two visually identical "الكل" pills in adjacent rows (provider
  filter and category filter) — label the rows.

### 4.5 Pricing page

The layout is good and the annual maths is correct (1,599 × 10 = 15,990 ÷ 12 = 1,333 ✓),
and "شهران مجانًا" shows on the annual toggle. Missing:

- The **free tier is not shown at all** — visitors cannot see what they get without paying.
- No comparison table. Elite just says "everything in Pro" plus four lines.
- **Prices are TRY-only** while the header carries a live FX ticker and the entire
  audience is foreign. Show "≈ $34" next to each price using the rate you already fetch.
- "استشارات ذكاء اصطناعي بلا حدود" needs a stated fair-use limit.

### 4.6 Testimonials — presentation, not authenticity

**These are real clients the owner served before the site existed.** The problem is that
the presentation carries every marker of invented copy: exactly one testimonial per target
language (Syria / Russia / Iran), five stars on all three, initials only, no photos, no
dates, no links. Make the truth legible:

- First name in full plus a surname initial; a real photo or a handwritten-style monogram.
- Date and specific service: "إقامة سياحية — مارس ٢٠٢٦" instead of "طالب من سوريا".
- One concrete detail inside each quote (district name, number of days, an obstacle that
  was solved) — specificity is what separates a real testimonial from a written one.
- An odd, uneven count (5 or 7), not 4 mirroring 4 languages.
- Strongest: link a Google Business review or a consented WhatsApp screenshot. External
  proof cannot be authored.

Keep the stats but make them defensible and time-bounded: "أكثر من ١٠٠٠ حالة منذ ٢٠٢٣".

### 4.7 Accessibility

- Header nav links: `rgba(26,58,107,.7)` on `#faf8f0` ≈ **4.37:1**, below the 4.5:1
  minimum for 14px text. Raise the alpha to `.85`.
- Inactive billing toggle `rgba(26,58,107,.6)` ≈ **3.6:1** — same fix.
- Nav links are 21px tall; WCAG 2.5.8 wants 24px minimum. Add vertical padding.
- Currency ticker: animates indefinitely with no pause control (WCAG 2.2.2) and ignores
  `prefers-reduced-motion`. Add a pause button and honour the media query.
- The ticker's "آخر تحديث … المصدر:" label repeats twice per marquee cycle and collides
  with the currency pairs. Show it once, outside the scrolling region.
- Bidi: "(KVKK) حماية بياناتك" renders with the parenthesis on the wrong side. Wrap Latin
  runs inside Arabic text in `<bdi>` or `unicode-bidi: isolate`.
- On `/auth` the ticker is stuck on "جارٍ تحميل الأسعار".

### 4.8 Small things

- `theme-color` is `#1d5f9e` in `index.html` but brand navy is `#1a3a6b` — the mobile
  browser chrome does not match the site.
- The notification bell renders for logged-out visitors and does nothing.
- The cookie banner occupies a wide bottom strip covering content on every page until
  answered, and has no dismiss (×) — only accept or decline.
- The 404 back-arrow points left inside an RTL layout.
- The header logo link has no useful accessible name.

### 4.9 Auth error messages

```
unknown email  -> 404 { "error": "user_not_found" }
wrong password -> 401 { "error": "wrong_password" }
```

This lets anyone enumerate your customer list by trying emails. The README says the split
is deliberate for UX; the usual compromise is one message ("email or password is
incorrect") plus rate limiting on failed attempts. Decide consciously and document it.

---

## PHASE 5 — Make the docs match reality

Rewrite the `README` architecture section to describe what actually ships. Either:

- **(a)** deploy `server/index.mjs` and route the client through it exclusively — its
  security model is genuinely good and already tested, or
- **(b)** commit to Supabase and move every trust decision into Edge Functions with the
  `service_role` key, keeping RLS as defence in depth.

The current state — both present, neither authoritative — is the worst option, because it
describes protections that do not protect anyone. Pick one and delete the other.

---

## Definition of done

- [ ] Supabase security advisor shows no `anon`-executable `SECURITY DEFINER` function
      that lacks an internal authorization check
- [ ] `checkout_card_demo` no longer exists
- [ ] A subscription can only be activated by a verified gateway webhook or an admin
- [ ] Hero and all site images are visible on a warm-cache reload
- [ ] Password reset works end to end in all four languages
- [ ] Security headers present; `rafiq.ist` cannot be framed
- [ ] `/map` does not download map chunks while logged out; no main-thread freeze
- [ ] Each language has its own URL and correct `hreflang`
- [ ] `npm test`, `npm run typecheck`, `npm run check:i18n` all pass
- [ ] Lighthouse: performance ≥ 80, accessibility ≥ 95 on mobile
