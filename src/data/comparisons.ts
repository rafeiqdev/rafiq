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
  }
};
