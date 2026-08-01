/**
 * Investment opportunities shown on /real-estate/investments and injected into
 * the listings feed.
 *
 * These live in code, not the database, on purpose: there are ten of them, they
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
    maxUsd: null,
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
    images: ['1.webp', '2.webp', '3.webp'],
    source: { label: 'RAMS Park House — Imtilak', url: 'https://www.imtilak.net/' },
  },
  {
    slug: 'lotus-sisli',
    brand: '#6b2f5e',
    name: { ar: 'لوتس شيشلي', en: 'Lotus Şişli', fa: 'لوتوس شیشلی', ru: 'Lotus Şişli' },
    developer: '—',
    district: { ar: 'شيشلي / مجيدية كوي', en: 'Şişli / Mecidiyeköy', fa: 'شیشلی / مجیدیه‌کوی', ru: 'Шишли / Меджидиекёй' },
    side: 'european',
    type: {
      ar: 'شقق ومكاتب استثمارية وسط إسطنبول التجاري',
      en: 'Investment apartments and offices in central commercial Istanbul',
      fa: 'آپارتمان و دفتر سرمایه‌گذاری در مرکز تجاری استانبول',
      ru: 'Инвестиционные квартиры и офисы в деловом центре Стамбула',
    },
    minUsd: 383_000,
    maxUsd: null,
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
      { ar: 'التأجير اليومي في تركيا صار يحتاج ترخيص — تأكد من وضع الوحدة قبل ما تبني عليه العائد.', en: 'Short-term letting in Turkey now requires a permit — confirm the unit’s status before counting on that income.', fa: 'اجاره کوتاه‌مدت در ترکیه نیازمند مجوز است.', ru: 'Краткосрочная аренда в Турции требует разрешения — проверьте статус объекта.' },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Lotus Şişli — Tru Property', url: 'https://truproperty.com/' },
  },
  {
    slug: 'basaksehir-projects',
    brand: '#1f6b6b',
    name: { ar: 'مجمعات باشاك شهير', en: 'Başakşehir complexes', fa: 'مجتمع‌های باشاک‌شهیر', ru: 'Комплексы Башакшехир' },
    developer: '—',
    district: { ar: 'باشاك شهير', en: 'Başakşehir', fa: 'باشاک‌شهیر', ru: 'Башакшехир' },
    side: 'european',
    type: {
      ar: 'مجمعات سكنية حديثة ومخططة عمرانياً',
      en: 'Modern master-planned residential complexes',
      fa: 'مجتمع‌های مسکونی مدرن و برنامه‌ریزی‌شده',
      ru: 'Современные жилые комплексы с генпланом',
    },
    minUsd: 220_000,
    maxUsd: 337_000,
    summary: {
      ar: 'مدينة حديثة مكتملة الخدمات بجوار مطار إسطنبول والمدينة الطبية والحدائق الكبرى — مرغوبة جداً للعائلات.',
      en: 'A modern, fully serviced district next to Istanbul Airport, the medical city and large public parks — highly sought after by families.',
      fa: 'منطقه‌ای مدرن و کامل نزدیک فرودگاه استانبول و شهر پزشکی.',
      ru: 'Современный благоустроенный район рядом с аэропортом Стамбула и медгородком.',
    },
    pros: [
      { ar: 'مدينة حديثة مكتملة الخدمات — بجوار مطار إسطنبول، والمدينة الطبية، والحدائق العامة الكبرى.', en: 'Fully serviced modern district — next to Istanbul Airport, the medical city and major parks.', fa: 'منطقه مدرن با خدمات کامل.', ru: 'Современный район с полной инфраструктурой.' },
      { ar: 'طابع عائلي محافظ — مرغوبة جداً للعائلات العربية ولطالبي الإقامة العقارية.', en: 'Conservative family character — popular with Arab families and residence-permit buyers.', fa: 'بافت خانوادگی و محافظه‌کارانه.', ru: 'Семейный, консервативный характер района.' },
    ],
    cons: [
      { ar: 'المسافة عن وسط إسطنبول — حوالي ٣٠–٣٥ كم عن الفاتح وتكسيم وشيشلي.', en: 'Distance from central Istanbul — roughly 30–35 km from Fatih, Taksim and Şişli.', fa: 'فاصله از مرکز استانبول حدود ۳۰ تا ۳۵ کیلومتر.', ru: 'Удалённость от центра — примерно 30–35 км.' },
      { ar: 'وفرة المعروض — مشاريع كثيرة بالمنطقة بتخلي المنافسة أعلى وقت إعادة البيع.', en: 'Heavy supply — many competing projects make resale harder.', fa: 'عرضه زیاد و رقابت بالا در فروش مجدد.', ru: 'Избыток предложения усложняет перепродажу.' },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Başakşehir — Imtilak', url: 'https://www.imtilak.net/' },
  },
  {
    slug: 'seba-central-kagithane',
    brand: '#1f4e79',
    name: { ar: 'سيبا سنترال كاغد هانه', en: 'Seba Central Kağıthane', fa: 'سبا سنترال کاغیت‌هانه', ru: 'Seba Central Kağıthane' },
    developer: 'Seba',
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
    images: ['1.webp', '2.webp'],
    source: { label: 'Seba Central — Tru Property', url: 'https://truproperty.com/' },
  },
  {
    slug: 'focus-gunesli-bagcilar',
    brand: '#6b4a1f',
    name: { ar: 'فوكس غونشلي', en: 'Focus Güneşli', fa: 'فوکوس گونشلی', ru: 'Focus Güneşli' },
    developer: '—',
    district: { ar: 'باججيلار / طريق باسين إكسبريس', en: 'Bağcılar / Basın Ekspres', fa: 'باغجیلار / باسین اکسپرس', ru: 'Багджылар / Басын Экспрес' },
    side: 'european',
    type: {
      ar: 'شقق استثمارية ومكاتب على محور تجاري',
      en: 'Investment apartments and offices on a commercial corridor',
      fa: 'آپارتمان و دفتر سرمایه‌گذاری روی محور تجاری',
      ru: 'Инвестиционные квартиры и офисы на коммерческой оси',
    },
    minUsd: 215_000,
    maxUsd: null,
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
    images: ['1.webp', '2.webp'],
    source: { label: 'Focus Güneşli — Binaa Investment', url: 'https://www.binaainvestment.com/' },
  },
  {
    slug: 'casablu-vadi-beylikduzu',
    brand: '#7a5c1e',
    name: { ar: 'كاسابلو فادي', en: 'Casablu Vadi', fa: 'کازابلو وادی', ru: 'Casablu Vadi' },
    developer: '—',
    district: { ar: 'بيليك دوزو', en: 'Beylikdüzü', fa: 'بیلیک‌دوزو', ru: 'Бейликдюзю' },
    side: 'european',
    type: {
      ar: 'مجمع سكني عائلي بإطلالات بحرية ومساحات واسعة',
      en: 'A family residential complex with sea views and generous layouts',
      fa: 'مجتمع مسکونی خانوادگی با چشم‌انداز دریا',
      ru: 'Семейный жилой комплекс с видом на море',
    },
    minUsd: 266_000,
    maxUsd: null,
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
    images: ['1.webp', '2.webp'],
    source: { label: 'Babacan Lagoon — Imtilak', url: 'https://www.imtilak.net/' },
  },
  {
    slug: 'avcilar-coastal',
    brand: '#3d4a5c',
    name: { ar: 'شقق أفجلار الساحلية', en: 'Avcılar coastal apartments', fa: 'آپارتمان‌های ساحلی آوجیلار', ru: 'Прибрежные квартиры Авджылар' },
    developer: '—',
    district: { ar: 'أفجلار', en: 'Avcılar', fa: 'آوجیلار', ru: 'Авджылар' },
    side: 'european',
    type: {
      ar: 'شقق سكنية قرب البحر وجامعة إسطنبول',
      en: 'Residential apartments near the sea and Istanbul University',
      fa: 'آپارتمان‌های مسکونی نزدیک دریا و دانشگاه استانبول',
      ru: 'Жилые квартиры у моря рядом со Стамбульским университетом',
    },
    minUsd: 106_000,
    maxUsd: 150_000,
    summary: {
      ar: 'خيار منخفض السعر مع طلب إيجاري طلابي دائم — بس خارج حدود الإقامة والجنسية تماماً.',
      en: 'A low-priced option with steady student rental demand — but entirely below both the residence and citizenship thresholds.',
      fa: 'گزینه‌ای ارزان با تقاضای دائمی اجاره دانشجویی.',
      ru: 'Недорогой вариант со стабильным студенческим спросом.',
    },
    pros: [
      { ar: 'طلب إيجاري طلابي دائم — سهولة تأجير العقار للطلاب والموظفين.', en: 'Steady student rental demand — easy to let to students and staff.', fa: 'تقاضای دائمی اجاره دانشجویی.', ru: 'Постоянный студенческий спрос на аренду.' },
      { ar: 'سعر منخفض جداً — مناسب لذوي الميزانيات المحدودة.', en: 'Very low entry price — suited to limited budgets.', fa: 'قیمت ورود بسیار پایین.', ru: 'Очень низкая цена входа.' },
    ],
    cons: [
      { ar: 'خارج حدود الإقامة والجنسية — أسعار الوحدات المنفردة ما بتحقق شرط الـ ٢٠٠ ألف للإقامة ولا الـ ٤٠٠ ألف للجنسية.', en: 'Below both thresholds — a single unit meets neither the $200,000 residence nor the $400,000 citizenship requirement.', fa: 'زیر هر دو آستانه اقامت و شهروندی.', ru: 'Ниже обоих порогов — ни ВНЖ, ни гражданства.' },
      { ar: 'الحاجة للتأكد من مقاومة الزلازل — ضروري اختيار مبانٍ حديثة ومراعاة معايير السلامة الزلزالية بالمنطقة.', en: 'Seismic safety must be checked — pick modern buildings and verify earthquake standards for the area.', fa: 'بررسی مقاومت لرزه‌ای ضروری است.', ru: 'Обязательна проверка сейсмостойкости — выбирайте современные здания.' },
    ],
    images: ['1.webp', '2.webp'],
    source: { label: 'Avcılar listings — TEKCE', url: 'https://www.tekce.com/' },
  },
];

export const investmentBySlug = (slug: string): InvestmentOpportunity | null =>
  INVESTMENTS.find((o) => o.slug === slug) ?? null;

/** Price range formatted for display, e.g. "$320,000 – $1,100,000" or "from $353,000". */
export function priceRange(o: InvestmentOpportunity, fromLabel: string): string {
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
  return o.maxUsd === null ? `${fromLabel} ${fmt(o.minUsd)}` : `${fmt(o.minUsd)} – ${fmt(o.maxUsd)}`;
}
