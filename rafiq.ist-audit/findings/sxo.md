# SXO Findings — rafiq.ist (Arabic core-service queries)

**SXO Gap Score is separate from any SEO Health Score.** Scope: this file answers one question — for the core Arabic queries Rafiq needs to win, who actually ranks, what page TYPE wins, and can a paid-service landing page realistically break in given the owner's no-DIY-steps / no-exact-fees constraints.

## Headline finding (lead with this)

**CRITICAL page-type mismatch on every high-value Arabic cluster except real-estate-listing and clinic-service queries.** Google is not rewarding "paid-service landing pages" for these queries — it is rewarding long-form advisory **Blog/Guide content published by competing consultancy agencies** (Hybrid type per taxonomy: educational depth + commercial CTA), **actual property-listing inventory** for real estate, and **direct clinic service pages** for hair transplant. Rafiq's current service pages (630–1070 words, Service-Page format per `page-type-taxonomy.md` #5: description + CTA, no case studies, no FAQ depth) are structurally the wrong shape for 4 of 6 clusters tested — and the site has zero backlinks to compensate with authority the way the incumbents do.

## 1. SERP composition per query (6 SERPs checked, WebSearch-summarized results, 2026-09-06)

| Query | Dominant SERP composition | Winning page type | Gov/official sites present? |
|---|---|---|---|
| الإقامة السياحية في تركيا | muwajihi.com, trustusconsultancy.com (×2), hajjajj.com, garsconsulting.com — all consultancy/agency **blogs** | Blog/Guide (long-form, "2026" freshness signal, step-by-step + often exact fees) | None visible in top results |
| تمديد الإقامة في اسطنبول | enabbaladi.net (news), emiristanbul.com (agency), muwajihi.com, istanbulservices.com (agency blog), newturkpost.com (news) | News/Blog mix | None visible |
| فتح حساب بنكي في تركيا للأجانب | Wise.com (global fintech, huge authority), fanarturk.com, trustusconsultancy.com, **turkiyeatlas.com (forum thread)**, investment.com.tr (consultancy), culture-money.com | Blog/Guide + one forum thread + one dominant global brand | None visible |
| شراء عقار في اسطنبول | turkeyexpert.com, imtilak.net, portokoza.com, mudonemlak.com, numberoneproperty.net — **real-estate agencies with live property inventory**; one guide article (imtilak "خطوات شراء عقار") | Product/Listing pages (agency inventory), not blog | None |
| زراعة الشعر في اسطنبول | veraclinic.net, estepera.com, turkey-care.com, elithair.com — **actual clinics**; ilajak.com is a "أفضل مراكز" listicle | Service Page (real clinics with JCI/accreditation claims, patient volume, galleries) | None |
| لم الشمل في تركيا | alaraby.co.uk (major news outlet), studyshoot.com, dalilarabtr.com, turk.wiki (×2), immig-us.com | Blog/Guide + news + wiki-style community sites | None |

**Notable pattern:** no `.gov.tr` / e-ikamet / göç idaresi page appeared in any of the six result sets returned. The Turkish state's own transactional portals are not competing for informational search intent at all — the vacuum is filled entirely by private consultancy/agency content, which is exactly the type of competitor Rafiq is up against, not a neutral government source.

## 2. Page-type mismatch by cluster

Rafiq's target pages are classified as **Service Page** (taxonomy #5: process description + contact CTA, no case studies/FAQ depth per established facts: 630–1070 words, differentiated but not structured as guides).

| Cluster | SERP dominant type | Rafiq type | Mismatch severity |
|---|---|---|---|
| Residency (إقامة سياحية / تمديد) | Blog/Guide (Hybrid) | Service Page | **CRITICAL** — missing FAQ/step depth, no schema, no freshness cues competitors use ("2026") |
| Banking (فتح حساب بنكي) | Blog/Guide + forum + 1 mega-brand | Service Page | **CRITICAL** — plus impossible to out-authority Wise.com head-on |
| Family reunification (لم الشمل) | Blog/Guide/News/Wiki | Service Page (if it exists at all for this topic) | **HIGH** — also a monetization-fit question, see §5 |
| Real estate (شراء عقار) | Product/Listing inventory | Service Page, no live listings | **HIGH** — wrong content type (advisory copy vs. actual inventory) |
| Hair transplant (زراعة الشعر) | Service Page (real clinics) | Service Page (broker, not the clinic) | **MEDIUM on type, CRITICAL on trust/E-E-A-T** — type matches but Rafiq lacks the accreditation/gallery/surgeon-credential signals real clinics show |

## 3. The core tension — DIY-steps ban + no-exact-fees ban vs. what actually ranks

Every winning residency/banking/reunification result in this SERP set **does** include step-by-step application instructions, and several show or reference cost figures. That is a direct piece of why they rank: they satisfy the literal informational intent behind the query. Rafiq's own content rules (`CLAUDE.md`: no DIY steps, no exact government fees) forbid replicating the exact winning format.

**What CAN win without violating either rule** — practical, specific:

1. **"Which option fits you" decision-guide, not "how to apply."** E.g. "الإقامة السياحية أم إقامة العقار: كيف تختار؟" — compares eligibility profiles and trade-offs, never touches the application form itself. Matches Hybrid taxonomy type (education + CTA) without being a how-to.
2. **"Common rejection reasons / red flags" framing.** This is a genuine content gap: none of the 6 SERPs returned a page built around *why applications get rejected* or *how to avoid losing money to a bad agent/clinic/broker*. Risk-framing is inherently NOT step-by-step and NOT fee-disclosure, and it converts hard because it manufactures urgency for the exact thing a paid concierge sells (avoiding mistakes).
3. **Case-study / "قصة عميل" narrative pages.** Anonymized real client journey — satisfies E-E-A-T and search intent for social proof, is a Service-Page required element per taxonomy (#5) that Rafiq currently lacks, and structurally cannot be a DIY guide.
4. **Cost RANGE + "get your exact number" CTA**, framed as "التكلفة تختلف حسب حالتك" with a short list of the variables that move price (property size, insurance provider, agent used) — informational enough to satisfy searcher curiosity, never an exact government fee.
5. **FAQPage schema built from real client questions** (eligibility, required documents *list* — not the how-to-fill-them — timelines, risks) layered onto the existing Service Page. This adds the depth/structure Google rewards without adding a walkthrough.

Recommend `/seo content` for a deeper E-E-A-T buildout plan once this format shift is agreed, and `/seo schema` to generate the FAQPage/Article schema for these new sections.

## 4. Why the accounting pages are the only thing getting impressions

"bookkeeping turkey," "accountant in turkey," "tax consultant istanbul" are **English, long-tail, low-competition** queries. They are not up against a decade of Arabic consultancy content-marketing machines (trustusconsultancy, muwajihi, imtilak) each publishing dozens of "2026"-refreshed guides, nor a global fintech brand (Wise), nor forums. A plain Service Page is *enough* to get impressions there — not because it's a good page, but because almost nothing else is competing for that specific phrase.

**What this reveals:** Rafiq's zero-backlink domain (established fact) cannot win broad, high-volume Arabic head terms (الإقامة السياحية في تركيا, شراء عقار في اسطنبول) against entrenched content operations in any realistic near-term. The winnable topics are the ones where competition density is low — regardless of language — which means the strategy must shift from "attack the big obvious Arabic head terms" to "find the Arabic equivalent of the accounting long-tail: specific, lower-volume, under-served phrasing."

## 5. Ranked Arabic query clusters to attack first

| # | Cluster | Priority | Recommended page format | Why |
|---|---|---|---|---|
| 1 | Long-tail residency risk queries — e.g. "أسباب رفض طلب الإقامة في تركيا", "أخطاء شائعة عند التقدم للإقامة" | **HIGH** | Hybrid: risk/FAQ page + case study + CTA | Zero competitors in this SERP set own the "rejection reasons" angle; naturally avoids DIY-steps ban; direct commercial fit (avoid mistakes → hire us) |
| 2 | Banking long-tail — "أفضل بنك للأجانب في تركيا", "فتح حساب بنكي عن بعد لغير المقيمين" | **HIGH** | Comparison/Hybrid page (bank-by-bank pros/cons, no step-by-step account opening) | Broad term is blocked by Wise; long-tail comparison format is still blog-dominated but thinner competition, and comparison tables are a taxonomy-recognized winning format |
| 3 | Residency sub-type "إقامة العقار في تركيا" (property-based residency, ties to real-estate vertical) | **MEDIUM** | Hybrid guide + case study, cross-linked to real-estate service page | Lower-volume than generic "إقامة سياحية," bridges two service lines Rafiq already sells, avoids competing with the biggest guide sites head-on |
| 4 | Real estate buyer-safety angle — "عمولة السمسار العقاري في اسطنبول للأجانب", "نصب عقاري في اسطنبول" (scam/fraud avoidance) | **MEDIUM** | Advisory/Hybrid page, NOT a listings page (Rafiq has no inventory to compete with imtilak/portokoza) | Real estate broad term needs live inventory Rafiq doesn't have (HIGH severity gap flagged in §2); the safety/vetting angle sidesteps that entirely and matches the concierge value prop |
| 5 | Family reunification eligibility/documents (not full guide) — "من يحق له لم الشمل في تركيا" | **LOW-MEDIUM** | Hybrid FAQ page | Genuine search volume and content gap, but flag business-model risk: this audience segment (Syrians under temporary protection) may have lower willingness/ability to pay for a paid concierge — validate commercial fit before investing content effort |

**Explicitly NOT recommended for near-term head-on attack:** "زراعة الشعر في اسطنبول" broad term — **CRITICAL** mismatch on trust signals (real JCI-accredited clinics with surgeon galleries dominate; Rafiq is a broker, not a clinic). Redirect medical-tourism content toward "كيف تختار عيادة زراعة شعر آمنة في اسطنبول" (clinic-vetting/red-flags angle) where impartial-broker positioning is the differentiator instead of the liability.

## Limitations

- WebSearch results here are AI-summarized snapshots of Google results, not raw SERP HTML — featured snippet / PAA / AI Overview / local-pack presence could not be directly confirmed for any of the 6 queries, and exact ranking positions are unknown.
- The live rafiq.ist target pages were not re-fetched/re-rendered in this session; page-type and word-count claims for Rafiq rely on the established facts provided in the task brief, not a fresh `render_page.py` / `parse_html.py` pass.
- No keyword-volume tool was used; cluster prioritization is based on competitive-density inference from SERP composition, not verified search volume.
- Persona scoring, wireframes, and a full 7-dimension Gap Analysis were out of scope for this pass per the task's narrow question — only the mismatch/format question was answered in depth.

Next step: `/seo google report` to generate a PDF version of this analysis, or `/seo content` for a full E-E-A-T buildout plan on the recommended Hybrid/FAQ format.
