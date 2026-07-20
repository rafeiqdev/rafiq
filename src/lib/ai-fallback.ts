/**
 * Client-side AI policy + deterministic responder.
 *
 * Ported from the old Express `server/ai-policy.mjs` so the assistant keeps
 * working without a backend (the app now runs fully on Supabase). When you wire
 * a real LLM (e.g. a Supabase Edge Function) this same policy can gate the
 * booking-escalation decision.
 */

export interface PolicyMessage {
  role: 'user' | 'assistant';
  text: string;
}

const TOPIC_PATTERNS: Record<string, RegExp> = {
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

type Lang = 'en' | 'ar' | 'ru' | 'fa';
type Topic = keyof typeof TOPIC_PATTERNS | 'generic';

/**
 * Fallback replies, shown ONLY when the AI service is unreachable.
 *
 * Deliberately contain NO procedures, prices, laws, or numbered steps: the
 * assistant's persona (api/ai-chat.ts) is an intake agent, not an information
 * desk, and the previous how-to texts contradicted it the moment the Gemini
 * quota ran out. Each reply just acknowledges the person's topic warmly and
 * offers the two honest options — try again shortly, or book the specialist
 * who will explain everything. Built from one template per language so a
 * future topic can't accidentally reintroduce advice.
 */
const TOPIC_NAME: Record<Lang, Record<string, string>> = {
  en: { residency: 'the residence permit (İkamet)', tax: 'the tax number', bank: 'opening a bank account', housing: 'housing and rentals', health: 'health insurance', sim: 'phones and SIM cards', study: 'studying and diploma equivalency', realestate: 'real estate' },
  ar: { residency: 'تصريح الإقامة (İkamet)', tax: 'الرقم الضريبي', bank: 'فتح حساب بنكي', housing: 'السكن والإيجار', health: 'التأمين الصحي', sim: 'الهاتف والشرائح', study: 'الدراسة ومعادلة الشهادة', realestate: 'العقارات' },
  ru: { residency: 'ВНЖ (İkamet)', tax: 'налоговому номеру', bank: 'открытию банковского счёта', housing: 'жилью и аренде', health: 'медицинской страховке', sim: 'телефонам и SIM-картам', study: 'учёбе и признанию диплома', realestate: 'недвижимости' },
  fa: { residency: 'اجازه اقامت (İkamet)', tax: 'شماره مالیاتی', bank: 'افتتاح حساب بانکی', housing: 'مسکن و اجاره', health: 'بیمه درمانی', sim: 'تلفن و سیم‌کارت', study: 'تحصیل و تأیید مدرک', realestate: 'املاک' },
};

const FALLBACK_TEXT: Record<Lang, { topic: (name: string) => string; generic: string }> = {
  en: {
    topic: (n) => `Thanks — I noted that your question is about ${n}. Our smart assistant is briefly unavailable, so please try again in a little while, or book an appointment now and our specialist will walk you through everything in detail.`,
    generic: 'Welcome! Our smart assistant is briefly unavailable. Please try again in a little while, or book an appointment now and our specialist will take care of your case in detail.',
  },
  ar: {
    topic: (n) => `أهلًا بك — سجّلت أن سؤالك يخص ${n}. مساعدنا الذكي غير متاح لحظيًا، فجرّب مرة أخرى بعد قليل، أو احجز موعدًا الآن وسيشرح لك مختصنا كل التفاصيل بنفسه.`,
    generic: 'أهلًا بك! مساعدنا الذكي غير متاح لحظيًا. جرّب مرة أخرى بعد قليل، أو احجز موعدًا الآن وسيهتم مختصنا بحالتك بالتفصيل.',
  },
  ru: {
    topic: (n) => `Спасибо — я записал, что ваш вопрос касается ${n}. Наш умный помощник временно недоступен: попробуйте ещё раз чуть позже или запишитесь на приём — специалист подробно всё объяснит.`,
    generic: 'Добро пожаловать! Наш умный помощник временно недоступен. Попробуйте ещё раз чуть позже или запишитесь на приём — специалист подробно займётся вашим вопросом.',
  },
  fa: {
    topic: (n) => `خوش آمدید — ثبت کردم که پرسش شما درباره ${n} است. دستیار هوشمند ما موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید یا همین حالا وقت ملاقات بگیرید تا کارشناس ما همه جزئیات را برایتان توضیح دهد.`,
    generic: 'خوش آمدید! دستیار هوشمند ما موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید یا همین حالا وقت ملاقات بگیرید تا کارشناس ما به‌طور کامل به موضوع شما رسیدگی کند.',
  },
};

function buildReplies(L: Lang): Record<string, string> {
  const out: Record<string, string> = { generic: FALLBACK_TEXT[L].generic };
  for (const [topic, name] of Object.entries(TOPIC_NAME[L])) {
    out[topic] = FALLBACK_TEXT[L].topic(name);
  }
  return out;
}

const REPLIES: Record<Lang, Record<string, string>> = {
  en: buildReplies('en'),
  ar: buildReplies('ar'),
  ru: buildReplies('ru'),
  fa: buildReplies('fa'),
};

const SUMMARY_LABEL: Record<Lang, Record<string, string>> = {
  en: { residency: 'Residence permit (İkamet) issue', tax: 'Tax number (Vergi No) issue', bank: 'Bank account issue', housing: 'Housing / rental issue', health: 'Health insurance issue', sim: 'Phone / SIM issue', study: 'Education / denklik issue', realestate: 'Real estate / citizenship issue', generic: 'General settlement question' },
  ar: { residency: 'مشكلة تصريح إقامة (İkamet)', tax: 'مشكلة رقم ضريبي (Vergi No)', bank: 'مشكلة حساب بنكي', housing: 'مشكلة سكن / إيجار', health: 'مشكلة تأمين صحي', sim: 'مشكلة هاتف / شريحة', study: 'مشكلة دراسة / معادلة (denklik)', realestate: 'مشكلة عقارات / جنسية', generic: 'سؤال عام عن الاستقرار' },
  ru: { residency: 'Вопрос по ВНЖ (İkamet)', tax: 'Вопрос по налоговому номеру (Vergi No)', bank: 'Вопрос по банковскому счёту', housing: 'Вопрос по жилью / аренде', health: 'Вопрос по медстраховке', sim: 'Вопрос по телефону / SIM', study: 'Вопрос по учёбе / denklik', realestate: 'Вопрос по недвижимости / гражданству', generic: 'Общий вопрос по обустройству' },
  fa: { residency: 'مشکل اجازه اقامت (İkamet)', tax: 'مشکل شماره مالیاتی (Vergi No)', bank: 'مشکل حساب بانکی', housing: 'مشکل مسکن / اجاره', health: 'مشکل بیمه درمانی', sim: 'مشکل تلفن / سیم‌کارت', study: 'مشکل تحصیل / denklik', realestate: 'مشکل املاک / شهروندی', generic: 'پرسش عمومی استقرار' },
};

function detectTopic(text: string): Topic {
  for (const topic of Object.keys(TOPIC_PATTERNS) as (keyof typeof TOPIC_PATTERNS)[]) {
    if (TOPIC_PATTERNS[topic].test(text)) return topic;
  }
  return 'generic';
}

function langOf(lang: string): Lang {
  return (['en', 'ar', 'ru', 'fa'].includes(lang) ? lang : 'en') as Lang;
}

export interface PolicyResult {
  reply: string;
  offerBooking: boolean;
  problemSummary: string;
}

/** Deterministic responder + booking-escalation decision (no network). */
export function fallbackRespond(history: PolicyMessage[], userText: string, lang: string): PolicyResult {
  const L = langOf(lang);
  const topic = detectTopic(userText);
  const sameTopicCount = history.filter((m) => m.role === 'user' && detectTopic(m.text) === topic).length;
  const asksHuman = HUMAN_PATTERNS.test(userText);
  const isComplex = COMPLEX_PATTERNS.test(userText);
  const isStuck = topic !== 'generic' && sameTopicCount >= 3;

  const replies = REPLIES[L];
  const labels = SUMMARY_LABEL[L];
  return {
    reply: replies[topic] ?? replies.generic,
    offerBooking: asksHuman || isComplex || isStuck,
    problemSummary: `${labels[topic] ?? labels.generic}: "${userText.trim().slice(0, 160)}"`,
  };
}
