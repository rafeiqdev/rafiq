# rafiq.ist — Technical SEO, Round 2 (gap-fill audit)

Date: 2026-09-08. Scope: hreflang reciprocity, orphan/coverage, redirect hygiene, response headers, crawl-budget shape. Items already closed by round 1 (pre-render confirmed, canonicals self-referential/correct, unique titles, TTFB 0.28-0.60s, robots.txt clean, IndexNow key 200) are **not** re-verified here.

Carried-forward open items (confirmed still open, not re-investigated):
- Unknown URLs return HTTP 200 soft-404 with root canonical — **Critical**, still open.
- `www.rafiq.ist` has no TLS certificate — confirmed again this round: `curl https://www.rafiq.ist/ar` fails outright (curl error 35, SSL connect error, no handshake completes). **Critical**, still open.
- `https://rafiq-istanbul.vercel.app` returns 503 but remains indexed by Google — not re-tested. **High**, still open.
- `/llms-full.txt` is 861 KB — not re-tested. **Low/Medium**, still open.

---

## 1. Hreflang reciprocity — PASS (clean)

Sampled 25 URLs: all 4 language homepages, `/about`, `/contact`, `/services/res-tourist`, `/guides/legal`, `/compare/residency-diy` (each ×4 languages), plus `/ar/services`.

- Every sampled page's `<head>` carries the full 5-tag set (`ar`, `en`, `ru`, `fa`, `x-default`) and every alternate **reciprocates** — fetched each named alternate directly and confirmed it points back with the identical 5-URL set. No one-way or missing alternates found in the sample.
- `x-default` resolves to the `/ar` variant on every single page checked, e.g.:
  `<link rel="alternate" hreflang="x-default" href="https://rafiq.ist/ar/services/res-tourist" />`
- Sitemap `xhtml:link` entries match the in-page `<head>` tags exactly — checked `/ar/guides/legal`, `/ar/guides/accounting`, `/ar/services/res-tourist`. No disagreement between sitemap and rendered HTML found.
- `<html lang>`/`dir` also correctly flips per language (`ar`/`fa` → `rtl`, `en`/`ru` → `ltr`).

**Could not verify:** exhaustive coverage of all 452 URLs — this is a 25-URL sample across 6 URL types, not a full crawl. No contradiction pattern was found in the sample, so treat as a strong pass, not a proven 100%.

---

## 2. Orphan and coverage check — CRITICAL finding

Compared sitemap URLs against `<a href>` links actually present in the pre-rendered HTML of `/ar` (homepage), `/ar/services`, and the `<footer>`.

**Finding A — main navigation is not crawlable (Critical).** The homepage HTML contains a `<nav aria-label="الرئيسية">` element, but it holds **zero** `<a href>` tags — confirmed by extracting every `href="..."` in the raw pre-rendered `/ar` document (39 total: 24 content links + JS/CSS asset links + 4 language self-links + favicon/manifest). The nav must be building its menu client-side only (buttons/JS handlers, not `<Link>` anchors).

**Finding B — `<footer>` is guides/compare-only, not a site footer.** The only `<footer>` element present is an SEO block titled "كل الأدلة" containing exactly 12 guide links + 4 compare links. It carries no legal/trust links at all.

**Result:** these sitemap URLs have **zero pre-rendered internal links pointing to them** anywhere on the homepage or services page:
```
/about  /contact  /faq  /news  /privacy  /referrals  /refund  /terms
```
×4 languages = **32 orphaned URLs (7% of the 452-URL sitemap)** — and this includes the About and Contact pages, which round-1 flagged as newly-shipped trust content. They exist and are indexable, but nothing in the crawlable HTML points to them, so Google has to discover them purely from the sitemap with no internal PageRank flowing in.

**Finding C — 2 orphaned service pages (High).** `/ar/services` lists 82 of the 84 sitemap-listed `/ar/services/*` slugs. Missing from the visible link list:
```
/ar/services/daily-concierge
/ar/services/tour-vip
```
×4 languages = 8 more orphaned URLs, sitemap-only.

**Reverse direction (linked but not sitemapped):** none found — every guide, compare, and service link present on `/ar` and `/ar/services` has a matching sitemap entry (`svc_linked.txt` 82 URLs vs `svc_sitemap.txt` 84 URLs, guides 12/12, compare 4/4, all reciprocal).

**Could not verify:** orphan status of the other ~44 individual guide sub-slugs beyond the 12 category guides linked in the footer (footer links guide *categories*, not sub-guides — round 1's guide-page structure wasn't re-walked), and orphan status of the deeper `/compare/*` and `/services/*` pages beyond the two homepage/services views checked.

---

## 3. Redirect hygiene — Medium finding

- Sampled 15 URLs spanning both sitemaps (home, about, contact, a service, a guide, a compare page, tricks, faq, news, terms, `res-tourist` ×2 languages, `bank-account`, `real-estate`): **all 15 return HTTP 200 directly, zero redirect hops.** Good — no crawl-budget waste from the sitemap itself.
- `http://rafiq.ist/ar` → `308` → `https://rafiq.ist/ar`. Correct.
- `/ar/` and `/ar/services/` (trailing slash) both return `200` directly rather than redirecting to the canonical no-slash form — but the `<link rel="canonical">` on `/ar/services/` correctly points to `https://rafiq.ist/ar/services`, so it self-corrects via canonical rather than via redirect. Not broken, but two crawlable HTTP-200 URLs exist for one piece of content instead of one. **Low.**
- **Broken case-handling (Medium, new finding):** `https://rafiq.ist/AR` → `308` → `https://rafiq.ist/ar/AR` (not `/ar`) → that URL then returns `200` as the generic soft-404 shell (`<title>Rafiq Istanbul</title>`, `<link rel="canonical" href="https://rafiq.ist" />`). Same pattern on `https://rafiq.ist/Ar/Services` → `308` → `https://rafiq.ist/ar/Ar/Services` (also lands on the soft-404 shell). The locale-prefixing middleware prepends `/ar/` without lowercasing or validating the original segment, so any uppercase or mixed-case request produces a nonsensical redirect target rather than a clean redirect to the correct lowercase page. Low real-world traffic impact (crawlers rarely request uppercase paths), but combine this with the already-open "unknown URL → 200 soft-404" issue and it's a second path feeding junk URLs into that same soft-404 trap.

---

## 4. Response headers — Mixed

Checked `GET https://rafiq.ist/ar` and a hashed static asset `GET https://rafiq.ist/assets/index-iMa56HcF.css`.

Good:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — strong HSTS.
- `Content-Encoding: br` — Brotli active on both HTML and CSS.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` — solid security baseline.
- Edge caching is working: `Age: 32`, `X-Vercel-Cache: HIT` on the HTML.
- No `X-Robots-Tag` header — not blocking anything, indexability is controlled via in-HTML meta/canonical as already confirmed.

**Finding (Medium/High — CWV-relevant):** the hashed, content-addressed static asset (`index-iMa56HcF.css`, filename changes on every rebuild) is served with:
```
Cache-Control: public, max-age=0, must-revalidate
```
identical to the HTML document's own header. A filename-hashed asset should be `Cache-Control: public, max-age=31536000, immutable` — it can never change without a new filename, so there is zero reason to force revalidation. As shipped, every repeat visit re-validates every JS/CSS asset (extra round-trips) instead of reading straight from the browser cache, which directly hurts repeat-view LCP/INP and wastes bandwidth. This looks like a Vercel output-config gap (missing a `headers` rule for `/assets/*`) rather than a per-file issue — likely affects all hashed bundles, not just this one file.

- `Content-Security-Policy-Report-Only` is present but not enforced (Report-Only mode) — not a crawling issue, flagged for completeness only.

**Could not verify:** headers on non-HTML routes other than the one CSS file sampled (JS bundles presumably share the same misconfiguration but weren't individually checked); no server-timing/CWV field data was pulled (out of scope for source inspection).

---

## 5. Crawl-budget shape (452 URLs × 4 languages)

Per-language breakdown (452 total ÷ 4 ≈ 113/language):

| Segment | Total (4 langs) | Per language |
|---|---|---|
| `/services/*` | 340 | 85 |
| `/guides/*` | 48 | 12 |
| `/compare/*` | 16 | 4 |
| home + about/contact/faq/news/privacy/referrals/refund/terms/tricks/real-estate/health-tourism | 44 | 11 |

`/services/*` is 75% of the entire sitemap. On a domain with **zero backlinks** (per the Sept-2026 GEO audit), this is the shape most likely to dilute crawl budget across hundreds of thin, near-identical service pages before Google trusts the domain enough to crawl deeply.

**Lowest-value, first-candidates-to-drop-or-noindex:**
1. **The 2 already-orphaned service slugs** (`daily-concierge`, `tour-vip` ×4 languages = 8 URLs) — no internal link points to them at all, so they're pure crawl-budget cost with no supporting PageRank. Either link them from `/services` or drop them from the sitemap.
2. Any other single-digit-search-volume `/services/*` micro-slugs bundled under `daily-*`/`biz-*` prefixes that read as line-item variants of a broader service rather than distinct search intents — round 1 didn't audit per-slug search demand, so this needs a keyword-volume pass before pruning further, but structurally these are the weakest 340 URLs in the sitemap.
3. **Do not drop the 8 orphaned trust pages** found in section 2 (`about/contact/faq/news/privacy/referrals/refund/terms`) — these are high-value, not low-value; the fix there is to add internal links, not remove them from the sitemap.

---

## Priority summary

| Priority | Finding |
|---|---|
| Critical (carried) | Unknown URLs return 200 soft-404 with root canonical |
| Critical (carried) | `www.rafiq.ist` has no TLS cert at all |
| Critical (new) | Main nav + footer carry zero links to about/contact/faq/news/privacy/referrals/refund/terms — 32 URLs (7% of sitemap) are internal-link orphans, including the newly-shipped About/Contact pages |
| High (carried) | `rafiq-istanbul.vercel.app` returns 503 but stays indexed |
| High (new) | 2 orphaned service pages (`daily-concierge`, `tour-vip` ×4 languages) unlinked from `/services` |
| Medium/High (new) | Hashed static assets served `Cache-Control: max-age=0, must-revalidate` instead of `immutable` — repeat-visit LCP/INP cost |
| Medium (new) | Uppercase/mixed-case path requests (`/AR`, `/Ar/Services`) redirect to malformed double-segment URLs that dead-end on the soft-404 shell |
| Low (new) | Trailing-slash variants (`/ar/`, `/ar/services/`) serve 200 directly instead of 301/308-ing to the canonical no-slash form (mitigated by correct canonical tag) |
| Low (carried) | `/llms-full.txt` is 861 KB |
| Pass | hreflang reciprocity, sitemap vs in-head hreflang agreement, x-default → `/ar` everywhere (25-URL sample) |
| Pass | Sampled sitemap URLs (15/15) return 200 directly, no redirect chains |

## What was not verified this round
- Orphan status of individual guide sub-slugs and deeper compare/service pages beyond the homepage + `/services` index views.
- Hreflang correctness beyond the 25-URL sample (no full-sitemap crawl).
- Header behavior on JS bundles beyond the one CSS file sampled.
- Any lab/field Core Web Vitals measurement (Lighthouse/CrUX) — this round is source/header inspection only, per scope.
