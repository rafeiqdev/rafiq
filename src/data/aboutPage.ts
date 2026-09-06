/**
 * The /about page — who Rafiq is, how it works, and what it deliberately does
 * not promise.
 *
 * This page exists because the SEO/GEO audit found the site published no
 * business identity at all: no "who we are", no contact details, nothing a
 * search engine or an AI answer engine could use to establish that Rafiq is a
 * real, accountable business. For content about residency, banking, property
 * and medical treatment — which Google treats under its strictest quality bar
 * — an unidentifiable publisher is a hard ceiling on how far anything can
 * rank, and a reason AI assistants will not name Rafiq in an answer.
 *
 * Everything here is deliberately verifiable. There is no invented office
 * address, no founding date, no team headcount, no awards, no client numbers
 * and no registration number — Rafiq is not yet a registered company, and the
 * "legal status" section says so plainly rather than implying otherwise. When
 * the company is formally established, that section is the one to update.
 *
 * Same guardrails as every other content file here: no exact government fees,
 * no step-by-step DIY instructions, no guaranteed outcomes, and no claim that
 * Rafiq is a government authority, bank, law firm, or clinic.
 *
 * Double-quoted JSON-style strings, same reason as faqHub.ts and
 * comparisons.ts: read by scripts/generate-seo-pages.mjs via brace-matching +
 * JSON.parse, not a field-by-field regex parser.
 */

export type AboutLanguage = "ar" | "en" | "ru" | "fa";

export interface AboutSection {
  heading: string;
  body: string;
}

export interface AboutContent {
  seoTitle: string;
  metaDescription: string;
  /** H1 — shorter than seoTitle, which carries the brand suffix for the SERP. */
  title: string;
  intro: string;
  sections: AboutSection[];
  ctaHeading: string;
  ctaBody: string;
  ctaLabel: string;
}

export const ABOUT_PAGE: Record<AboutLanguage, AboutContent> = {
  "ar": {
    "seoTitle": "من نحن | رفيق إسطنبول — تنسيق معاملات الأجانب في إسطنبول",
    "metaDescription": "رفيق منصة تنسيق تساعد الأجانب في إسطنبول على إنجاز معاملات الإقامة والبنوك والسكن والصحة بلغتهم، مباشرة أو عبر شركاء مرخصين. تعرّف على طريقة عملنا وحدود ما نعد به.",
    "title": "من نحن",
    "intro": "رفيق منصة تنسيق للأجانب في إسطنبول. نحن لسنا جهة حكومية ولا بنكاً ولا مكتب محاماة ولا عيادة — نحن الطرف الذي يفهم حالتك، يشرح لك ما ينطبق عليك بلغتك، وينسّق تنفيذ المعاملة معك أو مع شريك مرخّص، ويتابعها حتى تصل إلى نتيجة.",
    "sections": [
      {
        "heading": "ما الذي نقوم به فعلاً",
        "body": "معظم صعوبة الحياة في إسطنبول بالنسبة للوافد ليست في المعاملة نفسها، بل في معرفة أي معاملة تنطبق على حالته، وما المستندات المطلوبة، وأين تُنجز، وبأي ترتيب — وكل ذلك بلغة لا يتقنها. رفيق يغطي هذه المسافة: نستمع لحالتك، نحدد الخدمة المناسبة، نوضّح الشروط والمستندات والمخاطر الشائعة، ثم نرافقك في التنفيذ. تشمل تغطيتنا الإقامات والمعاملات الرسمية، الحسابات البنكية والتأمين، السكن والعقارات، الصحة والسياحة العلاجية، التعليم، الترجمة والتوثيق، وخدمات الحياة اليومية."
      },
      {
        "heading": "كيف ننفّذ: مباشرة أو عبر شركاء مرخّصين",
        "body": "بعض الخدمات ينفّذها فريق رفيق مباشرة، وبعضها ينفّذه شريك مرخّص في مجاله — محامٍ أو مكتب عقاري أو مركز طبي أو مترجم محلّف. كل صفحة خدمة على الموقع تذكر أيّاً من الاثنين ينطبق عليها، قبل أن تتواصل معنا وليس بعده. حين يكون التنفيذ عبر شريك، يبقى رفيق طرفك في المتابعة: نحن من نشرح لك، ونتابع الملف، ونبقى المرجع الذي تعود إليه."
      },
      {
        "heading": "لمن نقدّم الخدمة",
        "body": "للطلاب القادمين للدراسة، وللواصلين حديثاً إلى إسطنبول، وللمقيمين منذ سنوات الذين يحتاجون تجديداً أو معاملة جديدة، وللزوّار والسيّاح، ولمن ما زال يخطّط للانتقال ويريد أن يفهم الصورة قبل أن يتحرك، ولمن يأتي إلى إسطنبول للعلاج. الحالات مختلفة تماماً، ولذلك نبدأ دائماً بالسؤال عن حالتك قبل أن نقترح خدمة."
      },
      {
        "heading": "بأي لغة نعمل",
        "body": "العربية والإنجليزية والروسية والفارسية. الموقع كامل متاح بهذه اللغات الأربع، والتواصل معنا كذلك. لا نطلب منك أن تتعامل بالتركية في أي مرحلة — هذا بالضبط ما نغطّيه عنك، سواء في مكالمة أو في مراجعة مستند أو في مرافقة ميدانية."
      },
      {
        "heading": "أين نعمل",
        "body": "نعمل في إسطنبول. عملنا ميداني بطبيعته — مرافقة إلى البنك، إلى المستشفى، إلى معاينة عقار، إلى موعد رسمي — ولا نستقبل زيارات في مكتب مفتوح للجمهور. التواصل يبدأ عن بُعد عبر واتساب أو البريد الإلكتروني، ثم نتفق على الترتيب الميداني إن كانت حالتك تحتاجه."
      },
      {
        "heading": "ما لا نعد به",
        "body": "لا نضمن نتيجة أي طلب تبتّ فيه جهة رسمية. قرار الإقامة تصدره دائرة الهجرة، وقرار الجنسية تصدره الجهة المختصة، وقبول الحساب البنكي قرار البنك، والقرار الطبي قرار الطبيب. دورنا أن نجهّز الملف بشكل صحيح، ونوضّح المخاطر قبل أن تدفع أو تلتزم، ونتابع — لا أن نَعِد بقرار ليس لنا. وأي جهة تضمن لك نتيجة حكومية مقدّماً، هذه في حد ذاتها إشارة خطر ينبغي أن تنتبه لها."
      },
      {
        "heading": "التكلفة",
        "body": "تختلف تكلفة كل معاملة باختلاف نوعها وحالتك الشخصية والرسوم الرسمية السارية وقت التنفيذ، ولذلك لا ننشر أرقاماً ثابتة على الموقع — الرقم المنشور اليوم قد يكون مضلّلاً غداً. حين تتواصل معنا ونفهم حالتك بدقة، نعطيك التكلفة الواضحة قبل أن تبدأ، وما يدخل فيها وما لا يدخل."
      },
      {
        "heading": "وضعنا القانوني",
        "body": "شركة رفيق قيد التأسيس في تركيا حالياً. نفضّل أن نقول ذلك صراحةً بدل أن نوحي بغير الواقع، وسننشر الاسم القانوني ورقم السجل على هذه الصفحة فور اكتمال التسجيل. الخدمات التي تتطلب ترخيصاً — القانونية والعقارية والطبية والترجمة المحلّفة — تُنفَّذ عبر شركاء مرخّصين في مجالاتهم، وهذا مذكور في صفحة كل خدمة."
      }
    ],
    "ctaHeading": "عندك حالة تريد أن تسأل عنها؟",
    "ctaBody": "اشرح لنا وضعك بإيجاز ونقول لك ما ينطبق عليك وما الخطوة التالية — قبل أي التزام.",
    "ctaLabel": "تواصل معنا"
  },
  "en": {
    "seoTitle": "About Rafiq Istanbul | Coordination for foreigners in Istanbul",
    "metaDescription": "Rafiq is a coordination service helping foreigners in Istanbul handle residency, banking, housing and health matters in their own language — directly or through licensed partners. How we work, and what we don't promise.",
    "title": "About us",
    "intro": "Rafiq is a coordination service for foreigners in Istanbul. We are not a government authority, a bank, a law firm or a clinic. We are the party that understands your situation, explains what applies to you in your own language, coordinates the work with you or with a licensed partner, and follows it through to an outcome.",
    "sections": [
      {
        "heading": "What we actually do",
        "body": "For a newcomer, the hard part of life in Istanbul is rarely the procedure itself — it is knowing which procedure applies to your situation, what documents it needs, where it is done and in what order, all in a language you do not speak. Rafiq closes that gap: we listen to your case, identify the right service, explain the conditions, the documents and the common pitfalls, then stay with you through the work. Our coverage spans residence permits and official procedures, banking and insurance, housing and property, health and medical travel, education, translation and notarisation, and everyday living services."
      },
      {
        "heading": "How the work is done: directly or through licensed partners",
        "body": "Some services are handled directly by Rafiq's own team; others are carried out by a partner licensed in their field — a lawyer, a real-estate office, a medical facility, a sworn translator. Every service page on this site states which of the two applies, before you contact us rather than after. When a partner does the work, Rafiq remains your point of contact: we are the ones who explain it, follow the file, and stay the person you come back to."
      },
      {
        "heading": "Who we work with",
        "body": "Students arriving to study, people who have just landed in Istanbul, long-term residents who need a renewal or a new procedure, visitors and tourists, people still planning the move who want to understand the picture before they commit, and people coming to Istanbul for treatment. These situations are genuinely different from one another, which is why we always start by asking about yours before suggesting a service."
      },
      {
        "heading": "Languages we work in",
        "body": "Arabic, English, Russian and Persian. The whole site is available in all four, and so is talking to us. At no point do we ask you to handle Turkish yourself — that is precisely what we cover for you, whether on a call, in reviewing a document, or accompanying you in person."
      },
      {
        "heading": "Where we operate",
        "body": "We work in Istanbul. The work is field-based by nature — accompanying you to a bank, to a hospital, to a property viewing, to an official appointment — and we do not receive walk-in visitors at a public office. Contact starts remotely over WhatsApp or email, and we arrange the in-person part from there if your case needs it."
      },
      {
        "heading": "What we do not promise",
        "body": "We do not guarantee the outcome of any application decided by an official body. Residence decisions are made by the migration authority, citizenship decisions by the competent authority, account approval by the bank, and medical decisions by the doctor. Our role is to prepare the file properly, make the risks clear before you pay or commit, and follow it through — not to promise a decision that is not ours to make. Anyone who guarantees you a government outcome in advance is showing you a warning sign worth paying attention to."
      },
      {
        "heading": "Cost",
        "body": "What a procedure costs depends on its type, your personal circumstances, and the official fees in force at the time, so we do not publish fixed figures on this site — a number that is accurate today can be misleading tomorrow. Once you contact us and we understand your case precisely, we give you a clear cost before anything starts, along with what it does and does not include."
      },
      {
        "heading": "Our legal status",
        "body": "Rafiq is currently in the process of being formally established as a company in Türkiye. We would rather say that plainly than imply otherwise, and we will publish the legal name and registration number on this page as soon as registration is complete. Services that require a licence — legal, real-estate, medical and sworn translation — are carried out through partners licensed in their fields, and each service page says so."
      }
    ],
    "ctaHeading": "Have a situation you want to ask about?",
    "ctaBody": "Tell us briefly where you stand and we will tell you what applies to you and what the next step is — before any commitment.",
    "ctaLabel": "Contact us"
  },
  "ru": {
    "seoTitle": "О нас | Рафик Стамбул — сопровождение иностранцев в Стамбуле",
    "metaDescription": "Рафик — служба сопровождения, помогающая иностранцам в Стамбуле с ВНЖ, банками, жильём и медициной на их родном языке: напрямую или через лицензированных партнёров. Как мы работаем и чего не обещаем.",
    "title": "О нас",
    "intro": "Рафик — служба сопровождения для иностранцев в Стамбуле. Мы не государственный орган, не банк, не юридическая фирма и не клиника. Мы та сторона, которая разбирается в вашей ситуации, объясняет на вашем языке, что именно к вам применимо, координирует работу — свою или лицензированного партнёра — и ведёт дело до результата.",
    "sections": [
      {
        "heading": "Чем мы занимаемся на деле",
        "body": "Для приезжего сложность жизни в Стамбуле обычно не в самой процедуре, а в том, чтобы понять, какая процедура относится именно к его случаю, какие документы нужны, где всё оформляется и в каком порядке — и всё это на языке, которым он не владеет. Рафик закрывает этот разрыв: мы выслушиваем вашу ситуацию, определяем нужную услугу, объясняем условия, документы и типичные риски, а затем сопровождаем вас до конца. Мы охватываем ВНЖ и официальные процедуры, банки и страхование, жильё и недвижимость, медицину и лечебные поездки, образование, перевод и нотариальное заверение, а также бытовые услуги."
      },
      {
        "heading": "Как выполняется работа: напрямую или через лицензированных партнёров",
        "body": "Часть услуг выполняет команда Рафик напрямую, часть — партнёр, лицензированный в своей области: юрист, агентство недвижимости, медицинский центр, присяжный переводчик. На каждой странице услуги указано, какой из двух вариантов применим, — до того, как вы с нами свяжетесь, а не после. Когда работу ведёт партнёр, Рафик остаётся вашим контактным лицом: мы объясняем, ведём дело и остаёмся тем, к кому вы возвращаетесь."
      },
      {
        "heading": "С кем мы работаем",
        "body": "Со студентами, приехавшими учиться; с теми, кто только прибыл в Стамбул; с давними резидентами, которым нужно продление или новая процедура; с гостями и туристами; с теми, кто ещё планирует переезд и хочет понять картину до того, как решится; и с теми, кто приезжает в Стамбул на лечение. Это по-настоящему разные ситуации, поэтому мы всегда начинаем с вопроса о вашей, прежде чем предлагать услугу."
      },
      {
        "heading": "На каких языках мы работаем",
        "body": "Арабский, английский, русский и персидский. Весь сайт доступен на всех четырёх, как и общение с нами. Мы ни на одном этапе не просим вас разбираться с турецким языком самостоятельно — именно это мы и берём на себя: в разговоре, при проверке документа или при личном сопровождении."
      },
      {
        "heading": "Где мы работаем",
        "body": "Мы работаем в Стамбуле. Работа по своей природе выездная — сопровождение в банк, в больницу, на просмотр недвижимости, на официальную запись, — и мы не принимаем посетителей в открытом офисе. Общение начинается дистанционно, через WhatsApp или электронную почту, а очную часть мы согласуем отдельно, если ваш случай этого требует."
      },
      {
        "heading": "Чего мы не обещаем",
        "body": "Мы не гарантируем результат по заявлению, решение по которому принимает официальный орган. Решение по ВНЖ принимает миграционная служба, по гражданству — компетентный орган, по счёту — банк, по лечению — врач. Наша роль в том, чтобы правильно подготовить дело, заранее и честно обозначить риски до оплаты или обязательств и довести дело до конца, а не обещать решение, которое принимаем не мы. Тот, кто заранее гарантирует вам государственное решение, тем самым показывает тревожный признак, на который стоит обратить внимание."
      },
      {
        "heading": "Стоимость",
        "body": "Стоимость процедуры зависит от её типа, ваших личных обстоятельств и официальных сборов, действующих на момент оформления, поэтому мы не публикуем на сайте фиксированные цифры — сумма, верная сегодня, завтра может ввести в заблуждение. После обращения, когда мы точно поймём вашу ситуацию, мы называем понятную стоимость до начала работы и поясняем, что в неё входит, а что нет."
      },
      {
        "heading": "Наш правовой статус",
        "body": "Компания Рафик в настоящее время находится в процессе официальной регистрации в Турции. Мы предпочитаем говорить об этом прямо, а не создавать иное впечатление, и опубликуем юридическое название и регистрационный номер на этой странице сразу после завершения регистрации. Услуги, требующие лицензии, — юридические, риелторские, медицинские и присяжный перевод — выполняются через партнёров, лицензированных в своих областях, и это указано на странице каждой услуги."
      }
    ],
    "ctaHeading": "Есть вопрос по вашей ситуации?",
    "ctaBody": "Коротко опишите, на каком вы этапе, и мы скажем, что к вам применимо и каким будет следующий шаг — до любых обязательств.",
    "ctaLabel": "Связаться с нами"
  },
  "fa": {
    "seoTitle": "درباره ما | رفیق استانبول — هماهنگی امور خارجی‌ها در استانبول",
    "metaDescription": "رفیق یک سرویس هماهنگی است که به خارجی‌های ساکن استانبول در امور اقامت، بانک، مسکن و سلامت به زبان خودشان کمک می‌کند — مستقیم یا از طریق شرکای دارای مجوز. روش کار ما و آنچه قول نمی‌دهیم.",
    "title": "درباره ما",
    "intro": "رفیق یک سرویس هماهنگی برای خارجی‌های ساکن استانبول است. ما نه نهاد دولتی هستیم، نه بانک، نه دفتر حقوقی و نه کلینیک. ما طرفی هستیم که وضعیت شما را می‌فهمد، به زبان خودتان توضیح می‌دهد چه چیزی شامل حال شما می‌شود، اجرای کار را با شما یا با یک شریک دارای مجوز هماهنگ می‌کند و آن را تا رسیدن به نتیجه پیگیری می‌کند.",
    "sections": [
      {
        "heading": "کاری که واقعاً انجام می‌دهیم",
        "body": "برای تازه‌واردها، دشواری زندگی در استانبول معمولاً خودِ اداری نیست، بلکه دانستن این است که کدام روند به وضعیت شما مربوط می‌شود، چه مدارکی لازم دارد، کجا انجام می‌شود و با چه ترتیبی — آن هم به زبانی که بلد نیستید. رفیق همین فاصله را پر می‌کند: به وضعیت شما گوش می‌دهیم، خدمت مناسب را تشخیص می‌دهیم، شرایط و مدارک و ریسک‌های رایج را توضیح می‌دهیم و تا پایان کار همراهتان می‌مانیم. پوشش ما شامل اقامت و امور رسمی، بانک و بیمه، مسکن و املاک، سلامت و سفر درمانی، آموزش، ترجمه و تأیید اسناد، و خدمات روزمره است."
      },
      {
        "heading": "روش اجرا: مستقیم یا از طریق شرکای دارای مجوز",
        "body": "بخشی از خدمات را تیم رفیق مستقیماً انجام می‌دهد و بخشی را شریکی دارای مجوز در حوزه خود — وکیل، دفتر املاک، مرکز درمانی یا مترجم رسمی. در صفحه هر خدمت روی این سایت نوشته شده که کدام‌یک از این دو حالت برقرار است؛ پیش از تماس شما، نه بعد از آن. وقتی کار را شریک انجام می‌دهد، رفیق همچنان نقطه تماس شماست: ما توضیح می‌دهیم، پرونده را پیگیری می‌کنیم و همان کسی می‌مانیم که به او مراجعه می‌کنید."
      },
      {
        "heading": "با چه کسانی کار می‌کنیم",
        "body": "با دانشجویانی که برای تحصیل می‌آیند، تازه‌واردانی که به استانبول رسیده‌اند، مقیمان قدیمی که به تمدید یا روند تازه‌ای نیاز دارند، بازدیدکنندگان و گردشگران، کسانی که هنوز در حال برنامه‌ریزی برای مهاجرت‌اند و می‌خواهند پیش از تصمیم تصویر روشنی داشته باشند، و کسانی که برای درمان به استانبول می‌آیند. این وضعیت‌ها واقعاً با هم فرق دارند؛ به همین دلیل همیشه پیش از پیشنهاد هر خدمتی، نخست درباره وضعیت شما می‌پرسیم."
      },
      {
        "heading": "زبان‌های کاری ما",
        "body": "عربی، انگلیسی، روسی و فارسی. کل سایت به هر چهار زبان در دسترس است و ارتباط با ما نیز همین‌طور. در هیچ مرحله‌ای از شما نمی‌خواهیم خودتان با زبان ترکی سر و کله بزنید — دقیقاً همین را برای شما پوشش می‌دهیم؛ چه در یک تماس، چه در بررسی یک سند، چه در همراهی حضوری."
      },
      {
        "heading": "محدوده کاری ما",
        "body": "ما در استانبول کار می‌کنیم. کار ما ذاتاً میدانی است — همراهی به بانک، به بیمارستان، به بازدید ملک، به یک وقت اداری — و پذیرای مراجعه حضوری در دفتری عمومی نیستیم. ارتباط از راه دور و از طریق واتساپ یا ایمیل آغاز می‌شود و اگر پرونده شما نیاز داشته باشد، بخش حضوری را از همان‌جا هماهنگ می‌کنیم."
      },
      {
        "heading": "آنچه قول نمی‌دهیم",
        "body": "نتیجه هیچ درخواستی را که یک نهاد رسمی درباره‌اش تصمیم می‌گیرد تضمین نمی‌کنیم. تصمیم اقامت با اداره مهاجرت است، تصمیم تابعیت با نهاد ذی‌صلاح، تأیید حساب با بانک و تصمیم درمانی با پزشک. نقش ما این است که پرونده را درست آماده کنیم، ریسک‌ها را پیش از پرداخت یا تعهد شما روشن بگوییم و کار را پیگیری کنیم — نه اینکه تصمیمی را قول بدهیم که در اختیار ما نیست. هر کسی که از پیش نتیجه‌ای دولتی را برای شما تضمین کند، خودِ همین یک نشانه هشدار است که باید جدی بگیرید."
      },
      {
        "heading": "هزینه",
        "body": "هزینه هر روند به نوع آن، شرایط شخصی شما و عوارض رسمی جاری در زمان انجام بستگی دارد؛ به همین دلیل رقم ثابتی روی سایت منتشر نمی‌کنیم — عددی که امروز درست است، فردا می‌تواند گمراه‌کننده باشد. پس از تماس شما و وقتی وضعیتتان را دقیق فهمیدیم، هزینه روشن را پیش از شروع کار به شما می‌گوییم و توضیح می‌دهیم چه چیزی شامل آن هست و چه چیزی نیست."
      },
      {
        "heading": "وضعیت حقوقی ما",
        "body": "شرکت رفیق هم‌اکنون در حال تأسیس رسمی در ترکیه است. ترجیح می‌دهیم این را صریح بگوییم تا اینکه تصور دیگری ایجاد کنیم، و نام حقوقی و شماره ثبت را به‌محض تکمیل ثبت روی همین صفحه منتشر خواهیم کرد. خدماتی که نیازمند مجوزند — حقوقی، املاک، درمانی و ترجمه رسمی — از طریق شرکای دارای مجوز در حوزه خودشان انجام می‌شود و این موضوع در صفحه هر خدمت ذکر شده است."
      }
    ],
    "ctaHeading": "پرونده‌ای دارید که می‌خواهید درباره‌اش بپرسید؟",
    "ctaBody": "کوتاه بگویید در چه وضعیتی هستید تا بگوییم چه چیزی شامل حال شماست و گام بعدی چیست — پیش از هر تعهدی.",
    "ctaLabel": "تماس با ما"
  }
};
