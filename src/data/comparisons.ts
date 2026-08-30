/**
 * "Rafiq vs. X" comparison pages — a distinct content type from category
 * guides (src/data/categoryGuides.ts): a guide explains one service category,
 * a comparison contrasts two paths a reader is actively weighing (Rafiq's
 * coordination vs. handling the same process alone). Comparison content gets
 * cited by AI answer engines more than almost any other content type, since
 * "X vs Y" is exactly the shape a query like "should I use Rafiq or do it
 * myself" fans out into — see the GEO work this file supports.
 *
 * Kept hand-written (unlike categoryGuides.ts, which is script-generated)
 * because there are few enough of these to write and review directly, and
 * each one needs a real, honest comparison rather than templated filler.
 *
 * String literals are double-quoted with JSON-style escaping on purpose,
 * matching categoryGuides.ts/serviceSeo*.ts, NOT ordinary TS style — this
 * file is read by scripts/generate-seo-pages.mjs via the same regex-based
 * parser those files already use (that script deliberately avoids importing
 * .ts source, see its own header), and that parser assumes JSON string
 * escaping. A single-quoted apostrophe (`Rafiq\'s`) would silently truncate
 * the match.
 *
 * Same guardrails as every other service-facing page in this codebase:
 * no step-by-step DIY instructions (this describes what the self-filing path
 * involves, it does not teach it), no exact government fees, and no
 * suggestion that Rafiq — a coordination platform — can guarantee an
 * official outcome. The competent authority always makes the actual decision.
 */

export type ComparisonLanguage = "ar" | "en" | "ru" | "fa";

export interface ComparisonRow {
  aspect: string;
  alone: string;
  rafiq: string;
}

export interface ComparisonSection {
  heading: string;
  body: string;
}

export interface ComparisonFaq {
  question: string;
  answer: string;
}

export interface Comparison {
  seoTitle: string;
  /** Short label for compact spots (footer link, related-content chips) — the full seoTitle reads as a run-on sentence there. */
  navLabel: string;
  metaDescription: string;
  intro: string;
  /** Label for the "doing it alone" column header. */
  aloneLabel: string;
  /** Label for the "with Rafiq" column header. */
  rafiqLabel: string;
  rows: ComparisonRow[];
  sections: ComparisonSection[];
  faqs: ComparisonFaq[];
  ctaTitle: string;
  ctaBody: string;
}

export const COMPARISONS: Record<string, Record<ComparisonLanguage, Comparison>> = {
  "residency-diy": {
    "ar": {
      "seoTitle": "رفيق مقابل تقديم الإقامة التركية بنفسك — مقارنة صريحة",
      "navLabel": "رفيق أو التقديم بنفسك؟",
      "metaDescription": "مقارنة موضوعية بين تنسيق الإقامة التركية عبر رفيق والتقديم الذاتي: اللغة، الوقت، المتابعة، وما لا يضمنه أي طرف.",
      "intro": "كتير من الأجانب بإسطنبول بيوصلوا لنفس السؤال: هل يقدّموا على الإقامة التركية بأنفسهم، ولا ينسّقوا الموضوع مع رفيق؟ ما في جواب واحد يناسب الكل. هاي مقارنة صريحة — ما بتقول إنه التقديم الذاتي مستحيل، وما بتوعد إنه رفيق بيحل كل شي، بس بتوضح وين فعلاً بتصير الأمور معقدة ووين التنسيق بيوفر وقت وجهد.",
      "aloneLabel": "تقديم بنفسك",
      "rafiqLabel": "تنسيق مع رفيق",
      "rows": [
        { "aspect": "اللغة والتواصل مع الجهات الرسمية", "alone": "تركية بشكل أساسي، أو تعتمد على ترجمة فورية بنفسك", "rafiq": "تنسيق ومتابعة بلغتك (عربي، إنجليزي، روسي، فارسي)" },
        { "aspect": "متابعة تحديثات اللوائح والمواعيد", "alone": "مسؤوليتك الكاملة، وبتتغيّر بين فترة وفترة", "rafiq": "فريق مطّلع على آخر التحديثات بشكل مستمر" },
        { "aspect": "تنظيم المستندات والمواعيد", "alone": "تجمعها وترتبها وتتابعها بنفسك", "rafiq": "مساعدة بالتنظيم، التذكير، وترتيب الخطوات" },
        { "aspect": "وقتك ومجهودك الشخصي", "alone": "أعلى — بحث، تنقّل، ومتابعة مباشرة", "rafiq": "أقل — نقطة تنسيق واحدة بدل ما تلاحق كل جهة لحالك" },
        { "aspect": "القرار النهائي على الطلب", "alone": "بيد دائرة الهجرة التركية (Göç İdaresi) حصراً", "rafiq": "نفس الشي — بيد دائرة الهجرة حصراً، برضو" }
      ],
      "sections": [
        { "heading": "متى يكون التقديم بنفسك خيار منطقي؟", "body": "إذا كنت تحكي تركي بطلاقة، عندك وقت فاضي للمتابعة الشخصية، ووضعك بسيط وواضح (متل إقامة سياحية أولى بدون تعقيدات)، ممكن التقديم الذاتي يكون خيار معقول جداً وما في داعي تدفع لحدا يتوسط. رفيق مش بديل إجباري — هو خيار لمين بده يوفر وقت أو قلقان من تفويت خطوة أو تعقيد اللغة." },
        { "heading": "وين بالضبط رفيق بيسهّل الموضوع؟", "body": "الفايدة الأكبر بتظهر لما اللغة عائق حقيقي، أو الوضع مش بسيط (تجديد بعد رفض سابق، إقامة مبنية على عقار، أو حالة عائلية معقدة)، أو وقتك محدود ومش قادر تلاحق كل جهة بنفسك. رفيق بينسّق الخطوة المناسبة — داخلياً أو عبر شريك مختص — ويرتب التواصل الأولي، بس ما بيصدر قرارات رسمية ولا بيضمن نتيجة." },
        { "heading": "شو ما بيضمنه ولا رفيق ولا أي طرف تاني", "body": "القرار النهائي بقبول أو رفض أي طلب إقامة بيد دائرة الهجرة التركية دائماً — سواء قدّمت بنفسك أو نسّقت مع رفيق أو مع أي جهة تانية. ولا حدا بيقدر يضمن لك موافقة أو يتجاوز شروط الجهة الرسمية. الفرق الحقيقي هو بالوقت والجهد والوضوح أثناء الطريق، مش بالنتيجة النهائية نفسها." }
      ],
      "faqs": [
        { "question": "هل رفيق يضمن قبول طلب الإقامة؟", "answer": "لا. القرار النهائي دائماً بيد دائرة الهجرة التركية (Göç İdaresi)، بغض النظر عن الطريقة اللي قدّمت فيها. رفيق ينسّق ويسهّل التواصل، وما بيصدر موافقات رسمية." },
        { "question": "هل التقديم الذاتي أرخص من التنسيق مع رفيق؟", "answer": "الرسوم الحكومية نفسها بكل الحالات — رفيق ما بيتحكم فيها ولا بيضيف عليها. الفرق الأساسي بين الخيارين هو الوقت والجهد اللي بتوفره، مش الرسوم الرسمية نفسها." },
        { "question": "وضعي بسيط جداً — هل برضو يفرق معي التنسيق مع رفيق؟", "answer": "للحالات البسيطة والواضحة، الفرق ممكن يكون محدود. الفايدة الأكبر بتظهر بالحالات الأعقد أو لما اللغة أو الوقت يكونوا عائق حقيقي." }
      ],
      "ctaTitle": "بدك تعرف وين بالضبط رفيق ممكن يساعدك؟",
      "ctaBody": "احكيلنا وضعك الحالي (سياحي، عقار، تجديد، أو غيره) ولغتك المفضلة، ومنوضحلك بصراحة وين التنسيق معنا بيوفر وقت وجهد فعلياً."
    },
    "en": {
      "seoTitle": "Rafiq vs. filing Turkish residency yourself — an honest comparison",
      "navLabel": "Rafiq or filing it yourself?",
      "metaDescription": "A straightforward comparison between coordinating Turkish residency through Rafiq and filing it yourself: language, time, follow-up, and what neither side can guarantee.",
      "intro": "Many foreigners in Istanbul reach the same question: file for Turkish residency alone, or coordinate it through Rafiq? There is no single right answer. This comparison is deliberately honest — it does not claim self-filing is impossible, and it does not promise Rafiq solves everything. It just lays out where things genuinely get complicated and where coordination saves real time and effort.",
      "aloneLabel": "Filing it yourself",
      "rafiqLabel": "Coordinating with Rafiq",
      "rows": [
        { "aspect": "Language and dealing with authorities", "alone": "Mainly Turkish, or you arrange your own interpretation", "rafiq": "Coordination and follow-up in your language (Arabic, English, Russian, Farsi)" },
        { "aspect": "Tracking regulation and appointment changes", "alone": "Entirely on you, and rules shift periodically", "rafiq": "A team that stays current on the latest changes" },
        { "aspect": "Organizing documents and appointments", "alone": "You gather, order and track everything", "rafiq": "Help with organizing, reminders, and sequencing steps" },
        { "aspect": "Your own time and effort", "alone": "Higher — research, travel, and hands-on follow-up", "rafiq": "Lower — one coordination point instead of chasing every office yourself" },
        { "aspect": "Final decision on the application", "alone": "Made exclusively by Türkiye's Directorate of Migration Management (Göç İdaresi)", "rafiq": "Same — exclusively theirs, either way" }
      ],
      "sections": [
        { "heading": "When does filing it yourself make sense?", "body": "If you speak fluent Turkish, have the time for hands-on follow-up, and your case is simple and clear-cut (a straightforward first tourist residence permit, for example), filing it yourself can be a perfectly reasonable choice with no need to pay anyone to coordinate. Rafiq is not a mandatory middleman — it is an option for people who want to save time or are worried about a language barrier or missed step." },
        { "heading": "Where coordination with Rafiq actually helps", "body": "The biggest benefit shows up when language is a real barrier, the situation is not simple (a renewal after a prior rejection, a residence permit tied to a property, or a complex family situation), or your time is limited and chasing every office yourself is not realistic. Rafiq coordinates the right next step — in-house or through a specialist partner — and arranges initial contact, but it does not issue official decisions or guarantee an outcome." },
        { "heading": "What neither Rafiq nor anyone else can guarantee", "body": "The final approval or rejection of any residence application always rests with Türkiye's Directorate of Migration Management, whether you filed alone, through Rafiq, or through anyone else. No one can guarantee approval or bypass the authority's own requirements. The real difference is in time, effort, and clarity along the way — not in the outcome itself." }
      ],
      "faqs": [
        { "question": "Does Rafiq guarantee my residence application gets approved?", "answer": "No. The final decision always rests with Türkiye's Directorate of Migration Management (Göç İdaresi), regardless of how you filed. Rafiq coordinates and facilitates contact; it does not issue official approvals." },
        { "question": "Is filing it yourself cheaper than coordinating with Rafiq?", "answer": "Government fees are the same either way — Rafiq neither controls nor adds to them. The real difference between the two options is the time and effort involved, not the official fees themselves." },
        { "question": "My situation is very simple — does coordinating with Rafiq still help?", "answer": "For simple, clear-cut cases, the difference can be limited. The bigger benefit shows up in more complex cases, or when language or time are a genuine obstacle." }
      ],
      "ctaTitle": "Want to know exactly where Rafiq can help you?",
      "ctaBody": "Tell us your current situation (tourist, property-based, renewal, or otherwise) and your preferred language, and we'll tell you honestly where coordinating with us actually saves time and effort."
    },
    "ru": {
      "seoTitle": "Rafiq против самостоятельной подачи на ВНЖ в Турции — честное сравнение",
      "navLabel": "Rafiq или самостоятельно?",
      "metaDescription": "Прямое сравнение координации ВНЖ через Rafiq и самостоятельной подачи: язык, время, сопровождение и то, что не может гарантировать ни одна из сторон.",
      "intro": "Многие иностранцы в Стамбуле задаются одним и тем же вопросом: подавать на ВНЖ самостоятельно или координировать процесс через Rafiq? Единого правильного ответа нет. Это сравнение намеренно честное — оно не утверждает, что самостоятельная подача невозможна, и не обещает, что Rafiq решит всё за вас. Здесь просто показано, где процесс действительно усложняется, а где координация реально экономит время и силы.",
      "aloneLabel": "Самостоятельно",
      "rafiqLabel": "С координацией Rafiq",
      "rows": [
        { "aspect": "Язык и общение с ведомствами", "alone": "В основном турецкий, либо вы сами организуете перевод", "rafiq": "Сопровождение на вашем языке (арабский, английский, русский, фарси)" },
        { "aspect": "Отслеживание изменений в правилах и записи", "alone": "Полностью на вас, а правила периодически меняются", "rafiq": "Команда, которая постоянно следит за актуальными изменениями" },
        { "aspect": "Организация документов и записей", "alone": "Вы сами собираете, упорядочиваете и отслеживаете всё", "rafiq": "Помощь с организацией, напоминаниями и порядком шагов" },
        { "aspect": "Ваше время и усилия", "alone": "Выше — самостоятельный поиск информации, поездки, личное сопровождение", "rafiq": "Ниже — одна точка координации вместо обращения в каждую инстанцию самостоятельно" },
        { "aspect": "Итоговое решение по заявке", "alone": "Принимает исключительно Управление миграции Турции (Göç İdaresi)", "rafiq": "Так же — исключительно они, в любом случае" }
      ],
      "sections": [
        { "heading": "Когда самостоятельная подача имеет смысл?", "body": "Если вы свободно говорите по-турецки, у вас есть время для личного сопровождения процесса, а ваш случай простой и понятный (например, первичный туристический ВНЖ без осложнений), самостоятельная подача может быть вполне разумным выбором без необходимости платить за координацию. Rafiq — не обязательный посредник, а вариант для тех, кто хочет сэкономить время или опасается языкового барьера либо пропущенного шага." },
        { "heading": "В чём координация с Rafiq действительно помогает", "body": "Наибольшая польза проявляется, когда язык становится реальным барьером, ситуация непростая (продление после предыдущего отказа, ВНЖ на основании недвижимости, сложная семейная ситуация) или времени мало и самостоятельно обращаться в каждую инстанцию нереально. Rafiq координирует нужный следующий шаг — напрямую или через профильного партнёра — и организует первичный контакт, но не выносит официальных решений и не гарантирует результат." },
        { "heading": "Что не может гарантировать ни Rafiq, ни кто-либо ещё", "body": "Окончательное одобрение или отказ по любой заявке на ВНЖ всегда остаётся за Управлением миграции Турции — независимо от того, подавали вы самостоятельно, через Rafiq или через кого-то ещё. Никто не может гарантировать одобрение или обойти требования ведомства. Реальная разница — во времени, усилиях и ясности процесса, а не в самом итоговом решении." }
      ],
      "faqs": [
        { "question": "Гарантирует ли Rafiq одобрение заявки на ВНЖ?", "answer": "Нет. Окончательное решение всегда принимает Управление миграции Турции (Göç İdaresi), независимо от способа подачи. Rafiq координирует процесс и организует контакт, но не выдаёт официальные одобрения." },
        { "question": "Дешевле ли подавать самостоятельно, чем через Rafiq?", "answer": "Государственные пошлины одинаковы в обоих случаях — Rafiq их не контролирует и не увеличивает. Реальная разница между вариантами — во времени и усилиях, а не в официальных сборах." },
        { "question": "Мой случай очень простой — поможет ли мне координация с Rafiq?", "answer": "Для простых и понятных случаев разница может быть небольшой. Основная польза проявляется в более сложных ситуациях, либо когда язык или время становятся реальным препятствием." }
      ],
      "ctaTitle": "Хотите узнать, чем именно Rafiq может вам помочь?",
      "ctaBody": "Расскажите нам о вашей текущей ситуации (туристический ВНЖ, на основании недвижимости, продление или иное) и предпочитаемом языке — мы честно скажем, где координация с нами реально сэкономит время и усилия."
    },
    "fa": {
      "seoTitle": "رفیق در برابر ثبت‌نام مستقیم اقامت ترکیه — مقایسه‌ای صادقانه",
      "navLabel": "رفیق یا اقدام شخصی؟",
      "metaDescription": "مقایسه‌ای صریح بین هماهنگی اقامت ترکیه از طریق رفیق و ثبت‌نام شخصی: زبان، زمان، پیگیری و آنچه هیچ‌کدام تضمین نمی‌کنند.",
      "intro": "بسیاری از خارجی‌های ساکن استانبول با یک سؤال مشترک روبه‌رو می‌شوند: خودشان برای اقامت ترکیه اقدام کنند یا این روند را از طریق رفیق هماهنگ کنند؟ پاسخ واحدی برای همه وجود ندارد. این مقایسه عمداً صادقانه است — نه می‌گوید اقدام شخصی غیرممکن است، نه قول می‌دهد رفیق همه چیز را حل می‌کند. فقط نشان می‌دهد کجا واقعاً کار پیچیده می‌شود و کجا هماهنگی، زمان و انرژی واقعی صرفه‌جویی می‌کند.",
      "aloneLabel": "اقدام شخصی",
      "rafiqLabel": "هماهنگی با رفیق",
      "rows": [
        { "aspect": "زبان و ارتباط با نهادهای رسمی", "alone": "عمدتاً ترکی، یا ترتیب ترجمه توسط خودتان", "rafiq": "هماهنگی و پیگیری به زبان شما (عربی، انگلیسی، روسی، فارسی)" },
        { "aspect": "پیگیری تغییرات مقررات و نوبت‌ها", "alone": "کاملاً بر عهده خودتان، و مقررات گاه‌به‌گاه تغییر می‌کند", "rafiq": "تیمی که به‌طور مداوم از آخرین تغییرات آگاه است" },
        { "aspect": "سازمان‌دهی مدارک و نوبت‌ها", "alone": "خودتان جمع‌آوری، مرتب‌سازی و پیگیری می‌کنید", "rafiq": "کمک در سازمان‌دهی، یادآوری و ترتیب مراحل" },
        { "aspect": "زمان و انرژی شخصی شما", "alone": "بیشتر — تحقیق، رفت‌وآمد و پیگیری مستقیم", "rafiq": "کمتر — یک نقطه هماهنگی به‌جای پیگیری شخصی هر نهاد" },
        { "aspect": "تصمیم نهایی درباره درخواست", "alone": "منحصراً بر عهده اداره مهاجرت ترکیه (Göç İdaresi)", "rafiq": "همان — منحصراً بر عهده همان اداره، در هر دو حالت" }
      ],
      "sections": [
        { "heading": "چه زمانی اقدام شخصی منطقی است؟", "body": "اگر به ترکی مسلط هستید، وقت کافی برای پیگیری مستقیم دارید و وضعیت شما ساده و روشن است (مثلاً اقامت توریستی اولیه بدون پیچیدگی)، اقدام شخصی می‌تواند انتخابی کاملاً منطقی باشد و نیازی به پرداخت هزینه هماهنگی نیست. رفیق واسطه‌ای اجباری نیست — گزینه‌ای است برای کسانی که می‌خواهند در وقت صرفه‌جویی کنند یا نگران مانع زبانی یا از قلم افتادن یک مرحله هستند." },
        { "heading": "هماهنگی با رفیق دقیقاً کجا کمک می‌کند؟", "body": "بیشترین فایده زمانی است که زبان یک مانع واقعی باشد، وضعیت ساده نباشد (تمدید پس از رد قبلی، اقامت بر پایه ملک، یا وضعیت خانوادگی پیچیده)، یا زمان محدود باشد و پیگیری شخصی هر نهاد عملی نباشد. رفیق مرحله مناسب را هماهنگ می‌کند — مستقیم یا از طریق همکار متخصص — و تماس اولیه را ترتیب می‌دهد، اما تصمیم رسمی صادر نمی‌کند و نتیجه را تضمین نمی‌کند." },
        { "heading": "چیزی که نه رفیق و نه هیچ طرف دیگری تضمین نمی‌کند", "body": "تصمیم نهایی برای تأیید یا رد هر درخواست اقامت همیشه بر عهده اداره مهاجرت ترکیه است — چه شخصاً اقدام کرده باشید، چه از طریق رفیق یا هر طرف دیگری. هیچ‌کس نمی‌تواند تأیید را تضمین کند یا از الزامات نهاد رسمی عبور کند. تفاوت واقعی در زمان، انرژی و شفافیت مسیر است، نه در خودِ نتیجه نهایی." }
      ],
      "faqs": [
        { "question": "آیا رفیق تأیید درخواست اقامت را تضمین می‌کند؟", "answer": "خیر. تصمیم نهایی همیشه بر عهده اداره مهاجرت ترکیه (Göç İdaresi) است، صرف‌نظر از روش اقدام. رفیق هماهنگ می‌کند و ارتباط را تسهیل می‌کند، اما تأیید رسمی صادر نمی‌کند." },
        { "question": "آیا اقدام شخصی ارزان‌تر از هماهنگی با رفیق است؟", "answer": "هزینه‌های دولتی در هر دو حالت یکسان است — رفیق نه آن‌ها را کنترل می‌کند و نه چیزی به آن‌ها اضافه می‌کند. تفاوت واقعی بین دو گزینه، زمان و انرژی صرف‌شده است، نه هزینه‌های رسمی." },
        { "question": "وضعیت من خیلی ساده است — آیا باز هم هماهنگی با رفیق فایده دارد؟", "answer": "برای موارد ساده و روشن، تفاوت می‌تواند محدود باشد. بیشترین فایده در موارد پیچیده‌تر یا زمانی که زبان یا وقت مانعی واقعی است، دیده می‌شود." }
      ],
      "ctaTitle": "می‌خواهید دقیقاً بدانید رفیق کجا می‌تواند کمک کند؟",
      "ctaBody": "وضعیت فعلی خود (توریستی، بر پایه ملک، تمدید یا غیره) و زبان مورد نظرتان را به ما بگویید تا صادقانه بگوییم هماهنگی با ما دقیقاً کجا در وقت و انرژی شما صرفه‌جویی می‌کند."
    }
  },
  "citizenship-consultancy": {
    "ar": {
      "seoTitle": "رفيق مقابل التعامل المباشر مع مكتب استشارات الجنسية التركية",
      "navLabel": "رفيق أو مكتب استشارات مباشرة؟",
      "metaDescription": "مقارنة صريحة بين تنسيق ملف الجنسية التركية عبر رفيق والتعامل المباشر مع مكتب استشارات: التحقق، المتابعة، وما لا يضمنه أي طرف.",
      "intro": "الجنسية التركية موضوع حساس ومكلف، وكتير من الناس بيوصلوا لمكاتب استشارات مباشرة بدون نقطة تنسيق توسّطهم. هاي مقارنة صريحة بين الخيارين — ما بتقول إنه التعامل المباشر خطأ، وما بتوعد إنه رفيق بيضمن نتيجة، بس بتوضح وين المخاطر الحقيقية (متل التحقق من مصداقية المكتب) ووين التنسيق بيوفر أمان إضافي.",
      "aloneLabel": "التعامل المباشر مع مكتب",
      "rafiqLabel": "تنسيق مع رفيق",
      "rows": [
        { "aspect": "التحقق من مصداقية مقدّم الخدمة", "alone": "بحث وتحقق شخصي بالكامل — والمجال فيه مكاتب غير موثوقة", "rafiq": "تنسيق مع شركاء تمت مراجعتهم مسبقاً" },
        { "aspect": "متابعة الملف والتواصل", "alone": "تعتمد كلياً على استجابة المكتب نفسه", "rafiq": "نقطة تنسيق مركزية بلغتك" },
        { "aspect": "فهم المتطلبات القانونية المتغيّرة", "alone": "تسأل وتتحقق بنفسك في كل مرحلة", "rafiq": "فريق مطّلع بشكل مستمر على آخر التحديثات" },
        { "aspect": "القرار النهائي على طلب الجنسية", "alone": "بيد الجهات الرسمية التركية حصراً", "rafiq": "نفس الشي — بيد الجهات الرسمية حصراً، برضو" }
      ],
      "sections": [
        { "heading": "متى يكون التعامل المباشر خيار معقول؟", "body": "إذا كنت بالفعل بحثت ووثّقت من مصداقية مكتب استشارات أو محامٍ محدد، وعندك القدرة على متابعة التواصل معه مباشرة بثقة، فالتعامل المباشر خيار مشروع تماماً. رفيق مش شرط إجباري لأي ملف جنسية." },
        { "heading": "وين بالضبط رفيق بيضيف أمان؟", "body": "مجال الجنسية التركية — خصوصاً الجنسية عبر الاستثمار — فيه للأسف مكاتب غير موثوقة تستغل حاجة الناس. رفيق ينسّق مع شركاء (محامين أو مكاتب استشارات) خضعوا لمراجعة مسبقة، ويكون نقطة تواصل واحدة بلغتك بدل ما تتنقل بين عدة جهات بنفسك." },
        { "heading": "شو ما بيقدر يضمنه ولا رفيق ولا أي مكتب", "body": "قبول أو رفض أي طلب جنسية — وأي شرط استثماري أو قانوني مرتبط فيه — يقرره القانون التركي والجهات الرسمية المختصة حصراً، بغض النظر عن الجهة اللي نسّقت معك. لا رفيق ولا أي مكتب استشارات بيقدر يضمن الموافقة أو يتجاوز الشروط الرسمية." }
      ],
      "faqs": [
        { "question": "هل رفيق يضمن الحصول على الجنسية التركية؟", "answer": "لا. القرار النهائي بيد الجهات الرسمية التركية حصراً، بغض النظر عن طريقة التنسيق. رفيق ينسّق الاتصال بشركاء مختصين وما بيصدر قرارات رسمية." },
        { "question": "هل رفيق مكتب محاماة بيقدّم استشارة قانونية؟", "answer": "لا. رفيق منصة تنسيق، وينسّق التواصل مع محامين أو مكاتب استشارات مختصة عند الحاجة — الاستشارة القانونية نفسها تصدر عن المختص المباشر." },
        { "question": "كيف بعرف إنه المكتب اللي بتنسّق معه رفيق موثوق؟", "answer": "رفيق ينسّق مع شركاء خضعوا لمراجعة مسبقة، لكن التحقق النهائي من ترخيص أي مزود ومطابقته لوضعك يبقى مسؤوليتك أيضاً قبل أي التزام." }
      ],
      "ctaTitle": "بدك تعرف الخطوة المناسبة لملف الجنسية تبعك؟",
      "ctaBody": "احكيلنا وضعك الحالي (إقامة طويلة، استثمار، أو غيره) ولغتك المفضلة، ومنوضحلك بصراحة وين التنسيق معنا بيضيف قيمة فعلية."
    },
    "en": {
      "seoTitle": "Rafiq vs. going directly to a Turkish citizenship consultancy",
      "navLabel": "Rafiq or a consultancy directly?",
      "metaDescription": "An honest comparison between coordinating a Turkish citizenship file through Rafiq and approaching a consultancy office directly: vetting, follow-up, and what neither side can guarantee.",
      "intro": "Turkish citizenship is a sensitive, high-stakes topic, and many people go straight to a consultancy office with no coordination point in between. This comparison is deliberately honest — it does not say going direct is wrong, and it does not promise Rafiq guarantees an outcome. It lays out where the real risks are (like verifying a provider's credibility) and where coordination adds real safety.",
      "aloneLabel": "Going directly to a consultancy",
      "rafiqLabel": "Coordinating with Rafiq",
      "rows": [
        { "aspect": "Verifying the provider's credibility", "alone": "Entirely your own research — the field has unreliable offices too", "rafiq": "Coordination with partners vetted in advance" },
        { "aspect": "Following up and communication", "alone": "Depends entirely on that office's own responsiveness", "rafiq": "One coordination point in your language" },
        { "aspect": "Tracking changing legal requirements", "alone": "You check and verify at every stage yourself", "rafiq": "A team that stays current on the latest changes" },
        { "aspect": "Final decision on the citizenship application", "alone": "Made exclusively by Turkish authorities", "rafiq": "Same — exclusively theirs, either way" }
      ],
      "sections": [
        { "heading": "When does going direct make sense?", "body": "If you have already researched and verified a specific consultancy or lawyer's credibility, and are comfortable following up with them directly, going direct is a perfectly legitimate choice. Rafiq is not a mandatory step for any citizenship file." },
        { "heading": "Where exactly does Rafiq add safety?", "body": "The Turkish citizenship space — especially citizenship by investment — unfortunately has some unreliable offices that exploit people's urgency. Rafiq coordinates with partners (lawyers or consultancy offices) that have already been vetted, and acts as a single point of contact in your language instead of you navigating multiple parties alone." },
        { "heading": "What neither Rafiq nor any office can guarantee", "body": "Approval or rejection of any citizenship application — and any investment or legal condition tied to it — is decided exclusively by Turkish law and the competent authorities, regardless of who coordinated the file. Neither Rafiq nor any consultancy can guarantee approval or bypass official requirements." }
      ],
      "faqs": [
        { "question": "Does Rafiq guarantee Turkish citizenship?", "answer": "No. The final decision always rests with Turkish authorities, regardless of how the file was coordinated. Rafiq coordinates contact with specialist partners and does not issue official decisions." },
        { "question": "Is Rafiq a law firm giving legal advice?", "answer": "No. Rafiq is a coordination platform that arranges contact with lawyers or consultancy partners when needed — the actual legal advice comes from that specialist directly." },
        { "question": "How do I know a partner Rafiq coordinates with is trustworthy?", "answer": "Rafiq coordinates with partners that have already been vetted, but confirming a provider's license and fit for your specific case remains your responsibility too before committing." }
      ],
      "ctaTitle": "Want to know the right next step for your citizenship file?",
      "ctaBody": "Tell us your current situation (long-term residence, investment, or otherwise) and your preferred language, and we'll tell you honestly where coordinating with us adds real value."
    },
    "ru": {
      "seoTitle": "Rafiq против прямого обращения в консалтинговый офис по гражданству Турции",
      "navLabel": "Rafiq или напрямую в офис?",
      "metaDescription": "Честное сравнение координации заявки на гражданство Турции через Rafiq и прямого обращения в консалтинговый офис: проверка, сопровождение и то, что не может гарантировать ни одна из сторон.",
      "intro": "Гражданство Турции — чувствительная и дорогостоящая тема, и многие обращаются напрямую в консалтинговый офис без какой-либо координации. Это сравнение намеренно честное — оно не говорит, что обращаться напрямую неправильно, и не обещает, что Rafiq гарантирует результат. Здесь показано, где реальные риски (например, проверка добросовестности офиса), а где координация добавляет реальную безопасность.",
      "aloneLabel": "Напрямую в консалтинговый офис",
      "rafiqLabel": "С координацией Rafiq",
      "rows": [
        { "aspect": "Проверка добросовестности исполнителя", "alone": "Полностью самостоятельный поиск — в этой сфере есть и недобросовестные офисы", "rafiq": "Координация с заранее проверенными партнёрами" },
        { "aspect": "Сопровождение и коммуникация", "alone": "Полностью зависит от отзывчивости самого офиса", "rafiq": "Единая точка координации на вашем языке" },
        { "aspect": "Отслеживание меняющихся правовых требований", "alone": "Проверяете самостоятельно на каждом этапе", "rafiq": "Команда, которая постоянно следит за изменениями" },
        { "aspect": "Итоговое решение по заявке на гражданство", "alone": "Принимают исключительно турецкие власти", "rafiq": "Так же — исключительно они, в любом случае" }
      ],
      "sections": [
        { "heading": "Когда обращение напрямую оправдано?", "body": "Если вы уже изучили и проверили добросовестность конкретного консалтингового офиса или юриста и готовы взаимодействовать с ним напрямую, обращение напрямую — вполне законный выбор. Rafiq не является обязательным этапом для заявки на гражданство." },
        { "heading": "В чём именно Rafiq добавляет безопасности", "body": "В сфере турецкого гражданства — особенно гражданства через инвестиции — к сожалению, встречаются недобросовестные офисы, пользующиеся срочностью запроса. Rafiq координирует работу с партнёрами (юристами или консалтинговыми офисами), которые уже прошли проверку, и выступает единой точкой контакта на вашем языке вместо самостоятельного взаимодействия с несколькими сторонами." },
        { "heading": "Что не может гарантировать ни Rafiq, ни какой-либо офис", "body": "Одобрение или отказ по любой заявке на гражданство — и любое инвестиционное или юридическое условие, связанное с ней, — определяется исключительно турецким законодательством и компетентными органами, независимо от того, кто координировал заявку. Ни Rafiq, ни консалтинговый офис не могут гарантировать одобрение или обойти официальные требования." }
      ],
      "faqs": [
        { "question": "Гарантирует ли Rafiq турецкое гражданство?", "answer": "Нет. Окончательное решение всегда остаётся за турецкими властями, независимо от способа координации. Rafiq координирует контакт со специализированными партнёрами и не выносит официальных решений." },
        { "question": "Является ли Rafiq юридической фирмой, дающей юридические консультации?", "answer": "Нет. Rafiq — координационная платформа, которая организует контакт с юристами или консалтинговыми партнёрами при необходимости — саму юридическую консультацию даёт непосредственно специалист." },
        { "question": "Как узнать, что партнёр, с которым координирует Rafiq, надёжен?", "answer": "Rafiq координирует работу с уже проверенными партнёрами, но окончательная проверка лицензии исполнителя и его соответствия вашей ситуации остаётся и вашей ответственностью перед тем, как брать на себя обязательства." }
      ],
      "ctaTitle": "Хотите узнать верный следующий шаг для вашей заявки на гражданство?",
      "ctaBody": "Расскажите нам о вашей текущей ситуации (долгосрочное проживание, инвестиции или иное) и предпочитаемом языке — мы честно скажем, где координация с нами добавляет реальную ценность."
    },
    "fa": {
      "seoTitle": "رفیق در برابر مراجعه مستقیم به دفتر مشاوره تابعیت ترکیه",
      "navLabel": "رفیق یا مراجعه مستقیم؟",
      "metaDescription": "مقایسه‌ای صادقانه بین هماهنگی پرونده تابعیت ترکیه از طریق رفیق و مراجعه مستقیم به دفتر مشاوره: بررسی اعتبار، پیگیری و آنچه هیچ‌کدام تضمین نمی‌کنند.",
      "intro": "تابعیت ترکیه موضوعی حساس و پرهزینه است، و بسیاری مستقیماً به یک دفتر مشاوره مراجعه می‌کنند بدون هیچ نقطه هماهنگی میانی. این مقایسه عمداً صادقانه است — نمی‌گوید مراجعه مستقیم اشتباه است، و قول نمی‌دهد رفیق نتیجه را تضمین می‌کند. فقط نشان می‌دهد ریسک‌های واقعی کجاست (مثل بررسی اعتبار ارائه‌دهنده) و هماهنگی کجا امنیت واقعی اضافه می‌کند.",
      "aloneLabel": "مراجعه مستقیم به دفتر مشاوره",
      "rafiqLabel": "هماهنگی با رفیق",
      "rows": [
        { "aspect": "بررسی اعتبار ارائه‌دهنده خدمت", "alone": "کاملاً تحقیق شخصی — این حوزه دفاتر نامعتبر هم دارد", "rafiq": "هماهنگی با همکارانی که از پیش بررسی شده‌اند" },
        { "aspect": "پیگیری و ارتباط", "alone": "کاملاً وابسته به پاسخگویی همان دفتر", "rafiq": "یک نقطه هماهنگی به زبان شما" },
        { "aspect": "پیگیری تغییرات الزامات قانونی", "alone": "خودتان در هر مرحله بررسی می‌کنید", "rafiq": "تیمی که به‌طور مداوم از آخرین تغییرات آگاه است" },
        { "aspect": "تصمیم نهایی درباره درخواست تابعیت", "alone": "منحصراً بر عهده مقامات رسمی ترکیه", "rafiq": "همان — منحصراً بر عهده همان مقامات، در هر دو حالت" }
      ],
      "sections": [
        { "heading": "چه زمانی مراجعه مستقیم منطقی است؟", "body": "اگر از قبل اعتبار یک دفتر مشاوره یا وکیل مشخص را بررسی و تأیید کرده‌اید و راحت هستید که مستقیماً با او پیگیری کنید، مراجعه مستقیم انتخابی کاملاً مشروع است. رفیق مرحله‌ای اجباری برای هیچ پرونده تابعیتی نیست." },
        { "heading": "هماهنگی با رفیق دقیقاً کجا امنیت اضافه می‌کند؟", "body": "حوزه تابعیت ترکیه — به‌ویژه تابعیت از طریق سرمایه‌گذاری — متأسفانه دفاتر نامعتبری دارد که از فوریت نیاز افراد سوءاستفاده می‌کنند. رفیق با همکارانی (وکلا یا دفاتر مشاوره) که از پیش بررسی شده‌اند هماهنگ می‌کند و به‌جای پیگیری شخصی با چند طرف مختلف، یک نقطه تماس واحد به زبان شما فراهم می‌کند." },
        { "heading": "چیزی که نه رفیق و نه هیچ دفتری تضمین نمی‌کند", "body": "تأیید یا رد هر درخواست تابعیت — و هر شرط سرمایه‌گذاری یا قانونی مرتبط با آن — منحصراً توسط قانون ترکیه و مقامات ذی‌صلاح تعیین می‌شود، صرف‌نظر از اینکه چه کسی پرونده را هماهنگ کرده است. نه رفیق و نه هیچ دفتر مشاوره‌ای نمی‌تواند تأیید را تضمین کند یا از الزامات رسمی عبور کند." }
      ],
      "faqs": [
        { "question": "آیا رفیق تابعیت ترکیه را تضمین می‌کند؟", "answer": "خیر. تصمیم نهایی همیشه بر عهده مقامات رسمی ترکیه است، صرف‌نظر از روش هماهنگی. رفیق تماس با همکاران متخصص را هماهنگ می‌کند و تصمیم رسمی صادر نمی‌کند." },
        { "question": "آیا رفیق یک دفتر حقوقی است که مشاوره قانونی می‌دهد؟", "answer": "خیر. رفیق یک پلتفرم هماهنگی است که در صورت نیاز تماس با وکلا یا همکاران مشاوره را ترتیب می‌دهد — مشاوره قانونی واقعی مستقیماً از سوی همان متخصص ارائه می‌شود." },
        { "question": "چطور بفهمم همکاری که رفیق با آن هماهنگ می‌کند قابل اعتماد است؟", "answer": "رفیق با همکارانی که از پیش بررسی شده‌اند هماهنگ می‌کند، اما تأیید نهایی مجوز هر ارائه‌دهنده و تناسب آن با وضعیت شما همچنان مسئولیت خود شماست پیش از هرگونه تعهد." }
      ],
      "ctaTitle": "می‌خواهید بدانید گام بعدی مناسب برای پرونده تابعیت شما چیست؟",
      "ctaBody": "وضعیت فعلی خود (اقامت بلندمدت، سرمایه‌گذاری یا غیره) و زبان مورد نظرتان را به ما بگویید تا صادقانه بگوییم هماهنگی با ما دقیقاً کجا ارزش واقعی اضافه می‌کند."
    }
  },
  "health-tourism-direct": {
    "ar": {
      "seoTitle": "رفيق مقابل الحجز المباشر مع عيادة للسياحة العلاجية في إسطنبول",
      "navLabel": "رفيق أو حجز مباشر مع العيادة؟",
      "metaDescription": "مقارنة صريحة بين تنسيق رحلة العلاج في إسطنبول عبر رفيق والحجز المباشر مع عيادة: اللغة، اللوجستيات، وما رفيق ما بيقدر يضمنه طبياً.",
      "intro": "كتير من مرضى السياحة العلاجية بيحجزوا مباشرة مع عيادة بإسطنبول بدون أي جهة تنسّق الرحلة. هاي مقارنة صريحة — رفيق مش عيادة ولا بيقدّم استشارة طبية، وما بيضمن نتيجة أي عملية. بس بتوضح وين التنسيق بيفرق فعلياً، خصوصاً باللغة واللوجستيات.",
      "aloneLabel": "الحجز المباشر مع العيادة",
      "rafiqLabel": "تنسيق مع رفيق",
      "rows": [
        { "aspect": "اللغة أثناء الاستشارة والإجراء", "alone": "تعتمد على مترجم العيادة نفسها إن وُجد", "rafiq": "مرافقة وتنسيق بلغتك خلال الرحلة" },
        { "aspect": "التحقق من ترخيص وسمعة مقدّم الخدمة", "alone": "بحث وتحقق شخصي بالكامل", "rafiq": "تنسيق مع شركاء تمت مراجعتهم مسبقاً" },
        { "aspect": "تنظيم السفر والإقامة حول الموعد", "alone": "تنسّقه بنفسك مع كل جهة لحالها", "rafiq": "مساعدة بتنسيق الجدول والخدمات اللوجستية" },
        { "aspect": "القرار الطبي والتشخيص والنتيجة", "alone": "بيد الطبيب والعيادة حصراً", "rafiq": "نفس الشي حصراً — رفيق ما بيقدّم استشارة طبية" }
      ],
      "sections": [
        { "heading": "متى يكون الحجز المباشر كافي؟", "body": "إذا عندك توصية موثوقة لعيادة أو طبيب محدد بإسطنبول، وقادر تنسّق سفرك وإقامتك بنفسك بثقة، الحجز المباشر خيار معقول تماماً. رفيق مش خطوة إجبارية لأي رحلة علاجية." },
        { "heading": "وين بالضبط رفيق بيسهّل الرحلة؟", "body": "الفايدة الأكبر بتظهر لما اللغة عائق حقيقي أثناء الاستشارة الطبية، أو ما عندك عيادة موثوقة مسبقاً وبدك تنسيق مع شريك تمت مراجعته، أو وقتك محدود وبدك حدا ينظّملك السفر والإقامة حول موعد العملية. رفيق بينسّق اللوجستيات والتواصل، بس ما بيتدخل بأي قرار طبي." },
        { "heading": "شو رفيق ما بيقدر يضمنه إطلاقاً", "body": "التشخيص، خطة العلاج، ونتيجة أي إجراء طبي بيد الطبيب والعيادة المختصة حصراً. رفيق منصة تنسيق لوجستي ولغوي فقط — ما بيقدّم استشارة طبية، وما بيضمن نتيجة أي عملية أو إجراء." }
      ],
      "faqs": [
        { "question": "هل رفيق بيقدّم استشارة طبية أو تشخيص؟", "answer": "لا إطلاقاً. رفيق بينسّق اللوجستيات والتواصل فقط؛ أي تشخيص أو قرار طبي بيد الطبيب أو العيادة المختصة حصراً." },
        { "question": "هل رفيق بيضمن نتيجة العملية أو الإجراء؟", "answer": "لا. النتائج الطبية تعتمد على تقييم الطبيب وحالتك الصحية الخاصة، ورفيق ما إله أي دور بالقرار الطبي نفسه." },
        { "question": "شو الفرق الفعلي إذا عندي عيادة موثوقة مسبقاً؟", "answer": "إذا عندك عيادة موثوقة وقادر تنسّق سفرك بنفسك، الفرق ممكن يكون محدود. الفايدة الأكبر لما تحتاج مساعدة باللغة أو التنظيم اللوجستي حول موعدك." }
      ],
      "ctaTitle": "بدك تعرف كيف رفيق ينسّق رحلتك العلاجية؟",
      "ctaBody": "احكيلنا شو نوع الإجراء اللي بتفكر فيه ولغتك المفضلة، ومنوضحلك بصراحة وين التنسيق معنا بيسهّل رحلتك."
    },
    "en": {
      "seoTitle": "Rafiq vs. booking directly with a health tourism clinic in Istanbul",
      "navLabel": "Rafiq or booking direct?",
      "metaDescription": "An honest comparison between coordinating a medical trip to Istanbul through Rafiq and booking directly with a clinic: language, logistics, and what Rafiq cannot guarantee medically.",
      "intro": "Many medical tourism patients book directly with an Istanbul clinic with no one coordinating the trip. This comparison is deliberately honest — Rafiq is not a clinic and does not give medical advice or guarantee any procedure's outcome. It simply lays out where coordination genuinely helps, especially with language and logistics.",
      "aloneLabel": "Booking directly with the clinic",
      "rafiqLabel": "Coordinating with Rafiq",
      "rows": [
        { "aspect": "Language during consultation and the procedure", "alone": "Depends on the clinic's own interpreter, if any", "rafiq": "Escort and coordination in your language throughout the trip" },
        { "aspect": "Verifying the provider's license and reputation", "alone": "Entirely your own research", "rafiq": "Coordination with partners vetted in advance" },
        { "aspect": "Organizing travel and accommodation around the appointment", "alone": "You coordinate each piece separately yourself", "rafiq": "Help coordinating the schedule and logistics" },
        { "aspect": "The medical decision, diagnosis, and outcome", "alone": "Made exclusively by the doctor and clinic", "rafiq": "Same, exclusively — Rafiq does not give medical advice" }
      ],
      "sections": [
        { "heading": "When is booking directly enough?", "body": "If you have a trusted recommendation for a specific clinic or doctor in Istanbul, and can confidently coordinate your own travel and stay, booking directly is a perfectly reasonable choice. Rafiq is not a required step for any medical trip." },
        { "heading": "Where exactly does Rafiq make the trip easier?", "body": "The biggest benefit shows up when language is a real barrier during the medical consultation, you do not already have a trusted clinic and want to coordinate with a vetted partner instead, or your time is limited and you want help organizing travel and accommodation around the procedure date. Rafiq coordinates logistics and communication, but never any medical decision." },
        { "heading": "What Rafiq cannot guarantee at all", "body": "Diagnosis, the treatment plan, and the outcome of any medical procedure are made exclusively by the qualified doctor and clinic. Rafiq is a logistics and language coordination platform only — it does not give medical advice and does not guarantee the result of any procedure." }
      ],
      "faqs": [
        { "question": "Does Rafiq give medical advice or a diagnosis?", "answer": "No, never. Rafiq coordinates logistics and communication only; any diagnosis or medical decision comes exclusively from the qualified doctor or clinic." },
        { "question": "Does Rafiq guarantee the outcome of a procedure?", "answer": "No. Medical outcomes depend on the doctor's own assessment and your specific health situation, and Rafiq plays no role in that medical decision." },
        { "question": "What's the real difference if I already have a trusted clinic?", "answer": "If you already have a trusted clinic and can coordinate your own travel, the difference can be limited. The bigger benefit shows up when you need help with language or logistics around your appointment." }
      ],
      "ctaTitle": "Want to know how Rafiq coordinates a medical trip?",
      "ctaBody": "Tell us what kind of procedure you're considering and your preferred language, and we'll tell you honestly where coordinating with us makes the trip easier."
    },
    "ru": {
      "seoTitle": "Rafiq против прямой записи в клинику медицинского туризма в Стамбуле",
      "navLabel": "Rafiq или напрямую в клинику?",
      "metaDescription": "Честное сравнение координации медицинской поездки в Стамбул через Rafiq и прямой записи в клинику: язык, логистика и то, что Rafiq не может гарантировать в медицинском плане.",
      "intro": "Многие пациенты медицинского туризма записываются напрямую в стамбульскую клинику без какой-либо координации поездки. Это сравнение намеренно честное — Rafiq не клиника и не даёт медицинских консультаций, не гарантирует результат какой-либо процедуры. Здесь просто показано, где координация действительно помогает — прежде всего с языком и логистикой.",
      "aloneLabel": "Прямая запись в клинику",
      "rafiqLabel": "С координацией Rafiq",
      "rows": [
        { "aspect": "Язык на консультации и во время процедуры", "alone": "Зависит от переводчика самой клиники, если он есть", "rafiq": "Сопровождение и координация на вашем языке на протяжении поездки" },
        { "aspect": "Проверка лицензии и репутации исполнителя", "alone": "Полностью самостоятельный поиск", "rafiq": "Координация с заранее проверенными партнёрами" },
        { "aspect": "Организация поездки и проживания вокруг приёма", "alone": "Вы координируете каждую часть отдельно сами", "rafiq": "Помощь с координацией графика и логистики" },
        { "aspect": "Медицинское решение, диагноз и результат", "alone": "Принимают исключительно врач и клиника", "rafiq": "Так же, исключительно — Rafiq не даёт медицинских консультаций" }
      ],
      "sections": [
        { "heading": "Когда прямой записи достаточно?", "body": "Если у вас есть проверенная рекомендация конкретной клиники или врача в Стамбуле и вы можете уверенно организовать поездку и проживание самостоятельно, прямая запись — вполне разумный выбор. Rafiq не является обязательным этапом для медицинской поездки." },
        { "heading": "В чём именно Rafiq облегчает поездку", "body": "Наибольшая польза проявляется, когда язык становится реальным барьером на медицинской консультации, у вас ещё нет проверенной клиники и вы хотите координацию с проверенным партнёром, или времени мало и нужна помощь с организацией поездки и проживания вокруг даты процедуры. Rafiq координирует логистику и коммуникацию, но никогда не вмешивается в медицинское решение." },
        { "heading": "Что Rafiq не может гарантировать ни при каких условиях", "body": "Диагноз, план лечения и результат любой медицинской процедуры определяются исключительно квалифицированным врачом и клиникой. Rafiq — платформа координации логистики и языка, она не даёт медицинских консультаций и не гарантирует результат какой-либо процедуры." }
      ],
      "faqs": [
        { "question": "Даёт ли Rafiq медицинские консультации или диагноз?", "answer": "Нет, никогда. Rafiq координирует только логистику и коммуникацию; любой диагноз или медицинское решение исходит исключительно от квалифицированного врача или клиники." },
        { "question": "Гарантирует ли Rafiq результат процедуры?", "answer": "Нет. Медицинские результаты зависят от оценки врача и вашей конкретной ситуации со здоровьем, и Rafiq никак не участвует в этом медицинском решении." },
        { "question": "В чём реальная разница, если у меня уже есть проверенная клиника?", "answer": "Если у вас уже есть проверенная клиника и вы можете сами организовать поездку, разница может быть небольшой. Основная польза проявляется, когда нужна помощь с языком или логистикой вокруг вашего приёма." }
      ],
      "ctaTitle": "Хотите узнать, как Rafiq координирует медицинскую поездку?",
      "ctaBody": "Расскажите нам, какую процедуру вы рассматриваете, и предпочитаемый язык — мы честно скажем, где координация с нами облегчит поездку."
    },
    "fa": {
      "seoTitle": "رفیق در برابر رزرو مستقیم با کلینیک گردشگری سلامت در استانبول",
      "navLabel": "رفیق یا رزرو مستقیم؟",
      "metaDescription": "مقایسه‌ای صادقانه بین هماهنگی سفر درمانی به استانبول از طریق رفیق و رزرو مستقیم با کلینیک: زبان، لجستیک و آنچه رفیق از نظر پزشکی تضمین نمی‌کند.",
      "intro": "بسیاری از بیماران گردشگری سلامت مستقیماً با یک کلینیک در استانبول رزرو می‌کنند بدون اینکه کسی سفر را هماهنگ کند. این مقایسه عمداً صادقانه است — رفیق کلینیک نیست و مشاوره پزشکی نمی‌دهد و نتیجه هیچ روشی را تضمین نمی‌کند. فقط نشان می‌دهد هماهنگی واقعاً کجا کمک می‌کند، به‌ویژه در زبان و لجستیک.",
      "aloneLabel": "رزرو مستقیم با کلینیک",
      "rafiqLabel": "هماهنگی با رفیق",
      "rows": [
        { "aspect": "زبان در طول مشاوره و روش درمانی", "alone": "وابسته به مترجم خود کلینیک، در صورت وجود", "rafiq": "همراهی و هماهنگی به زبان شما در طول سفر" },
        { "aspect": "بررسی مجوز و اعتبار ارائه‌دهنده", "alone": "کاملاً تحقیق شخصی", "rafiq": "هماهنگی با همکارانی که از پیش بررسی شده‌اند" },
        { "aspect": "سازمان‌دهی سفر و اقامت حول نوبت", "alone": "خودتان هر بخش را جداگانه هماهنگ می‌کنید", "rafiq": "کمک در هماهنگی برنامه و لجستیک" },
        { "aspect": "تصمیم پزشکی، تشخیص و نتیجه", "alone": "منحصراً بر عهده پزشک و کلینیک", "rafiq": "همان، منحصراً — رفیق مشاوره پزشکی نمی‌دهد" }
      ],
      "sections": [
        { "heading": "چه زمانی رزرو مستقیم کافی است؟", "body": "اگر توصیه‌ای معتبر برای یک کلینیک یا پزشک مشخص در استانبول دارید و می‌توانید با اطمینان سفر و اقامت خود را هماهنگ کنید، رزرو مستقیم انتخابی کاملاً منطقی است. رفیق مرحله‌ای اجباری برای هیچ سفر درمانی نیست." },
        { "heading": "هماهنگی با رفیق دقیقاً کجا سفر را آسان‌تر می‌کند؟", "body": "بیشترین فایده زمانی است که زبان در طول مشاوره پزشکی مانعی واقعی باشد، کلینیک معتبری از قبل ندارید و می‌خواهید با همکاری بررسی‌شده هماهنگ شوید، یا زمان محدود است و به کمک برای سازمان‌دهی سفر و اقامت حول تاریخ روش درمانی نیاز دارید. رفیق لجستیک و ارتباط را هماهنگ می‌کند، اما هرگز در تصمیم پزشکی دخالت نمی‌کند." },
        { "heading": "چیزی که رفیق به‌هیچ‌وجه تضمین نمی‌کند", "body": "تشخیص، برنامه درمان و نتیجه هر روش پزشکی منحصراً بر عهده پزشک و کلینیک واجد شرایط است. رفیق فقط یک پلتفرم هماهنگی لجستیک و زبان است — مشاوره پزشکی نمی‌دهد و نتیجه هیچ روشی را تضمین نمی‌کند." }
      ],
      "faqs": [
        { "question": "آیا رفیق مشاوره پزشکی یا تشخیص می‌دهد؟", "answer": "خیر، هرگز. رفیق فقط لجستیک و ارتباط را هماهنگ می‌کند؛ هر تشخیص یا تصمیم پزشکی منحصراً از سوی پزشک یا کلینیک واجد شرایط است." },
        { "question": "آیا رفیق نتیجه روش درمانی را تضمین می‌کند؟", "answer": "خیر. نتایج پزشکی به ارزیابی پزشک و وضعیت سلامت خاص شما بستگی دارد، و رفیق هیچ نقشی در آن تصمیم پزشکی ندارد." },
        { "question": "اگر از قبل کلینیک معتبری دارم، تفاوت واقعی چیست؟", "answer": "اگر از قبل کلینیک معتبری دارید و می‌توانید سفر خود را هماهنگ کنید، تفاوت می‌تواند محدود باشد. بیشترین فایده زمانی است که به کمک در زبان یا سازمان‌دهی لجستیک حول نوبت خود نیاز دارید." }
      ],
      "ctaTitle": "می‌خواهید بدانید رفیق چگونه سفر درمانی شما را هماهنگ می‌کند؟",
      "ctaBody": "به ما بگویید چه نوع روشی را در نظر دارید و زبان مورد نظرتان چیست تا صادقانه بگوییم هماهنگی با ما دقیقاً کجا سفر شما را آسان‌تر می‌کند."
    }
  },
  "bank-account-alone": {
    "ar": {
      "seoTitle": "رفيق مقابل فتح حساب بنكي في تركيا بنفسك",
      "navLabel": "رفيق أو الذهاب للبنك بنفسك؟",
      "metaDescription": "مقارنة صريحة بين فتح حساب بنكي في تركيا بمرافقة رفيق والذهاب للبنك بنفسك: اللغة، المستندات، وقرار البنك النهائي.",
      "intro": "فتح حساب بنكي كأجنبي بتركيا ممكن يكون بسيط أو معقد حسب وضعك واللغة. هاي مقارنة صريحة — رفيق ما بيقدر يضمن موافقة أي بنك، بس بتوضح وين المرافقة والتنسيق بيفرقوا فعلياً.",
      "aloneLabel": "الذهاب للبنك بنفسك",
      "rafiqLabel": "تنسيق مع رفيق",
      "rows": [
        { "aspect": "اللغة أثناء التعامل مع موظف البنك", "alone": "تعتمد على وجود موظف يحكي لغتك بالفرع", "rafiq": "مرافقة وترجمة بلغتك" },
        { "aspect": "معرفة المستندات المتوقعة مسبقاً", "alone": "تكتشف بنفسك، وممكن تحتاج أكتر من زيارة", "rafiq": "توضيح مسبق للمستندات الشائعة قبل الزيارة" },
        { "aspect": "اختيار الفرع أو البنك المناسب لوضعك", "alone": "بحث ومقارنة شخصية بين البنوك", "rafiq": "إرشاد بناءً على خبرة سابقة مع حالات مشابهة" },
        { "aspect": "الموافقة على فتح الحساب", "alone": "بيد البنك حصراً حسب معايير الامتثال الخاصة فيه", "rafiq": "نفس الشي حصراً — البنك هو يلي بيقرر" }
      ],
      "sections": [
        { "heading": "متى تقدر تروح للبنك بنفسك مباشرة؟", "body": "إذا كنت تحكي تركي أو إنجليزي بثقة، ووضعك بسيط وواضح (عندك إقامة سارية ومستندات جاهزة)، رايح البنك بنفسك خيار معقول جداً وما في داعي لمرافقة." },
        { "heading": "وين المرافقة مع رفيق بتفرق فعلياً؟", "body": "الفايدة الأكبر بتظهر أول مرة توصل تركيا وما بتعرف أي بنك يناسب وضعك، أو لما اللغة عائق حقيقي أثناء التعامل مع الموظف، أو لما ما بدك تضيع وقت بزيارات متكررة بسبب نقص مستند. رفيق بيوضحلك المتوقع مسبقاً ويرافقك، بس ما بيتدخل بقرار البنك نفسه." },
        { "heading": "شو ما فيه ضمانة", "body": "قبول أو رفض فتح أي حساب بنكي قرار داخلي للبنك حصراً حسب معايير الامتثال (KYC) الخاصة فيه، بغض النظر إذا رافقك رفيق أو رحت بنفسك. ولا رفيق ولا أي طرف بيقدر يضمن موافقة البنك." }
      ],
      "faqs": [
        { "question": "هل رفيق يضمن قبول فتح الحساب البنكي؟", "answer": "لا. قرار فتح الحساب بيد البنك حصراً حسب معايير الامتثال الخاصة فيه، بغض النظر عن طريقة التنسيق." },
        { "question": "هل لازم أعرف تركي عشان أفتح حساب بنكي؟", "answer": "مش شرط، بس بيسهّل الموضوع كتير. رفيق ممكن يوفر مرافقة وترجمة إذا احتجت تسهيل التواصل مع الموظف." },
        { "question": "هل في بنك واحد أفضل لكل الأجانب؟", "answer": "يختلف حسب وضعك الشخصي ونوع إقامتك. رفيق بيساعدك تفهم الخيارات المتاحة بدل ما تبحث وتقارن لحالك من الصفر." }
      ],
      "ctaTitle": "بدك مرافقة لفتح حسابك البنكي؟",
      "ctaBody": "احكيلنا وضعك الحالي (نوع إقامتك، لغتك المفضلة) ومنوضحلك بصراحة وين المرافقة معنا بتسهّل الزيارة."
    },
    "en": {
      "seoTitle": "Rafiq vs. opening a Turkish bank account yourself",
      "navLabel": "Rafiq or going to the bank alone?",
      "metaDescription": "An honest comparison between opening a Turkish bank account with Rafiq's escort and going to the bank yourself: language, documents, and the bank's own final decision.",
      "intro": "Opening a bank account as a foreigner in Turkey can be simple or complicated depending on your situation and language. This comparison is deliberately honest — Rafiq cannot guarantee any bank's approval, but it lays out where an escort and coordination genuinely help.",
      "aloneLabel": "Going to the bank yourself",
      "rafiqLabel": "Coordinating with Rafiq",
      "rows": [
        { "aspect": "Language when dealing with the bank staff", "alone": "Depends on a branch employee speaking your language", "rafiq": "Escort and interpretation in your language" },
        { "aspect": "Knowing the expected documents in advance", "alone": "You find out yourself, possibly needing more than one visit", "rafiq": "Clarifying commonly required documents before the visit" },
        { "aspect": "Choosing the right branch or bank for your situation", "alone": "Your own research and comparison between banks", "rafiq": "Guidance based on prior experience with similar cases" },
        { "aspect": "Approval to open the account", "alone": "Made exclusively by the bank under its own compliance criteria", "rafiq": "Same, exclusively — the bank makes that call" }
      ],
      "sections": [
        { "heading": "When can you go to the bank yourself directly?", "body": "If you speak confident Turkish or English, and your situation is simple and clear (a valid residence permit and documents ready), going yourself is a perfectly reasonable choice with no need for an escort." },
        { "heading": "Where does an escort with Rafiq actually help?", "body": "The biggest benefit shows up the first time you arrive in Turkey and don't know which bank fits your situation, when language is a real barrier with the staff, or when you don't want to waste time on repeat visits over a missing document. Rafiq clarifies what to expect in advance and escorts you, but does not influence the bank's own decision." },
        { "heading": "What no one can guarantee", "body": "Approval or rejection of any bank account application is an internal decision made exclusively by the bank under its own compliance (KYC) criteria, whether Rafiq escorted you or you went alone. Neither Rafiq nor anyone else can guarantee the bank's approval." }
      ],
      "faqs": [
        { "question": "Does Rafiq guarantee my bank account gets approved?", "answer": "No. Approval is made exclusively by the bank under its own compliance criteria, regardless of how you coordinated the visit." },
        { "question": "Do I need to speak Turkish to open a bank account?", "answer": "Not strictly, but it helps a lot. Rafiq can provide escort and interpretation if you need help communicating with the staff." },
        { "question": "Is one bank better for every foreigner?", "answer": "It depends on your personal situation and residence type. Rafiq helps you understand the available options instead of researching and comparing from scratch alone." }
      ],
      "ctaTitle": "Want an escort to open your bank account?",
      "ctaBody": "Tell us your current situation (residence type, preferred language) and we'll tell you honestly where an escort with us makes the visit easier."
    },
    "ru": {
      "seoTitle": "Rafiq против самостоятельного открытия банковского счёта в Турции",
      "navLabel": "Rafiq или самостоятельно в банк?",
      "metaDescription": "Честное сравнение открытия турецкого банковского счёта с сопровождением Rafiq и самостоятельного визита в банк: язык, документы и итоговое решение самого банка.",
      "intro": "Открытие банковского счёта иностранцем в Турции может быть простым или сложным в зависимости от вашей ситуации и языка. Это сравнение намеренно честное — Rafiq не может гарантировать одобрение какого-либо банка, но показывает, где сопровождение и координация действительно помогают.",
      "aloneLabel": "Самостоятельно в банк",
      "rafiqLabel": "С координацией Rafiq",
      "rows": [
        { "aspect": "Язык при общении с сотрудником банка", "alone": "Зависит от того, говорит ли сотрудник отделения на вашем языке", "rafiq": "Сопровождение и перевод на вашем языке" },
        { "aspect": "Знание ожидаемых документов заранее", "alone": "Узнаёте сами, возможно потребуется не один визит", "rafiq": "Разъяснение обычно требуемых документов перед визитом" },
        { "aspect": "Выбор подходящего отделения или банка", "alone": "Самостоятельный поиск и сравнение банков", "rafiq": "Рекомендации на основе опыта работы с похожими случаями" },
        { "aspect": "Одобрение открытия счёта", "alone": "Принимает исключительно банк по своим критериям комплаенса", "rafiq": "Так же, исключительно — решение остаётся за банком" }
      ],
      "sections": [
        { "heading": "Когда можно пойти в банк самостоятельно?", "body": "Если вы уверенно говорите по-турецки или по-английски, а ваша ситуация простая и понятная (действующий вид на жительство и готовые документы), самостоятельный визит — вполне разумный выбор без необходимости в сопровождении." },
        { "heading": "В чём именно сопровождение с Rafiq помогает", "body": "Наибольшая польза проявляется при первом приезде в Турцию, когда вы не знаете, какой банк подходит для вашей ситуации, когда язык становится реальным барьером при общении с сотрудником, или когда вы не хотите тратить время на повторные визиты из-за недостающего документа. Rafiq заранее разъясняет, чего ожидать, и сопровождает вас, но не влияет на само решение банка." },
        { "heading": "Что не может гарантировать никто", "body": "Одобрение или отказ по заявке на открытие счёта — внутреннее решение, которое принимает исключительно банк по своим критериям комплаенса (KYC), независимо от того, сопровождал вас Rafiq или вы пошли самостоятельно. Ни Rafiq, ни кто-либо ещё не может гарантировать одобрение банка." }
      ],
      "faqs": [
        { "question": "Гарантирует ли Rafiq одобрение моего банковского счёта?", "answer": "Нет. Одобрение принимает исключительно банк по своим критериям комплаенса, независимо от способа координации визита." },
        { "question": "Нужно ли мне знать турецкий, чтобы открыть банковский счёт?", "answer": "Не обязательно, но это сильно помогает. Rafiq может обеспечить сопровождение и перевод, если вам нужна помощь в общении с сотрудником." },
        { "question": "Есть ли один банк, который лучше подходит всем иностранцам?", "answer": "Это зависит от вашей личной ситуации и типа вида на жительство. Rafiq помогает разобраться в доступных вариантах вместо самостоятельного поиска и сравнения с нуля." }
      ],
      "ctaTitle": "Нужно сопровождение для открытия банковского счёта?",
      "ctaBody": "Расскажите нам о вашей текущей ситуации (тип вида на жительство, предпочитаемый язык) — мы честно скажем, где сопровождение с нами облегчит визит."
    },
    "fa": {
      "seoTitle": "رفیق در برابر افتتاح حساب بانکی در ترکیه به‌تنهایی",
      "navLabel": "رفیق یا مراجعه شخصی به بانک؟",
      "metaDescription": "مقایسه‌ای صادقانه بین افتتاح حساب بانکی ترکیه با همراهی رفیق و مراجعه شخصی به بانک: زبان، مدارک و تصمیم نهایی خود بانک.",
      "intro": "افتتاح حساب بانکی به‌عنوان یک خارجی در ترکیه بسته به وضعیت و زبان شما می‌تواند ساده یا پیچیده باشد. این مقایسه عمداً صادقانه است — رفیق نمی‌تواند تأیید هیچ بانکی را تضمین کند، اما نشان می‌دهد همراهی و هماهنگی واقعاً کجا کمک می‌کند.",
      "aloneLabel": "مراجعه شخصی به بانک",
      "rafiqLabel": "هماهنگی با رفیق",
      "rows": [
        { "aspect": "زبان در ارتباط با کارمند بانک", "alone": "وابسته به اینکه کارمند شعبه به زبان شما صحبت کند", "rafiq": "همراهی و ترجمه به زبان شما" },
        { "aspect": "آگاهی از مدارک موردنیاز از پیش", "alone": "خودتان متوجه می‌شوید، شاید بیش از یک مراجعه لازم باشد", "rafiq": "توضیح مدارک معمولاً موردنیاز پیش از مراجعه" },
        { "aspect": "انتخاب شعبه یا بانک مناسب برای وضعیت شما", "alone": "تحقیق و مقایسه شخصی بین بانک‌ها", "rafiq": "راهنمایی بر اساس تجربه قبلی با موارد مشابه" },
        { "aspect": "تأیید افتتاح حساب", "alone": "منحصراً بر عهده بانک طبق معیارهای انطباق خودش", "rafiq": "همان، منحصراً — تصمیم با خود بانک است" }
      ],
      "sections": [
        { "heading": "چه زمانی می‌توانید مستقیم به بانک مراجعه کنید؟", "body": "اگر به ترکی یا انگلیسی مسلط هستید و وضعیت شما ساده و روشن است (اقامت معتبر و مدارک آماده)، مراجعه شخصی انتخابی کاملاً منطقی است و نیازی به همراهی نیست." },
        { "heading": "همراهی با رفیق دقیقاً کجا کمک می‌کند؟", "body": "بیشترین فایده در اولین ورود به ترکیه است وقتی نمی‌دانید کدام بانک مناسب وضعیت شماست، یا زمانی که زبان مانعی واقعی در ارتباط با کارمند باشد، یا وقتی نمی‌خواهید به‌دلیل کمبود یک مدرک وقت خود را با مراجعات مکرر تلف کنید. رفیق از پیش توضیح می‌دهد چه انتظاری داشته باشید و همراهی می‌کند، اما در تصمیم خود بانک دخالتی ندارد." },
        { "heading": "چیزی که هیچ‌کس تضمین نمی‌کند", "body": "تأیید یا رد هر درخواست افتتاح حساب، تصمیمی داخلی است که منحصراً توسط بانک طبق معیارهای انطباق (KYC) خودش گرفته می‌شود، چه رفیق همراهی کرده باشد چه خودتان مراجعه کرده باشید. نه رفیق و نه هیچ طرف دیگری نمی‌تواند تأیید بانک را تضمین کند." }
      ],
      "faqs": [
        { "question": "آیا رفیق تأیید حساب بانکی من را تضمین می‌کند؟", "answer": "خیر. تأیید منحصراً بر عهده بانک طبق معیارهای انطباق خودش است، صرف‌نظر از روش هماهنگی مراجعه." },
        { "question": "آیا برای افتتاح حساب بانکی باید ترکی بلد باشم؟", "answer": "الزامی نیست، اما کمک زیادی می‌کند. رفیق در صورت نیاز به کمک در ارتباط با کارمند می‌تواند همراهی و ترجمه ارائه دهد." },
        { "question": "آیا یک بانک برای همه خارجی‌ها بهتر است؟", "answer": "این به وضعیت شخصی و نوع اقامت شما بستگی دارد. رفیق کمک می‌کند گزینه‌های موجود را بفهمید به‌جای اینکه از صفر خودتان تحقیق و مقایسه کنید." }
      ],
      "ctaTitle": "همراهی برای افتتاح حساب بانکی می‌خواهید؟",
      "ctaBody": "وضعیت فعلی خود (نوع اقامت، زبان مورد نظر) را به ما بگویید تا صادقانه بگوییم همراهی با ما دقیقاً کجا مراجعه شما را آسان‌تر می‌کند."
    }
  }
};
