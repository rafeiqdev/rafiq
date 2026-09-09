# Meta Ads measurement on rafiq.ist

What the site sends to Meta, when, and what it refuses to send. Written for
whoever runs the campaigns and for whoever changes this code next.

Pixel: **Rafiq.ist Pixel — `1052019674091480`**, ad account *Rafiq Istanbul Ads*
(`1007402792345650`, TRY / Europe-Istanbul), page `Rafiq.ist`.

---

## 1. The two rules that decide everything

**Nothing loads before consent.** `fbevents.js` is not fetched until the visitor
taps "accept" on the cookie banner. There is no Meta call that unloads a running
pixel, so "load only on grant" is the only honest implementation — a visitor who
switches back to "decline" gets a fresh page load with the pixel absent
(`ConsentBanner.tsx`).

**Nothing loads outside production.** The bootstrap in `index.html` refuses any
host that is not `rafiq.ist` / `www.rafiq.ist`. Preview deploys, localhost and
`*.vercel.app` aliases never enter the audiences or the conversion counts the
campaigns optimise against. This also means **you cannot test events on
localhost** — see §6.

---

## 2. Configuration

| Variable | Where | Needed? |
| --- | --- | --- |
| `VITE_META_PIXEL_ID` | Vercel → Settings → Environment Variables | **No.** The live pixel is already the built-in default in `index.html`. Set it only to point an environment at a *different* pixel. A pixel ID is public by design, so it is not a secret. |
| `VITE_META_DOMAIN_VERIFICATION` | Vercel → Settings → Environment Variables | Yes, once. |

### Adding the domain-verification token

1. Business Manager → **Brand Safety → Domains** → add `rafiq.ist`.
2. Choose **"Add a meta-tag to your website"** and copy *only the token* (the
   long string inside `content="…"`), not the whole tag.
3. Vercel → project → Settings → Environment Variables →
   `VITE_META_DOMAIN_VERIFICATION` = that token, for **Production**.
4. Redeploy (any push to `main` does it). The tag is added to the HTML at build
   time by `vite.config.ts`; with no token, **no tag is added at all**, because
   a tag containing an empty or placeholder value would fail verification and
   look like a broken claim on the domain.
5. Back in Business Manager, press **Verify**.

There is no DNS change and nothing here touches DNS.

---

## 3. What is sent

Everything goes through one function — `trackMetaEvent()` in
`src/lib/analytics.ts`. Nothing else may call `window.fbq` directly.

| Meta event | Fires when | Parameters |
| --- | --- | --- |
| `PageView` | The landing page (from the bootstrap in `index.html`), then once per in-app route change. Never twice for the same screen. | — |
| `ViewContent` | A service page `/services/:id` opens, or the AI-vs-person chooser opens for a service. | `content_name`, `content_ids`, `content_category` |
| `InitiateCheckout` | The request form opens (intent, not a lead). | `content_name`, `content_ids`, `content_category` |
| `Lead` | **Only after the database accepts the request.** A validation error, a rate-limit or a network failure sends nothing. Deduplicated per request id. | `content_name`, `content_ids`, `content_category` |
| `Contact` | A WhatsApp tap anywhere on the site, or a tap on the phone number in the footer. | `content_name` (`WhatsApp Contact` / `Phone Contact`), `content_category`, `placement` |
| `CompleteRegistration` | An account is actually created. | `method` |

`content_name` carries the **service ID** (e.g. `ikamet-renewal`), not the
translated title: one campaign then reports as one thing instead of four, and an
ID cannot contain anything a visitor typed.

### Which event to optimise a campaign for

- Message/WhatsApp campaigns → **Contact**
- Lead-generation campaigns → **Lead**
- Retargeting audiences → **ViewContent**

`Contact` and `Lead` must keep their names. Renaming them throws away the
optimisation history of every campaign already running.

---

## 4. What is never sent

Refused at the boundary, not by convention — `trackMetaEvent()` drops the
**whole event** if any value looks like an email or a phone number, or is a
nested object (which is where free text hides):

- names, phone numbers, email addresses
- passport, ikamet or ID numbers
- uploaded documents, medical details, legal or immigration case details
- AI chat message text
- search queries typed by the visitor
- UTM parameters (Meta attributes its own clicks; UTMs are for our reporting)

There is also **no Conversions API** and **no Meta access token** anywhere in the
browser bundle. Server-side conversions are not implemented; if they ever are,
the token belongs in a Vercel function, never in client code.

---

## 5. UTM parameters

Ad traffic arrives with `?utm_source=…` on the landing URL only — one tap later
the query string is gone. So the five standard parameters are read once, kept
for the rest of the visit, and attached to the first-party events that represent
commercial intent (`request_started`, `request_submitted`, `whatsapp_clicked`,
`signup`, `checkout_opened`, `payment_submitted`).

Values are lowercased, capped at 60 characters and rejected unless they are
slug-shaped, so a campaign name can never smuggle free text into the database.
They are stored for the visit only after consent, and never forwarded to Meta.

Suggested naming, so the reports stay readable:

```
?utm_source=facebook&utm_medium=paid&utm_campaign=ikamet-ar-sep&utm_content=video-a
```

---

## 6. Testing the events

**On localhost nothing fires** — by design (§1). To test:

1. Open `https://rafiq.ist` in Chrome with the
   [Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
   extension.
2. **Accept the cookie banner.** Before that, the helper correctly shows no
   pixel.
3. Events Manager → the pixel → **Test Events** → "Test browser events" → open
   `https://rafiq.ist/ar` and walk through:
   - open any `/ar/services/…` page → `ViewContent`
   - tap "Ask on WhatsApp" → `Contact`
   - open the request form → `InitiateCheckout`
   - submit it with a real name and phone → `Lead` (and only then)
   - submit it with an empty name → **no** `Lead`
   - move between pages → one `PageView` each, never two

To re-test the banner, use the **"Privacy choices"** link at the bottom of any
page; it puts the choice back.

---

## 7. Files

| File | Role |
| --- | --- |
| `index.html` | Loads the pixel after consent, on the production host only. Sends the landing `PageView`. |
| `src/lib/analytics.ts` | `trackMetaEvent()` (the only path to `fbq`), the event mapping, UTM capture, `trackPhoneContact()`. |
| `src/components/ConsentBanner.tsx` | The choice, and the reload that makes withdrawal real. |
| `src/components/SiteFooter.tsx` | "Privacy choices" link; tracked WhatsApp and phone links. |
| `src/pages/ServiceDetail.tsx` | The ad landing page: `ViewContent`, WhatsApp CTA, independence note, legal links. |
| `vite.config.ts` | Injects the domain-verification tag at build time. |
| `vercel.json` | CSP allows `connect.facebook.net` and `facebook.com`. |
| `src/i18n/locales/*.json` | Banner copy and the privacy-policy section on advertising cookies (4 languages). |

---

## 8. Known limits

- **`guide_viewed` is not stored in the first-party `events` table.** It is in
  the table's CHECK constraint already, so it will store as soon as it is used —
  no migration needed. A phone tap, however, has **no** allowed event type, so
  it reaches Meta and GA4 only. Adding one needs a migration, and migrations here
  are pasted into the Supabase SQL editor by hand.
- **No Conversions API**, so events blocked by iOS/ad-blockers are simply lost.
  Recovering them needs a server-side endpoint and a token stored in Vercel.
- **Payment/purchase events are not sent.** `Purchase` would need the checkout
  flow wired up deliberately, with the value and currency.
