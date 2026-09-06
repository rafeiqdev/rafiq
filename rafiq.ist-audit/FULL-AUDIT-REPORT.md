# Rafiq Istanbul — Full SEO + GEO Audit

**Domain audited:** https://rafiq.ist
**Date:** 2026-09-06
**Business type:** Local service / professional service (paid concierge & coordination for foreigners in Istanbul)
**Languages:** Arabic (default + x-default), English, Russian, Farsi
**Stack:** React SPA (Vite) on Vercel, with build-time pre-rendering

> **Domain note:** `rafeiq.dev` no longer resolves (NXDOMAIN). `rafiq-istanbul-ruddy.vercel.app` 301-redirects to `rafiq.ist`. Everything below refers to the live `rafiq.ist`.

---

## SEO Health Score: **64 / 100**

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 68 |
| Content Quality | 23% | 55 |
| On-Page SEO | 20% | 85 |
| Schema / Structured Data | 10% | 65 |
| Performance (CWV) | 10% | 50 |
| AI Search Readiness (GEO) | 10% | 60 |
| Images | 5% | 40 |

The score is held up by an unusually good technical/on-page foundation and dragged down by a total absence of trust, identity and authority signals.

---

## Executive summary

This site is **not suffering from a technical SEO problem. It is suffering from a trust and authority problem.**

The engineering is genuinely good — better than most sites at this stage. Every route is pre-rendered into real HTML, canonicals are correct, hreflang is complete across four languages, JSON-LD ships in the raw HTML, and service pages carry 600–1,000 words of genuinely differentiated content. All of that works.

And yet Google has indexed **40 of 444 URLs**, and returns **262 impressions in three months** — every single one of them for English *accounting* queries that are a footnote of the business, while the core Arabic residency/banking/property/health services get nothing at all.

The reason 364 URLs sit in "Discovered – currently not indexed" is that Google found them via the sitemap, sampled the site, and concluded it was not worth spending crawl budget on. That verdict is driven by three things this site does not have: **inbound links (zero), a verifiable business identity (no address, no phone, no email, no About page), and any external mention anywhere on the web.**

Publishing more pages will not fix this. It will make it worse.

### Top 5 critical issues

1. **364 URLs "Discovered – currently not indexed"** — Google is declining to crawl the site. Root cause is authority, not technique.
2. **No business identity anywhere** — no phone, no email, no physical address, no About page, no Contact page. For immigration/money/health content (YMYL), this alone caps how far the site can rank.
3. **Zero backlink profile** — the domain does not appear in the Common Crawl web graph at all.
4. **Soft 404s on every invalid URL** — any typo'd or dead path returns HTTP 200 with the app shell, canonicalised to the homepage. Infinite indexable junk URLs.
5. **444 URLs on a zero-authority domain** — the ×4 language multiplication spends crawl budget the site has not earned.

### Top 5 quick wins

1. Publish an About page and a Contact page with a real Istanbul address, phone and email. (Highest value per hour of work on this entire list.)
2. Return a real HTTP 404 for unknown routes.
3. Add `address`, `telephone`, `email`, `contactPoint` and `areaServed` to the Organization schema; upgrade it to `ProfessionalService`.
4. Create and verify a Google Business Profile.
5. Stop restamping `lastmod` / `dateModified` on every page on every deploy.

---

## 1. Technical SEO — 68/100

### What works (verified, not assumed)

Ten routes were fetched with a Googlebot user-agent and parsed. All passed:

| Check | Result |
|---|---|
| Pre-rendered content in raw HTML (no JS needed) | ✅ all 10 routes, all 4 languages |
| Unique `<title>` per page per language | ✅ |
| Unique meta description per page per language | ✅ |
| Self-referential canonical | ✅ e.g. `/ar/services/res-tourist` → `https://rafiq.ist/ar/services/res-tourist` |
| hreflang ar/en/ru/fa + x-default | ✅ present on every page |
| Exactly one `<h1>` | ✅ |
| JSON-LD in raw HTML | ✅ 3–4 blocks per page |
| robots.txt allows all crawlers + declares sitemap | ✅ |
| Sitemaps on the correct host | ✅ 444/444 URLs on `rafiq.ist`, 0 leftover `vercel.app` |
| TTFB | ✅ 0.28 s – 0.60 s |
| `/` → `/ar` redirect | ✅ 1 hop |
| `http://` → `https://` | ✅ 2 hops total |

This is a well-built site. The pre-rendering in particular (`scripts/generate-seo-pages.mjs`) is doing exactly what it should, and it is the reason GEO readiness scores as well as it does.

### 🔴 CRITICAL — Soft 404s: every invalid URL returns HTTP 200

Verified:

```
/ar/services/does-not-exist  → 200
/ar/guides/nope              → 200
/ar/random-string-xyz        → 200
/ar/about                    → 200
/ar/contact                  → 200
```

Each serves the generic app shell: `<title>Rafiq Istanbul</title>`, `<link rel="canonical" href="https://rafiq.ist">`, no `noindex`, no pre-rendered content.

**Why it matters here specifically:** Google is already refusing to crawl this site's real pages. Handing it an unbounded space of 200-status junk URLs — every typo, every stale link, every crawler-invented path — is the opposite of what a crawl-budget-starved site needs. It also means the "Page with redirect" and "Alternative page with proper canonical tag" exclusions in Search Console will grow.

**Fix:** return a genuine `404` status for unmatched routes. On Vercel this means a server-side check against the known route list before falling through to the SPA shell, or a `vercel.json` route that 404s unknown paths under `/ar|/en|/ru|/fa`.

### 🟠 HIGH — `www.rafiq.ist` fails over HTTPS

```
https://www.rafiq.ist/  → connection failure (curl status 000)
```

`www` is not registered as a domain on the Vercel project, so there is no TLS certificate for it, even though DNS points there. Anyone who types or links `www.` gets a browser security error — and any backlink built to a `www.` URL is dead weight.

**Fix:** Vercel → Settings → Domains → Add `www.rafiq.ist` → redirect to `rafiq.ist` (308). This is an account-settings change the owner needs to make or approve.

### 🟠 HIGH — `lastmod` is a build timestamp, not a modification date

All 444 sitemap URLs carry the identical `<lastmod>2026-09-06</lastmod>`. Schema `dateModified` behaves the same way — the guide page also reports `"dateModified":"2026-09-06"`.

Every deploy tells Google that all 444 pages changed simultaneously. Google detects this pattern quickly and then discounts the signal entirely, so genuine updates stop being recognised. On a site that needs Google to re-crawl selectively, throwing away the one signal that says "this page actually changed" is expensive.

**Fix:** derive `lastmod` from the content source's real change date (git history of the data file, or a `updatedAt` field per service/guide), not from `Date.now()` at build time.

### 🟡 MEDIUM — 444 URLs is over-extended for the site's current standing

111 unique pages × 4 languages:

| Path shape | URLs | Unique pages |
|---|---|---|
| `/services/*` | 336 | 84 |
| `/guides/*` | 48 | 12 |
| `/compare/*` | 16 | 4 |
| top-level (home, faq, news, tricks, terms, privacy, refund, referrals, real-estate, health-tourism, services) | 44 | 11 |

The Russian and Farsi trees double the URL count. There is no evidence in Search Console that either is producing impressions. They are not harmful in themselves, but on a domain with no links they consume the crawl allowance that the Arabic pages need.

**Recommendation:** keep ar + en fully. Reduce ru/fa to the ~15 highest-intent pages until the Arabic tree is actually indexed and ranking, then expand back. This is a sequencing decision, not a deletion decision.

---

## 2. Indexing reality — the actual crisis

Live Google Search Console data for `https://rafiq.ist/`, read 2026-09-06:

| Metric | Value |
|---|---|
| Indexed | **40** |
| Not indexed | **370** |
| — Discovered, currently not indexed | 364 |
| — Crawled, currently not indexed | 4 |
| — Page with redirect | 1 |
| — Alternative page with proper canonical tag | 1 |

Performance, last 3 months (12 Aug – 4 Sep 2026):

| Metric | Value |
|---|---|
| Clicks | 25 |
| Impressions | 262 |
| Average CTR | 9.5% |
| Average position | **46.4** |

These numbers are unchanged from the 2026-09-02 reading — four days of no movement.

### The query list is the most important finding in this audit

Top queries by impressions:

| Query | Impressions |
|---|---|
| bookkeeping turkey | 78 |
| accounting support | 8 |
| tax provider | 7 |
| accountant in turkey | 7 |
| tax consultant istanbul | 6 |
| accounting services turkey | 6 |
| accounting services | 6 |
| tax accountants | 6 |

27 queries in total. **Every one of them is English, and every one is accounting/tax.** Not a single Arabic query for residency, ikamet, banking, property or medical tourism appears anywhere.

Two conclusions follow:

1. **The core business has zero search visibility.** Not low — zero. The Arabic pages that represent the actual product are not being served to anyone.
2. **"Discovered – currently not indexed" is a verdict about the domain, not the pages.** Google crawled a sample, found no reason to trust the site, and stopped. The 84 service pages are well-written and it does not matter yet.

`/guides/accounting` picking up impressions while everything else gets none is informative: it is the one topic where the English SERP is thin enough that even a zero-authority page can surface at position ~46. It is a hint about which SERPs are winnable first, not a strategy.

---

## 3. Content quality — 55/100

### What works — the content is genuinely better than the rankings suggest

15 Arabic service pages were fetched and measured:

| Metric | Value |
|---|---|
| Word count range | 632 – 1,067 |
| Median | 793 |
| Mean | 825 |
| Average pairwise similarity (5-word shingle Jaccard) | **12.0%** |
| Shared boilerplate across ≥80% of pages | 19.7% |

That similarity figure matters. Templated service-page networks typically run 40–70% pairwise similarity. At 12%, these pages are genuinely individually written. **Thin or spun content is not this site's problem** — a conclusion worth stating clearly, because it is the usual diagnosis and it is wrong here.

The four `/compare/` pages (`residency-diy`, `bank-account-alone`, `citizenship-consultancy`, `health-tourism-direct`) are a strong commercial idea — they engage the "should I just do this myself?" question directly, which is exactly the right move for a paid service that cannot publish DIY instructions.

### 🔴 CRITICAL — No E-E-A-T signals at all

This is the finding that explains the indexing verdict.

| Trust signal | Status |
|---|---|
| About page | ❌ does not exist |
| Contact page | ❌ does not exist |
| Physical address | ❌ nowhere on the site |
| Phone number | ❌ nowhere on the site |
| Email address | ❌ nowhere on the site |
| Named human authors | ❌ author is the Organization |
| Company registration / licence | ❌ not published |
| Reviews / testimonials | ❌ none found |
| Citations of official Turkish sources | ❌ none in schema or visible content |

The homepage HTML contains no `tel:`, no `mailto:`, no `+90` number, and no street address.

This content is about immigration status, bank accounts, property purchases and medical procedures. Google classifies that as **Your Money or Your Life**, and applies its strictest quality bar. A YMYL site that will not say who it is, where it is, or how to reach it does not clear that bar — regardless of how well the pages are written.

**This is the single highest-return fix available.** An About page with the real company name, Istanbul address, phone, email, registration details and the people behind it, plus a Contact page, is a few hours of work and it removes the biggest single reason Google is refusing this site.

### 🟡 MEDIUM — Two genuinely thin pages

| Page | Words |
|---|---|
| `/ar/tricks` | 156 |
| `/ar/real-estate` | 204 |

Both are hub pages that are mostly navigation. `/ar/real-estate` in particular is a money page for one of the highest-value services and carries 204 words.

### 🟡 MEDIUM — No dates, no sources on YMYL guides

Guides carry `dateModified` (restamped every build, so meaningless) and no `datePublished`, no named reviewer, and no citation of the Turkish authority that governs each topic (Göç İdaresi for residency, Tapu ve Kadastro for property, Sağlık Bakanlığı for health tourism, e-Devlet for official records).

Adding "reviewed on [real date]" and linking the governing official source costs nothing, breaks none of the owner's content rules, and is one of the strongest available trust signals for both Google and AI answer engines.

---

## 4. On-Page SEO — 85/100

The strongest category. Verified across 10 routes in 4 languages:

| Page | Title | Body words |
|---|---|---|
| `/ar` | رفيق إسطنبول — كل ما تحتاجه لإسطنبول في مكان واحد | 461 |
| `/en` | Rafiq Istanbul — Everything you need for Istanbul, in one place | 552 |
| `/ru` | Рафик Стамбул — Всё для жизни в Стамбуле — в одном месте | 483 |
| `/fa` | رفیق استانبول — هر آنچه برای استانبول نیاز دارید، یک‌جا | 526 |
| `/ar/services` | كل خدمات رفيق — رفيق إسطنبول | 593 |
| `/ar/services/res-tourist` | إقامة سياحية في إسطنبول \| رفيق | 975 |
| `/ar/guides/residency` | الإقامة والمعاملات في إسطنبول — دليل عملي في Türkiye | 541 |
| `/ar/health-tourism` | رفيق \| منصة التنسيق الطبي والرعاية الصحية في إسطنبول | 458 |
| `/ar/real-estate` | العقارات في إسطنبول — رفيق إسطنبول | 204 |
| `/ar/tricks` | حيل إسطنبول — رفيق إسطنبول | 156 |

Titles are descriptive, keyword-bearing, localised per language, and correctly branded. Descriptions are unique and written for humans. H1s match intent. Nothing here needs fixing.

**Minor:** homepage titles lead with the brand name. On a domain with no brand recognition yet, leading with the service ("خدمات الإقامة والمعاملات في إسطنبول — رفيق") would earn more from the few impressions the site gets.

---

## 5. Schema / Structured data — 65/100

### What ships (in raw HTML, on every page — good)

An `@graph` containing `Organization` + `WebSite` with `SearchAction`, plus per-page-type blocks:

| Page type | Blocks |
|---|---|
| Homepages | Organization + WebSite, FAQPage, WebPage |
| `/services/<id>` | Organization + WebSite, **Service**, BreadcrumbList, WebPage |
| `/guides/<topic>` | Organization + WebSite, FAQPage, BreadcrumbList, WebPage |
| Hub pages | Organization + WebSite, BreadcrumbList, WebPage |

The Organization block is well-formed and multilingual-aware:

```json
{"@type":"Organization","@id":"https://rafiq.ist/#organization",
 "name":"Rafiq Istanbul",
 "alternateName":["Rafiq","رفيق إسطنبول","Рафик Стамбул","رفیق استانبول"],
 "url":"https://rafiq.ist","logo":"https://rafiq.ist/icon-512.png",
 "availableLanguage":["Arabic","English","Russian","Persian"],
 "sameAs":["https://www.facebook.com/profile.php?id=61593278548147",
           "https://www.instagram.com/rafiq.ist/"]}
```

### 🟠 HIGH — Organization is missing every contact and location property

Absent: `address`, `telephone`, `email`, `contactPoint`, `areaServed`, `priceRange`, `foundingDate`, `openingHoursSpecification`.

These are exactly the properties Google and AI answer engines use to resolve a business as a real entity. Their absence is the schema-level expression of the same problem as the missing About page.

`sameAs` lists only Facebook and Instagram — and the Facebook entry is a numeric `profile.php?id=` URL rather than a named page, which is a weaker signal.

### 🟠 HIGH — Not typed as a local/professional service

The business physically operates in Istanbul — bank escorts, hospital visits, property viewings, government appointments. `Organization` is the generic parent type. `ProfessionalService` (a subtype of `LocalBusiness`) with `areaServed` set to Istanbul and its districts describes what this business actually is, and unlocks local-pack eligibility that `Organization` does not.

**Recommended replacement** (values marked `TODO` must come from the owner — do not invent them):

```json
{
  "@type": "ProfessionalService",
  "@id": "https://rafiq.ist/#organization",
  "name": "Rafiq Istanbul",
  "alternateName": ["Rafiq", "رفيق إسطنبول", "Рафик Стамбул", "رفیق استانبول"],
  "url": "https://rafiq.ist",
  "logo": "https://rafiq.ist/icon-512.png",
  "image": "https://rafiq.ist/og-cover.png",
  "telephone": "TODO +90...",
  "email": "TODO",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "TODO",
    "addressLocality": "TODO district",
    "addressRegion": "İstanbul",
    "postalCode": "TODO",
    "addressCountry": "TR"
  },
  "areaServed": { "@type": "City", "name": "Istanbul" },
  "availableLanguage": ["Arabic", "English", "Russian", "Persian"],
  "contactPoint": [{
    "@type": "ContactPoint",
    "contactType": "customer service",
    "telephone": "TODO +90...",
    "availableLanguage": ["Arabic", "English", "Russian", "Persian"]
  }],
  "sameAs": ["TODO named Facebook page URL", "https://www.instagram.com/rafiq.ist/"]
}
```

No `AggregateRating` or `Review` markup should be added until real, verifiable reviews exist. Fabricated review markup is a manual-action risk.

---

## 6. Performance — 50/100

Google PageSpeed Insights was rate-limited during this audit (`PSI rate limit exceeded`) on repeated attempts, so **no Lighthouse score or CrUX field data was obtained**. The figures below are direct measurements, not estimates.

### Server response — good

TTFB across 10 routes: **0.28 s – 0.60 s**. Vercel's edge is doing its job.

### 🟠 HIGH — The JavaScript bundle is very large and barely split

Measured transfer sizes with brotli (what a real user downloads):

| Asset | Transferred (br) | Uncompressed |
|---|---|---|
| `index-D9mHIkRm.js` | **814 KB** | **3,125 KB** |
| `supabase-Be25SE7n.js` | 55.9 KB | 212 KB |
| `react-vendor-1B7PQhyt.js` | 47.3 KB | 142 KB |
| `index-CbWUKU-l.css` | 26.8 KB | 161 KB |
| `i18next-BIAYtJ4h.js` | 17.4 KB | 52.7 KB |
| `react-router-DY59H8Wx.js` | 9.0 KB | 23.3 KB |
| **Total** | **948 KB** | **3,716 KB** |

Only 5 JS chunks are referenced on the homepage — there is effectively **no route-level code splitting**. Every visitor downloads and parses the entire application, including the admin control centre, the real-estate module, the medical-tourism flow and the chat, in order to read one service page.

3.1 MB of JavaScript to parse and execute is seconds of blocked main thread on the mid-range Android phones this audience actually uses, on Turkish and Middle Eastern mobile data. That directly damages INP and TBT, and it is felt hardest by the users furthest from Istanbul.

**Fix, in order of value:**
1. Route-level `React.lazy()` splitting so `/ar/services/<id>` does not load the admin, real-estate or medical-tourism code.
2. Split the admin bundle out entirely — it should never reach a public visitor.
3. Load Supabase lazily; a static service page does not need the database client at first paint.
4. Audit `index-D9mHIkRm.js` for large dependencies (animation libraries, icon sets, date/locale data) that can be dynamically imported.

### 🟡 MEDIUM — First-visit experience is gated behind a loader

There is a `#boot-loader` overlay and a cookie-consent panel that occupies roughly the bottom quarter of the mobile viewport on first load (confirmed in `screenshots/home_ar_mobile_fold.png`). Combined with a 3.1 MB bundle, the first-visit path to readable content is long.

---

## 7. Images — 40/100

### 🟠 HIGH — Zero `<img>` tags in the pre-rendered HTML

Across all 10 pre-rendered pages, the raw HTML contains **0 `<img>` elements**. Every image — including the homepage hero — is injected by React after hydration or applied as a CSS background.

Consequences:
- No alt text exists for any crawler that reads the pre-rendered HTML.
- The site is effectively invisible to Google Images, which for "شقق للبيع في اسطنبول" and medical-tourism queries is a meaningful traffic source being left entirely unclaimed.
- The LCP element on the homepage is JavaScript-dependent, which is the worst case for LCP.

The pre-rendering script is already solving this problem for text. Extending it to emit the hero and key content images — with real Arabic alt text, explicit `width`/`height`, and `fetchpriority="high"` on the hero — would be a contained change with a direct LCP payoff.

### 🟡 MEDIUM — PNG only

The pre-rendered HTML references `.png` 120 times and `.webp`/`.avif` zero times, even though `logo-rafiq.webp` exists in `public/`. Serving WebP/AVIF with PNG fallback would cut image bytes substantially for the same visual result.

`og-cover.png` is 53 KB and serves correctly — social previews are fine.

---

## 8. AI Search Readiness (GEO) — 60/100

### What works — the plumbing is right

This is where the pre-rendering investment pays off, and it is worth being precise about why.

| GEO requirement | Status |
|---|---|
| Content readable without executing JavaScript | ✅ **verified on all 10 routes** |
| AI crawlers permitted in robots.txt | ✅ wildcard `Allow: /`, plus explicit `OAI-SearchBot` |
| GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Applebot | ✅ all permitted (nothing blocked) |
| Structured data in raw HTML | ✅ Organization, WebSite, Service, FAQPage, BreadcrumbList |
| `llms.txt` published and valid | ✅ correct host, well-formed |
| `llms-full.txt` published | ✅ 861 KB |
| Multilingual entity naming (`alternateName`) | ✅ all 4 scripts |

Most SPA sites fail the first requirement outright — an AI crawler that does not run JavaScript sees an empty shell. This site passes it. That is a real asset and it should not be undone.

Worth stating plainly: **`llms.txt` is ignored by Google Search.** It has some value for ChatGPT and Perplexity, but it is not an indexing mechanism and should not be treated as one.

### 🔴 CRITICAL — The brand cannot be resolved as an entity

An AI answer engine asked "من هو رفيق إسطنبول؟" or "who can help me with residency in Istanbul?" needs to establish that Rafiq is a real, locatable, accountable business before recommending it. The available evidence:

- No address, phone or email anywhere on the site.
- No About page, no Contact page.
- `sameAs` limited to Facebook (numeric ID URL) and Instagram.
- **Absent from the Common Crawl web graph entirely** — no third-party page anywhere in that crawl links to or mentions this domain.

With no external corroboration and no self-published identity, there is nothing for an AI engine to ground a recommendation in. Well-written service pages do not compensate for this — if anything, confident claims from an unidentifiable source read as a negative signal.

### 🟠 HIGH — `llms-full.txt` is 861 KB

That is very large for a file intended to be fetched and read in a single pass. Practical guidance: keep `llms-full.txt` to the highest-value content and stay well under ~100 KB, or split it per topic and index the parts from `llms.txt`.

### 🟠 HIGH — Freshness signals are self-defeating

Every page reports `dateModified` equal to the last build date, and every sitemap URL carries the same `lastmod`. AI answer engines weight recency when choosing what to cite. A page claiming to be updated today, every day, with content that did not change, trains the engine to ignore the field.

### 🟠 HIGH — The guide pages are the weakest layer, and they are the entry point

Detailed passage-level scoring is in `findings/geo.md`. The key result:

`/ar/guides/residency` — the page most likely to be a first entry point for an informational Arabic query — consists largely of meta-language *about Rafiq's own process*, with almost no concrete facts, numbers or named authorities. There is very little in it an AI engine could lift into an answer.

By contrast `/ar/services/res-tourist` is dense and genuinely citable. The layer that gets found is weaker than the layer that converts, which is backwards.

### 🟡 MEDIUM — Passages are too short to be cited

Extracted passages measure roughly **30–70 words**, against a practical target of ~134–167 words for a self-contained citable answer. The content is accurate but atomised into fragments that don't stand alone when lifted out of the page.

### 🔵 LOW — Register is inconsistent across the site

`/ar/faq` is written in colloquial Arabic while the guides and service pages are in Modern Standard Arabic. For a model cross-checking facts across pages, the shift reads as lower internal consistency. Worth aligning, but far behind everything above it.

### 🟠 HIGH — No official-source citations

The strongest available citability signal for this exact content is the one currently missing: linking each topic to the Turkish authority that governs it — Göç İdaresi Başkanlığı for residence permits, Tapu ve Kadastro for property, T.C. Sağlık Bakanlığı for health-tourism authorisation, e-Devlet for official records.

This breaks none of the owner's content rules. It is not a DIY instruction and it is not a price. It is the citation that makes the surrounding claims quotable.

---

## 9. Local SEO

Rafiq is a physical service business in Istanbul — bank escorts, hospital appointments, property viewings, government offices — and it currently has **no local SEO presence of any kind**.

| Signal | Status |
|---|---|
| NAP (name/address/phone) on site | ❌ none |
| Google Business Profile | ❌ none found |
| `LocalBusiness`/`ProfessionalService` schema | ❌ typed as generic `Organization` |
| `areaServed` | ❌ absent |
| District-level pages | ❌ none |
| Local citations / directories | ❌ none found |
| Reviews | ❌ none |

A verified Google Business Profile with real reviews would likely produce more qualified enquiries in the next 90 days than any on-site change in this report. It is also the fastest route to being resolvable as an entity by both Google and AI engines.

**Note:** creating and verifying a GBP requires the owner's own Google account and a verifiable Istanbul address. It is not something that can be done from the codebase.

---

## 10. Backlinks & authority

| Source | Result |
|---|---|
| Common Crawl web graph (cc-main-2026-jan-feb-mar) | **Domain not present.** No PageRank, no harmonic centrality, no host count. |
| Moz API | Not configured — DA/PA and spam score unavailable |

Absence from the Common Crawl graph means no page in that crawl links to `rafiq.ist`. Combined with the historical `rafeiq.dev` domain now being dead, any links that ever existed to the old domain are lost — a dead domain cannot pass equity.

This is the root cause of "Discovered – currently not indexed". Google allocates crawl budget roughly in proportion to demonstrated importance, and this domain has demonstrated none.

**Realistic, ethical link paths for this business:**
1. Arabic expat communities in Istanbul (Facebook groups, forums) — genuine participation, not link drops.
2. Turkish business directories and chamber listings once the business is formally identifiable.
3. Partner sites — the hospitals, real-estate agencies and law offices Rafiq already works with. These are the easiest and most credible links available and they cost nothing but asking.
4. Embassy and consulate resource pages for Arabic-speaking countries.
5. Student/university groups (the student persona is already a target).

No paid links, no PBNs. On a YMYL site those carry manual-action risk that would be far worse than the current situation.

---

## 11. What NOT to do

Given the owner's content rules and the state of the site, these common recommendations would be actively harmful here:

- **Do not publish more pages.** 444 URLs with 40 indexed means the constraint is trust, not inventory. New pages join the "Discovered – not indexed" queue.
- **Do not add DIY step-by-step procedure content** to chase informational queries. It violates the business model and the `/compare/*` pages already handle that intent correctly.
- **Do not publish exact government fees.**
- **Do not add review or rating schema** until real reviews exist.
- **Do not hide content behind login** for any reason — it removes the page from search entirely.
- **Do not translate more content into Russian and Farsi** until Arabic is indexed and ranking.

---

## Method and limitations

**Verified directly:** raw HTML of 10 routes fetched with a Googlebot user-agent and parsed for titles, descriptions, canonicals, hreflang, JSON-LD, H1s and body text; 15 Arabic service pages fetched and measured for word count and pairwise shingle similarity; HTTP status and redirect behaviour for 4 invalid paths, apex, www and http; live sitemaps parsed (444 URLs, host and lastmod checked); asset transfer sizes measured with and without brotli; Common Crawl web-graph lookup; live Google Search Console indexing and performance reports read on 2026-09-06; 42 screenshots captured at desktop and mobile widths.

**Not obtained:**
- **Lighthouse scores and CrUX field data** — PageSpeed Insights returned `PSI rate limit exceeded` on every attempt. Core Web Vitals are therefore inferred from measured bundle sizes and TTFB, not measured directly. This should be re-run.
- **Backlink DA/PA and spam scores** — no Moz API key configured. Only the Common Crawl graph was available.
- **Google Business Profile status** — could not be confirmed either way from external sources.
- Whether the owner has an Istanbul address, phone and company registration that *can* be published. Every recommendation above assumes they exist; if any do not, that changes the sequencing.
