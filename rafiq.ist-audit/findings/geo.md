# GEO (Generative Engine Optimization) Findings — rafiq.ist

Scope: this file covers only what was newly investigated for this audit (passage
citability, llms-full.txt size, entity resolution, YMYL authority gap, freshness
signal integrity, prioritized fixes). Crawler access, JSON-LD presence, SSR/CSR,
and llms.txt existence were already confirmed by the orchestrator and are not
re-verified here.

---

## 1. Passage-level citability — real Arabic pages

Pages sampled: `/ar/services/res-tourist`, `/ar/guides/residency`, `/ar/faq`.
Text extracted from raw HTML (boilerplate/nav lines identifiable and excluded
from scoring).

### What would get lifted into an AI answer (good passages)

**`/ar/services/res-tourist` — "من يحق له التقديم على الإقامة السياحية؟" (54 words)**
> الإقامة السياحية قصيرة الأمد تسمح بالبقاء في تركيا بعد انتهاء مدة التأشيرة أو
> الإعفاء، بشرط أن يكون سبب الإقامة سياحياً حقيقياً وليس بديلاً عن إقامة عمل أو
> دراسة أو لمّ شمل عائلي. تنظر مديرية الهجرة إلى خطة سفرك الكاملة...

Self-contained, answers the question in the heading directly, no dangling
pronouns, no "as mentioned above." This is the single best-shaped passage on
the site for AI lifting.

**`/ar/services/res-tourist` — "المدة المتوقعة وصلاحية الإقامة" (49 words)**
> المهلة القانونية العامة للبت في طلب الإقامة هي حتى 90 يوماً من تاريخ
> التقديم. عملياً، كثير من الملفات تُحسم أسرع من ذلك، لكن لا يوجد ضمان حكومي
> بمدة أقصر...

Good: contains a specific, checkable number (90 days) framed as a legal
maximum rather than a promised outcome — citable and compliant with the
no-fabricated-guarantee posture.

**`/ar/faq` — "شو هو رفيق بالضبط؟"**
> رفيق منصة تنسيق رقمية بتساعد الأجانب بإسطنبول ينسّقوا خدمات الإقامة والبنوك
> والسكن والصحة والحياة اليومية، مباشرة أو عبر شركاء مختصين، بلغتهم.

This is the only sentence in the crawled sample that **defines what Rafiq is**
in one self-contained line — it is the single most important sentence on the
site for entity grounding, and it currently lives buried as FAQ item #7, not
restated near the top of the homepage or in the Organization schema
`description`. **Severity: High.**

### What would NOT get cited (structurally weak passages)

**`/ar/guides/residency` — the entire generic "category" guide page.** Every
paragraph is meta-language about Rafiq's own process ("Rafiq منصة تنسيق: نقترح
خطوات، نحجز مواعيد...") with **zero facts, numbers, or named government
terms** a model could extract as a standalone answer. Example:
> الزمن يختلف حسب نوع الطلب وتوافر الجهة أو الشريك المتعاقد. Rafiq ينسق
> الخيارات المتاحة ويعرض تقديرات أو خطوات مقترحة...

This answers nothing an AI system would quote — it hedges rather than
answers. Compare with `/ar/faq`'s answer to a near-identical question ("كم
يستغرق استخراج الإقامة التركية؟"), which is shorter but at least points to a
named, checkable source (e-İkamet). The guide-tier pages (residency, health,
realestate, banking, tourism guides) appear to share one generic template with
almost no page-specific substance — **this is the weakest citability layer on
the site, and also the highest-traffic entry point since guides rank for
broad terms.** **Severity: High.**

**Passage length overall.** The target optimal AI-citation length is 134–167
words per self-contained block. Every extracted passage on this site measures
**30–70 words** — roughly a third to half of that target. Content is written
in short, individually-true but thin sentences rather than consolidated
134–167-word answer blocks that front-load a direct answer and follow with
2–3 sentences of specific, sourced elaboration. This is a structural pattern
across the whole site, not a one-off. **Severity: Medium** (directionally
correct, just under-length).

**FAQ dialect inconsistency.** `/ar/faq` is written in spoken colloquial
Arabic ("هاي مجموعة", "بيسألها", "شو"), while `/ar/services/res-tourist` and
`/ar/guides/residency` are in Modern Standard Arabic. AI systems answering in
Arabic on formal/YMYL topics (residency, banking, health) are more likely to
draw on and echo MSA phrasing; mixed register across the same domain for the
same facts may read as lower-authority to a model doing cross-page
consistency checks. **Severity: Low.**

---

## 2. `/llms-full.txt` — 861 KB is self-defeating

Measured: **861,564 bytes / ~60,096 words** in one flat file, no internal
table of contents, no per-section anchors mapping back to canonical URLs.

- At typical mixed Arabic/Latin tokenization (~1.3–1.8 tokens per word), this
  is roughly **80,000–110,000 tokens** — larger than what many retrieval
  pipelines allocate to a *single* source document. Even where a model's
  context window technically fits it, crawlers/RAG systems commonly apply
  per-document size caps or truncate before injecting content, meaning
  everything past the cutoff (likely whatever sits last in the file — tail
  guides/services by build order) may never be seen at all.
- A monolithic dump also defeats the purpose of `llms.txt`/`llms-full.txt` as
  a *curated, high-signal index* — the spec's intent is a compact map an LLM
  can cheaply ingest, not a full site mirror.
- **What it should be instead:** keep `/llms.txt` as the compact index
  (already correct at ~4.5 KB), and either (a) drop `/llms-full.txt` entirely
  and rely on per-page JSON-LD plus clean HTML for grounding, or (b) split it
  into per-section files (e.g. `/llms-residency.txt`, `/llms-banking.txt`,
  `/llms-realestate.txt`), each under roughly 30–50 KB, linked individually
  from `/llms.txt`, so a crawler can selectively pull the one relevant to a
  query instead of ingesting the entire site to answer one question.

**Severity: High** (the file plausibly works against citation rather than
for it).

---

## 3. Entity resolution — can AI engines recognize "رفيق إسطنبول" as a real business?

Combining the established facts with this pass:
- Zero third-party mentions (absent from Common Crawl's web graph).
- No About page, no Contact page, no phone/email/address anywhere on the site.
- Organization JSON-LD has no `address`, `telephone`, `email`, `contactPoint`,
  or `areaServed`.
- `sameAs` limited to Facebook + Instagram — no Wikipedia, no Wikidata, no
  LinkedIn company page, no Google Business Profile signal.
- The one sentence that actually defines the business in plain language is
  buried in FAQ item #7, not surfaced as a top-level entity description.

**Consequence, stated plainly:** none of the three engines has enough
independent, corroborating signal to build a confident knowledge-graph entry
for "رفيق إسطنبول." A model can read the site's own claims about itself (via
crawling) and may paraphrase them if a query lands directly on a page, but it
has no way to **verify** Rafiq is a real, operating company — no second
source confirms it. Practically:
- **Google AI Overviews**, which leans heavily on the existing Knowledge
  Graph / Google Business Profile / reviews, is the **least likely** of the
  three to surface Rafiq as a named recommendation for a query like "من
  يساعدني في إقامتي بإسطنبول" — there is nothing to anchor an entity card to.
- **Perplexity**, which cites live web sources per-query, is the **most
  likely** to quote a specific Rafiq page if it ranks for the exact query,
  because Perplexity doesn't require pre-existing entity trust — but it will
  treat Rafiq as "a page," not "a known company," and won't proactively
  recommend it by name in a broader comparison.
- **ChatGPT** (with browsing) could describe what Rafiq says about itself,
  but would very likely hedge ("appears to be," "according to their
  website") rather than assert it as an established provider, precisely
  because nothing on the open web independently confirms it.

**Severity: Critical.** This is the single largest ceiling on all other GEO
work — better passages and schema cannot fix a total absence of third-party
corroboration.

---

## 4. Missing-authority signals for YMYL topics (immigration, money, health)

Honest, ownable fixes — none require inventing anything or crossing the
DIY/pricing constraints:

- **Cite the specific official source per claim, inline, not only as a
  page-level "المصادر الرسمية" list.** Today `res-tourist` lists Göç İdaresi /
  e-İkamet / NVİ once at the page bottom. AI engines and users trust a claim
  more when the *specific* fact (e.g. "جواز السفر يجب أن يبقى صالحاً 60 يوماً")
  is followed by "(حسب متطلبات إدارة الهجرة)" or a direct link to the relevant
  Göç İdaresi/e-İkamet reference — not bundled once as a generic footer.
  **High impact, low effort.**
- **Named human expertise, without fabricating credentials.** The site
  attributes every guide to the Organization with no human byline. A real,
  verifiable line such as "بالتنسيق مع فريق رفيق المختص بمعاملات الإقامة," or a
  named coordinator with a real LinkedIn profile (only if such a person truly
  exists and consents), gives AI engines a person-entity to anchor trust to.
  Do **not** invent a name, title, or credential that isn't real. **Medium
  impact, needs owner decision on who — if anyone — can be named.**
- **A real About page** stating, honestly, what Rafiq is (a coordination
  platform, not a law firm/clinic/bank — this framing already exists almost
  verbatim in the FAQ), how long it has operated, and how coordination
  actually works. This gives crawlers one canonical "hub" page to cite for
  "what is Rafiq" queries instead of forcing them to infer it from a buried
  FAQ answer. **Critical, low-to-medium effort — no new facts needed, just
  surfacing what's already written.**
- **Verifiable partner/provider category disclosure where honest** (e.g.
  "شريك تأميني مرخّص," "عيادة معتمدة من وزارة الصحة" — without necessarily
  naming the specific company if commercially sensitive) gives AI systems a
  concrete, checkable claim instead of "شركاء مختصون" repeated with no
  specificity.
- **Dates that mean something** (see section 5) — a real "آخر مراجعة قانونية"
  date tied to an actual content review, not a build timestamp.

**Severity:** Critical (About page + inline sourcing), Medium (named expert),
Medium (partner specificity).

---

## 5. `dateModified` / `lastmod` restamping — effect on AI freshness signals

Confirmed on this pass: `sitemap.xml`, `sitemap-priority.xml`, and every guide
page checked (`res-tourist`, `residency`, `faq`) all carry the exact same
date — **2026-09-06, today** — regardless of whether that specific page's
content actually changed.

Effect on AI systems:
- Freshness is a real trust/ranking input for AI Overviews and Perplexity on
  time-sensitive YMYL topics (fees change, immigration rules change). A
  `dateModified` that changes on every deploy — even for pages with zero
  content edits — is **worse than having no date at all**, because it trains
  crawlers to distrust the signal on this specific domain: once a crawler
  notices dates don't correlate with actual diffs, it discounts or ignores
  the field site-wide, including on pages where the date *is* meaningful.
- It also removes any way for a human or model to distinguish "this
  residency page was actually checked against current Göç İdaresi rules
  last week" from "this page hasn't been touched in a year but redeployed
  for an unrelated reason."
- **Fix:** derive `dateModified` from the actual last content-diff of that
  specific page (e.g. the git history of its source file, or a manually
  maintained "reviewed on" field), not from the deploy pipeline. This is a
  build-tooling change, not a content-writing change.

**Severity: High.**

---

## 6. Prioritized GEO fix list (Arabic-first)

| # | Fix | Why it matters | Effort | Severity |
|---|-----|-----------------|--------|----------|
| 1 | Publish a real `/ar/about` page using the FAQ's existing "شو هو رفيق بالضبط؟" definition as its opening paragraph, plus how coordination works | Gives AI engines one canonical entity-defining page instead of a buried FAQ line | Low | Critical |
| 2 | Fix `dateModified`/`lastmod` to reflect real content changes, not build time | Stops AI crawlers from learning to ignore the freshness signal on this domain | Low–Medium (tooling) | High |
| 3 | Split or drop `/llms-full.txt` — replace the 861 KB single file with per-topic files under ~50 KB each, linked from `/llms.txt` | Prevents truncation/ignoring by RAG pipelines that cap per-document size | Medium | High |
| 4 | Rewrite guide-tier pages (`/ar/guides/*`) to include page-specific facts and inline official-source citations per claim, matching the density already present in service pages like `res-tourist` | Guides are high-traffic entry points but currently carry near-zero citable substance | Medium–High | High |
| 5 | Consolidate short sentences into 134–167-word self-contained answer blocks (direct answer first, then 2–3 supporting, sourced sentences) on the highest-traffic service and FAQ pages | Current passages run 30–70 words, roughly half the length AI systems most often lift verbatim | Medium | Medium |
| 6 | Pursue real third-party presence: a genuine Wikidata item, a real Google Business Profile, and any earned mentions (press, directories, partner sites linking back) — add to `sameAs` only when real | Zero third-party mentions is the hard ceiling on entity trust for all three engines | High (ongoing, outside content team) | Critical |
| 7 | Add inline attribution per specific claim ("...حسب موقع e-İkamet") instead of one generic source list per page | Increases per-fact verifiability, the strongest lever for YMYL citation trust | Low | Medium |
| 8 | Normalize register (MSA) across FAQ and guide/service pages, or intentionally document why FAQ uses colloquial phrasing | Reduces cross-page inconsistency signal for the same facts | Low | Low |

**Explicitly not recommended** (per owner constraints): no step-by-step
self-service procedures, no exact government fees, and no invented address,
phone, review, rating, or named expert who doesn't actually work at Rafiq.

---

## Summary for the owner (plain language)

بالعربي البسيط: الموقع مكتوب بشكل تقني صحيح (الصفحات ظاهرة كاملة بدون جافاسكربت،
والروبوتات مسموح لها بالدخول)، لكن أدوات الذكاء الاصطناعي (تشات جي بي تي،
بيربلكسيتي، جوجل) ما بتقدر تتأكد إنو "رفيق إسطنبول" شركة حقيقية موجودة فعلاً —
لأنو ما فيه ولا مصدر خارجي واحد بيذكر رفيق، وما فيه صفحة "من نحن"، وما فيه رقم
أو عنوان بأي مكان بالموقع. أهم خطوة وأسهلها: صفحة "من نحن" حقيقية تشرح شو هو
رفيق بالضبط (الجملة جاهزة أصلاً بصفحة الأسئلة الشائعة، بس مدفونة). بعدها،
تحديث تاريخ "آخر تحديث" ليعكس تغيير حقيقي بالمحتوى، مش تاريخ كل نشر جديد
للموقع. وأخيراً، ملف `llms-full.txt` كبير جداً (861 كيلوبايت) ولازم يتقسّم
لملفات أصغر حسب الموضوع.
