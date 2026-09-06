# Rafiq Istanbul — Prioritised Action Plan

**Domain:** https://rafiq.ist · **Audit date:** 2026-09-06 · **Health score:** 64/100

The organising principle: **the site does not have a technique problem, it has a trust problem.** Google has indexed 40 of 444 URLs and is refusing to crawl the rest. Nothing in Phase 2 or beyond will move the needle until Phase 1 is done.

---

## Phase 1 — Critical: make the business real to Google (Week 1)

Everything here answers one question a search engine is currently unable to answer: *who is this?*

| # | Action | Owner | Effort | Why it's first |
|---|---|---|---|---|
| 1.1 | **Publish an About page** (`/ar/about` + 3 languages): real company name, Istanbul address, phone, email, who the team is, company registration/licence number if one exists, since when operating. | Owner supplies facts → dev builds | 3–4 h | The single highest-return item in this document. YMYL content from an unidentifiable business does not rank. |
| 1.2 | **Publish a Contact page** with phone, WhatsApp, email and address as real text (not an image, not only a form). | Owner + dev | 1–2 h | Same reason. Also the #1 thing a real visitor looks for before paying a stranger abroad. |
| 1.3 | **Put NAP in the site footer on every page** — name, Istanbul address, phone. | Dev | 1 h | Site-wide trust signal, and the basis of every local citation later. |
| 1.4 | **Create + verify a Google Business Profile** for the Istanbul address. | **Owner only** (needs their Google account + address verification) | Owner's time | Fastest route to both local visibility and entity resolution. Likely to produce enquiries before any on-site change does. |
| 1.5 | **Return real HTTP 404** for unknown routes instead of a 200 app shell. | Dev | 2–4 h | Stops an unbounded space of junk URLs competing for a crawl budget the site hasn't earned. |
| 1.6 | **Add `www.rafiq.ist`** in Vercel → Settings → Domains, redirecting to the apex (308). | **Owner approval** (account setting) | 10 min | `www.` currently fails TLS entirely — every visitor and every backlink using it is lost. |

> **Blocker to flag:** items 1.1–1.4 all assume the owner has a publishable Istanbul address, phone and company registration. If any of those don't exist yet, that becomes the actual first task — the SEO work downstream cannot substitute for it.

---

## Phase 2 — High impact: fix the signals Google is already reading (Weeks 2–3)

| # | Action | Effort | Detail |
|---|---|---|---|
| 2.1 | **Upgrade Organization → `ProfessionalService`** with `address`, `telephone`, `email`, `contactPoint`, `areaServed: Istanbul`. | 2 h | Ready-to-paste JSON-LD in `FULL-AUDIT-REPORT.md` §5. Values marked `TODO` must come from the owner — do not invent them. |
| 2.2 | **Fix `lastmod` and `dateModified`** — derive from the content's real change date, not the build timestamp. | 3–4 h | All 444 URLs currently claim to change on every deploy. Google has learned to ignore the field. |
| 2.3 | **Split the JavaScript bundle.** Route-level `React.lazy()`; move admin out of the public bundle; lazy-load Supabase. | 1–2 days | Currently 3.1 MB uncompressed / 814 KB brotli in one chunk, ~5 chunks total. Every visitor downloads the admin panel to read a service page. |
| 2.4 | **Emit hero + key images as real `<img>` in the pre-rendered HTML** with Arabic alt text, explicit `width`/`height`, `fetchpriority="high"` on the hero. | 4–6 h | The pre-rendered HTML currently contains **zero** `<img>` tags. No Google Images presence, and the LCP element is JS-dependent. |
| 2.5 | **Add `datePublished` + a named human reviewer** to guides, and cite the governing Turkish authority per topic (Göç İdaresi, Tapu ve Kadastro, Sağlık Bakanlığı, e-Devlet). | 4 h | Breaks neither content rule — not a DIY step, not a price. Strongest available citability signal for both Google and AI engines. |
| 2.6 | **Serve WebP/AVIF** with PNG fallback. | 3 h | HTML currently references `.png` 120 times, `.webp`/`.avif` zero times. |

---

## Phase 3 — Content strategy: change the page format, not the page count (Month 2)

Full SERP analysis in `findings/sxo.md`. The finding that drives this phase:

**For 4 of 6 core Arabic clusters, the winning page type is a long-form advisory guide published by a competing consultancy — not a service landing page.** Competitors win partly *because* they publish step-by-step instructions and fees, which Rafiq's rules forbid. So Rafiq cannot copy the winning format; it needs a different format that satisfies the same intent.

**The formats that work within the rules:**

1. **"Which option fits you" decision guides** — compare eligibility profiles and trade-offs. Never touches the application form.
2. **"Common rejection reasons / red flags"** — a genuine gap: not one of the six SERPs had a page built around *why applications fail*. Inherently not a how-to, not a fee disclosure, and it converts, because avoiding costly mistakes is exactly what a paid concierge sells.
3. **Anonymised client case studies** — social proof, E-E-A-T, and structurally incapable of being a DIY guide.
4. **Cost *ranges* with the variables that move the price** — "التكلفة تختلف حسب حالتك" plus what changes it, then "get your exact number" CTA.
5. **FAQPage schema built from real client questions** layered onto existing service pages (eligibility, document *lists*, timelines, risks — not how to fill them in).

**Clusters to attack, in order:**

| # | Cluster | Priority | Format |
|---|---|---|---|
| 1 | Residency risk — "أسباب رفض طلب الإقامة في تركيا", "أخطاء شائعة عند التقدم للإقامة" | **HIGH** | Risk/FAQ page + case study + CTA |
| 2 | Banking long-tail — "أفضل بنك للأجانب في تركيا", "فتح حساب بنكي عن بعد لغير المقيمين" | **HIGH** | Bank-by-bank comparison (no account-opening walkthrough) |
| 3 | Property-based residency — "إقامة العقار في تركيا" | MEDIUM | Guide + case study, cross-linked to the real-estate service |
| 4 | Real-estate buyer safety — "نصب عقاري في اسطنبول", broker commission questions | MEDIUM | Advisory page, **not** a listings page — Rafiq has no inventory to compete with the agency sites |
| 5 | Family reunification eligibility — "من يحق له لم الشمل في تركيا" | LOW-MED | FAQ page — but validate commercial fit for this audience first |

**Explicitly not recommended:** attacking "زراعة الشعر في اسطنبول" head-on. That SERP is owned by actual JCI-accredited clinics with surgeon credentials and patient galleries. Rafiq is a broker, not a clinic, and cannot match those trust signals. Redirect to "كيف تختار عيادة زراعة شعر آمنة في اسطنبول" — where being an impartial broker is the *advantage* rather than the weakness.

**Why the accounting pages are the only thing ranking:** they're English, long-tail and barely contested. That's a clue about strategy, not a success. The lesson is to find the *Arabic* long-tail equivalent — specific, under-served phrasing — rather than attacking saturated head terms against competitors with a decade of content and links.

---

## Phase 4 — Authority: the actual bottleneck (Month 2 onward, continuous)

The domain is **absent from the Common Crawl web graph** — no page in that crawl links to it. This is why 364 URLs sit in "Discovered – currently not indexed".

| Path | Effort | Note |
|---|---|---|
| **Partner links** — the hospitals, real-estate agencies, law offices and clinics Rafiq already works with | Low | Easiest and most credible links available. Costs nothing but asking. Start here. |
| Turkish business directories and chamber listings | Low | Only possible once the business is formally identifiable (Phase 1). |
| Arabic expat communities in Istanbul (Facebook groups, forums) | Medium | Genuine participation. Link-dropping will get the brand banned from the exact communities it needs. |
| Embassy / consulate resource pages | Medium | High-trust, slow. |
| Student and university groups | Medium | The student persona is already a target audience. |

**Never:** paid links, PBNs, link exchanges. On a YMYL site a manual action would be far worse than the current position.

---

## Phase 5 — Monitoring (ongoing)

| What | Cadence | Success signal |
|---|---|---|
| Search Console → Indexing | Weekly | "Discovered – currently not indexed" falling below 364; indexed count rising above 40 |
| Search Console → Performance, filtered to Arabic queries | Weekly | **Any** Arabic residency/banking/property query appearing at all. Currently there are zero. |
| Average position | Monthly | Below 46.4 |
| Re-run PageSpeed Insights | After Phase 2.3 | Blocked during this audit by API rate limits — Core Web Vitals were never actually measured |
| Google Business Profile insights | Monthly | Calls, direction requests, profile views |

---

## Do not do

- **Do not publish more pages.** 444 URLs with 40 indexed means the constraint is trust, not inventory. New pages join the back of the "not indexed" queue.
- **Do not translate more content into Russian and Farsi** until the Arabic tree is indexed and ranking. Those two trees double the crawl cost for no measured return.
- **Do not add DIY step-by-step content** to chase informational queries — the `/compare/*` pages already handle that intent correctly.
- **Do not publish exact government fees.**
- **Do not add review or rating schema** until real, verifiable reviews exist. Fabricated review markup is a manual-action risk.
- **Do not gate any content behind login.** It removes the page from search entirely.

---

## The one-sentence version

Publish who Rafiq is — address, phone, email, About page, Google Business Profile — fix the 404s, then change the Arabic content format from "service page" to "risk and decision guide", and get the first ten real links from existing partners. Everything else is secondary until Google can tell that this business exists.
