# Schema.org / JSON-LD Validation — rafiq.ist

Pages fetched (raw pre-rendered HTML, no JS needed): `/ar`, `/ar/about`, `/ar/contact`,
`/ar/services/res-tourist`, `/ar/guides/residency`, `/ar/faq`, `/ar/health-tourism`, `/en/about`.

All 8 pages ship valid, well-formed JSON-LD (`@context: https://schema.org`, absolute URLs,
ISO 8601 dates, no deprecated types like HowTo/SpecialAnnouncement). No dangling `@id`
references were found — every `#organization` / `#website` reference resolves to a node
defined in the same `@graph` block on that same page. That part is genuinely clean; the
issues below are concrete, not speculative.

---

## CRITICAL

### 1. Organization node now publishes a physical street address that contradicts known business facts
Every single page's `Organization` node (sitewide, in the shared `@graph` block) carries:

```json
"address": {
  "@type": "PostalAddress",
  "streetAddress": "Hobyar, Fındıkçı Remzi Sk. 2B, 34112 Fatih/İstanbul",
  "addressLocality": "İstanbul",
  "addressCountry": "TR"
}
```

This is a factual-accuracy problem, not a syntax one: Rafiq has no premises open to
visitors and is not (yet) a registered company — that's why the type was deliberately kept
as `Organization`, not `LocalBusiness`, with no address. But a full street address is live
on every page today. Two possibilities, both need the owner to confirm before anything else
in this report matters:
- If this address is real and newly secured, it should not appear only in invisible JSON-LD —
  it needs to match a real, verifiable registration, and the "no address" assumption in this
  project's own notes is now stale.
- If it is not a real, confirmed business address, it must be removed from the markup
  immediately. Publishing an unverified/placeholder street address as a business's legal
  location is a trust and NAP-consistency risk, and is exactly the kind of thing Google (and
  any local-pack signal) can flag as inconsistent if it doesn't match a real registration
  anywhere else.

**Action: do not "fix" this with a schema patch — get owner confirmation on whether this
address is real first.** If it must go, delete the whole `address` block from the
`Organization` node (all locales, all pages) and keep `PostalAddress` out entirely, as the
rest of the profile is already scoped for.

---

## HIGH

### 2. Duplicate `@id` collision on `/about` and `/contact` (both `ar` and `en` confirmed)
Each of these pages emits **two separate JSON-LD nodes that share the exact same `@id`** but
different `@type` and different properties:

| Page | Node A | Node B | Shared `@id` |
|---|---|---|---|
| `/ar/about` | `AboutPage` | `WebPage` | `https://rafiq.ist/ar/about#webpage` |
| `/ar/contact` | `ContactPage` | `WebPage` | `https://rafiq.ist/ar/contact#webpage` |
| `/en/about` | `AboutPage` | `WebPage` | `https://rafiq.ist/en/about#webpage` |

The `AboutPage`/`ContactPage` block has `about`, `mainEntity`, `isPartOf` but is **missing
`author`/`publisher`**, which only exist on the separate `WebPage` block with the identical
id. Two nodes claiming the same identity with different types/properties is invalid graph
modeling — `AboutPage` and `ContactPage` are already subtypes of `WebPage` in Schema.org, so
this should be one merged node, not two. Fix: paste this in place of both blocks currently on
`/ar/about` (same pattern for `/ar/contact` and the `en` equivalents):

```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": "https://rafiq.ist/ar/about#webpage",
  "url": "https://rafiq.ist/ar/about",
  "name": "من نحن | رفيق إسطنبول — تنسيق معاملات الأجانب في إسطنبول",
  "description": "رفيق منصة تنسيق تساعد الأجانب في إسطنبول على إنجاز معاملات الإقامة والبنوك والسكن والصحة بلغتهم، مباشرة أو عبر شركاء مرخصين. تعرّف على طريقة عملنا وحدود ما نعد به.",
  "inLanguage": "ar",
  "dateModified": "2026-09-07",
  "isPartOf": { "@id": "https://rafiq.ist/#website" },
  "about": { "@id": "https://rafiq.ist/#organization" },
  "mainEntity": { "@id": "https://rafiq.ist/#organization" },
  "author": { "@id": "https://rafiq.ist/#organization" },
  "publisher": { "@id": "https://rafiq.ist/#organization" }
}
```

For `/ar/contact` use `"@type": "ContactPage"` with that page's own url/name/description.
This is a template-level bug (both a generic "WebPage" emitter and a page-type-specific
emitter fire on the same route), so it likely affects every `/about` and `/contact` page in
all 4 locales, not just the two sampled here.

### 3. BreadcrumbList labels are the full `<title>` tag, not short breadcrumb labels
On every non-home page tested, the last (and on `/about`/`/contact`/`/faq`/`/health-tourism`,
the *only* non-home) `ListItem.name` is the entire SEO title, e.g.:

```json
{ "@type": "ListItem", "position": 2,
  "name": "من نحن | رفيق إسطنبول — تنسيق معاملات الأجانب في إسطنبول",
  "item": "https://rafiq.ist/ar/about" }
```

Confirmed on `/ar/about`, `/ar/contact`, `/ar/services/res-tourist`, `/ar/guides/residency`,
`/ar/faq`, `/ar/health-tourism`, `/en/about`. Positions themselves are correct (sequential,
start at 1, absolute URLs, complete trail) — only the label text is wrong. This matters
because **BreadcrumbList is one of the two blocks on this site still eligible for an actual
Google rich result** (unlike FAQPage). Today it would render the full pipe-separated title as
a breadcrumb crumb in the SERP instead of a short label. Fix pattern (apply to the breadcrumb
generator, not page-by-page):

```json
{ "@type": "ListItem", "position": 2, "name": "من نحن", "item": "https://rafiq.ist/ar/about" }
{ "@type": "ListItem", "position": 2, "name": "تواصل معنا", "item": "https://rafiq.ist/ar/contact" }
{ "@type": "ListItem", "position": 2, "name": "الأسئلة الشائعة", "item": "https://rafiq.ist/ar/faq" }
{ "@type": "ListItem", "position": 2, "name": "السياحة العلاجية", "item": "https://rafiq.ist/ar/health-tourism" }
{ "@type": "ListItem", "position": 3, "name": "الإقامة السياحية", "item": "https://rafiq.ist/ar/services/res-tourist" }
{ "@type": "ListItem", "position": 3, "name": "الإقامة والمعاملات", "item": "https://rafiq.ist/ar/guides/residency" }
{ "@type": "ListItem", "position": 2, "name": "About", "item": "https://rafiq.ist/en/about" }
```

---

## MEDIUM

### 4. `Organization.areaServed` puts `addressCountry` directly on a `City` node
```json
"areaServed": { "@type": "City", "name": "Istanbul", "addressCountry": "TR" }
```
`addressCountry` is a property of `PostalAddress`, not of `Place`/`City` — Schema.org does not
define it there. Present on every page in the shared graph. Fix:
```json
"areaServed": {
  "@type": "City",
  "name": "Istanbul",
  "containedInPlace": { "@type": "Country", "name": "Turkey" }
}
```

### 5. `Service.serviceType` on `/ar/services/res-tourist` duplicates the SEO title
```json
"serviceType": "إقامة سياحية في إسطنبول | رفيق"
```
`serviceType` should be a clean category label Google can classify the service by, not a copy
of the `<title>` tag including the "| رفيق" brand suffix. Fix:
```json
"serviceType": "الإقامة السياحية"
```
(`name` mirroring the page title is normal convention and does not need to change — only
`serviceType`.)

### 6. Inconsistent `areaServed` modeling between nodes on the same page
`Organization.areaServed` carries the invalid `addressCountry` (see #4); `Service.areaServed`
on the same page (`/ar/services/res-tourist`) is just `{"@type":"City","name":"Istanbul"}`
with no country info at all. Once #4 is fixed, apply the same `containedInPlace` pattern to
the `Service` node for consistency.

---

## LOW / INFO

- **`availableLanguage` placed directly on the `Organization` node**, not only inside
  `contactPoint` (Schema.org's `availableLanguage` domain is `ContactPoint`/`Service`, not
  `Organization`). Harmless — Google ignores unrecognized properties rather than rejecting
  the block — but not spec-correct. Low.
- **`inLanguage` placed on the `Service` node** on `/ar/services/res-tourist` — same kind of
  non-standard placement, same harmless outcome. Low.
- **Postal code embedded inside `streetAddress`** (`"...2B, 34112 Fatih/İstanbul"`) instead of
  a separate `postalCode` field. Only relevant if Critical #1 is resolved by keeping the
  address rather than removing it.
- **FAQPage rich results are dead in Google Search** (retired for all sites 7 May 2026, per
  this audit's brief). Found on 4 pages — `/ar` (6 Q&A), `/ar/guides/residency` (3 Q&A),
  `/ar/faq` (16 Q&A), `/ar/health-tourism` (3 Q&A) — all syntactically valid, real
  non-placeholder Question/acceptedAnswer text. Correctly Info, not Critical: no SERP benefit
  today, entity-signal only.
- **Content-relevance nit, not a schema error:** the FAQPage on `/ar/guides/residency` contains
  3 generic "what is Rafiq / can you guarantee approval / what do I need to send" questions —
  not residency-specific content, despite sitting on the residency guide page. Looks like a
  shared sitewide FAQ widget reused as-is. Worth checking whether the same 3 generic questions
  are duplicated across every `/ar/guides/*` page (only `residency` was sampled here).

---

## What's actually eligible for a Google rich result today

| Block | Eligible for rich result? |
|---|---|
| `BreadcrumbList` | **Yes** — live feature, but currently degraded by finding #3 above |
| `WebSite` + `SearchAction` | **Yes** — Sitelinks Search Box, correctly formatted (urlTemplate, query-input) |
| `Organization` | No dedicated rich result; entity/Knowledge-Graph signal only |
| `AboutPage` / `ContactPage` / `WebPage` | No dedicated rich result; entity signal only |
| `Service` | No dedicated Google rich result for bare `Service` markup; entity signal only |
| `FAQPage` | **No** — retired sitewide as of 7 May 2026; entity-signal-only at best |

No HowTo, SpecialAnnouncement, CourseInfo, EstimatedSalary, or LearningVideo markup was found
anywhere — no deprecated-type debt to clean up.

---

## Summary for a plain read

- الأهم بلا منافس: كل صفحة في الموقع فيها الآن عنوان شارع كامل مكتوب داخل بيانات "من نحن"
  المخفية عن الشركة (Hobyar, Fındıkçı Remzi Sk. 2B, فاتح). هذا يتعارض مع كون رفيق بلا مكتب
  يستقبل زوارًا وغير مسجّلة كشركة بعد. لازم تأكيد: هل هذا عنوان حقيقي مؤكد؟ إذا لا — يُحذف فورًا
  من كل الصفحات قبل أي شيء آخر.
- صفحتا "من نحن" و"تواصل معنا" (بالعربي والإنجليزي على الأقل) فيهما خطأ برمجي بسيط: بيانتان
  منفصلتان تحملان نفس "الهوية الرقمية" (@id) بمعلومات مختلفة — يحتاج دمج، وهذا جاهز كنسخ ولصق
  أعلاه.
- فتات الخبز (Home > اسم الصفحة) في أعلى نتيجة جوجل يستخدم حاليًا عنوان الصفحة الطويل الكامل
  بدل اسم قصير — يشوّه شكل النتيجة في جوجل. الإصلاح جاهز أعلاه أيضًا لكل صفحة.
- الباقي أخطاء تقنية صغيرة لا تمنع جوجل من قراءة الصفحة، وأسئلة الصفحة الشائعة (FAQ) لم تعد
  تُظهر نتيجة خاصة في جوجل أصلًا منذ أيار 2026 — هذا معروف ولا داعي للقلق بشأنه.
