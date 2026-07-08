/**
 * Booking-escalation policy + deterministic fallback engine.
 *
 * The SYSTEM_PROMPT is the single source of truth for the escalation policy.
 * When ANTHROPIC_API_KEY is configured the LLM decides per this prompt; the
 * regex triggers below are kept as a server-side safety net (explicit human
 * request / user circling the same topic) and as the offline dev fallback.
 */

export const SYSTEM_PROMPT = `You are Rafiq, the multilingual assistant of Rafiq Istanbul, helping foreigners with residency (İkamet), tax numbers (Vergi No), banking, housing, health insurance (SGK/private), education (denklik), real estate and daily life in Istanbul. Always answer in the user's language (Arabic, English, Russian or Farsi).

BOOKING POLICY — decide on your own when a human expert is needed:
1. NEVER offer a human appointment for simple questions you can answer yourself (e.g. "how do I get an Istanbulkart", "what is a Vergi No").
2. DO offer a free online appointment (call or video) when ANY of these hold:
   - The case is complex or case-specific: rejections, appeals, deadlines already missed, closed districts, citizenship files, court/penalty issues, large transactions (property purchase, company formation).
   - The user appears stuck: they have asked repeatedly about the same problem without resolution.
   - The user explicitly asks to talk to a person / expert / lawyer / consultant.
3. When you decide to offer: first summarize the user's problem in their own language in 1-2 sentences, then offer the FREE online appointment. Never force it — it is an offer, the user can keep chatting.
4. The booking form stays minimal: preferred date & time and preferred language only. Your problem summary and the full chat transcript are attached automatically.

OUTPUT FORMAT: respond ONLY with a JSON object, no markdown fences:
{"reply": "<your answer in the user's language>", "offerBooking": <true|false>, "problemSummary": "<1-2 sentence summary of the user's problem in their language>"}`;

const TOPIC_PATTERNS = {
  residency: /ikamet|İkamet|residen|permit|visa|اقامة|إقامة|الاقامة|تصريح|внж|икамет|вид на жительство|اقامت|ویزا/i,
  tax: /vergi|tax number|الرقم الضريبي|ضريب|налог|инн|مالیات|شماره مالیاتی/i,
  bank: /bank|account|iban|بنك|حساب بنكي|مصرف|банк|счет|счёт|بانک|حساب بانکی/i,
  housing: /rent|apartment|flat|housing|kira|إيجار|سكن|شقة|аренда|квартир|жиль|اجاره|آپارتمان|مسکن/i,
  health: /insurance|sgk|hospital|doctor|تأمين|مستشفى|страхов|больниц|врач|بیمه|بیمارستان|پزشک/i,
  sim: /sim|esim|phone|number|شريحة|هاتف|сим|телефон|سیم‌?کارت|تلفن/i,
  study: /universit|student|denklik|study|جامعة|دراسة|معادلة|университет|учеб|студен|دانشگاه|تحصیل/i,
  realestate: /buy|property|tapu|citizenship|عقار|شراء|جنسية|недвижимост|купить|гражданств|ملک|خرید|شهروندی/i,
};

const COMPLEX_PATTERNS =
  /reject|refus|denied|appeal|deport|fine|penalty|court|lawyer|expired|miss(ed)? (the )?deadline|closed district|stuck|complicated|urgent|رفض|مرفوض|استئناف|ترحيل|غرامة|محكمة|محام|منتهي|عالق|معقد|عاجل|отказ|отклон|апелляц|депорт|штраф|суд|адвокат|просрочен|застрял|сложн|срочн|رد شد|ریجکت|اخراج|جریمه|دادگاه|وکیل|منقضی|گیر کرد|پیچیده|فوری/i;

const HUMAN_PATTERNS =
  /talk to (a )?(human|person|expert|someone)|real person|consultant|advisor|appointment|meeting|تحدث (مع|إلى)|إنسان|خبير|مستشار|موعد|شخص حقيقي|человек|эксперт|консультант|специалист|встреч|запис|انسان|کارشناس|مشاور|وقت مشاوره|آدم واقعی/i;

const REPLIES = {
  en: {
    residency: 'For the residence permit (İkamet): 1) get your tax number, 2) buy mandatory health insurance, 3) register your address with a notarized rental contract, 4) apply on e-İkamet and attend the appointment. Important: ~25% of Istanbul districts are closed to new registrations — check your district before renting. What stage are you at?',
    tax: 'The tax number (Vergi No) is free and quick: apply online via the İnteraktif Vergi Dairesi portal with your passport details, or visit any tax office in person (~1 hour). You will need it for the bank and your rental contract.',
    bank: 'To open a Turkish bank account you typically need: passport, tax number (Vergi No), and proof of address. Requirements vary by branch — if one refuses, try another. Do you already have your tax number?',
    housing: 'For renting: budget 1–2 months deposit + agency fee, insist on a notarized contract (you need it for ikamet address registration), and check the district is open for residence registrations before signing. Which district are you considering?',
    health: 'Health insurance: SGK (public) gives broad hospital coverage and covers the family; private insurance is cheaper for younger people and is accepted for the ikamet application. Which do you want to compare?',
    sim: 'Get a Turkish SIM at any Turkcell / Vodafone / Türk Telekom shop with your passport (~30 min). An eSIM bought online is cheaper than airport SIMs. Note: foreign phones must be IMEI-registered if you stay over 90 days.',
    study: 'For studying: 1) university acceptance, 2) diploma equivalency (denklik) if needed, 3) student residence permit using your enrollment letter. The student ikamet replaces most other justifications. Are you enrolled already?',
    realestate: 'Buying property: verify the title deed (tapu), check for debts and zoning, and use a sworn translator at the notary. For citizenship-by-investment the threshold applies and the property must be held for 3 years. Do you have a specific property in mind?',
    generic: 'I can help with residency (İkamet), tax number (Vergi No), banking, housing, health insurance, SIM cards, studying, and real estate. Tell me a bit more about your situation.',
  },
  ar: {
    residency: 'لتصريح الإقامة (İkamet): 1) احصل على الرقم الضريبي، 2) اشترِ التأمين الصحي الإلزامي، 3) سجّل عنوانك بعقد إيجار موثق، 4) قدّم عبر e-İkamet واحضر الموعد. مهم: نحو 25% من أحياء إسطنبول مغلقة أمام التسجيلات الجديدة — تحقق من الحي قبل الاستئجار. في أي مرحلة أنت الآن؟',
    tax: 'الرقم الضريبي (Vergi No) مجاني وسريع: قدّم عبر بوابة İnteraktif Vergi Dairesi ببيانات جوازك، أو زر أي دائرة ضرائب (نحو ساعة). ستحتاجه للبنك وعقد الإيجار.',
    bank: 'لفتح حساب بنكي تركي تحتاج عادة: جواز السفر، الرقم الضريبي (Vergi No)، وإثبات عنوان. المتطلبات تختلف بين الفروع — إذا رفضك فرع جرّب آخر. هل لديك الرقم الضريبي بالفعل؟',
    housing: 'للاستئجار: جهّز تأمين شهر إلى شهرين + عمولة المكتب، وأصرّ على عقد موثق (تحتاجه لتسجيل عنوان الإقامة)، وتأكد أن الحي مفتوح لتسجيلات الإقامة قبل التوقيع. أي حي تفكر فيه؟',
    health: 'التأمين الصحي: SGK الحكومي يمنح تغطية واسعة ويشمل العائلة؛ التأمين الخاص أرخص للشباب ومقبول لمعاملة الإقامة. أيهما تريد أن نقارن؟',
    sim: 'احصل على شريحة تركية من أي فرع Turkcell / Vodafone / Türk Telekom بجواز سفرك (نحو 30 دقيقة). شريحة eSIM عبر الإنترنت أرخص من شرائح المطار. ملاحظة: يجب تسجيل IMEI للهواتف الأجنبية إذا بقيت أكثر من 90 يومًا.',
    study: 'للدراسة: 1) قبول جامعي، 2) معادلة الشهادة (denklik) إذا لزمت، 3) إقامة الطالب بخطاب التسجيل. إقامة الطالب تغني عن معظم المبررات الأخرى. هل أنت مسجل بالفعل؟',
    realestate: 'لشراء عقار: تحقق من سند الملكية (tapu) ومن الديون وحالة التخطيط، واستخدم مترجمًا محلفًا عند كاتب العدل. للجنسية عبر الاستثمار يُطبق الحد الأدنى ويجب الاحتفاظ بالعقار 3 سنوات. هل لديك عقار محدد؟',
    generic: 'أستطيع مساعدتك في الإقامة (İkamet)، الرقم الضريبي (Vergi No)، البنوك، السكن، التأمين الصحي، الشرائح، الدراسة، والعقارات. أخبرني المزيد عن وضعك.',
  },
  ru: {
    residency: 'Для ВНЖ (İkamet): 1) получите налоговый номер, 2) купите обязательную медстраховку, 3) зарегистрируйте адрес по нотариальному договору аренды, 4) подайте на e-İkamet и придите на приём. Важно: ~25% районов Стамбула закрыты для новых регистраций — проверьте район до аренды. На каком вы этапе?',
    tax: 'Налоговый номер (Vergi No) — бесплатно и быстро: онлайн через портал İnteraktif Vergi Dairesi по паспорту или лично в любой налоговой (~1 час). Он нужен для банка и договора аренды.',
    bank: 'Для счёта в турецком банке обычно нужны: паспорт, налоговый номер (Vergi No) и подтверждение адреса. Требования различаются по отделениям — если одно отказало, идите в другое. Налоговый номер уже есть?',
    housing: 'Аренда: закладывайте депозит за 1–2 месяца + комиссию агента, настаивайте на нотариальном договоре (нужен для регистрации адреса под икамет) и проверьте, открыт ли район для регистраций ВНЖ. Какой район рассматриваете?',
    health: 'Страховка: SGK (государственная) даёт широкое покрытие и распространяется на семью; частная — дешевле для молодых и принимается для подачи на икамет. Что сравним?',
    sim: 'Турецкую SIM оформляют в любом салоне Turkcell / Vodafone / Türk Telekom по паспорту (~30 минут). eSIM онлайн дешевле SIM из аэропорта. Важно: иностранный телефон нужно регистрировать (IMEI), если остаётесь дольше 90 дней.',
    study: 'Учёба: 1) зачисление в университет, 2) признание диплома (denklik) при необходимости, 3) студенческий ВНЖ по справке о зачислении. Студенческий икамет заменяет большинство оснований. Вы уже зачислены?',
    realestate: 'Покупка недвижимости: проверьте ТАПУ, долги и зонирование, у нотариуса нужен присяжный переводчик. Для гражданства за инвестиции действует порог, и объект нужно держать 3 года. Есть конкретный объект?',
    generic: 'Я помогу с ВНЖ (İkamet), налоговым номером (Vergi No), банками, жильём, страховкой, SIM-картами, учёбой и недвижимостью. Расскажите чуть подробнее о вашей ситуации.',
  },
  fa: {
    residency: 'برای اجازه اقامت (İkamet): ۱) شماره مالیاتی بگیرید، ۲) بیمه درمانی اجباری بخرید، ۳) آدرس را با قرارداد اجاره محضری ثبت کنید، ۴) در e-İkamet درخواست دهید و در وقت ملاقات حاضر شوید. مهم: حدود ۲۵٪ مناطق استانبول برای ثبت جدید بسته‌اند — قبل از اجاره منطقه را بررسی کنید. الان در چه مرحله‌ای هستید؟',
    tax: 'شماره مالیاتی (Vergi No) رایگان و سریع است: آنلاین از پورتال İnteraktif Vergi Dairesi با اطلاعات گذرنامه، یا حضوری در هر اداره مالیات (حدود ۱ ساعت). برای بانک و قرارداد اجاره لازمش دارید.',
    bank: 'برای حساب بانکی ترکیه معمولاً لازم است: گذرنامه، شماره مالیاتی (Vergi No) و مدرک آدرس. شرایط شعبه‌ها فرق دارد — اگر یکی رد کرد، شعبه دیگر را امتحان کنید. شماره مالیاتی دارید؟',
    housing: 'برای اجاره: ۱ تا ۲ ماه ودیعه + کمیسیون بنگاه در نظر بگیرید، حتماً قرارداد محضری بگیرید (برای ثبت آدرس اقامت لازم است) و قبل از امضا مطمئن شوید منطقه برای ثبت اقامت باز است. کدام منطقه مدنظرتان است؟',
    health: 'بیمه درمانی: SGK دولتی پوشش گسترده دارد و خانواده را هم شامل می‌شود؛ بیمه خصوصی برای جوان‌ترها ارزان‌تر و برای درخواست اقامت قابل قبول است. کدام را مقایسه کنیم؟',
    sim: 'سیم‌کارت ترکیه را با گذرنامه از هر شعبه Turkcell / Vodafone / Türk Telekom بگیرید (حدود ۳۰ دقیقه). eSIM آنلاین ارزان‌تر از سیم‌کارت فرودگاه است. توجه: اگر بیش از ۹۰ روز بمانید، گوشی خارجی باید ثبت IMEI شود.',
    study: 'برای تحصیل: ۱) پذیرش دانشگاه، ۲) تأیید مدرک (denklik) در صورت نیاز، ۳) اقامت دانشجویی با نامه ثبت‌نام. اقامت دانشجویی جای بیشتر مدارک دیگر را می‌گیرد. ثبت‌نام کرده‌اید؟',
    realestate: 'خرید ملک: سند (tapu)، بدهی‌ها و وضعیت کاربری را بررسی کنید و در دفتر اسناد رسمی مترجم رسمی همراه داشته باشید. برای شهروندی از طریق سرمایه‌گذاری حد نصاب اعمال می‌شود و ملک باید ۳ سال نگه داشته شود. ملک مشخصی مدنظر دارید؟',
    generic: 'می‌توانم در اقامت (İkamet)، شماره مالیاتی (Vergi No)، بانک، مسکن، بیمه درمانی، سیم‌کارت، تحصیل و املاک کمکتان کنم. کمی بیشتر از شرایط خود بگویید.',
  },
};

const SUMMARY_LABEL = {
  en: { residency: 'Residence permit (İkamet) issue', tax: 'Tax number (Vergi No) issue', bank: 'Bank account issue', housing: 'Housing / rental issue', health: 'Health insurance issue', sim: 'Phone / SIM issue', study: 'Education / denklik issue', realestate: 'Real estate / citizenship issue', generic: 'General settlement question' },
  ar: { residency: 'مشكلة تصريح إقامة (İkamet)', tax: 'مشكلة رقم ضريبي (Vergi No)', bank: 'مشكلة حساب بنكي', housing: 'مشكلة سكن / إيجار', health: 'مشكلة تأمين صحي', sim: 'مشكلة هاتف / شريحة', study: 'مشكلة دراسة / معادلة (denklik)', realestate: 'مشكلة عقارات / جنسية', generic: 'سؤال عام عن الاستقرار' },
  ru: { residency: 'Вопрос по ВНЖ (İkamet)', tax: 'Вопрос по налоговому номеру (Vergi No)', bank: 'Вопрос по банковскому счёту', housing: 'Вопрос по жилью / аренде', health: 'Вопрос по медстраховке', sim: 'Вопрос по телефону / SIM', study: 'Вопрос по учёбе / denklik', realestate: 'Вопрос по недвижимости / гражданству', generic: 'Общий вопрос по обустройству' },
  fa: { residency: 'مشکل اجازه اقامت (İkamet)', tax: 'مشکل شماره مالیاتی (Vergi No)', bank: 'مشکل حساب بانکی', housing: 'مشکل مسکن / اجاره', health: 'مشکل بیمه درمانی', sim: 'مشکل تلفن / سیم‌کارت', study: 'مشکل تحصیل / denklik', realestate: 'مشکل املاک / شهروندی', generic: 'پرسش عمومی استقرار' },
};

export function detectTopic(text) {
  for (const [topic, re] of Object.entries(TOPIC_PATTERNS)) {
    if (re.test(text)) return topic;
  }
  return 'generic';
}

/** Server-side safety-net triggers, applied even when the LLM answers. */
export function policyTriggers(history, userText) {
  const topic = detectTopic(userText);
  const sameTopicCount = history.filter((m) => m.role === 'user' && detectTopic(m.text) === topic).length;
  return {
    topic,
    asksHuman: HUMAN_PATTERNS.test(userText),
    isComplex: COMPLEX_PATTERNS.test(userText),
    isStuck: topic !== 'generic' && sameTopicCount >= 3,
  };
}

export function fallbackSummary(lang, topic, userText) {
  const labels = SUMMARY_LABEL[lang] ?? SUMMARY_LABEL.en;
  return `${labels[topic] ?? labels.generic}: "${userText.trim().slice(0, 160)}"`;
}

/** Deterministic dev fallback when no LLM key is configured. */
export function fallbackRespond(history, userText, lang) {
  const { topic, asksHuman, isComplex, isStuck } = policyTriggers(history, userText);
  const replies = REPLIES[lang] ?? REPLIES.en;
  return {
    reply: replies[topic] ?? replies.generic,
    offerBooking: asksHuman || isComplex || isStuck,
    problemSummary: fallbackSummary(lang, topic, userText),
  };
}
