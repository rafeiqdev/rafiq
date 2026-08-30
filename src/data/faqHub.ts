/**
 * The /faq hub — a single consolidated page of short, direct answers to the
 * questions foreigners (and AI assistants on their behalf) most often ask
 * about Turkish residency, money, and daily life in Istanbul.
 *
 * Distinct from category guides and comparisons: a guide goes deep on one
 * topic, a comparison contrasts two paths, this page answers many
 * independent short questions in one place — the shape FAQPage schema and
 * AI answer engines both favor for direct Q&A extraction. It deliberately
 * stays short per answer and links out to the fuller guide/service/
 * comparison page for depth, rather than duplicating that content here.
 *
 * Same guardrails as every other service-facing content in this codebase:
 * no exact government fees, no step-by-step DIY instructions, no guaranteed
 * outcomes, and no claim that Rafiq is a government authority, bank, law
 * firm, or clinic.
 *
 * Double-quoted JSON-style strings, same reason as comparisons.ts: read by
 * scripts/generate-seo-pages.mjs via brace-matching + JSON.parse, not a
 * field-by-field regex parser.
 */

export type FaqHubLanguage = "ar" | "en" | "ru" | "fa";

export interface FaqHubItem {
  question: string;
  answer: string;
}

export interface FaqHubCategory {
  heading: string;
  items: FaqHubItem[];
}

export interface FaqHubContent {
  seoTitle: string;
  metaDescription: string;
  intro: string;
  categories: FaqHubCategory[];
}

export const FAQ_HUB: Record<FaqHubLanguage, FaqHubContent> = {
  "ar": {
    "seoTitle": "الأسئلة الشائعة عن الإقامة والحياة في إسطنبول | رفيق",
    "metaDescription": "إجابات مباشرة عن أكتر الأسئلة تكراراً حول الإقامة التركية، البنوك، والحياة اليومية بإسطنبول للأجانب.",
    "intro": "هاي مجموعة من أكتر الأسئلة اللي بيسألها الأجانب عن الإقامة والحياة بإسطنبول، بإجابات مباشرة وصريحة. للتفاصيل الكاملة عن أي موضوع، تقدر تزور الدليل أو الخدمة المخصصة له.",
    "categories": [
      {
        "heading": "الإقامة والأوراق الرسمية",
        "items": [
          { "question": "كم يستغرق استخراج الإقامة التركية؟", "answer": "المدة بتختلف حسب نوع الإقامة وعبء العمل الحالي عند دائرة الهجرة، وما فيه رقم ثابت ينطبق على الكل. أدق مصدر لمعرفة الجدول الزمني الفعلي هو موعدك أو حسابك على منصة e-İkamet." },
          { "question": "هل لازم امتلك عقار عشان أحصل على إقامة بتركيا؟", "answer": "لا. في أكتر من مسار للإقامة — متل الإقامة السياحية اللي ما بتحتاج ملكية عقار. امتلاك عقار مسار واحد من بين عدة مسارات، مش شرط عام." },
          { "question": "شو الفرق بين الإقامة السياحية وإقامة العقار؟", "answer": "الإقامة السياحية بتُمنح بناءً على إثبات إقامتك الفعلية بتركيا (متل عقد إيجار)، بينما إقامة العقار بتُمنح بناءً على ملكية عقار مسجّلة باسمك. كل نوع له شروطه ووثائقه الخاصة عند دائرة الهجرة." },
          { "question": "هل ممكن أجدد إقامتي بعد ما تترفض مرة؟", "answer": "نعم، الرفض السابق ما بيمنع تقديم طلب جديد أو تجديد لاحق، بس بيصير مهم تفهم سبب الرفض قبل إعادة التقديم." }
        ]
      },
      {
        "heading": "المال والبنوك",
        "items": [
          { "question": "هل لازم رقم ضريبي لفتح حساب بنكي بتركيا؟", "answer": "أغلب البنوك بتطلب رقم ضريبي كجزء من فتح الحساب لأي شخص أجنبي، وممكن الحصول عليه بسهولة من مكتب الضرائب. المتطلبات الدقيقة ممكن تختلف من بنك لبنك." },
          { "question": "هل ممكن أفتح حساب بنكي بدون إقامة سارية؟", "answer": "بعض البنوك بتسمح بفتح حساب بجواز السفر فقط لمدة محدودة، بس أغلبها بيفضّل وجود إقامة سارية. الخيارات المتاحة بتختلف حسب البنك ووضعك." },
          { "question": "هل رفيق بيتحكم بالرسوم الحكومية أو رسوم البنك؟", "answer": "لا إطلاقاً. الرسوم الحكومية ورسوم البنوك تحددها الجهات الرسمية والبنوك نفسها حصراً، ورفيق ما بيضيف عليها ولا بيتحكم فيها." },
          { "question": "أي عملة أحسن أحتفظ فيها بحسابي بتركيا؟", "answer": "بيعتمد على وضعك الشخصي (دخل، مصاريف، مدة الإقامة). كتير ناس بتحتفظ بحساب بالليرة التركية وبعملة أجنبية معاً لتوزيع المخاطر، بس القرار شخصي وبيرجع لاستشارة مالية مناسبة لحالتك." }
        ]
      },
      {
        "heading": "الحياة اليومية والتنقل",
        "items": [
          { "question": "شو هو إسطنبول كارت وليش بحتاجه؟", "answer": "إسطنبول كارت بطاقة إلكترونية مدفوعة مسبقاً تستخدمها لكل وسائل النقل العام بإسطنبول (مترو، باص، ترام، فيري). ممكن تشحنها من الآلات المنتشرة بالمحطات ونقاط البيع." },
          { "question": "هل لازم أسجل رقم الموبايل الأجنبي تبعي بتركيا؟", "answer": "أي جهاز أجنبي بيحتاج تسجيل IMEI بعد فترة معينة من الاستخدام بشبكة تركية، وإلا بينحظر عن الشبكات المحلية. الإجراء له رسوم رسمية ثابتة تحددها الدولة." },
          { "question": "هل تركيا آمنة للأجانب بشكل عام؟", "answer": "إسطنبول متل أي مدينة كبيرة فيها مناطق وأوقات أأمن من غيرها، وأغلب الأجانب بيعيشوا فيها بدون مشاكل أمنية كبيرة. الحس السليم المعتاد كافي بأغلب الحالات." },
          { "question": "كيف بقدر أحوّل فلوس من بلدي لتركيا أو العكس؟", "answer": "في عدة طرق (تحويل بنكي، شركات تحويل أموال، محافظ رقمية)، وكل وحدة إلها رسومها وسرعتها ومحدودياتها الخاصة. الخيار الأنسب بيعتمد على المبلغ والبلد والعملة." }
        ]
      },
      {
        "heading": "عن رفيق",
        "items": [
          { "question": "شو هو رفيق بالضبط؟", "answer": "رفيق منصة تنسيق رقمية بتساعد الأجانب بإسطنبول ينسّقوا خدمات الإقامة والبنوك والسكن والصحة والحياة اليومية، مباشرة أو عبر شركاء مختصين، بلغتهم." },
          { "question": "هل رفيق شركة محاماة أو عيادة أو بنك؟", "answer": "لا. رفيق منصة تنسيق فقط — ما بيقدّم استشارة قانونية أو طبية أو خدمات مصرفية مباشرة، وبينسّق التواصل مع المختصين بهاي المجالات عند الحاجة." },
          { "question": "بأي لغات بيشتغل رفيق؟", "answer": "رفيق متوفر بأربع لغات: العربية، الإنجليزية، الروسية، والفارسية." },
          { "question": "هل رفيق يضمن نتيجة أي خدمة بينسّقها؟", "answer": "لا. القرار النهائي على أي طلب (إقامة، جنسية، حساب بنكي، أو غيره) بيد الجهة الرسمية أو المزود المختص حصراً، بغض النظر عن التنسيق." }
        ]
      }
    ]
  },
  "en": {
    "seoTitle": "Frequently asked questions about residency and life in Istanbul | Rafiq",
    "metaDescription": "Direct answers to the most common questions about Turkish residency, banking, and daily life in Istanbul for foreigners.",
    "intro": "Here are some of the questions foreigners ask most often about residency and life in Istanbul, with direct, honest answers. For the full picture on any topic, visit its dedicated guide or service page.",
    "categories": [
      {
        "heading": "Residency and official papers",
        "items": [
          { "question": "How long does getting Turkish residency take?", "answer": "The timeline varies by permit type and the immigration office's current workload — there is no single number that applies to everyone. The most accurate source for your actual timeline is your own appointment or e-İkamet account." },
          { "question": "Do I need to own property to get residency in Turkey?", "answer": "No. There is more than one residency path — a tourist residence permit, for example, does not require owning property. Property ownership is one path among several, not a general requirement." },
          { "question": "What's the difference between a tourist residence permit and a property-based one?", "answer": "A tourist residence permit is granted based on proof of your actual residence in Turkey (like a lease), while a property-based permit is granted based on owning a property registered in your name. Each type has its own conditions and documents with the immigration office." },
          { "question": "Can I reapply for residency after a previous rejection?", "answer": "Yes — a prior rejection does not prevent a new application or a later renewal, but it becomes important to understand the reason for the rejection before reapplying." }
        ]
      },
      {
        "heading": "Money and banking",
        "items": [
          { "question": "Do I need a tax number to open a bank account in Turkey?", "answer": "Most banks require a tax number as part of opening an account for any foreigner, and it's easy to obtain from the tax office. Exact requirements can vary by bank." },
          { "question": "Can I open a bank account without a valid residence permit?", "answer": "Some banks allow opening an account with just a passport for a limited period, but most prefer a valid residence permit. Available options vary by bank and your situation." },
          { "question": "Does Rafiq control government or bank fees?", "answer": "No, not at all. Government fees and bank fees are set exclusively by the relevant authorities and banks themselves — Rafiq neither adds to them nor controls them." },
          { "question": "Which currency should I keep my account in?", "answer": "It depends on your personal situation (income, expenses, how long you're staying). Many people hold both Turkish lira and a foreign currency to spread risk, but the decision is personal and depends on advice suited to your situation." }
        ]
      },
      {
        "heading": "Daily life and getting around",
        "items": [
          { "question": "What is an Istanbulkart and why do I need one?", "answer": "Istanbulkart is a prepaid electronic card used for all public transport in Istanbul (metro, bus, tram, ferry). You can top it up at machines found at stations and sales points." },
          { "question": "Do I need to register my foreign phone in Turkey?", "answer": "Any foreign device needs its IMEI registered after a certain period of use on a Turkish network, or it gets blocked from local networks. The procedure has a fixed official fee set by the state." },
          { "question": "Is Turkey generally safe for foreigners?", "answer": "Istanbul, like any large city, has areas and times that are safer than others, and most foreigners live there without major safety issues. Ordinary common sense usually covers most situations." },
          { "question": "How can I transfer money between my home country and Turkey?", "answer": "There are several ways (bank transfer, money transfer companies, digital wallets), each with its own fees, speed, and limits. The best option depends on the amount, country, and currency involved." }
        ]
      },
      {
        "heading": "About Rafiq",
        "items": [
          { "question": "What exactly is Rafiq?", "answer": "Rafiq is a digital coordination platform that helps foreigners in Istanbul coordinate residency, banking, housing, health, and daily-life services — directly or through specialist partners — in their own language." },
          { "question": "Is Rafiq a law firm, a clinic, or a bank?", "answer": "No. Rafiq is a coordination platform only — it does not give legal or medical advice or provide banking services directly, and it coordinates contact with specialists in those fields when needed." },
          { "question": "What languages does Rafiq work in?", "answer": "Rafiq is available in four languages: Arabic, English, Russian, and Farsi." },
          { "question": "Does Rafiq guarantee the outcome of any service it coordinates?", "answer": "No. The final decision on any application (residency, citizenship, a bank account, or otherwise) always rests exclusively with the relevant authority or specialist provider, regardless of coordination." }
        ]
      }
    ]
  },
  "ru": {
    "seoTitle": "Часто задаваемые вопросы о ВНЖ и жизни в Стамбуле | Rafiq",
    "metaDescription": "Прямые ответы на самые частые вопросы о турецком ВНЖ, банках и повседневной жизни в Стамбуле для иностранцев.",
    "intro": "Здесь собраны вопросы, которые иностранцы чаще всего задают о ВНЖ и жизни в Стамбуле, с прямыми и честными ответами. Полную картину по любой теме можно найти на соответствующей странице гида или услуги.",
    "categories": [
      {
        "heading": "ВНЖ и официальные документы",
        "items": [
          { "question": "Сколько времени занимает получение турецкого ВНЖ?", "answer": "Срок зависит от типа разрешения и текущей загруженности миграционной службы — единой цифры, подходящей всем, не существует. Самый точный источник по вашему реальному сроку — ваша запись или аккаунт на портале e-İkamet." },
          { "question": "Нужно ли владеть недвижимостью, чтобы получить ВНЖ в Турции?", "answer": "Нет. Существует несколько путей получения ВНЖ — например, туристический вид на жительство не требует владения недвижимостью. Владение недвижимостью — один из нескольких путей, а не общее требование." },
          { "question": "В чём разница между туристическим ВНЖ и ВНЖ на основании недвижимости?", "answer": "Туристический ВНЖ выдаётся на основании подтверждения фактического проживания в Турции (например, договора аренды), а ВНЖ на основании недвижимости — на основании владения зарегистрированной на ваше имя недвижимостью. У каждого типа свои условия и документы в миграционной службе." },
          { "question": "Можно ли подать заявку снова после предыдущего отказа?", "answer": "Да — предыдущий отказ не мешает подать новую заявку или продлить ВНЖ позже, но важно понять причину отказа перед повторной подачей." }
        ]
      },
      {
        "heading": "Деньги и банки",
        "items": [
          { "question": "Нужен ли налоговый номер для открытия банковского счёта в Турции?", "answer": "Большинство банков требуют налоговый номер как часть открытия счёта для любого иностранца, и его легко получить в налоговой инспекции. Точные требования могут отличаться в разных банках." },
          { "question": "Можно ли открыть банковский счёт без действующего ВНЖ?", "answer": "Некоторые банки позволяют открыть счёт только по паспорту на ограниченный срок, но большинство предпочитают действующий вид на жительство. Доступные варианты зависят от банка и вашей ситуации." },
          { "question": "Контролирует ли Rafiq государственные или банковские сборы?", "answer": "Нет, вообще никак. Государственные сборы и банковские комиссии устанавливают исключительно соответствующие ведомства и сами банки — Rafiq их не увеличивает и не контролирует." },
          { "question": "В какой валюте лучше держать счёт?", "answer": "Это зависит от вашей личной ситуации (доход, расходы, срок пребывания). Многие держат счёт и в турецких лирах, и в иностранной валюте для распределения риска, но решение личное и зависит от подходящей именно вам финансовой консультации." }
        ]
      },
      {
        "heading": "Повседневная жизнь и передвижение",
        "items": [
          { "question": "Что такое Istanbulkart и зачем он нужен?", "answer": "Istanbulkart — это предоплаченная электронная карта для всего общественного транспорта Стамбула (метро, автобус, трамвай, паром). Пополнить её можно в автоматах на станциях и в точках продаж." },
          { "question": "Нужно ли регистрировать иностранный телефон в Турции?", "answer": "Любое иностранное устройство требует регистрации IMEI после определённого периода использования в турецкой сети, иначе оно блокируется от местных сетей. За процедуру предусмотрен фиксированный официальный сбор, установленный государством." },
          { "question": "Безопасна ли Турция для иностранцев в целом?", "answer": "В Стамбуле, как и в любом крупном городе, есть более и менее безопасные районы и время суток, и большинство иностранцев живут там без серьёзных проблем с безопасностью. Обычной осторожности достаточно в большинстве ситуаций." },
          { "question": "Как перевести деньги между моей страной и Турцией?", "answer": "Есть несколько способов (банковский перевод, компании денежных переводов, цифровые кошельки), у каждого свои комиссии, скорость и лимиты. Лучший вариант зависит от суммы, страны и валюты." }
        ]
      },
      {
        "heading": "О Rafiq",
        "items": [
          { "question": "Что такое Rafiq?", "answer": "Rafiq — это цифровая платформа координации, которая помогает иностранцам в Стамбуле координировать услуги ВНЖ, банков, жилья, здоровья и повседневной жизни — напрямую или через профильных партнёров — на их языке." },
          { "question": "Является ли Rafiq юридической фирмой, клиникой или банком?", "answer": "Нет. Rafiq — это только платформа координации: она не даёт юридических или медицинских консультаций и не оказывает банковские услуги напрямую, а координирует контакт со специалистами в этих областях при необходимости." },
          { "question": "На каких языках работает Rafiq?", "answer": "Rafiq доступен на четырёх языках: арабском, английском, русском и фарси." },
          { "question": "Гарантирует ли Rafiq результат какой-либо услуги, которую координирует?", "answer": "Нет. Окончательное решение по любой заявке (ВНЖ, гражданство, банковский счёт и другое) всегда остаётся исключительно за соответствующим ведомством или профильным исполнителем, независимо от координации." }
        ]
      }
    ]
  },
  "fa": {
    "seoTitle": "پرسش‌های رایج درباره اقامت و زندگی در استانبول | رفیق",
    "metaDescription": "پاسخ‌های مستقیم به رایج‌ترین پرسش‌ها درباره اقامت ترکیه، بانکداری و زندگی روزمره در استانبول برای خارجی‌ها.",
    "intro": "این‌ها برخی از پرسش‌هایی هستند که خارجی‌ها بیشتر درباره اقامت و زندگی در استانبول می‌پرسند، همراه با پاسخ‌های مستقیم و صادقانه. برای تصویر کامل هر موضوع، به راهنما یا صفحه خدمت مربوطه سر بزنید.",
    "categories": [
      {
        "heading": "اقامت و مدارک رسمی",
        "items": [
          { "question": "دریافت اقامت ترکیه چقدر طول می‌کشد؟", "answer": "زمان‌بندی به نوع اقامت و حجم کار فعلی اداره مهاجرت بستگی دارد — عدد ثابتی که برای همه صدق کند وجود ندارد. دقیق‌ترین منبع برای زمان‌بندی واقعی شما، نوبت یا حساب کاربری خودتان در e-İkamet است." },
          { "question": "آیا برای اقامت ترکیه باید ملک داشته باشم؟", "answer": "خیر. بیش از یک مسیر برای اقامت وجود دارد — برای مثال، اقامت توریستی نیازی به مالکیت ملک ندارد. مالکیت ملک یکی از چند مسیر است، نه یک شرط عمومی." },
          { "question": "تفاوت اقامت توریستی و اقامت بر پایه ملک چیست؟", "answer": "اقامت توریستی بر اساس اثبات اقامت واقعی شما در ترکیه (مانند قرارداد اجاره) صادر می‌شود، در حالی که اقامت بر پایه ملک بر اساس مالکیت ملکی ثبت‌شده به نام شما صادر می‌شود. هر نوع شرایط و مدارک خاص خود را نزد اداره مهاجرت دارد." },
          { "question": "آیا می‌توانم پس از رد قبلی دوباره اقدام کنم؟", "answer": "بله، رد قبلی مانع درخواست جدید یا تمدید بعدی نمی‌شود، اما مهم است پیش از اقدام مجدد دلیل رد را بفهمید." }
        ]
      },
      {
        "heading": "پول و بانکداری",
        "items": [
          { "question": "آیا برای افتتاح حساب بانکی در ترکیه به شماره مالیاتی نیاز دارم؟", "answer": "بیشتر بانک‌ها برای افتتاح حساب هر خارجی، شماره مالیاتی می‌خواهند، و گرفتن آن از اداره مالیات آسان است. الزامات دقیق ممکن است بین بانک‌ها متفاوت باشد." },
          { "question": "آیا می‌توانم بدون اقامت معتبر حساب بانکی باز کنم؟", "answer": "برخی بانک‌ها اجازه افتتاح حساب فقط با پاسپورت برای مدت محدود می‌دهند، اما بیشتر آن‌ها اقامت معتبر را ترجیح می‌دهند. گزینه‌های موجود بسته به بانک و وضعیت شما متفاوت است." },
          { "question": "آیا رفیق هزینه‌های دولتی یا بانکی را کنترل می‌کند؟", "answer": "خیر، به‌هیچ‌وجه. هزینه‌های دولتی و بانکی منحصراً توسط نهادهای مربوطه و خود بانک‌ها تعیین می‌شود — رفیق نه چیزی به آن‌ها اضافه می‌کند و نه آن‌ها را کنترل می‌کند." },
          { "question": "بهتر است حسابم به چه ارزی باشد؟", "answer": "به وضعیت شخصی شما (درآمد، هزینه‌ها، مدت اقامت) بستگی دارد. بسیاری هم لیر ترکیه و هم ارز خارجی نگه می‌دارند تا ریسک را پخش کنند، اما تصمیم شخصی است و به مشاوره مالی متناسب با وضعیت شما بستگی دارد." }
        ]
      },
      {
        "heading": "زندگی روزمره و جابه‌جایی",
        "items": [
          { "question": "استانبول‌کارت چیست و چرا به آن نیاز دارم؟", "answer": "استانبول‌کارت یک کارت الکترونیکی پیش‌پرداخت است که برای تمام حمل‌ونقل عمومی استانبول (مترو، اتوبوس، تراموا، کشتی) استفاده می‌شود. می‌توانید آن را از دستگاه‌های موجود در ایستگاه‌ها و نقاط فروش شارژ کنید." },
          { "question": "آیا باید گوشی خارجی خود را در ترکیه ثبت کنم؟", "answer": "هر دستگاه خارجی پس از مدت معینی استفاده در شبکه ترکیه باید IMEI آن ثبت شود، در غیر این صورت از شبکه‌های محلی مسدود می‌شود. این فرآیند هزینه رسمی ثابتی دارد که توسط دولت تعیین می‌شود." },
          { "question": "آیا ترکیه به‌طور کلی برای خارجی‌ها امن است؟", "answer": "استانبول، مانند هر شهر بزرگ دیگر، مناطق و ساعاتی امن‌تر از بقیه دارد، و بیشتر خارجی‌ها بدون مشکل امنیتی جدی در آن زندگی می‌کنند. عقل سلیم معمول در بیشتر موارد کافی است." },
          { "question": "چطور می‌توانم بین کشورم و ترکیه پول انتقال دهم؟", "answer": "چند روش وجود دارد (حواله بانکی، شرکت‌های انتقال پول، کیف‌پول‌های دیجیتال)، که هرکدام هزینه، سرعت و محدودیت خاص خود را دارند. بهترین گزینه به مبلغ، کشور و ارز بستگی دارد." }
        ]
      },
      {
        "heading": "درباره رفیق",
        "items": [
          { "question": "رفیق دقیقاً چیست؟", "answer": "رفیق یک پلتفرم هماهنگی دیجیتال است که به خارجی‌های ساکن استانبول کمک می‌کند خدمات اقامت، بانکداری، مسکن، سلامت و زندگی روزمره را — مستقیم یا از طریق همکاران متخصص — به زبان خودشان هماهنگ کنند." },
          { "question": "آیا رفیق یک دفتر حقوقی، کلینیک یا بانک است؟", "answer": "خیر. رفیق فقط یک پلتفرم هماهنگی است — مشاوره حقوقی یا پزشکی نمی‌دهد و خدمات بانکی مستقیم ارائه نمی‌کند، و در صورت نیاز تماس با متخصصان این حوزه‌ها را هماهنگ می‌کند." },
          { "question": "رفیق به چه زبان‌هایی کار می‌کند؟", "answer": "رفیق به چهار زبان در دسترس است: عربی، انگلیسی، روسی و فارسی." },
          { "question": "آیا رفیق نتیجه هر خدمتی که هماهنگ می‌کند را تضمین می‌کند؟", "answer": "خیر. تصمیم نهایی درباره هر درخواست (اقامت، تابعیت، حساب بانکی یا غیره) همیشه منحصراً بر عهده نهاد رسمی یا ارائه‌دهنده متخصص است، صرف‌نظر از هماهنگی." }
        ]
      }
    ]
  }
};
