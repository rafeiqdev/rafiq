/**
 * The /contact page — the channels that actually reach Rafiq.
 *
 * Created alongside src/data/aboutPage.ts for the reason set out there: the
 * site published no way to reach a human and no statement of where the
 * business operates, which is a trust ceiling for both search engines and
 * visitors deciding whether to pay a stranger abroad.
 *
 * IMPORTANT — no contact value is hardcoded in this file. The WhatsApp number
 * and email address are read from VITE_WHATSAPP_NUMBER and VITE_CONTACT_EMAIL
 * via src/lib/contact.ts, so there is exactly one place to change them and no
 * risk of a stale number surviving in a translation. The strings here are only
 * the surrounding labels and explanations. A channel whose value is not
 * configured is not rendered at all rather than shown broken — same guard the
 * floating WhatsApp button and SiteFooter already use.
 *
 * There is deliberately no office address (Rafiq has no public premises — the
 * work is field-based) and no response-time promise: an SLA the business has
 * not actually committed to is worse than none. If real opening hours or a
 * response-time commitment are ever agreed, `availability` is the string to
 * update in all four languages.
 *
 * Double-quoted JSON-style strings, same reason as faqHub.ts and
 * comparisons.ts: read by scripts/generate-seo-pages.mjs via brace-matching +
 * JSON.parse, not a field-by-field regex parser.
 */

export type ContactLanguage = "ar" | "en" | "ru" | "fa";

export interface ContactContent {
  seoTitle: string;
  metaDescription: string;
  /** H1 — shorter than seoTitle, which carries the brand suffix for the SERP. */
  title: string;
  intro: string;
  whatsappLabel: string;
  whatsappBody: string;
  whatsappCta: string;
  emailLabel: string;
  emailBody: string;
  availabilityLabel: string;
  availability: string;
  areaLabel: string;
  area: string;
  languagesLabel: string;
  languages: string;
  tipsHeading: string;
  tipsIntro: string;
  tips: string[];
  costLabel: string;
  costNote: string;
}

export const CONTACT_PAGE: Record<ContactLanguage, ContactContent> = {
  "ar": {
    "seoTitle": "تواصل مع رفيق | واتساب وبريد إلكتروني — إسطنبول",
    "metaDescription": "تواصل مع رفيق إسطنبول عبر واتساب أو البريد الإلكتروني بالعربية أو الإنجليزية أو الروسية أو الفارسية. اشرح حالتك ونوضّح لك ما ينطبق عليك والتكلفة قبل أي التزام.",
    "title": "تواصل معنا",
    "intro": "اشرح لنا حالتك بإيجاز — من أي بلد أنت، وضعك الحالي في تركيا، وما الذي تحتاجه — ونقول لك ما ينطبق عليك، وما المستندات المطلوبة، والتكلفة الواضحة قبل أن تلتزم بأي شيء.",
    "whatsappLabel": "واتساب",
    "whatsappBody": "أسرع طريقة للوصول إلينا، وهي القناة التي نتابعها فعلياً. اكتب لنا بلغتك مباشرة.",
    "whatsappCta": "افتح محادثة واتساب",
    "emailLabel": "البريد الإلكتروني",
    "emailBody": "مناسب إذا كان معك مستندات ترغب بإرسالها، أو تفضّل التواصل الكتابي المطوّل.",
    "availabilityLabel": "متى نرد",
    "availability": "نرد على الرسائل خلال ساعات العمل بتوقيت إسطنبول. إذا كانت حالتك عاجلة، اذكر ذلك في أول سطر من رسالتك.",
    "areaLabel": "أين نعمل",
    "area": "إسطنبول، تركيا. عملنا ميداني — مرافقة إلى البنك أو المستشفى أو معاينة عقار أو موعد رسمي — ولا نستقبل زيارات في مكتب مفتوح للجمهور. يبدأ التواصل عن بُعد، ثم نتفق على الترتيب الميداني إن احتاجت حالتك ذلك.",
    "languagesLabel": "لغات التواصل",
    "languages": "العربية، الإنجليزية، الروسية، الفارسية. لا حاجة لأن تتعامل بالتركية في أي مرحلة.",
    "tipsHeading": "كيف تحصل على جواب دقيق من أول رسالة",
    "tipsIntro": "كل ما كانت رسالتك أوضح، كان جوابنا أدق وأسرع. حاول أن تذكر:",
    "tips": [
      "جنسيتك، وهل أنت حالياً داخل تركيا أم خارجها.",
      "وضعك الحالي: تأشيرة، إقامة سارية، إقامة منتهية، أو لا شيء بعد.",
      "ما الذي تحتاجه تحديداً، أو المشكلة التي تواجهها إن كنت غير متأكد من الخدمة المناسبة.",
      "الإطار الزمني — هل هناك موعد أو تاريخ انتهاء يضغط عليك."
    ],
    "costLabel": "التكلفة",
    "costNote": "لا ننشر أرقاماً ثابتة على الموقع لأن التكلفة تختلف بحسب نوع المعاملة وحالتك والرسوم الرسمية السارية وقت التنفيذ. بعد أن نفهم حالتك نعطيك الرقم الواضح وما يشمله، قبل أن تبدأ."
  },
  "en": {
    "seoTitle": "Contact Rafiq | WhatsApp and email — Istanbul",
    "metaDescription": "Get in touch with Rafiq Istanbul on WhatsApp or by email, in Arabic, English, Russian or Persian. Describe your situation and we'll tell you what applies to you and what it costs before you commit.",
    "title": "Contact us",
    "intro": "Tell us briefly where you stand — where you're from, your current status in Türkiye, and what you need — and we'll tell you what applies to you, which documents it takes, and a clear cost before you commit to anything.",
    "whatsappLabel": "WhatsApp",
    "whatsappBody": "The fastest way to reach us, and the channel we actually monitor. Write to us in your own language.",
    "whatsappCta": "Open a WhatsApp chat",
    "emailLabel": "Email",
    "emailBody": "Better if you have documents to send, or you prefer a longer written exchange.",
    "availabilityLabel": "When we reply",
    "availability": "We answer messages during working hours, Istanbul time. If your case is urgent, say so in the first line of your message.",
    "areaLabel": "Where we operate",
    "area": "Istanbul, Türkiye. Our work is field-based — accompanying you to a bank, a hospital, a property viewing or an official appointment — and we do not receive walk-in visitors at a public office. Contact starts remotely, and we arrange the in-person part from there if your case needs it.",
    "languagesLabel": "Languages",
    "languages": "Arabic, English, Russian and Persian. You never need to handle Turkish yourself.",
    "tipsHeading": "How to get a precise answer on the first message",
    "tipsIntro": "The clearer your message, the more precise and faster our answer. Try to include:",
    "tips": [
      "Your nationality, and whether you are currently inside Türkiye or abroad.",
      "Your current status: a visa, a valid permit, an expired permit, or nothing yet.",
      "What exactly you need — or the problem you're facing, if you're not sure which service fits.",
      "Your timeline — whether an appointment or an expiry date is putting pressure on you."
    ],
    "costLabel": "Cost",
    "costNote": "We don't publish fixed figures on this site, because cost depends on the type of procedure, your circumstances, and the official fees in force at the time. Once we understand your case, we give you a clear number and what it covers, before anything starts."
  },
  "ru": {
    "seoTitle": "Связаться с Рафик | WhatsApp и почта — Стамбул",
    "metaDescription": "Свяжитесь с Рафик Стамбул через WhatsApp или по электронной почте на арабском, английском, русском или персидском. Опишите ситуацию — мы скажем, что к вам применимо и сколько это стоит, до любых обязательств.",
    "title": "Свяжитесь с нами",
    "intro": "Коротко опишите, на каком вы этапе — откуда вы, каков ваш нынешний статус в Турции и что вам нужно, — и мы скажем, что к вам применимо, какие документы потребуются и какова понятная стоимость, прежде чем вы возьмёте на себя какие-либо обязательства.",
    "whatsappLabel": "WhatsApp",
    "whatsappBody": "Самый быстрый способ связаться с нами и канал, который мы действительно отслеживаем. Пишите на своём языке.",
    "whatsappCta": "Открыть чат в WhatsApp",
    "emailLabel": "Электронная почта",
    "emailBody": "Удобнее, если нужно отправить документы или вы предпочитаете развёрнутую письменную переписку.",
    "availabilityLabel": "Когда мы отвечаем",
    "availability": "Мы отвечаем на сообщения в рабочие часы по стамбульскому времени. Если случай срочный, укажите это в первой строке сообщения.",
    "areaLabel": "Где мы работаем",
    "area": "Стамбул, Турция. Наша работа выездная — сопровождение в банк, в больницу, на просмотр недвижимости или на официальную запись, — и мы не принимаем посетителей в открытом офисе. Общение начинается дистанционно, а очную часть мы согласуем отдельно, если ваш случай этого требует.",
    "languagesLabel": "Языки общения",
    "languages": "Арабский, английский, русский и персидский. Вам ни на каком этапе не придётся иметь дело с турецким.",
    "tipsHeading": "Как получить точный ответ с первого сообщения",
    "tipsIntro": "Чем яснее ваше сообщение, тем точнее и быстрее наш ответ. Постарайтесь указать:",
    "tips": [
      "Ваше гражданство и находитесь ли вы сейчас в Турции или за её пределами.",
      "Ваш текущий статус: виза, действующий ВНЖ, просроченный ВНЖ или пока ничего.",
      "Что именно вам нужно — или в чём проблема, если вы не уверены, какая услуга подходит.",
      "Сроки — поджимает ли вас запись на приём или дата окончания документа."
    ],
    "costLabel": "Стоимость",
    "costNote": "Мы не публикуем на сайте фиксированные цифры, потому что стоимость зависит от типа процедуры, ваших обстоятельств и официальных сборов, действующих на момент оформления. Разобравшись в вашей ситуации, мы называем понятную сумму и поясняем, что в неё входит, до начала работы."
  },
  "fa": {
    "seoTitle": "تماس با رفیق | واتساپ و ایمیل — استانبول",
    "metaDescription": "با رفیق استانبول از طریق واتساپ یا ایمیل به عربی، انگلیسی، روسی یا فارسی در تماس باشید. وضعیتتان را شرح دهید تا بگوییم چه چیزی شامل حال شماست و هزینه‌اش پیش از هر تعهدی چقدر است.",
    "title": "تماس با ما",
    "intro": "کوتاه بگویید در چه وضعیتی هستید — اهل کجایید، وضعیت فعلی‌تان در ترکیه چیست و به چه چیزی نیاز دارید — تا بگوییم چه چیزی شامل حال شماست، چه مدارکی لازم است و هزینه روشن آن پیش از هر تعهدی چقدر خواهد بود.",
    "whatsappLabel": "واتساپ",
    "whatsappBody": "سریع‌ترین راه رسیدن به ما و کانالی که واقعاً پیگیری‌اش می‌کنیم. به زبان خودتان بنویسید.",
    "whatsappCta": "شروع گفتگو در واتساپ",
    "emailLabel": "ایمیل",
    "emailBody": "اگر سندی برای ارسال دارید یا مکاتبه نوشتاری مفصل‌تر را ترجیح می‌دهید، مناسب‌تر است.",
    "availabilityLabel": "زمان پاسخ‌گویی",
    "availability": "به پیام‌ها در ساعات کاری به وقت استانبول پاسخ می‌دهیم. اگر پرونده‌تان فوری است، همان خط اول پیام آن را بنویسید.",
    "areaLabel": "محدوده کاری ما",
    "area": "استانبول، ترکیه. کار ما میدانی است — همراهی به بانک، بیمارستان، بازدید ملک یا یک وقت اداری — و پذیرای مراجعه حضوری در دفتری عمومی نیستیم. ارتباط از راه دور آغاز می‌شود و در صورت نیاز پرونده، بخش حضوری را از همان‌جا هماهنگ می‌کنیم.",
    "languagesLabel": "زبان‌های ارتباطی",
    "languages": "عربی، انگلیسی، روسی و فارسی. در هیچ مرحله‌ای لازم نیست خودتان با زبان ترکی سر و کار داشته باشید.",
    "tipsHeading": "چطور از همان پیام اول پاسخ دقیق بگیرید",
    "tipsIntro": "هرچه پیام شما روشن‌تر باشد، پاسخ ما دقیق‌تر و سریع‌تر است. تلاش کنید این‌ها را بنویسید:",
    "tips": [
      "تابعیت شما، و اینکه اکنون داخل ترکیه هستید یا خارج از آن.",
      "وضعیت فعلی شما: ویزا، اقامت معتبر، اقامت منقضی‌شده، یا هنوز هیچ‌کدام.",
      "دقیقاً به چه چیزی نیاز دارید — یا اگر مطمئن نیستید کدام خدمت مناسب است، مشکلی که با آن روبه‌رو هستید.",
      "بازه زمانی — اینکه آیا وقت اداری یا تاریخ انقضایی به شما فشار می‌آورد."
    ],
    "costLabel": "هزینه",
    "costNote": "ما رقم ثابتی روی سایت منتشر نمی‌کنیم، چون هزینه به نوع روند، شرایط شما و عوارض رسمی جاری در زمان انجام بستگی دارد. پس از آنکه وضعیتتان را فهمیدیم، عدد روشن و آنچه را که پوشش می‌دهد، پیش از شروع کار به شما می‌گوییم."
  }
};
