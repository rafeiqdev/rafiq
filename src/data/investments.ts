/**
 * Investment opportunities shown on /real-estate/investments and injected into
 * the listings feed.
 *
 * These live in code, not the database, on purpose: there is a handful of them, they
 * change a few times a year, and each one is an editorial file (pros, risks,
 * sources) rather than a row a scraper produces. Moving them to Supabase buys
 * nothing until an admin needs to edit them without a deploy.
 *
 * IMAGES: every `images` path points at /public/img/investments/<slug>/. Until
 * the official photo packs arrive from each developer's sales office, the files
 * are absent and <InvestmentPhoto> falls back to a neutral Istanbul photo with
 * an "illustrative image" label. Do NOT drop scraped developer marketing photos
 * or logos in there — that is a copyright and trademark exposure on a
 * commercial site, and these developers do enforce it.
 */

/** Statutory thresholds, in USD. Verified against 2026 sources — see README. */
export const CITIZENSHIP_THRESHOLD_USD = 400_000;
export const RESIDENCY_THRESHOLD_USD = 200_000;

export type Eligibility = 'yes' | 'partial' | 'no';

/** Keys for the optional per-project fact rows. Each has an i18n label. */
export type FactKey =
  | 'delivery'
  | 'buildYear'
  | 'units'
  | 'unitTypes'
  | 'mix'
  | 'aidat'
  | 'yield'
  | 'occupancy'
  | 'mgmtCut'
  | 'payment'
  | 'shortLet'
  | 'residencyUnit';

export interface InvestmentOpportunity {
  slug: string;
  /** drives every accent on the card and the page — one value per project */
  brand: string;
  name: { ar: string; en: string; fa: string; ru: string };
  developer: string;
  district: { ar: string; en: string; fa: string; ru: string };
  /** 'european' | 'asian' — shown next to the district */
  side: 'european' | 'asian';
  type: { ar: string; en: string; fa: string; ru: string };
  minUsd: number;
  /** null = the listing is quoted as "starting from", with no published ceiling */
  maxUsd: number | null;
  pros: { ar: string; en: string; fa: string; ru: string }[];
  cons: { ar: string; en: string; fa: string; ru: string }[];
  summary: { ar: string; en: string; fa: string; ru: string };
  /**
   * Extra, project-specific facts rendered as rows in the facts table.
   *
   * Kept as a keyed list rather than a dozen optional interface fields: every
   * project publishes a different subset (an off-plan tower has a payment plan
   * and no yield; a managed residence has an occupancy rate and a management
   * cut), and a fixed schema would be mostly nulls. The key maps to an i18n
   * label; a plain-string value is rendered LTR for figures, a localised
   * object for prose.
   */
  extraFacts?: { key: FactKey; value: string | { ar: string; en: string; fa: string; ru: string } }[];

  /** relative to /img/investments/<slug>/ */
  images: string[];
  /** where the price range and description came from, shown on the page */
  source: { label: string; url: string };
}

/**
 * Eligibility is DERIVED from the price range, never hand-typed.
 *
 * - `yes`     — even the cheapest unit clears the threshold
 * - `partial` — some units may clear it, or the ceiling is unpublished
 * - `no`      — the whole range sits below the threshold
 *
 * `partial` is deliberately not rounded up to `yes`. A buyer who reads "eligible"
 * on a project whose entry unit is $266k, buys that unit, and then learns it
 * never qualified for citizenship is the single worst outcome this page can
 * produce — so an unpublished ceiling reads as "depends on the unit", not "yes".
 */
export function eligibilityFor(minUsd: number, maxUsd: number | null, threshold: number): Eligibility {
  if (minUsd >= threshold) return 'yes';
  if (maxUsd === null || maxUsd >= threshold) return 'partial';
  return 'no';
}

export const citizenshipEligibility = (o: InvestmentOpportunity): Eligibility =>
  eligibilityFor(o.minUsd, o.maxUsd, CITIZENSHIP_THRESHOLD_USD);

export const residencyEligibility = (o: InvestmentOpportunity): Eligibility =>
  eligibilityFor(o.minUsd, o.maxUsd, RESIDENCY_THRESHOLD_USD);

export const INVESTMENTS: InvestmentOpportunity[] = [
  {
    slug: 'emaar-square-residences',
    brand: '#0b6b4f',
    name: {
      ar: 'إعمار سكوير ريزيدنس',
      en: 'Emaar Square Residences',
      fa: 'امارت اسکوئر رزیدنس',
      ru: 'Emaar Square Residences',
    },
    developer: 'Emaar Properties PJSC',
    district: { ar: 'أوسكودار / ليباديه', en: 'Üsküdar / Libadiye', fa: 'اسکودار / لیبادیه', ru: 'Ускюдар / Либадие' },
    side: 'asian',
    type: {
      ar: 'شقق وأبراج سكنية فاخرة (1+1 إلى 4+1 وبنتهاوس) متصلة بمركز تسوق إعمار سكوير مول',
      en: 'Luxury residential towers (1+1 to 4+1 and penthouses) connected to Emaar Square Mall',
      fa: 'برج‌های مسکونی لوکس (۱+۱ تا ۴+۱ و پنت‌هاوس) متصل به مرکز خرید امارت اسکوئر',
      ru: 'Люксовые жилые башни (1+1 до 4+1 и пентхаусы), соединённые с ТЦ Emaar Square',
    },
    minUsd: 320_000,
    maxUsd: 1_100_000,
    summary: {
      ar: 'أبراج سكنية فاخرة متصلة مباشرة بمركز تسوق إعمار سكوير مول. الموقع بيجمع بين هدوء الجانب الآسيوي والقرب من جسور البوسفور والمركز المالي لشرق إسطنبول.',
      en: 'Luxury residential towers connected directly to Emaar Square Mall, combining the calm of the Asian side with proximity to the Bosphorus bridges and the eastern financial district.',
      fa: 'برج‌های مسکونی لوکس متصل به مرکز خرید امارت اسکوئر، ترکیبی از آرامش سمت آسیایی و نزدیکی به پل‌های بسفر و مرکز مالی شرق استانبول.',
      ru: 'Люксовые башни, соединённые с ТЦ Emaar Square: спокойствие азиатской стороны рядом с мостами Босфора и восточным деловым центром.',
    },
    pros: [
      { ar: 'علامة تجارية عالمية وموثوقية عالية — مطور إماراتي معروف، جودة بناء وسهولة إعادة بيع للمستثمرين الدوليين.', en: 'A global brand with high credibility — a well-known UAE developer, build quality and easy resale to international buyers.', fa: 'برند جهانی و اعتبار بالا — سازنده شناخته‌شده اماراتی، کیفیت ساخت و فروش مجدد آسان.', ru: 'Глобальный бренд и высокое доверие — известный застройщик из ОАЭ, качество и лёгкая перепродажа.' },
      { ar: 'سيولة عقارية مرتفعة — طلب مستمر على الشراء والاستئجار، محمي بقيمة الماركة الفاخرة.', en: 'High liquidity — steady buying and rental demand, protected by the premium brand.', fa: 'نقدشوندگی بالا — تقاضای پیوسته خرید و اجاره.', ru: 'Высокая ликвидность — устойчивый спрос на покупку и аренду.' },
      { ar: 'موقع استراتيجي — هدوء الجانب الآسيوي مع القرب من جسور البوسفور والمركز المالي.', en: 'Strategic location — the calm of the Asian side with access to the Bosphorus bridges and the financial centre.', fa: 'موقعیت استراتژیک — آرامش سمت آسیایی و دسترسی به پل‌ها و مرکز مالی.', ru: 'Стратегическое расположение — тишина азиатской стороны и доступ к мостам и деловому центру.' },
    ],
    cons: [
      { ar: 'ارتفاع عتبة الدخول — سعر المتر المربع أعلى من متوسط المنطقة.', en: 'High entry price — the price per m² is above the district average.', fa: 'قیمت ورود بالا — قیمت هر متر مربع بالاتر از میانگین منطقه.', ru: 'Высокий порог входа — цена за м² выше средней по району.' },
      { ar: 'رسوم خدمات عالية (Aidat) — الصيانة والمرافق الفاخرة مرتفعة شهرياً وبتاكل من العائد الصافي.', en: 'High service charges (aidat) — premium maintenance eats into the net yield every month.', fa: 'شارژ ماهانه بالا — هزینه نگهداری لوکس بازده خالص را کاهش می‌دهد.', ru: 'Высокие сервисные сборы (aidat) — премиальное обслуживание съедает чистую доходность.' },
      { ar: 'عائد إيجاري متوسط النسبة — نسبة العائد للسعر أقل من المناطق النامية لأن سعر الشراء فاخر.', en: 'Mid-range rental yield — the yield-to-price ratio trails developing districts because the purchase price is premium.', fa: 'بازده اجاره متوسط — نسبت بازده به قیمت پایین‌تر از مناطق در حال توسعه.', ru: 'Средняя арендная доходность — соотношение доходности к цене ниже, чем в развивающихся районах.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: '٢٠١٧ — جاهز ومسلّم بالكامل', en: '2017 — delivered and complete', fa: '۲۰۱۷ — تحویل‌شده', ru: '2017 — сдан полностью' } },
      { key: 'units', value: '420' },
      { key: 'aidat', value: '$1.5 – $2.5 / m² / month' },
      { key: 'yield', value: '4.5% – 6%' },
      { key: 'payment', value: { ar: 'كاش بالكامل للشقق الجاهزة', en: 'Cash in full for ready units', fa: 'نقدی کامل برای واحدهای آماده', ru: 'Полная оплата за готовые юниты' } },
    ],
    images: ['1.webp', '2.webp', '3.webp'],
    source: { label: 'Emaar Square Residences', url: 'https://properties.emaar.com/' },
  },
  {
    slug: 'address-residence-istanbul',
    brand: '#0e4f6b',
    name: {
      ar: 'أدرس ريزيدنس إسطنبول',
      en: 'Address Residence Istanbul',
      fa: 'ادرس رزیدنس استانبول',
      ru: 'Address Residence Istanbul',
    },
    developer: 'Address Hotels & Resorts (Emaar)',
    district: { ar: 'أوسكودار / ليباديه', en: 'Üsküdar / Libadiye', fa: 'اسکودار / لیبادیه', ru: 'Ускюдар / Либадие' },
    side: 'asian',
    type: {
      ar: 'شقق فندقية براندد بنظام ٥ نجوم',
      en: 'Five-star branded hotel residences',
      fa: 'آپارتمان‌های هتلی برند پنج‌ستاره',
      ru: 'Пятизвёздочные брендированные апарт-отели',
    },
    minUsd: 550_000,
    maxUsd: 1_850_000,
    summary: {
      ar: 'شقق فندقية براندد بإدارة فندقية كاملة — سبا، مسابح، مطاعم عالمية، وخدمة غرف. مناسبة للمستثمر اللي بده عائد بالعملة الصعبة بدون إدارة يومية.',
      en: 'Branded residences under full hotel management — spa, pools, international restaurants and room service. Suited to an investor who wants hard-currency income without day-to-day management.',
      fa: 'رزیدنس‌های برند با مدیریت کامل هتلی — اسپا، استخر، رستوران و سرویس اتاق.',
      ru: 'Брендированные резиденции под полным управлением отеля — спа, бассейны, рестораны, рум-сервис.',
    },
    pros: [
      { ar: 'نظام إدارة فندقي كامل — إمكانية تشغيل الشقة عبر الفندق لتحقيق عوائد بالعملة الصعبة.', en: 'Full hotel management — the unit can be operated through the hotel for hard-currency returns.', fa: 'مدیریت کامل هتلی — امکان بهره‌برداری واحد از طریق هتل.', ru: 'Полное гостиничное управление — доход в твёрдой валюте.' },
      { ar: 'مناسبة للجنسية التركية — قيمة الوحدة تتجاوز حد الـ ٤٠٠ ألف دولار بوضوح.', en: 'Comfortably clears the $400,000 citizenship threshold.', fa: 'به‌راحتی از آستانه ۴۰۰ هزار دلاری شهروندی عبور می‌کند.', ru: 'Уверенно превышает порог гражданства в $400 000.' },
      { ar: 'فخامة مطلقة وخدمات متكاملة — سبا، مسابح، مطاعم عالمية، وخدمة الغرف.', en: 'Full-service luxury — spa, pools, international restaurants, room service.', fa: 'لوکس کامل با خدمات یکپارچه.', ru: 'Полный набор люксовых услуг.' },
    ],
    cons: [
      { ar: 'ميزانية ضخمة — ما بتناسب أصحاب الميزانيات المتوسطة أو الصغيرة.', en: 'Large budget required — not suited to mid or small budgets.', fa: 'بودجه بزرگ لازم است.', ru: 'Требуется большой бюджет.' },
      { ar: 'اقتطاعات الإدارة الفندقية — النسبة اللي تاخدها الإدارة من الإيجار بتقص من العائد الصافي.', en: 'Hotel management takes a cut of rental income, reducing the net yield.', fa: 'کسر سهم مدیریت هتل از درآمد اجاره.', ru: 'Управляющая компания удерживает долю дохода.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: '٢٠٢١ — جاهز ومُدار بالكامل', en: '2021 — delivered and fully managed', fa: '۲۰۲۱ — تحویل‌شده و تحت مدیریت', ru: '2021 — сдан и под управлением' } },
      { key: 'mgmtCut', value: '25% – 35%' },
      { key: 'occupancy', value: '70% – 80%' },
    ],
    images: ['1.webp', '2.webp', '3.webp'],
    source: { label: 'Address Residence Istanbul', url: 'https://www.addresshotels.com/' },
  },
  {
    slug: 'rams-park-house-maslak',
    brand: '#8a2f2a',
    name: { ar: 'رامس بارك هاوس مسلك', en: 'RAMS Park House Maslak', fa: 'رمز پارک هاوس مسلک', ru: 'RAMS Park House Maslak' },
    developer: 'RAMS Global',
    district: { ar: 'مسلك / ساريير', en: 'Maslak / Sarıyer', fa: 'مسلک / ساری‌یر', ru: 'Маслак / Сарыер' },
    side: 'european',
    type: {
      ar: 'مجمع سكني وتجاري فاخر قرب استينيا بارك ووادي إسطنبول',
      en: 'Premium mixed-use complex near İstinye Park and Vadi İstanbul',
      fa: 'مجتمع لوکس مسکونی-تجاری نزدیک استینیه پارک',
      ru: 'Премиальный жилой и коммерческий комплекс рядом с İstinye Park',
    },
    minUsd: 353_000,
    maxUsd: 1_500_000,
    summary: {
      ar: 'مجمع فاخر في قلب منطقة المال والأعمال بإسطنبول الأوروبية، قريب من استينيا بارك ووادي إسطنبول.',
      en: 'A premium complex at the heart of the European-side business district, close to İstinye Park and Vadi İstanbul.',
      fa: 'مجتمعی لوکس در قلب منطقه تجاری سمت اروپایی.',
      ru: 'Премиальный комплекс в сердце делового района европейской части.',
    },
    pros: [
      { ar: 'قلب منطقة المال والأعمال — مسلك هي منطقة ناطحات السحاب والمركز المالي لإسطنبول الأوروبية.', en: 'Heart of the business district — Maslak is the European side’s skyscraper and finance hub.', fa: 'قلب منطقه تجاری — مسلک مرکز مالی سمت اروپایی است.', ru: 'Сердце делового района — Маслак это финансовый хаб европейской стороны.' },
      { ar: 'طلب إيجاري استثنائي — من التنفيذيين والدبلوماسيين والموظفين الأجانب.', en: 'Exceptional rental demand — executives, diplomats and expat staff.', fa: 'تقاضای اجاره استثنایی از مدیران و دیپلمات‌ها.', ru: 'Исключительный спрос на аренду со стороны руководителей и дипломатов.' },
      { ar: 'ارتفاع مستمر في قيمة الأراضي — مسلك محدودة الأراضي، وهاد بيدعم نمو القيمة الرأسمالية.', en: 'Land scarcity in Maslak supports continued capital growth.', fa: 'کمبود زمین در مسلک از رشد سرمایه‌ای پشتیبانی می‌کند.', ru: 'Дефицит земли в Маслаке поддерживает рост капитала.' },
    ],
    cons: [
      { ar: 'الازدحام المروري — اختناقات في ساعات الذروة عند مدخل شارع جانديري ومحاور TEM.', en: 'Traffic congestion — rush-hour bottlenecks at Cendere and the TEM interchanges.', fa: 'ترافیک سنگین در ساعات اوج.', ru: 'Пробки в час пик у Джендере и развязок TEM.' },
      { ar: 'قلة المساحات الخضراء المفتوحة — طابع المنطقة تجاري وبرجي بالدرجة الأولى.', en: 'Few open green spaces — the area is commercial and tower-dominated.', fa: 'فضای سبز کم — منطقه عمدتاً تجاری و برجی است.', ru: 'Мало зелёных зон — район в основном деловой и высотный.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'ديسمبر ٢٠٢٧ — قيد الإنشاء', en: 'December 2027 — under construction', fa: 'دسامبر ۲۰۲۷ — در حال ساخت', ru: 'Декабрь 2027 — строится' } },
      { key: 'unitTypes', value: '1+1 · 2+1 · 3+1 · 4+1 · penthouse' },
    ],
    images: ['1.webp', '2.webp', '3.webp'],
    source: { label: 'RAMS Park House — Imtilak', url: 'https://www.imtilak.net/' },
  },
  {
    slug: 'lotus-sisli',
    brand: '#6b2f5e',
    name: { ar: 'لوتس شيشلي', en: 'Lotus Şişli', fa: 'لوتوس شیشلی', ru: 'Lotus Şişli' },
    developer: 'Lotus Yapı Proje · Tolerans İnşaat · Cevahir İnşaat',
    district: { ar: 'شيشلي / مجيدية كوي', en: 'Şişli / Mecidiyeköy', fa: 'شیشلی / مجیدیه‌کوی', ru: 'Шишли / Меджидиекёй' },
    side: 'european',
    type: {
      ar: 'شقق ومكاتب استثمارية وسط إسطنبول التجاري',
      en: 'Investment apartments and offices in central commercial Istanbul',
      fa: 'آپارتمان و دفتر سرمایه‌گذاری در مرکز تجاری استانبول',
      ru: 'Инвестиционные квартиры и офисы в деловом центре Стамбула',
    },
    minUsd: 383_000,
    maxUsd: 900_000,
    summary: {
      ar: 'وحدات في قلب إسطنبول التجاري، على شبكة مواصلات متكاملة — مترو، متروبوس، وحافلات.',
      en: 'Units in the commercial heart of Istanbul on a full transport network — metro, metrobus and buses.',
      fa: 'واحدهایی در قلب تجاری استانبول با شبکه حمل‌ونقل کامل.',
      ru: 'Объекты в деловом центре Стамбула с полной транспортной сетью.',
    },
    pros: [
      { ar: 'مركز المدينة المباشر — شبكة مواصلات متكاملة (مترو، متروبوس، حافلات).', en: 'True city centre — full transport network (metro, metrobus, buses).', fa: 'مرکز واقعی شهر با شبکه حمل‌ونقل کامل.', ru: 'Настоящий центр города с полной транспортной сетью.' },
      { ar: 'مناسب للإيجار السياحي والقصير — تأجير يومي أو أسبوعي بعوائد مرتفعة.', en: 'Suited to short-stay and tourist rental — daily or weekly lets at high yields.', fa: 'مناسب اجاره کوتاه‌مدت و گردشگری.', ru: 'Подходит для краткосрочной и туристической аренды.' },
    ],
    cons: [
      { ar: 'الزحام والكثافة السكانية — منطقة صاخبة ومكتظة على مدار الساعة.', en: 'Noise and density — busy and crowded around the clock.', fa: 'شلوغی و تراکم بالا در تمام ساعات.', ru: 'Шум и плотность — многолюдно круглые сутки.' },
      { ar: 'قدم البنية التحتية المحيطة — تحيط بها أحياء قديمة تحت إعادة الإعمار.', en: 'Ageing surroundings — bordered by older districts under redevelopment.', fa: 'زیرساخت اطراف قدیمی و در حال بازسازی.', ru: 'Старая окружающая застройка в процессе реновации.' },
      { ar: 'العائد مربوط بالموسم السياحي — التأجير اليومي مرخّص هون، بس دخله بيتقلّب بين الموسم وخارجه أكتر بكتير من الإيجار السنوي.', en: 'Income is tied to the tourist season — daily letting is licensed here, but the revenue swings far more between peak and off-peak than an annual lease.', fa: 'درآمد وابسته به فصل گردشگری است و نوسان آن بیش از اجاره سالانه است.', ru: 'Доход привязан к турсезону — колебания намного выше, чем при годовой аренде.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: '٢٠٢٥', en: '2025', fa: '۲۰۲۵', ru: '2025' } },
      { key: 'shortLet', value: { ar: 'مرخّص — نظام Home-Office مع خدمات كونسيرج للتأجير اليومي', en: 'Licensed — home-office designation with concierge services for daily lets', fa: 'دارای مجوز — سیستم Home-Office با خدمات کنسیرژ', ru: 'Лицензировано — статус home-office и консьерж-сервис' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Lotus Şişli — Tru Property', url: 'https://truproperty.com/' },
  },
  {
    slug: 'basak-port',
    brand: '#1f6b6b',
    name: { ar: 'باشاك بورت', en: 'Başak Port', fa: 'باشاک پورت', ru: 'Başak Port' },
    developer: 'Binesa Yapı / İnşaat',
    district: { ar: 'باشاك شهير', en: 'Başakşehir', fa: 'باشاک‌شهیر', ru: 'Башакшехир' },
    side: 'european',
    type: {
      ar: 'مجمع سكني حديث ومخطط عمرانياً',
      en: 'A modern master-planned residential complex',
      fa: 'مجتمع مسکونی مدرن و برنامه‌ریزی‌شده',
      ru: 'Современный жилой комплекс с генпланом',
    },
    minUsd: 250_000,
    maxUsd: 450_000,
    summary: {
      ar: 'مجمع جاهز للتسليم في مدينة حديثة مكتملة الخدمات، بجوار مطار إسطنبول والمدينة الطبية والحدائق الكبرى.',
      en: 'A ready-to-hand-over complex in a fully serviced modern district next to Istanbul Airport, the medical city and large parks.',
      fa: 'مجتمعی آماده تحویل در منطقه‌ای مدرن نزدیک فرودگاه استانبول و شهر پزشکی.',
      ru: 'Готовый к сдаче комплекс в благоустроенном районе рядом с аэропортом и медгородком.',
    },
    pros: [
      { ar: 'مدينة حديثة مكتملة الخدمات — بجوار مطار إسطنبول، والمدينة الطبية، والحدائق العامة الكبرى.', en: 'Fully serviced modern district — next to Istanbul Airport, the medical city and major parks.', fa: 'منطقه مدرن با خدمات کامل.', ru: 'Современный район с полной инфраструктурой.' },
      { ar: 'طابع عائلي محافظ — مرغوبة جداً للعائلات العربية ولطالبي الإقامة العقارية.', en: 'Conservative family character — popular with Arab families and residence-permit buyers.', fa: 'بافت خانوادگی و محافظه‌کارانه.', ru: 'Семейный, консервативный характер района.' },
      { ar: 'جاهز للتسليم — ما في مخاطرة تأخير تسليم ولا انتظار.', en: 'Ready to hand over — no delivery-delay risk and no waiting.', fa: 'آماده تحویل — بدون ریسک تأخیر.', ru: 'Готов к передаче — без риска задержки сдачи.' },
    ],
    cons: [
      { ar: 'المسافة عن وسط إسطنبول — حوالي ٣٠–٣٥ كم عن الفاتح وتكسيم وشيشلي.', en: 'Distance from central Istanbul — roughly 30–35 km from Fatih, Taksim and Şişli.', fa: 'فاصله از مرکز استانبول حدود ۳۰ تا ۳۵ کیلومتر.', ru: 'Удалённость от центра — примерно 30–35 км.' },
      { ar: 'وفرة المعروض — مشاريع كثيرة بالمنطقة بتخلي المنافسة أعلى وقت إعادة البيع.', en: 'Heavy supply — many competing projects make resale harder.', fa: 'عرضه زیاد و رقابت بالا در فروش مجدد.', ru: 'Избыток предложения усложняет перепродажу.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'جاهز للتسليم', en: 'Ready to hand over', fa: 'آماده تحویل', ru: 'Готов к передаче' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Başakşehir — Imtilak', url: 'https://www.imtilak.net/' },
  },
  {
    slug: 'residence-inn-deluxia',
    brand: '#5c2f6b',
    name: { ar: 'ريزيدنس إن ديلوكسيا', en: 'Residence Inn Deluxia', fa: 'رزیدنس این دلوکسیا', ru: 'Residence Inn Deluxia' },
    developer: 'Teknik Yapı',
    district: { ar: 'بهجة شهير / باشاك شهير', en: 'Bahçeşehir / Başakşehir', fa: 'باغچه‌شهیر / باشاک‌شهیر', ru: 'Бахчешехир / Башакшехир' },
    side: 'european',
    type: {
      ar: 'شقق بمفهوم فندقي',
      en: 'Hotel-concept serviced apartments',
      fa: 'آپارتمان با مفهوم هتلی',
      ru: 'Апартаменты с гостиничной концепцией',
    },
    minUsd: 227_000,
    maxUsd: 500_000,
    summary: {
      ar: 'شقق بمفهوم فندقي جاهزة للتسليم من مطوّر تركي كبير، في منطقة عائلية مكتملة الخدمات.',
      en: 'Ready hotel-concept apartments from a major Turkish developer, in a fully serviced family district.',
      fa: 'آپارتمان‌های آماده با مفهوم هتلی از سازنده‌ای بزرگ.',
      ru: 'Готовые апартаменты с гостиничной концепцией от крупного турецкого застройщика.',
    },
    pros: [
      { ar: 'مفهوم فندقي بإدارة تشغيل — بيسهّل التأجير بدون إدارة يومية من المالك.', en: 'Hotel concept with an operator — lets the unit without day-to-day landlord work.', fa: 'مفهوم هتلی با اپراتور — اجاره بدون مدیریت روزانه.', ru: 'Гостиничная концепция с оператором — аренда без ежедневного управления.' },
      { ar: 'مطوّر تركي كبير ومعروف (Teknik Yapı) — سجل تسليم واضح.', en: 'A large, established Turkish developer (Teknik Yapı) with a clear delivery record.', fa: 'سازنده بزرگ و شناخته‌شده ترکیه.', ru: 'Крупный известный застройщик с понятной историей сдач.' },
      { ar: 'جاهز للتسليم — بدون انتظار ولا مخاطرة تأخير.', en: 'Ready to hand over — no waiting and no delivery-delay risk.', fa: 'آماده تحویل بدون انتظار.', ru: 'Готов к передаче — без ожидания.' },
    ],
    cons: [
      { ar: 'الوحدة الأرخص تحت حد الجنسية بفارق كبير — ٢٢٧ ألف دولار مقابل ٤٠٠ ألف مطلوبة.', en: 'The entry unit sits well below the citizenship threshold — $227k against the $400k required.', fa: 'واحد ورودی بسیار پایین‌تر از آستانه شهروندی است.', ru: 'Входной юнит существенно ниже порога гражданства.' },
      { ar: 'نسبة اقتطاع المشغّل من الإيجار غير معلنة — لازم تتأكد منها قبل ما تحسب العائد الصافي.', en: 'The operator’s cut of rental income is not published — confirm it before computing a net yield.', fa: 'سهم اپراتور از درآمد اجاره اعلام نشده است.', ru: 'Доля оператора в доходе не опубликована — уточните до расчёта чистой доходности.' },
      { ar: 'بعيدة عن وسط المدينة — نفس مشكلة باشاك شهير بالمسافة.', en: 'Far from the centre — the same distance issue as the rest of Başakşehir.', fa: 'دور از مرکز شهر.', ru: 'Далеко от центра.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'جاهز للتسليم', en: 'Ready to hand over', fa: 'آماده تحویل', ru: 'Готов к передаче' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Residence Inn Deluxia — Projeskop', url: 'https://projeskop.com/projeler/proje/residence-inn-deluxe' },
  },
  {
    slug: 'seba-central-kagithane',
    brand: '#1f4e79',
    name: { ar: 'سيبا سنترال كاغد هانه', en: 'Seba Central Kağıthane', fa: 'سبا سنترال کاغیت‌هانه', ru: 'Seba Central Kağıthane' },
    developer: 'Seba İnşaat',
    district: { ar: 'كاغد هانه', en: 'Kağıthane', fa: 'کاغیت‌هانه', ru: 'Кяытхане' },
    side: 'european',
    type: {
      ar: 'شقق ومكاتب عصرية في منطقة تحول عمراني متاخمة لمسلك وشيشلي',
      en: 'Modern apartments and offices in a regeneration zone bordering Maslak and Şişli',
      fa: 'آپارتمان و دفتر مدرن در منطقه بازآفرینی شهری',
      ru: 'Современные квартиры и офисы в зоне реновации рядом с Маслаком',
    },
    minUsd: 280_000,
    maxUsd: 444_000,
    summary: {
      ar: 'موقع استراتيجي بأسعار أقل من مسلك، في منطقة تحول عمراني سريع بين مسلك وشيشلي.',
      en: 'A strategic location at below-Maslak prices, in a fast-regenerating zone between Maslak and Şişli.',
      fa: 'موقعیت استراتژیک با قیمت کمتر از مسلک.',
      ru: 'Стратегическое расположение по цене ниже Маслака.',
    },
    pros: [
      { ar: 'موقع استراتيجي بأسعار أقل من مسلك — تحول عمراني سريع بيدعم قفزات السعر.', en: 'Strategic location below Maslak prices — rapid regeneration supports price growth.', fa: 'موقعیت استراتژیک با قیمت پایین‌تر از مسلک.', ru: 'Стратегическое место дешевле Маслака — быстрая реновация.' },
      { ar: 'إقبال من الطلاب والمهنيين الشباب — قربها من عدة جامعات ومراكز أعمال.', en: 'Demand from students and young professionals — several universities and business centres nearby.', fa: 'تقاضا از سوی دانشجویان و متخصصان جوان.', ru: 'Спрос со стороны студентов и молодых специалистов.' },
    ],
    cons: [
      { ar: 'تفاوت جودة الشوارع المحيطة — بعض الشوارع المجاورة لسه قيد التطوير.', en: 'Uneven surrounding streets — some neighbouring roads are still under development.', fa: 'کیفیت نامتوازن خیابان‌های اطراف.', ru: 'Неоднородное качество окружающих улиц.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'يناير ٢٠٢٥', en: 'January 2025', fa: 'ژانویه ۲۰۲۵', ru: 'Январь 2025' } },
      { key: 'mix', value: { ar: '٥٤ شقة سكنية · ٤١ مكتب · ٧ فلل · ٥ محلات — أي ٦٠٪ سكني و٤٠٪ مكاتب وتجاري', en: '54 apartments · 41 offices · 7 villas · 5 retail units — roughly 60% residential, 40% offices and retail', fa: '۵۴ آپارتمان · ۴۱ دفتر · ۷ ویلا · ۵ واحد تجاری', ru: '54 квартиры · 41 офис · 7 вилл · 5 торговых помещений' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Seba Central — Tru Property', url: 'https://truproperty.com/' },
  },
  {
    slug: 'focus-gunesli-bagcilar',
    brand: '#6b4a1f',
    name: { ar: 'فوكس غونشلي', en: 'Focus Güneşli', fa: 'فوکوس گونشلی', ru: 'Focus Güneşli' },
    developer: 'Barışan İnşaat',
    district: { ar: 'باججيلار / طريق باسين إكسبريس', en: 'Bağcılar / Basın Ekspres', fa: 'باغجیلار / باسین اکسپرس', ru: 'Багджылар / Басын Экспрес' },
    side: 'european',
    type: {
      ar: 'شقق استثمارية ومكاتب على محور تجاري',
      en: 'Investment apartments and offices on a commercial corridor',
      fa: 'آپارتمان و دفتر سرمایه‌گذاری روی محور تجاری',
      ru: 'Инвестиционные квартиры и офисы на коммерческой оси',
    },
    minUsd: 215_000,
    maxUsd: 500_000,
    summary: {
      ar: 'وحدات على محور باسين إكسبريس التجاري الممتد بين مطار أتاتورك سابقاً وطريق TEM — مناسب للمكاتب والوحدات الصغيرة.',
      en: 'Units on the Basın Ekspres commercial corridor between the former Atatürk airport and the TEM highway — suited to offices and small units.',
      fa: 'واحدهایی روی محور تجاری باسین اکسپرس.',
      ru: 'Объекты на коммерческой оси Басын Экспрес.',
    },
    pros: [
      { ar: 'محور تجاري بامتياز — مناسب جداً للمكاتب والشقق الصغرى (1+1 و 2+1).', en: 'A strong commercial corridor — well suited to offices and small units (1+1, 2+1).', fa: 'محور تجاری قوی، مناسب دفاتر و واحدهای کوچک.', ru: 'Сильный коммерческий коридор — офисы и малые юниты.' },
      { ar: 'سعر دخول مناسب للإقامة العقارية — يتجاوز حد الـ ٢٠٠ ألف دولار المطلوب.', en: 'Entry price clears the $200,000 residence-permit threshold.', fa: 'قیمت ورود بالاتر از آستانه ۲۰۰ هزار دلاری اقامت.', ru: 'Цена входа превышает порог ВНЖ в $200 000.' },
    ],
    cons: [
      { ar: 'طابع تجاري وصناعي محيط — بتفتقر لبيئة الأحياء السكنية الهادئة والعائلية.', en: 'Commercial and industrial surroundings — lacks a quiet residential feel.', fa: 'محیط اطراف تجاری و صنعتی است.', ru: 'Коммерческое и промышленное окружение.' },
      { ar: 'ازدحام محور باسين إكسبريس — الضغط المروري عالي جداً.', en: 'Basın Ekspres congestion — traffic pressure is very high.', fa: 'ترافیک سنگین محور باسین اکسپرس.', ru: 'Очень высокая транспортная нагрузка.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'يوليو ٢٠٢٨ — قيد الإنشاء', en: 'July 2028 — under construction', fa: 'ژوئیه ۲۰۲۸ — در حال ساخت', ru: 'Июль 2028 — строится' } },
      { key: 'payment', value: { ar: 'تقسيط ١٨ إلى ٣٦ شهر', en: 'Instalments over 18 to 36 months', fa: 'اقساط ۱۸ تا ۳۶ ماهه', ru: 'Рассрочка на 18–36 месяцев' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Focus Güneşli — Binaa Investment', url: 'https://www.binaainvestment.com/' },
  },
  {
    slug: 'casablu-vadi-beylikduzu',
    brand: '#7a5c1e',
    name: { ar: 'كاسابلو فادي', en: 'Casablu Vadi', fa: 'کازابلو وادی', ru: 'Casablu Vadi' },
    developer: 'Mutlu İnşaat · Best Proje',
    district: { ar: 'بيليك دوزو', en: 'Beylikdüzü', fa: 'بیلیک‌دوزو', ru: 'Бейликдюзю' },
    side: 'european',
    type: {
      ar: 'مجمع سكني عائلي بإطلالات بحرية ومساحات واسعة',
      en: 'A family residential complex with sea views and generous layouts',
      fa: 'مجتمع مسکونی خانوادگی با چشم‌انداز دریا',
      ru: 'Семейный жилой комплекс с видом на море',
    },
    minUsd: 266_000,
    maxUsd: 650_000,
    summary: {
      ar: 'مجمع عائلي بمساحات واسعة وسعر متر منخفض مقارنة بوسط المدينة، بتنظيم عمراني ممتاز وقرب من الساحل.',
      en: 'A family complex with generous areas and a low price per m² versus the centre, well planned and close to the coast.',
      fa: 'مجتمع خانوادگی با متراژ بالا و قیمت مناسب.',
      ru: 'Семейный комплекс с просторными планировками и низкой ценой за м².',
    },
    pros: [
      { ar: 'مساحات واسعة بأسعار معقولة — سعر المتر منخفض مقارنة بوسط المدينة.', en: 'Generous areas at reasonable prices — low price per m² versus the centre.', fa: 'متراژ بالا با قیمت مناسب.', ru: 'Просторные планировки по разумной цене.' },
      { ar: 'تنظيم عمراني ممتاز — شوارع عريضة، حدائق، وقرب من الساحل.', en: 'Excellent urban planning — wide streets, parks, close to the coast.', fa: 'برنامه‌ریزی شهری عالی.', ru: 'Отличная городская планировка.' },
    ],
    cons: [
      { ar: 'البعد الجغرافي الشديد — أكتر من ٤٠ كم عن وسط المدينة، والاعتماد الأكبر على المتروبوس.', en: 'Significant distance — over 40 km from the centre, largely reliant on the metrobus.', fa: 'فاصله زیاد از مرکز شهر.', ru: 'Большая удалённость — свыше 40 км от центра.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'نهاية ٢٠٢٤ — جاهز', en: 'End of 2024 — ready', fa: 'پایان ۲۰۲۴ — آماده', ru: 'Конец 2024 — готов' } },
      { key: 'residencyUnit', value: { ar: 'شقق ٣+١ و٤+١ بالإطلالة البحرية بتتجاوز ٤٠٠ ألف دولار وبتأهّل للجنسية', en: '3+1 and 4+1 sea-view units exceed $400,000 and qualify for citizenship', fa: 'واحدهای ۳+۱ و ۴+۱ از ۴۰۰ هزار دلار عبور می‌کنند', ru: 'Юниты 3+1 и 4+1 с видом на море превышают $400 000' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Casablu Vadi — Binaa Investment', url: 'https://www.binaainvestment.com/' },
  },
  {
    slug: 'babacan-lagoon-gaziosmanpasa',
    brand: '#2f5e3a',
    name: { ar: 'باباجان لاغون', en: 'Babacan Lagoon', fa: 'باباجان لاگون', ru: 'Babacan Lagoon' },
    developer: 'Babacan Holding',
    district: { ar: 'غازي عثمان باشا', en: 'Gaziosmanpaşa', fa: 'غازی عثمان پاشا', ru: 'Газиосманпаша' },
    side: 'european',
    type: {
      ar: 'مجمع سكني حديث بنظام المنازل الذكية',
      en: 'A modern smart-home residential complex',
      fa: 'مجتمع مسکونی مدرن با خانه هوشمند',
      ru: 'Современный ЖК с системой «умный дом»',
    },
    minUsd: 180_000,
    maxUsd: null,
    summary: {
      ar: 'من أوفر الخيارات للمجمعات الحديثة القريبة من محور TEM، بنظام منازل ذكية.',
      en: 'One of the better-value modern complexes near the TEM corridor, with smart-home systems.',
      fa: 'یکی از مقرون‌به‌صرفه‌ترین مجتمع‌های مدرن نزدیک محور TEM.',
      ru: 'Один из самых выгодных современных ЖК рядом с трассой TEM.',
    },
    pros: [
      { ar: 'سعر اقتصادي مناسب — من أوفر الخيارات للمجمعات الحديثة قرب محور TEM.', en: 'Economical pricing — good value among modern complexes near the TEM corridor.', fa: 'قیمت اقتصادی و مناسب.', ru: 'Экономичная цена среди современных ЖК.' },
    ],
    cons: [
      { ar: 'الوحدات الصغرى تحت حد الإقامة العقارية — إذا كان سعر الوحدة أقل من ٢٠٠ ألف دولار ما بتمنح إقامة عقارية بشكل منفرد.', en: 'Smaller units fall below the residence threshold — a unit under $200,000 does not grant a property residence permit on its own.', fa: 'واحدهای کوچک زیر آستانه اقامت هستند.', ru: 'Малые юниты ниже порога ВНЖ — объект дешевле $200 000 не даёт ВНЖ сам по себе.' },
    ],
    extraFacts: [
      { key: 'delivery', value: { ar: 'مارس إلى ديسمبر ٢٠٢٧ — قيد الإنشاء', en: 'March to December 2027 — under construction', fa: 'مارس تا دسامبر ۲۰۲۷ — در حال ساخت', ru: 'Март–декабрь 2027 — строится' } },
      { key: 'residencyUnit', value: { ar: 'شقق ١+١ بتبدأ من ١٨٠ ألف وما بتعطي إقامة — شقق ٢+١ بتتجاوز ٢٢٠ ألف وبتأهّل', en: '1+1 units start at $180k and do NOT grant residence — 2+1 units exceed $220k and do qualify', fa: 'واحدهای ۱+۱ از ۱۸۰ هزار شروع می‌شوند و اقامت نمی‌دهند — ۲+۱ بالای ۲۲۰ هزار واجد شرایط است', ru: 'Юниты 1+1 от $180 тыс. ВНЖ не дают — 2+1 свыше $220 тыс. дают' } },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Babacan Lagoon — Imtilak', url: 'https://www.imtilak.net/' },
  },
  {
    slug: 'allure-tower-avcilar',
    brand: '#3d4a5c',
    name: { ar: 'اللور تاور أفجلار', en: 'Allure Tower Avcılar', fa: 'الور تاور آوجیلار', ru: 'Allure Tower Avcılar' },
    developer: 'Doruk GYO',
    district: { ar: 'أفجلار', en: 'Avcılar', fa: 'آوجیلار', ru: 'Авджылар' },
    side: 'european',
    type: {
      ar: 'برج حديث مقاوم للزلازل على طريق E-5، قرب البحر وجامعة إسطنبول',
      en: 'A modern earthquake-resistant tower on the E-5, near the sea and Istanbul University',
      fa: 'برجی مدرن و مقاوم در برابر زلزله روی جاده E-5',
      ru: 'Современная сейсмостойкая башня на E-5, рядом с морем и университетом',
    },
    minUsd: 106_000,
    maxUsd: 150_000,
    summary: {
      ar: 'برج مسلّم من ٢٠١٦ مبني على معايير مقاومة الزلازل، بطلب إيجاري طلابي دائم وسعر دخول منخفض — بس خارج حدود الإقامة والجنسية تماماً.',
      en: 'A tower delivered in 2016 to earthquake-resistant standards, with steady student rental demand and a low entry price — but entirely below both the residence and citizenship thresholds.',
      fa: 'برجی تحویل‌شده در ۲۰۱۶ با استانداردهای مقاوم در برابر زلزله و تقاضای دائمی اجاره دانشجویی.',
      ru: 'Башня, сданная в 2016 году по сейсмостойким стандартам, со стабильным студенческим спросом.',
    },
    pros: [
      { ar: 'طلب إيجاري طلابي دائم — قرب جامعة إسطنبول بيسهّل التأجير للطلاب والموظفين.', en: 'Steady student rental demand — Istanbul University nearby makes it easy to let.', fa: 'تقاضای دائمی اجاره دانشجویی.', ru: 'Постоянный студенческий спрос на аренду.' },
      { ar: 'سعر منخفض جداً — مناسب لذوي الميزانيات المحدودة.', en: 'Very low entry price — suited to limited budgets.', fa: 'قیمت ورود بسیار پایین.', ru: 'Очень низкая цена входа.' },
      { ar: 'مبني على معايير مقاومة الزلازل ومسلّم ٢٠١٦ — نقطة مهمة جداً في أفجلار تحديداً.', en: 'Built to earthquake-resistant standards and delivered in 2016 — a genuinely important point in Avcılar specifically.', fa: 'ساخته‌شده با استانداردهای مقاوم در برابر زلزله.', ru: 'Построена по сейсмостойким стандартам — важно именно для Авджылара.' },
    ],
    cons: [
      { ar: 'خارج حدود الإقامة والجنسية — أسعار الوحدات المنفردة ما بتحقق شرط الـ ٢٠٠ ألف للإقامة ولا الـ ٤٠٠ ألف للجنسية.', en: 'Below both thresholds — a single unit meets neither the $200,000 residence nor the $400,000 citizenship requirement.', fa: 'زیر هر دو آستانه اقامت و شهروندی.', ru: 'Ниже обоих порогов — ни ВНЖ, ни гражданства.' },
      { ar: 'أفجلار من أعلى مناطق إسطنبول خطورة زلزالياً — هذا البرج مطابق، بس أي عقار ثاني بالمنطقة لازمه تقرير فحص إنشائي قبل الشراء.', en: 'Avcılar is among Istanbul’s highest seismic-risk districts — this tower complies, but any other property in the area needs a structural survey before purchase.', fa: 'آوجیلار از مناطق پرخطر لرزه‌ای استانبول است.', ru: 'Авджылар — один из самых сейсмоопасных районов Стамбула.' },
      { ar: 'مبنى مسلّم من ٢٠١٦ — بعد عشر سنين، رسوم الصيانة وتجديد المشتركات بتبلّش تزيد.', en: 'Delivered in 2016 — ten years on, maintenance and common-area renewal costs start climbing.', fa: 'تحویل‌شده در ۲۰۱۶ — هزینه نگهداری رو به افزایش است.', ru: 'Сдан в 2016 — через десять лет расходы на обслуживание растут.' },
    ],
    extraFacts: [
      { key: 'buildYear', value: '2016' },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Allure Tower — Emlakta Son Dakika', url: 'https://www.emlaktasondakika.com/konut-projeleri/allure-tower-avcilar-ne-zaman-teslim-edilecek-80581.html' },
  },
];

export const investmentBySlug = (slug: string): InvestmentOpportunity | null =>
  INVESTMENTS.find((o) => o.slug === slug) ?? null;

/** Price range formatted for display, e.g. "$320,000 – $1,100,000" or "from $353,000". */
export function priceRange(o: InvestmentOpportunity, fromLabel: string): string {
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
  return o.maxUsd === null ? `${fromLabel} ${fmt(o.minUsd)}` : `${fmt(o.minUsd)} – ${fmt(o.maxUsd)}`;
}
