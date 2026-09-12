/**
 * The property-based residence permit page — the ONE canonical page on this
 * site targeting "الإقامة العقارية في إسطنبول" (property residence permit in
 * Istanbul) and its close variants.
 *
 * Why a page of its own rather than more copy on /services/res-property:
 * that page is the transactional *service* page ("prepare and follow my
 * file"); this one answers the question a buyer types into Google months
 * before they are ready to request anything. Keeping them apart — different
 * titles, different intent, each linking to the other — is what stops the two
 * from competing for the same query. /services/res-property deliberately does
 * NOT carry "إسطنبول" in its title; this page does.
 *
 * String literals are double-quoted with JSON-style escaping on purpose,
 * matching comparisons.ts / aboutPage.ts / contactPage.ts, NOT ordinary TS
 * style — scripts/generate-seo-pages.mjs reads this file with a brace-matching
 * + JSON.parse pass (it deliberately never imports .ts source), so every
 * per-language block must be valid JSON. Two consequences to respect when
 * editing: no single-quoted apostrophes, and no "{" or "}" character inside
 * any string (the brace matcher counts them wherever they appear).
 *
 * Content guardrails, same as every other service-facing page here:
 *  - no step-by-step DIY walkthrough — the "steps" section describes what the
 *    journey looks like so a reader knows what is ahead, it does not teach
 *    them to file alone;
 *  - no exact minimum property value and no government fees. The threshold is
 *    set by regulation, was raised in mid-October 2023, and is exactly the
 *    kind of number that goes stale and misleads someone into a purchase;
 *  - no legal guarantees. Göç İdaresi decides, not Rafiq.
 *
 * Every fact below is already carried by reviewed copy in this repo (see
 * SERVICE_SEO_AR["res-property"] in src/data/serviceSeoAr.ts) — law 6458 as
 * the legal basis, residential-use requirement, the October 2023 threshold
 * increase, the districts closed to new foreigner registration since 2022,
 * the two-year maximum per short-term permit, family/shared-ownership rules,
 * and that ownership is not a citizenship route.
 */
import type { Lang } from '../lib/types';

export interface PropertyResidenceSection {
  heading: string;
  body: string;
}

export interface PropertyResidenceDocument {
  label: string;
  note: string;
}

export interface PropertyResidenceStep {
  title: string;
  body: string;
}

export interface PropertyResidenceFaq {
  question: string;
  answer: string;
}

/** An internal link out of this page — the outbound half of the topic cluster. */
export interface PropertyResidenceLink {
  /** Router path, language-relative (the basename adds /ar, /en, …). */
  to: string;
  label: string;
  note: string;
}

export interface PropertyResidenceContent {
  seoTitle: string;
  /** Short label for compact spots (footer link, cross-page callouts). */
  navLabel: string;
  metaDescription: string;
  /** The visible H1 — the bare keyword, without the brand suffix the title tag carries. */
  h1: string;
  eyebrow: string;
  /** Alt text for the header photo. Descriptive first, keyword-bearing second. */
  heroAlt: string;
  /** Opening paragraph. Carries the primary keyword in its first sentence. */
  intro: string;
  highlights: string[];
  sections: PropertyResidenceSection[];
  documentsHeading: string;
  documentsIntro: string;
  documents: PropertyResidenceDocument[];
  stepsHeading: string;
  stepsIntro: string;
  steps: PropertyResidenceStep[];
  faqHeading: string;
  faqs: PropertyResidenceFaq[];
  relatedHeading: string;
  relatedIntro: string;
  related: PropertyResidenceLink[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  whatsappButton: string;
  whatsappMessage: string;
  onThisPage: string;
  breadcrumbLabel: string;
  disclaimer: string;
}

/** The one canonical route for this topic. Referenced by every page that links here. */
export const PROPERTY_RESIDENCE_PATH = '/real-estate/residence-permit';

export const PROPERTY_RESIDENCE: Record<Lang, PropertyResidenceContent> = {
  "ar": {
    "seoTitle": "الإقامة العقارية في إسطنبول: الشروط والأوراق والخطوات | رفيق",
    "navLabel": "الإقامة العقارية في إسطنبول",
    "metaDescription": "دليل الإقامة العقارية في إسطنبول: من يحق له التقديم، شروط الإقامة العقارية، الأوراق المطلوبة، خطوات التقديم ومدة الإقامة — وكيف ينسّق رفيق ملفك خطوة بخطوة.",
    "h1": "الإقامة العقارية في إسطنبول",
    "eyebrow": "دليل الإقامة والعقار",
    "heroAlt": "مبانٍ سكنية في إسطنبول — الإقامة العقارية في إسطنبول تُمنح على أساس تملّك عقار سكني",
    "intro": "الإقامة العقارية في إسطنبول هي إقامة قصيرة الأمد تُمنح للأجنبي على أساس امتلاكه عقاراً سكنياً في تركيا، وهي من أكثر ما يسأل عنه المشترون العرب قبل الشراء وبعده. هذه الصفحة تشرح بلغة واضحة من يحق له التقديم، ما هي شروط الإقامة العقارية اليوم، ما الأوراق التي يُطلب تجهيزها، وكيف يسير الملف عملياً — بلا وعود قانونية: القرار النهائي يعود لإدارة الهجرة التركية وحدها.",
    "highlights": [
      "مسار قائم بموجب قانون الأجانب والحماية الدولية رقم 6458",
      "العقار يجب أن يكون سكنياً بالاستخدام الفعلي، لا أرضاً ولا محلاً تجارياً",
      "بعض أحياء إسطنبول مغلقة منذ 2022 أمام تسجيل إقامات جديدة للأجانب"
    ],
    "sections": [
      {
        "heading": "ما هي الإقامة العقارية؟",
        "body": "الإقامة العقارية ليست نوعاً مستقلاً بذاته في القانون التركي، بل هي إقامة قصيرة الأمد يُستند فيها إلى سبب محدد: امتلاك الأجنبي عقاراً سكنياً في تركيا. الأساس القانوني لها هو قانون الأجانب والحماية الدولية رقم 6458، الذي يَعدّ تملّك عقار سكني أحد أسباب منح الإقامة قصيرة الأمد. بعبارة أبسط: أنت لا تشتري إقامة، بل تشتري عقاراً، ثم يصبح هذا العقار سبباً مقبولاً عند طلب الإقامة إذا استوفى الشروط السارية وقت التقديم. الفرق مهم عملياً، لأن الإقامة تبقى مرتبطة ببقاء السبب قائماً، لا بعملية الشراء نفسها."
      },
      {
        "heading": "من يحق له التقديم على الإقامة العقارية؟",
        "body": "يحق لكل أجنبي مسجّل باسمه عقار سكني في تركيا أن يتقدّم بطلب إقامة قصيرة الأمد على هذا الأساس. ويمكن لزوج أو زوجة المالك ولأبنائه القاصرين أو المعالين التقديم ضمن الأساس نفسه عندما تكون لهم حصة ملكية في العقار ذاته. أما إذا كان العقار مملوكاً بالشراكة بين عدة أجانب لا تربطهم صلة قرابة، فالمعتاد أن شخصاً واحداً فقط هو من يستفيد من سند الملكية لطلب إقامة سكنية، بينما يحتاج البقية إلى نوع إقامة آخر يناسب وضعهم. ولأن الحالات العائلية تختلف كثيراً عن بعضها، فإن مراجعة الوضع قبل الشراء أوفر بكثير من محاولة تصحيحه بعده."
      },
      {
        "heading": "شروط الإقامة العقارية في تركيا",
        "body": "شروط الإقامة العقارية تغيّرت أكثر من مرة في السنوات الأخيرة، ولذلك يجب التعامل مع أي قائمة منشورة على أنها قابلة للتحديث. الثابت اليوم أن العقار يجب أن يكون سكنياً بالاستخدام الفعلي — فالأراضي والمحال التجارية والمشاريع التي ما تزال قيد الإنشاء لا تخدم هذا المسار. ويجب أن تبلغ قيمة العقار الحد الأدنى الذي تفرضه اللوائح السارية وفق تقرير تقييم عقاري معتمد؛ وقد رُفع هذا الحد في منتصف أكتوبر 2023، ولذلك لا ننشر هنا رقماً ثابتاً بل نؤكّد الحد الساري على حالتك عند التواصل. يُضاف إلى ذلك جواز سفر ساري المفعول لمدة كافية، وتأمين صحي صالح في تركيا يغطي فترة الإقامة، وتسجيل عنوان يطابق عنوان العقار."
      },
      {
        "heading": "أحياء إسطنبول المغلقة وما يعنيه ذلك لك",
        "body": "منذ عام 2022 أُغلق عدد من الأحياء والمناطق في تركيا أمام تسجيل إقامات جديدة للأجانب بسبب ارتفاع نسبة الأجانب فيها، ومن بينها عشر مناطق في إسطنبول. الإغلاق لا يمنع الشراء بحد ذاته، لكنه يعني أن عقاراً يقع داخل حي مغلق قد لا يصلح أساساً لتسجيل إقامة جديدة، مع استثناء عام لمن كان يملك عقاره هناك قبل تاريخ الإغلاق. القوائم تُحدَّث من وقت لآخر، وهذا تحديداً من أكثر أسباب خيبة أمل مشترٍ اختار الحي قبل أن يسأل. لذلك يبقى التحقق من وضع الحي والعقار قبل توقيع أي عقد أو دفع أي عربون هو أرخص خطوة في المسار كله."
      },
      {
        "heading": "مدة الإقامة العقارية وتجديدها",
        "body": "تُمنح الإقامة قصيرة الأمد القائمة على التملك العقاري لمدد لا تتجاوز سنتين في كل مرة، بحسب ما تنشره إدارة الهجرة التركية، ويمكن تجديدها طالما بقيت شروط الأهلية قائمة. وأهم هذه الشروط استمرار ملكية العقار واستمرار استخدامه كمسكن: بيع العقار أو تحويل استخدامه قد يؤثر مباشرة في التجديد. لا يوجد نص معلن يحدد سقفاً نهائياً لعدد مرات التجديد ما دامت الشروط متوفرة، لكن الأنظمة قابلة للتغيير كما حدث فعلاً في السنوات الأخيرة، ولذلك من الحكمة بدء ترتيب التجديد قبل وقت كافٍ من انتهاء المدة."
      },
      {
        "heading": "الإقامة العقارية ليست جنسية",
        "body": "الخلط بين مسارين مختلفين تماماً هو أكثر سوء فهم يتكرر: امتلاك عقار سكني قد يفتح باب الإقامة، لكنه لا يمنح الجنسية التركية. الجنسية عبر الاستثمار العقاري مسار قانوني منفصل بشروط قيمة أعلى بكثير وإجراءات مختلفة ومتطلبات خاصة به. من يشتري وفي ذهنه الجنسية يحتاج أن يعرف هذا الفرق قبل الدفع لا بعده، لأن عقاراً اشتُري على أساس الإقامة لا يتحول تلقائياً إلى عقار مؤهِّل للجنسية."
      },
      {
        "heading": "أكثر الأخطاء شيوعاً عند الحصول على الإقامة عن طريق شراء عقار",
        "body": "أغلب الرفض والتأخير لا يأتي من تعقيد القانون بل من تفاصيل صغيرة: عقار لا تبلغ قيمته الحد المطلوب وفق التقييم الرسمي، أو عقار غير مسجل كمسكن أصلاً، أو ملكية مشتركة بين أجانب لا تربطهم صلة قرابة دون تحديد من يحق له التقديم، أو عقار داخل حي مغلق أمام التسجيل، أو عنوان مسجل لا يطابق عنوان العقار، أو جواز سفر وتأمين صحي لا يغطيان المدة المطلوبة. كل نقطة من هذه يمكن كشفها قبل الشراء لا بعده، وهذا هو الفارق العملي بين ملف يمشي وملف يعلق."
      }
    ],
    "documentsHeading": "الأوراق المطلوبة للإقامة عن طريق تملك عقار في تركيا",
    "documentsIntro": "هذه قائمة عامة بما يُطلب تجهيزه عادة. المطلوب النهائي يتحدد حسب حالتك وحسب ما تطلبه إدارة الهجرة عند دراسة الملف.",
    "documents": [
      { "label": "سند الملكية (الطابو)", "note": "يثبت تسجيل العقار باسم مقدّم الطلب ويحدد نوعه واستخدامه." },
      { "label": "تقرير التقييم العقاري", "note": "صادر عن جهة معتمدة، ويؤكد بلوغ قيمة العقار الحد الأدنى الساري." },
      { "label": "جواز سفر ساري المفعول", "note": "بمدة صلاحية تغطي فترة الإقامة المطلوبة." },
      { "label": "تأمين صحي صالح في تركيا", "note": "يغطي كامل فترة الإقامة المطلوبة." },
      { "label": "إثبات تسجيل العنوان", "note": "تسجيل العنوان في النظام الوطني بما يطابق عنوان العقار." },
      { "label": "صور شخصية ووثائق داعمة", "note": "حسب ما تطلبه الجهة المختصة عند دراسة الملف." }
    ],
    "stepsHeading": "خطوات التقديم على الإقامة العقارية في إسطنبول",
    "stepsIntro": "هذه صورة عامة لمسار الملف من أوله إلى آخره حتى تعرف ما الذي ينتظرك. رفيق ينسّق الخطوات معك ومع المكاتب المختصة بدل أن تلاحق كل جهة وحدك.",
    "steps": [
      { "title": "تحقّق قبل الشراء", "body": "قبل أي عربون: هل الحي مفتوح لتسجيل إقامات جديدة؟ هل العقار سكني الاستخدام فعلاً؟ هل قيمته تبلغ الحد الساري؟ هذه أرخص خطوة في المسار كله وأكثرها توفيراً." },
      { "title": "إتمام التملك وتسجيل الطابو", "body": "استكمال إجراءات الشراء وتسجيل الملكية رسمياً، مع التقييم العقاري المعتمد الذي سيُستخدم لاحقاً في ملف الإقامة." },
      { "title": "تجهيز المستندات", "body": "تجميع سند الملكية والتقييم وجواز السفر والتأمين الصحي وتسجيل العنوان، والتأكد من تطابق البيانات بين الوثائق قبل تقديمها." },
      { "title": "تقديم الطلب ومتابعة الموعد", "body": "تقديم الطلب ومتابعة الموعد لدى الجهة المختصة، مع تجهيزك لما سيُطلب في الموعد نفسه." },
      { "title": "المتابعة ثم التجديد", "body": "متابعة حالة الطلب حتى صدور القرار واستلام البطاقة، ثم ترتيب التجديد قبل انتهاء المدة ما دامت شروط الأهلية قائمة." }
    ],
    "faqHeading": "أسئلة شائعة عن الإقامة العقارية",
    "faqs": [
      {
        "question": "هل ما زال شراء عقار في تركيا يمنح إقامة؟",
        "answer": "نعم، تملّك عقار سكني ما يزال أحد أسباب منح الإقامة قصيرة الأمد وفق قانون الأجانب والحماية الدولية رقم 6458. لكن الشروط تشدّدت في السنوات الأخيرة من ناحية الحد الأدنى لقيمة العقار والمناطق المسموح بالتسجيل فيها، لذلك يُتحقق من الوضع الساري وقت تقديمك أنت، لا وفق معلومة قديمة."
      },
      {
        "question": "كم قيمة العقار المطلوبة للإقامة العقارية؟",
        "answer": "هناك حد أدنى تفرضه اللوائح ويُثبَت بتقرير تقييم عقاري معتمد، وقد رُفع هذا الحد في منتصف أكتوبر 2023. ولأن الرقم قابل للتغيير، لا ننشره هنا كرقم ثابت؛ نؤكّد لك الحد الساري وقت تواصلك وبحسب نوع العقار وموقعه."
      },
      {
        "question": "هل تشمل الإقامة العقارية زوجتي وأولادي؟",
        "answer": "زوج أو زوجة المالك وأبناؤه القاصرون أو المعالون يمكن أن يتقدّموا ضمن الأساس نفسه عندما تكون لهم حصة ملكية في العقار ذاته. أما الشركاء الأجانب الذين لا تربطهم صلة قرابة فعادةً يستفيد واحد منهم فقط من سند الملكية، ويحتاج الباقون نوع إقامة آخر."
      },
      {
        "question": "هل أستطيع التقديم بعقار في أي حي من إسطنبول؟",
        "answer": "ليس دائماً. بعض الأحياء أُغلقت منذ 2022 أمام تسجيل إقامات جديدة للأجانب، ومنها عشر مناطق في إسطنبول، مع استثناء عام لمن امتلك عقاره هناك قبل تاريخ الإغلاق. القوائم تتغير، والتحقق من الحي قبل الشراء هو أهم خطوة وقائية."
      },
      {
        "question": "كم مدة الإقامة العقارية؟",
        "answer": "تُمنح الإقامة قصيرة الأمد لمدد لا تتجاوز سنتين في كل مرة وفق ما تنشره إدارة الهجرة التركية، وتُجدَّد ما دامت شروط الأهلية قائمة. المدة الممنوحة فعلياً تتفاوت حسب الملف وقرار الجهة المختصة."
      },
      {
        "question": "هل تمنحني الإقامة العقارية الجنسية التركية؟",
        "answer": "لا. الإقامة شيء والجنسية شيء آخر. الجنسية عبر الاستثمار العقاري مسار منفصل بشروط قيمة أعلى بكثير وإجراءات مختلفة، ولا يترتب على مجرد الحصول على إقامة عقارية."
      },
      {
        "question": "ماذا يحدث لإقامتي إذا بعت العقار؟",
        "answer": "الإقامة مرتبطة ببقاء سببها قائماً. بيع العقار أو تغيير استخدامه من سكني إلى غير ذلك قد يؤثر في التجديد، وقد يستدعي الانتقال إلى نوع إقامة آخر. من يخطط للبيع يُفضَّل أن يرتّب البديل قبل البيع لا بعده."
      }
    ],
    "relatedHeading": "صفحات مرتبطة على رفيق",
    "relatedIntro": "إذا كنت ما تزال تقارن بين المسارات، ابدأ من الصفحة الأقرب إلى وضعك.",
    "related": [
      { "to": "/services/res-property", "label": "خدمة تجهيز ملف الإقامة العقارية", "note": "تنسيق الملف على أساس تملّك عقار، من سند الملكية حتى الموعد." },
      { "to": "/services/res-eligibility", "label": "تدقيق مسار الإقامة والأهلية", "note": "مراجعة وضعك وتحديد المسار الأنسب قبل أي التزام مالي." },
      { "to": "/services/res-renew", "label": "تجديد الإقامة", "note": "ترتيب التجديد قبل انتهاء المدة لكل أنواع الإقامة." },
      { "to": "/services/res-citizenship", "label": "خدمات الجنسية التركية", "note": "المسار المنفصل عن الإقامة العقارية، بشروط وقيمة مختلفة تماماً." },
      { "to": "/real-estate", "label": "عقارات معروضة في إسطنبول", "note": "عروض مختارة مع توضيح ما تم التحقق منه وما لم يُتحقق منه بعد." },
      { "to": "/real-estate/investments", "label": "فرص الاستثمار العقاري", "note": "مناطق ومشاريع، مع توضيح ما يتجاوز حدود الإقامة والجنسية." },
      { "to": "/guides/realestate", "label": "دليل العقارات في تركيا", "note": "ما تتضمنه العمليات العقارية وكيف تستعد لها عملياً." },
      { "to": "/guides/residency", "label": "دليل الإقامة والمعاملات", "note": "بقية أنواع الإقامة والمعاملات الرسمية المرتبطة بها." },
      { "to": "/compare/residency-diy", "label": "رفيق أو التقديم بنفسك؟", "note": "مقارنة صريحة بين التنسيق مع رفيق والتقديم الذاتي." }
    ],
    "ctaTitle": "تحقّق من وضعك قبل ما تشتري",
    "ctaBody": "أرسل تفاصيل حالتك — نوع العقار، الحي، ووضع العائلة — وننسّق معك الخطوة التالية ونوضّح الشروط السارية على حالتك تحديداً. التكلفة تتفاوت حسب الحالة، ونعطيك الرقم الدقيق عند التواصل.",
    "ctaButton": "اطلب المساعدة",
    "whatsappButton": "اسأل عبر واتساب",
    "whatsappMessage": "مرحباً، أريد الاستفسار عن الإقامة العقارية في إسطنبول",
    "onThisPage": "في هذه الصفحة",
    "breadcrumbLabel": "مسار التنقل",
    "disclaimer": "رفيق منصة تنسيق مستقلة — ليست جهة حكومية ولا مكتب محاماة. ما في هذه الصفحة تعريف عام، والأنظمة قابلة للتغيير، والقرار النهائي في أي طلب إقامة يعود لإدارة الهجرة التركية."
  },
  "en": {
    "seoTitle": "Property Residence Permit in Istanbul: Conditions, Documents, Steps | Rafiq",
    "navLabel": "Property residence permit in Istanbul",
    "metaDescription": "The property residence permit in Istanbul explained: who may apply, the current conditions, the documents usually required, what the process looks like and how long the permit lasts.",
    "h1": "Property residence permit in Istanbul",
    "eyebrow": "Residence and property guide",
    "heroAlt": "Residential buildings in Istanbul — a property residence permit in Istanbul is granted on the basis of owning residential property",
    "intro": "A property residence permit in Istanbul is a short-term residence permit granted to a foreigner on the basis of owning residential property in Türkiye, and it is one of the first things buyers ask about before and after a purchase. This page sets out, in plain language, who may apply, what the conditions look like today, which documents are usually required and how a file actually moves — with no legal promises: the final decision belongs to the Turkish Directorate of Migration Management alone.",
    "highlights": [
      "A route grounded in Law No. 6458 on Foreigners and International Protection",
      "The property must be genuinely residential in use — not land, not a shop",
      "Some Istanbul districts have been closed to new foreigner registrations since 2022"
    ],
    "sections": [
      {
        "heading": "What is a property residence permit?",
        "body": "A property residence permit is not a separate permit category in Turkish law. It is a short-term residence permit resting on one specific ground: the foreigner owns residential property in Türkiye. The legal basis is Law No. 6458 on Foreigners and International Protection, which counts ownership of residential property among the grounds for a short-term permit. Put simply, you are not buying a permit — you are buying a property, and that property then becomes an accepted ground for a residence application if it satisfies the rules in force at the time you apply. The distinction matters in practice, because the permit stays tied to that ground continuing to exist, not to the purchase itself."
      },
      {
        "heading": "Who can apply for a property residence permit?",
        "body": "Any foreigner with residential property registered in their name in Türkiye may apply for a short-term permit on that basis. The owner's spouse and their minor or dependent children can also apply on the same ground when they hold a share of ownership in the same property. Where a property is jointly owned by several foreigners who are not related to each other, it is normally only one of them who can use the title deed to apply for a residence permit on this ground; the others need a permit type that fits their own situation. Family situations differ widely from one another, which is why reviewing the position before a purchase costs far less than trying to correct it afterwards."
      },
      {
        "heading": "Conditions for a property residence permit in Türkiye",
        "body": "The conditions have changed more than once in recent years, so treat any published list as something that can be updated. What holds today is that the property must be residential in actual use — land, commercial units and projects still under construction do not serve this route. The property value must reach the minimum set by the regulations in force, evidenced by a valuation report from an authorised body; that minimum was raised in mid-October 2023, which is why we do not publish a fixed figure here and instead confirm the threshold that applies to your case when you get in touch. Alongside that: a passport valid long enough to cover the requested period, valid health insurance in Türkiye covering that period, and an address registration that matches the property address."
      },
      {
        "heading": "Closed districts in Istanbul, and what that means for you",
        "body": "Since 2022 a number of neighbourhoods and districts across Türkiye have been closed to new foreigner residence registrations because of the share of foreign residents living there, including ten districts in Istanbul. A closure does not block the purchase itself, but it does mean a property inside a closed neighbourhood may not serve as a basis for registering a new permit, with a general exception for owners who already held property there before the closure date. The lists are updated from time to time, and this is one of the most common reasons a buyer who picked a neighbourhood before asking ends up disappointed. Checking the neighbourhood and the property before signing anything or paying a deposit stays the cheapest step in the whole process."
      },
      {
        "heading": "How long a property residence permit lasts, and renewal",
        "body": "Short-term permits based on property ownership are granted for periods not exceeding two years at a time, according to what the Turkish Directorate of Migration Management publishes, and can be renewed as long as the eligibility conditions still hold. The most important of those is that ownership continues and the property stays in residential use: selling it or converting its use can directly affect a renewal. There is no published ceiling on how many times a permit may be renewed while the conditions are met, but the rules can change — as they have in recent years — so it is wise to start arranging a renewal well before the current permit expires."
      },
      {
        "heading": "A property permit is not citizenship",
        "body": "Confusing two entirely separate routes is the misunderstanding that comes up most often: owning residential property may open the door to a residence permit, but it does not grant Turkish citizenship. Citizenship through real-estate investment is a separate legal route with a far higher value threshold, different procedures and its own requirements. Anyone buying with citizenship in mind needs to know that difference before they pay rather than after, because a property bought against the residence threshold does not automatically become a citizenship-qualifying one."
      },
      {
        "heading": "Common mistakes when seeking residence through buying property",
        "body": "Most refusals and delays come not from legal complexity but from small details: a property whose official valuation falls short of the required minimum, a property never registered for residential use, joint ownership between unrelated foreigners with no clarity on who applies, a property inside a district closed to registration, an address registration that does not match the property, or a passport and health insurance that do not cover the requested period. Every one of these can be spotted before a purchase rather than after — and that is the practical difference between a file that moves and one that stalls."
      }
    ],
    "documentsHeading": "Documents usually required for residence through property ownership",
    "documentsIntro": "This is a general list of what is normally prepared. The final set depends on your situation and on what the migration authority asks for when it reviews the file.",
    "documents": [
      { "label": "Title deed (tapu)", "note": "Shows the property is registered in the applicant's name, and states its type and use." },
      { "label": "Property valuation report", "note": "Issued by an authorised body, confirming the property reaches the minimum in force." },
      { "label": "Valid passport", "note": "With validity long enough to cover the requested residence period." },
      { "label": "Valid health insurance in Türkiye", "note": "Covering the full requested residence period." },
      { "label": "Address registration proof", "note": "Registration in the national address system matching the property address." },
      { "label": "Photographs and supporting documents", "note": "As requested by the competent authority while the file is reviewed." }
    ],
    "stepsHeading": "What applying for a property residence permit in Istanbul looks like",
    "stepsIntro": "This is a general picture of the journey so you know what is ahead. Rafiq coordinates the steps with you and with the specialist offices instead of leaving you to chase each one alone.",
    "steps": [
      { "title": "Check before you buy", "body": "Before any deposit: is the neighbourhood open to new registrations, is the property genuinely residential in use, does its value reach the current threshold? The cheapest step in the whole process, and the one that saves the most." },
      { "title": "Complete the purchase and title registration", "body": "Finishing the purchase and registering ownership officially, together with the authorised valuation that the residence file will rely on later." },
      { "title": "Prepare the documents", "body": "Gathering the title deed, valuation, passport, health insurance and address registration — and checking the details match across all of them before anything is submitted." },
      { "title": "Submit the application and attend the appointment", "body": "Filing the application and following the appointment with the competent authority, with you prepared for what will be asked on the day." },
      { "title": "Follow up, then renew", "body": "Tracking the file until a decision is issued and the card is received, then arranging the renewal before the period ends while the eligibility conditions still hold." }
    ],
    "faqHeading": "Common questions about the property residence permit",
    "faqs": [
      {
        "question": "Does buying property in Türkiye still lead to a residence permit?",
        "answer": "Yes — ownership of residential property remains one of the grounds for a short-term residence permit under Law No. 6458 on Foreigners and International Protection. The conditions have tightened in recent years around the minimum property value and the districts open to registration, so the position in force at the time of your own application is what matters, not an older figure."
      },
      {
        "question": "What property value is required for a property residence permit?",
        "answer": "There is a minimum set by regulation and evidenced by an authorised valuation report, and that minimum was raised in mid-October 2023. Because the figure is subject to change, we do not publish it here as a fixed number; we confirm the threshold in force when you contact us, for your property type and location."
      },
      {
        "question": "Does the permit cover my spouse and children?",
        "answer": "The owner's spouse and their minor or dependent children may apply on the same ground when they hold a share of ownership in the same property. Foreign co-owners who are not related usually see only one of them benefit from the title deed, with the others needing a different permit type."
      },
      {
        "question": "Can I apply with a property in any Istanbul district?",
        "answer": "Not always. Some neighbourhoods have been closed to new foreigner residence registrations since 2022, including ten districts in Istanbul, with a general exception for owners who held property there before the closure date. The lists change, so checking the neighbourhood before buying is the single most protective step."
      },
      {
        "question": "How long is a property residence permit valid?",
        "answer": "Short-term permits are granted for periods not exceeding two years at a time according to what the Turkish Directorate of Migration Management publishes, and are renewable while the eligibility conditions hold. The period actually granted varies with the file and the authority's decision."
      },
      {
        "question": "Does a property residence permit lead to Turkish citizenship?",
        "answer": "No. Residence and citizenship are separate matters. Citizenship through real-estate investment is its own route with a far higher value threshold and different procedures, and it does not follow from simply holding a property residence permit."
      },
      {
        "question": "What happens to my permit if I sell the property?",
        "answer": "The permit is tied to its ground continuing to exist. Selling the property, or changing its use away from residential, can affect a renewal and may mean moving to a different permit type. Anyone planning a sale is better off arranging the alternative before the sale rather than after."
      }
    ],
    "relatedHeading": "Related pages on Rafiq",
    "relatedIntro": "If you are still comparing routes, start with the page closest to your own situation.",
    "related": [
      { "to": "/services/res-property", "label": "Property-based residence permit service", "note": "File coordination on the basis of property ownership, from title deed to appointment." },
      { "to": "/services/res-eligibility", "label": "Residence path and eligibility check", "note": "A review of your situation and the best-fit route before any financial commitment." },
      { "to": "/services/res-renew", "label": "Residence renewal", "note": "Arranging a renewal before expiry, for every permit type." },
      { "to": "/services/res-citizenship", "label": "Turkish citizenship services", "note": "The route that is separate from a property permit, with very different conditions." },
      { "to": "/real-estate", "label": "Properties listed in Istanbul", "note": "Selected listings, with what has and has not been verified stated openly." },
      { "to": "/real-estate/investments", "label": "Real-estate investment opportunities", "note": "Areas and projects, with residence and citizenship thresholds flagged." },
      { "to": "/guides/realestate", "label": "Real estate guide", "note": "What property transactions involve and how to prepare for them." },
      { "to": "/guides/residency", "label": "Residency and official procedures guide", "note": "The other permit types and the official procedures around them." },
      { "to": "/compare/residency-diy", "label": "Rafiq or filing it yourself?", "note": "A straight comparison between coordinating with Rafiq and self-filing." }
    ],
    "ctaTitle": "Check your position before you buy",
    "ctaBody": "Send the details of your case — property type, neighbourhood, family situation — and we will coordinate the next step with you and set out the conditions that apply to you specifically. Costs vary by case; we give you the exact figure when we talk.",
    "ctaButton": "Request help",
    "whatsappButton": "Ask on WhatsApp",
    "whatsappMessage": "Hello, I would like to ask about the property residence permit in Istanbul",
    "onThisPage": "On this page",
    "breadcrumbLabel": "Breadcrumb",
    "disclaimer": "Rafiq is an independent coordination platform — not a government authority and not a law firm. What is on this page is general information, the rules can change, and the final decision on any residence application rests with the Turkish Directorate of Migration Management."
  },
  "ru": {
    "seoTitle": "ВНЖ при покупке недвижимости в Стамбуле: условия, документы, шаги | Rafiq",
    "navLabel": "ВНЖ по недвижимости в Стамбуле",
    "metaDescription": "ВНЖ на основании недвижимости в Стамбуле: кто может подать, какие условия действуют сейчас, какие документы обычно нужны, как проходит процесс и на какой срок выдаётся разрешение.",
    "h1": "ВНЖ по недвижимости в Стамбуле",
    "eyebrow": "Гид по ВНЖ и недвижимости",
    "heroAlt": "Жилые дома в Стамбуле — ВНЖ по недвижимости в Стамбуле выдаётся на основании владения жилой недвижимостью",
    "intro": "ВНЖ по недвижимости в Стамбуле — это краткосрочное разрешение на проживание, которое выдаётся иностранцу на основании владения жилой недвижимостью в Турции, и это один из первых вопросов покупателей до и после сделки. Здесь простым языком изложено, кто может подать заявление, какие условия действуют сегодня, какие документы обычно требуются и как реально движется дело — без юридических обещаний: окончательное решение принимает только Управление по миграции Турции.",
    "highlights": [
      "Основание — Закон № 6458 об иностранцах и международной защите",
      "Объект должен быть жилым по фактическому использованию: не земля и не коммерция",
      "Часть районов Стамбула с 2022 года закрыта для новой регистрации иностранцев"
    ],
    "sections": [
      {
        "heading": "Что такое ВНЖ по недвижимости?",
        "body": "ВНЖ по недвижимости — это не отдельная категория в турецком законодательстве, а краткосрочный вид на жительство с конкретным основанием: иностранец владеет жилой недвижимостью в Турции. Правовая база — Закон № 6458 об иностранцах и международной защите, который относит владение жилым объектом к основаниям для краткосрочного ВНЖ. Проще говоря, вы покупаете не разрешение, а объект, и этот объект затем становится принимаемым основанием для заявления, если отвечает правилам, действующим на момент подачи. Разница важна на практике: разрешение привязано к тому, что основание продолжает существовать, а не к самой сделке."
      },
      {
        "heading": "Кто может подать на ВНЖ по недвижимости?",
        "body": "Подать заявление на краткосрочный ВНЖ по этому основанию может любой иностранец, на имя которого в Турции зарегистрирована жилая недвижимость. Супруг или супруга собственника, а также его несовершеннолетние или находящиеся на иждивении дети могут подать по тому же основанию, если у них есть доля в том же объекте. Если же объект находится в общей собственности нескольких иностранцев, не связанных родством, то воспользоваться свидетельством о собственности для получения ВНЖ обычно может только один из них, а остальным нужен другой тип разрешения. Семейные ситуации сильно различаются, поэтому проверить положение дел до покупки намного дешевле, чем исправлять его после."
      },
      {
        "heading": "Условия ВНЖ по недвижимости в Турции",
        "body": "Условия менялись за последние годы не раз, поэтому любой опубликованный список следует считать подлежащим обновлению. Неизменным остаётся требование: объект должен быть жилым по фактическому использованию — земля, коммерческие помещения и строящиеся проекты этому маршруту не подходят. Стоимость объекта должна достигать минимума, установленного действующими правилами, и подтверждаться отчётом об оценке от уполномоченной организации; этот минимум был повышен в середине октября 2023 года, поэтому мы не публикуем здесь фиксированную цифру, а подтверждаем действующий порог для вашего случая при обращении. Дополнительно: действующий загранпаспорт с достаточным сроком, действующая медицинская страховка в Турции на запрашиваемый период и регистрация адреса, совпадающая с адресом объекта."
      },
      {
        "heading": "Закрытые районы Стамбула и что это значит для вас",
        "body": "С 2022 года ряд кварталов и районов Турции закрыт для новой регистрации ВНЖ иностранцев из-за высокой доли иностранных жителей, и среди них десять районов Стамбула. Закрытие само по себе не запрещает покупку, но означает, что объект внутри закрытого квартала может не подойти как основание для регистрации нового разрешения, с общим исключением для тех, кто владел там недвижимостью до даты закрытия. Списки время от времени обновляются, и именно это — одна из самых частых причин разочарования покупателя, выбравшего район прежде, чем задать вопрос. Проверка района и объекта до подписания договора и до задатка остаётся самым дешёвым шагом во всём процессе."
      },
      {
        "heading": "Срок ВНЖ по недвижимости и продление",
        "body": "Краткосрочные разрешения на основании владения недвижимостью выдаются на срок не более двух лет за раз — согласно публикациям Управления по миграции Турции — и продлеваются, пока сохраняются условия соответствия. Главное из них: собственность сохраняется, а объект остаётся в жилом использовании. Продажа объекта или изменение его назначения может напрямую повлиять на продление. Опубликованного предела по числу продлений при соблюдении условий нет, но правила меняются — как это уже происходило в последние годы, — поэтому продление разумно готовить заблаговременно."
      },
      {
        "heading": "ВНЖ по недвижимости — это не гражданство",
        "body": "Смешение двух совершенно разных маршрутов встречается чаще всего: владение жилой недвижимостью может открыть путь к ВНЖ, но не даёт турецкого гражданства. Гражданство через инвестиции в недвижимость — отдельный правовой маршрут с существенно более высоким стоимостным порогом, другими процедурами и собственными требованиями. Тому, кто покупает с прицелом на гражданство, важно понимать эту разницу до оплаты, а не после: объект, купленный под порог ВНЖ, автоматически не становится подходящим для гражданства."
      },
      {
        "heading": "Частые ошибки при получении ВНЖ через покупку недвижимости",
        "body": "Большинство отказов и задержек связано не со сложностью закона, а с мелочами: объект, официальная оценка которого не дотягивает до минимума; объект, никогда не регистрировавшийся как жилой; общая собственность иностранцев без родства и без ясности, кто подаёт; объект в районе, закрытом для регистрации; регистрация адреса, не совпадающая с объектом; паспорт и страховка, не покрывающие запрашиваемый срок. Каждый из этих пунктов можно выявить до покупки, а не после, и в этом практическая разница между делом, которое движется, и делом, которое стоит."
      }
    ],
    "documentsHeading": "Документы, которые обычно требуются для ВНЖ по владению недвижимостью",
    "documentsIntro": "Это общий перечень того, что готовят обычно. Итоговый набор зависит от вашей ситуации и от требований миграционного органа при рассмотрении дела.",
    "documents": [
      { "label": "Свидетельство о собственности (tapu)", "note": "Подтверждает регистрацию объекта на имя заявителя и указывает его тип и назначение." },
      { "label": "Отчёт об оценке недвижимости", "note": "От уполномоченной организации, подтверждает достижение действующего минимума." },
      { "label": "Действующий загранпаспорт", "note": "Со сроком действия, покрывающим запрашиваемый период проживания." },
      { "label": "Действующая медицинская страховка в Турции", "note": "На весь запрашиваемый период проживания." },
      { "label": "Подтверждение регистрации адреса", "note": "Регистрация в национальной адресной системе, совпадающая с адресом объекта." },
      { "label": "Фотографии и сопроводительные документы", "note": "По требованию компетентного органа при рассмотрении дела." }
    ],
    "stepsHeading": "Как выглядит оформление ВНЖ по недвижимости в Стамбуле",
    "stepsIntro": "Это общая картина пути, чтобы вы понимали, что вас ждёт. Rafiq координирует шаги с вами и профильными офисами, вместо того чтобы вы обходили каждую инстанцию самостоятельно.",
    "steps": [
      { "title": "Проверка до покупки", "body": "До любого задатка: открыт ли район для новых регистраций, действительно ли объект жилой по использованию, достигает ли его стоимость действующего порога. Самый дешёвый шаг во всём процессе и самый выгодный." },
      { "title": "Завершение сделки и регистрация собственности", "body": "Оформление покупки и официальная регистрация собственности вместе с оценкой от уполномоченной организации, на которую позже опирается дело о ВНЖ." },
      { "title": "Подготовка документов", "body": "Сбор свидетельства о собственности, оценки, паспорта, страховки и регистрации адреса и сверка данных между документами до подачи." },
      { "title": "Подача заявления и запись на приём", "body": "Подача заявления и сопровождение записи в компетентный орган, с подготовкой к тому, что спросят на приёме." },
      { "title": "Сопровождение и последующее продление", "body": "Отслеживание дела до решения и получения карты, затем подготовка продления до окончания срока, пока сохраняются условия соответствия." }
    ],
    "faqHeading": "Частые вопросы о ВНЖ по недвижимости",
    "faqs": [
      {
        "question": "Даёт ли покупка недвижимости в Турции право на ВНЖ сегодня?",
        "answer": "Да, владение жилой недвижимостью остаётся одним из оснований для краткосрочного ВНЖ по Закону № 6458 об иностранцах и международной защите. Но условия за последние годы ужесточились в части минимальной стоимости объекта и районов, открытых для регистрации, поэтому важно положение на момент именно вашей подачи, а не устаревшие данные."
      },
      {
        "question": "Какая стоимость объекта нужна для ВНЖ по недвижимости?",
        "answer": "Минимум установлен правилами и подтверждается отчётом об оценке от уполномоченной организации; он был повышен в середине октября 2023 года. Поскольку цифра может меняться, мы не публикуем её здесь как фиксированную, а подтверждаем действующий порог при обращении — с учётом типа и расположения объекта."
      },
      {
        "question": "Распространяется ли разрешение на супругу и детей?",
        "answer": "Супруг или супруга собственника и его несовершеннолетние или находящиеся на иждивении дети могут подать по тому же основанию, если владеют долей в том же объекте. Среди иностранных совладельцев без родства свидетельством о собственности обычно пользуется лишь один, остальным нужен другой тип разрешения."
      },
      {
        "question": "Можно ли подавать с объектом в любом районе Стамбула?",
        "answer": "Не всегда. Часть кварталов закрыта для новой регистрации ВНЖ иностранцев с 2022 года, включая десять районов Стамбула, с общим исключением для тех, кто владел там недвижимостью до даты закрытия. Списки меняются, поэтому проверка района до покупки — самый защищающий шаг."
      },
      {
        "question": "На какой срок выдаётся ВНЖ по недвижимости?",
        "answer": "Краткосрочные разрешения выдаются на срок не более двух лет за раз согласно публикациям Управления по миграции Турции и продлеваются, пока сохраняются условия. Фактически предоставленный срок зависит от дела и решения компетентного органа."
      },
      {
        "question": "Даёт ли ВНЖ по недвижимости турецкое гражданство?",
        "answer": "Нет. ВНЖ и гражданство — разные вещи. Гражданство через инвестиции в недвижимость — отдельный маршрут со значительно более высоким стоимостным порогом и другими процедурами, и оно не следует из самого факта наличия ВНЖ по недвижимости."
      },
      {
        "question": "Что будет с ВНЖ, если я продам объект?",
        "answer": "Разрешение привязано к сохранению своего основания. Продажа объекта или изменение его назначения с жилого на иное может повлиять на продление и потребовать перехода на другой тип разрешения. Тому, кто планирует продажу, лучше подготовить альтернативу заранее."
      }
    ],
    "relatedHeading": "Связанные страницы Rafiq",
    "relatedIntro": "Если вы ещё сравниваете маршруты, начните со страницы, ближайшей к вашей ситуации.",
    "related": [
      { "to": "/services/res-property", "label": "Услуга: ВНЖ на основании недвижимости", "note": "Координация дела на основании владения объектом — от свидетельства до приёма." },
      { "to": "/services/res-eligibility", "label": "Проверка маршрута ВНЖ и права на подачу", "note": "Разбор вашей ситуации и подходящего маршрута до финансовых обязательств." },
      { "to": "/services/res-renew", "label": "Продление ВНЖ", "note": "Подготовка продления до окончания срока для всех типов разрешений." },
      { "to": "/services/res-citizenship", "label": "Услуги по турецкому гражданству", "note": "Маршрут, отдельный от ВНЖ по недвижимости, с совсем другими условиями." },
      { "to": "/real-estate", "label": "Объекты в Стамбуле", "note": "Отобранные предложения с прямым указанием, что проверено, а что нет." },
      { "to": "/real-estate/investments", "label": "Инвестиционные возможности", "note": "Районы и проекты с пометками о порогах ВНЖ и гражданства." },
      { "to": "/guides/realestate", "label": "Гид по недвижимости", "note": "Что включают сделки с недвижимостью и как к ним подготовиться." },
      { "to": "/guides/residency", "label": "Гид по ВНЖ и официальным процедурам", "note": "Другие типы разрешений и связанные с ними процедуры." },
      { "to": "/compare/residency-diy", "label": "Rafiq или подача самостоятельно?", "note": "Честное сравнение координации с Rafiq и самостоятельной подачи." }
    ],
    "ctaTitle": "Проверьте своё положение до покупки",
    "ctaBody": "Отправьте детали: тип объекта, район, состав семьи — мы согласуем следующий шаг и разъясним условия, которые действуют именно для вас. Стоимость зависит от случая; точную цифру называем при обращении.",
    "ctaButton": "Запросить помощь",
    "whatsappButton": "Спросить в WhatsApp",
    "whatsappMessage": "Здравствуйте, хочу спросить о ВНЖ по недвижимости в Стамбуле",
    "onThisPage": "На этой странице",
    "breadcrumbLabel": "Навигационная цепочка",
    "disclaimer": "Rafiq — независимая платформа координации, а не государственный орган и не юридическая фирма. Здесь приведена общая информация, правила могут меняться, а окончательное решение по любому заявлению принимает Управление по миграции Турции."
  },
  "fa": {
    "seoTitle": "اقامت ملکی در استانبول: شرایط، مدارک و مراحل | رفیق",
    "navLabel": "اقامت ملکی در استانبول",
    "metaDescription": "اقامت ملکی در استانبول: چه کسی می‌تواند درخواست دهد، شرایط امروز چیست، چه مدارکی لازم است، روند پرونده چگونه پیش می‌رود و مدت اقامت چقدر است.",
    "h1": "اقامت ملکی در استانبول",
    "eyebrow": "راهنمای اقامت و ملک",
    "heroAlt": "ساختمان‌های مسکونی در استانبول — اقامت ملکی در استانبول بر پایه مالکیت ملک مسکونی صادر می‌شود",
    "intro": "اقامت ملکی در استانبول یک اقامت کوتاه‌مدت است که بر پایه مالکیت ملک مسکونی در ترکیه به فرد خارجی داده می‌شود و یکی از نخستین پرسش‌های خریداران پیش و پس از خرید است. این صفحه به زبان ساده توضیح می‌دهد چه کسی می‌تواند درخواست دهد، شرایط امروز چیست، معمولاً چه مدارکی لازم است و پرونده در عمل چگونه پیش می‌رود — بدون هیچ تضمین حقوقی: تصمیم نهایی تنها با اداره مهاجرت ترکیه است.",
    "highlights": [
      "مسیری بر پایه قانون اتباع خارجی و حمایت بین‌المللی شماره ۶۴۵۸",
      "ملک باید در کاربری واقعی مسکونی باشد، نه زمین و نه واحد تجاری",
      "برخی محله‌های استانبول از سال ۲۰۲۲ برای ثبت اقامت جدید اتباع بسته‌اند"
    ],
    "sections": [
      {
        "heading": "اقامت ملکی چیست؟",
        "body": "اقامت ملکی در قانون ترکیه یک دسته مستقل نیست، بلکه اقامتی کوتاه‌مدت است که بر پایه یک دلیل مشخص صادر می‌شود: مالکیت ملک مسکونی در ترکیه توسط فرد خارجی. مبنای قانونی آن قانون اتباع خارجی و حمایت بین‌المللی شماره ۶۴۵۸ است که مالکیت ملک مسکونی را از دلایل صدور اقامت کوتاه‌مدت می‌شمارد. به بیان ساده، شما اقامت نمی‌خرید؛ ملک می‌خرید و آن ملک در صورت داشتن شرایط روز، به دلیلی پذیرفتنی برای درخواست اقامت تبدیل می‌شود. این تفاوت در عمل مهم است، چون اقامت به پابرجا ماندن همان دلیل وابسته است، نه به خود معامله."
      },
      {
        "heading": "چه کسی می‌تواند برای اقامت ملکی درخواست دهد؟",
        "body": "هر فرد خارجی که ملکی مسکونی در ترکیه به نام او ثبت شده باشد می‌تواند بر همین پایه درخواست اقامت کوتاه‌مدت بدهد. همسر مالک و فرزندان صغیر یا تحت تکفل او نیز در صورتی که در همان ملک سهم مالکیت داشته باشند می‌توانند بر همین پایه درخواست دهند. اگر ملک به‌صورت مشترک میان چند خارجی بدون نسبت خویشاوندی باشد، معمولاً تنها یک نفر می‌تواند از سند مالکیت برای درخواست اقامت استفاده کند و بقیه به نوع دیگری از اقامت نیاز دارند. چون وضعیت خانواده‌ها بسیار متفاوت است، بررسی پرونده پیش از خرید بسیار کم‌هزینه‌تر از اصلاح آن پس از خرید است."
      },
      {
        "heading": "شرایط اقامت ملکی در ترکیه",
        "body": "شرایط در سال‌های اخیر بیش از یک بار تغییر کرده است، بنابراین هر فهرست منتشرشده را باید قابل به‌روزرسانی دانست. آنچه امروز پابرجاست این است که ملک باید در کاربری واقعی مسکونی باشد؛ زمین، واحد تجاری و پروژه‌های در حال ساخت به این مسیر نمی‌خورند. ارزش ملک نیز باید به حداقل تعیین‌شده در مقررات جاری برسد و با گزارش ارزیابی از نهاد مجاز اثبات شود؛ این حداقل در نیمه اکتبر ۲۰۲۳ افزایش یافت و به همین دلیل عدد ثابتی اینجا منتشر نمی‌کنیم و آستانه جاری پرونده شما را هنگام تماس تأیید می‌کنیم. افزون بر آن: گذرنامه معتبر با مدت کافی، بیمه درمانی معتبر در ترکیه برای کل دوره و ثبت آدرسی که با آدرس ملک بخواند."
      },
      {
        "heading": "محله‌های بسته استانبول و معنای آن برای شما",
        "body": "از سال ۲۰۲۲ شماری از محله‌ها و مناطق ترکیه به دلیل بالا بودن نسبت ساکنان خارجی برای ثبت اقامت جدید اتباع بسته شده‌اند و ده منطقه استانبول نیز در میان آن‌هاست. بسته بودن، خرید را ممنوع نمی‌کند اما یعنی ملکی در محله بسته ممکن است مبنای ثبت اقامت جدید قرار نگیرد، با استثنای عمومی برای کسانی که پیش از تاریخ بسته شدن در آنجا مالک بوده‌اند. فهرست‌ها گاه‌به‌گاه به‌روز می‌شوند و همین یکی از رایج‌ترین دلایل ناامیدی خریداری است که محله را پیش از پرسیدن انتخاب کرده است. بررسی محله و ملک پیش از امضای قرارداد و پرداخت بیعانه کم‌هزینه‌ترین گام کل مسیر است."
      },
      {
        "heading": "مدت اقامت ملکی و تمدید آن",
        "body": "اقامت کوتاه‌مدت بر پایه مالکیت ملک، بنا بر آنچه اداره مهاجرت ترکیه منتشر می‌کند، هر بار برای دوره‌ای حداکثر دو ساله صادر می‌شود و تا زمانی که شرایط برقرار باشد قابل تمدید است. مهم‌ترین این شرایط تداوم مالکیت و باقی ماندن کاربری مسکونی ملک است: فروش ملک یا تغییر کاربری آن می‌تواند مستقیماً بر تمدید اثر بگذارد. سقف اعلام‌شده‌ای برای تعداد دفعات تمدید وجود ندارد، اما مقررات تغییرپذیر است — چنان‌که در سال‌های اخیر رخ داده — پس بهتر است تمدید را زودتر از پایان مدت آماده کنید."
      },
      {
        "heading": "اقامت ملکی شهروندی نیست",
        "body": "خلط دو مسیر کاملاً جدا، رایج‌ترین سوءبرداشت است: مالکیت ملک مسکونی ممکن است راه اقامت را باز کند اما شهروندی ترکیه نمی‌دهد. شهروندی از راه سرمایه‌گذاری ملکی مسیری حقوقی جداگانه با آستانه ارزشی بسیار بالاتر، رویه‌های متفاوت و الزامات ویژه خود است. کسی که با نیت شهروندی می‌خرد باید این تفاوت را پیش از پرداخت بداند نه پس از آن، چون ملکی که برای آستانه اقامت خریده شده خودبه‌خود واجد شرایط شهروندی نمی‌شود."
      },
      {
        "heading": "رایج‌ترین اشتباه‌ها در گرفتن اقامت از راه خرید ملک",
        "body": "بیشتر رد شدن‌ها و تأخیرها نه از پیچیدگی قانون بلکه از جزئیات کوچک می‌آید: ملکی که ارزیابی رسمی‌اش به حداقل لازم نمی‌رسد، ملکی که اصلاً با کاربری مسکونی ثبت نشده، مالکیت مشترک میان خارجی‌های بدون نسبت بدون روشن بودن اینکه چه کسی درخواست می‌دهد، ملکی در محله بسته، ثبت آدرسی که با ملک نمی‌خواند، یا گذرنامه و بیمه‌ای که دوره خواسته‌شده را پوشش نمی‌دهد. هر یک از این موارد را می‌توان پیش از خرید کشف کرد نه پس از آن، و همین تفاوت عملی میان پرونده‌ای است که پیش می‌رود و پرونده‌ای که متوقف می‌ماند."
      }
    ],
    "documentsHeading": "مدارک لازم برای اقامت از راه مالکیت ملک در ترکیه",
    "documentsIntro": "این فهرستی عمومی از چیزی است که معمولاً آماده می‌شود. مجموعه نهایی به وضعیت شما و خواسته اداره مهاجرت هنگام بررسی پرونده بستگی دارد.",
    "documents": [
      { "label": "سند مالکیت (تاپو)", "note": "ثبت ملک به نام متقاضی را نشان می‌دهد و نوع و کاربری آن را مشخص می‌کند." },
      { "label": "گزارش ارزیابی ملک", "note": "صادرشده از نهاد مجاز، تأییدکننده رسیدن ارزش ملک به حداقل جاری." },
      { "label": "گذرنامه معتبر", "note": "با اعتباری که دوره اقامت درخواستی را پوشش دهد." },
      { "label": "بیمه درمانی معتبر در ترکیه", "note": "پوشش کامل دوره اقامت درخواستی." },
      { "label": "مدرک ثبت آدرس", "note": "ثبت در سامانه ملی آدرس، منطبق با آدرس ملک." },
      { "label": "عکس و مدارک پشتیبان", "note": "بر پایه آنچه مرجع صلاحیت‌دار هنگام بررسی پرونده می‌خواهد." }
    ],
    "stepsHeading": "مراحل درخواست اقامت ملکی در استانبول",
    "stepsIntro": "این تصویری کلی از مسیر است تا بدانید چه در پیش دارید. رفیق مراحل را با شما و دفاتر تخصصی هماهنگ می‌کند تا ناچار نباشید هر مرجع را تنها دنبال کنید.",
    "steps": [
      { "title": "بررسی پیش از خرید", "body": "پیش از هر بیعانه: آیا محله برای ثبت اقامت جدید باز است، آیا ملک واقعاً کاربری مسکونی دارد، آیا ارزش آن به آستانه جاری می‌رسد. کم‌هزینه‌ترین و پرصرفه‌ترین گام کل مسیر." },
      { "title": "تکمیل خرید و ثبت سند", "body": "تکمیل معامله و ثبت رسمی مالکیت، همراه با ارزیابی نهاد مجاز که بعداً پرونده اقامت به آن تکیه می‌کند." },
      { "title": "آماده‌سازی مدارک", "body": "گردآوری سند مالکیت، ارزیابی، گذرنامه، بیمه درمانی و ثبت آدرس و اطمینان از هم‌خوانی اطلاعات میان مدارک پیش از ارائه." },
      { "title": "ارائه درخواست و پیگیری وقت", "body": "ثبت درخواست و پیگیری وقت نزد مرجع صلاحیت‌دار، با آماده کردن شما برای آنچه در آن روز پرسیده می‌شود." },
      { "title": "پیگیری و سپس تمدید", "body": "پیگیری پرونده تا صدور تصمیم و دریافت کارت، سپس ترتیب دادن تمدید پیش از پایان مدت تا وقتی شرایط برقرار است." }
    ],
    "faqHeading": "پرسش‌های رایج درباره اقامت ملکی",
    "faqs": [
      {
        "question": "آیا خرید ملک در ترکیه هنوز اقامت می‌دهد؟",
        "answer": "بله، مالکیت ملک مسکونی همچنان یکی از دلایل صدور اقامت کوتاه‌مدت بر پایه قانون شماره ۶۴۵۸ است. اما شرایط در سال‌های اخیر از نظر حداقل ارزش ملک و مناطق مجاز برای ثبت سخت‌تر شده است، بنابراین آنچه اهمیت دارد وضعیت جاری در زمان درخواست خود شماست، نه اطلاعات قدیمی."
      },
      {
        "question": "برای اقامت ملکی چه ارزشی از ملک لازم است؟",
        "answer": "حداقلی در مقررات تعیین شده که با گزارش ارزیابی نهاد مجاز اثبات می‌شود و در نیمه اکتبر ۲۰۲۳ افزایش یافت. چون این عدد تغییرپذیر است، آن را اینجا به‌صورت ثابت منتشر نمی‌کنیم و آستانه جاری را هنگام تماس، بر پایه نوع و موقعیت ملک، به شما تأیید می‌کنیم."
      },
      {
        "question": "آیا همسر و فرزندان من هم پوشش داده می‌شوند؟",
        "answer": "همسر مالک و فرزندان صغیر یا تحت تکفل او در صورتی که در همان ملک سهم مالکیت داشته باشند می‌توانند بر همین پایه درخواست دهند. میان شرکای خارجی بدون نسبت خویشاوندی، معمولاً تنها یک نفر از سند مالکیت بهره می‌برد و بقیه به نوع دیگری از اقامت نیاز دارند."
      },
      {
        "question": "آیا می‌توانم با ملکی در هر محله استانبول درخواست دهم؟",
        "answer": "همیشه نه. برخی محله‌ها از سال ۲۰۲۲ برای ثبت اقامت جدید اتباع بسته شده‌اند، از جمله ده منطقه در استانبول، با استثنای عمومی برای کسانی که پیش از تاریخ بسته شدن در آنجا مالک بوده‌اند. فهرست‌ها تغییر می‌کنند و بررسی محله پیش از خرید محافظت‌کننده‌ترین گام است."
      },
      {
        "question": "مدت اعتبار اقامت ملکی چقدر است؟",
        "answer": "اقامت کوتاه‌مدت بنا بر آنچه اداره مهاجرت ترکیه منتشر می‌کند هر بار حداکثر برای دو سال صادر می‌شود و تا برقراری شرایط قابل تمدید است. مدت واقعی اعطاشده بسته به پرونده و تصمیم مرجع صلاحیت‌دار متفاوت است."
      },
      {
        "question": "آیا اقامت ملکی به شهروندی ترکیه می‌رسد؟",
        "answer": "خیر. اقامت و شهروندی دو موضوع جدا هستند. شهروندی از راه سرمایه‌گذاری ملکی مسیری جداگانه با آستانه ارزشی بسیار بالاتر و رویه‌های متفاوت است و از داشتن اقامت ملکی به دست نمی‌آید."
      },
      {
        "question": "اگر ملک را بفروشم چه بر سر اقامتم می‌آید؟",
        "answer": "اقامت به پابرجا ماندن دلیل آن وابسته است. فروش ملک یا تغییر کاربری آن از مسکونی به چیز دیگر می‌تواند بر تمدید اثر بگذارد و شاید نیاز به تغییر نوع اقامت ایجاد کند. کسی که قصد فروش دارد بهتر است جایگزین را پیش از فروش ترتیب دهد."
      }
    ],
    "relatedHeading": "صفحه‌های مرتبط در رفیق",
    "relatedIntro": "اگر هنوز مسیرها را مقایسه می‌کنید، از صفحه‌ای شروع کنید که به وضعیت شما نزدیک‌تر است.",
    "related": [
      { "to": "/services/res-property", "label": "خدمت اقامت بر پایه مالکیت ملک", "note": "هماهنگی پرونده بر پایه مالکیت ملک، از سند تا وقت اداری." },
      { "to": "/services/res-eligibility", "label": "بررسی مسیر اقامت و شرایط", "note": "بازبینی وضعیت شما و مسیر مناسب پیش از هر تعهد مالی." },
      { "to": "/services/res-renew", "label": "تمدید اقامت", "note": "ترتیب تمدید پیش از پایان مدت برای همه انواع اقامت." },
      { "to": "/services/res-citizenship", "label": "خدمات شهروندی ترکیه", "note": "مسیری جدا از اقامت ملکی، با شرایط و ارزشی کاملاً متفاوت." },
      { "to": "/real-estate", "label": "ملک‌های عرضه‌شده در استانبول", "note": "پیشنهادهای گزیده، با تصریح آنچه راستی‌آزمایی شده و آنچه نشده." },
      { "to": "/real-estate/investments", "label": "فرصت‌های سرمایه‌گذاری ملکی", "note": "مناطق و پروژه‌ها، با اشاره به آستانه‌های اقامت و شهروندی." },
      { "to": "/guides/realestate", "label": "راهنمای املاک", "note": "معاملات ملکی شامل چه چیزهایی است و چگونه برای آن آماده شویم." },
      { "to": "/guides/residency", "label": "راهنمای اقامت و امور رسمی", "note": "دیگر انواع اقامت و رویه‌های رسمی مرتبط با آن‌ها." },
      { "to": "/compare/residency-diy", "label": "رفیق یا اقدام شخصی؟", "note": "مقایسه صریح میان هماهنگی با رفیق و اقدام شخصی." }
    ],
    "ctaTitle": "پیش از خرید وضعیت خود را بررسی کنید",
    "ctaBody": "جزئیات پرونده خود را بفرستید — نوع ملک، محله و وضعیت خانواده — تا گام بعدی را با شما هماهنگ کنیم و شرایطی را که دقیقاً بر شما اعمال می‌شود روشن کنیم. هزینه بسته به مورد متفاوت است و رقم دقیق را هنگام تماس می‌گوییم.",
    "ctaButton": "درخواست کمک",
    "whatsappButton": "پرسش در واتساپ",
    "whatsappMessage": "سلام، می‌خواهم درباره اقامت ملکی در استانبول بپرسم",
    "onThisPage": "در این صفحه",
    "breadcrumbLabel": "مسیر راهنما",
    "disclaimer": "رفیق یک پلتفرم هماهنگی مستقل است — نه نهاد دولتی و نه دفتر حقوقی. آنچه در این صفحه آمده اطلاعات عمومی است، مقررات تغییرپذیر است و تصمیم نهایی درباره هر درخواست اقامت با اداره مهاجرت ترکیه است."
  },
};
