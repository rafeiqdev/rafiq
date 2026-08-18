/**
 * Quick facts + a practical city guide about Istanbul itself (best areas to
 * live, cost of living, climate, safety, culture, language) — shown on the
 * Istanbul Tricks page. Content is written in-house, inspired by the kind of
 * coverage expat guides (e.g. Yabangee) publish, but not copied from them.
 * Localized inline per-language (ar/en/ru/fa), same pattern as istanbulApps.ts.
 */
import type { LocalizedText } from './istanbulApps';
import type { IconName } from '../components/AppIcon';

export interface QuickFact {
  icon: IconName;
  value: LocalizedText;
  label: LocalizedText;
}

export interface CityGuideCard {
  icon: IconName;
  title: LocalizedText;
  body: LocalizedText;
}

export const QUICK_FACTS: QuickFact[] = [
  {
    icon: 'users',
    value: { ar: '١٦+ مليون', en: '16M+', ru: '16+ млн', fa: '+۱۶ میلیون' },
    label: { ar: 'عدد السكان', en: 'Population', ru: 'Население', fa: 'جمعیت' },
  },
  {
    icon: 'wallet',
    value: { ar: '١٢–١٨ ألف ₺', en: '₺12–18K', ru: '12–18 тыс ₺', fa: '۱۲ تا ۱۸ هزار ₺' },
    label: {
      ar: 'معيشة شهرية تقريبية للفرد',
      en: 'Approx. monthly cost (single)',
      ru: 'Расходы в месяц (примерно)',
      fa: 'هزینه ماهانه تقریبی فرد',
    },
  },
  {
    icon: 'thermometer-sun',
    value: { ar: '٤ فصول', en: '4 Seasons', ru: '4 сезона', fa: '۴ فصل' },
    label: {
      ar: 'صيف حار وشتاء ممطر',
      en: 'Hot summer, rainy winter',
      ru: 'Жаркое лето, дождливая зима',
      fa: 'تابستان گرم، زمستان بارانی',
    },
  },
  {
    icon: 'languages',
    value: { ar: 'التركية', en: 'Turkish', ru: 'Турецкий', fa: 'ترکی' },
    label: { ar: 'اللغة الرسمية', en: 'Official language', ru: 'Официальный язык', fa: 'زبان رسمی' },
  },
];

export const CITY_GUIDE: CityGuideCard[] = [
  {
    icon: 'map-pin',
    title: {
      ar: 'أفضل الأحياء للسكن',
      en: 'Best areas to live',
      ru: 'Лучшие районы для жизни',
      fa: 'بهترین محله‌ها برای زندگی',
    },
    body: {
      ar: 'قاضي كوي وأسكودار بالجانب الآسيوي هادئتان وقريبتان من الجامعات؛ شيشلي وبشكتاش بالجانب الأوروبي أقرب للمركز والخدمات. اختر حسب مكان دراستك أو عملك لتقليل وقت التنقل اليومي.',
      en: 'Kadıköy and Üsküdar on the Asian side are calmer and close to universities; Şişli and Beşiktaş on the European side sit nearer the center and services. Pick based on your work or study location to cut your daily commute.',
      ru: 'Кадыкёй и Ускюдар на азиатской стороне спокойнее и ближе к университетам; Шишли и Бешикташ на европейской стороне ближе к центру и услугам. Выбирайте район по месту работы или учёбы, чтобы сократить дорогу.',
      fa: 'قادیکوی و اسکودار در سمت آسیایی آرام‌تر و نزدیک دانشگاه‌ها هستند؛ شیشلی و بشیکتاش در سمت اروپایی به مرکز و خدمات نزدیک‌ترند. بر اساس محل کار یا تحصیل خود انتخاب کنید تا رفت‌وآمد روزانه کمتر شود.',
    },
  },
  {
    icon: 'wallet',
    title: {
      ar: 'تكلفة المعيشة',
      en: 'Cost of living',
      ru: 'Стоимость жизни',
      fa: 'هزینه زندگی',
    },
    body: {
      ar: 'الإيجار هو أكبر بند بالمصروف ويتفاوت كثير حسب الحي وقرب المترو؛ الطعام والمواصلات العامة رخيصة نسبياً مقارنة بأوروبا. توصيل الطعام والتسوق الإلكتروني رفعوا الإنفاق الشهري بشكل ملحوظ خلال السنوات الأخيرة.',
      en: 'Rent is the biggest expense and varies a lot by neighborhood and metro access; food and public transport are relatively cheap compared to Europe. Food delivery and online shopping have pushed monthly spending up noticeably in recent years.',
      ru: 'Аренда — самая большая статья расходов и сильно зависит от района и близости к метро; еда и общественный транспорт относительно дёшевы по сравнению с Европой. Доставка еды и онлайн-покупки заметно увеличили ежемесячные расходы за последние годы.',
      fa: 'اجاره بزرگ‌ترین هزینه است و بسته به محله و نزدیکی به مترو خیلی متفاوت است؛ غذا و حمل‌ونقل عمومی نسبت به اروپا ارزان‌تر است. تحویل غذا و خرید آنلاین در سال‌های اخیر هزینه ماهانه را به‌طور قابل توجهی افزایش داده‌اند.',
    },
  },
  {
    icon: 'cloud-sun',
    title: {
      ar: 'الطقس والفصول',
      en: 'Climate & seasons',
      ru: 'Климат и сезоны',
      fa: 'آب‌وهوا و فصل‌ها',
    },
    body: {
      ar: 'الصيف حار وجاف من يونيو لسبتمبر، والشتاء بارد ورطب مع أمطار وأحياناً ثلج بين ديسمبر وفبراير. الربيع والخريف أفضل وقت للتجول بالمدينة بسبب الطقس المعتدل.',
      en: 'Summer is hot and dry from June to September, while winter is cold and wet with occasional snow between December and February. Spring and autumn are the best time to explore the city thanks to mild weather.',
      ru: 'Лето жаркое и сухое с июня по сентябрь, зима холодная и влажная, иногда со снегом, с декабря по февраль. Весна и осень — лучшее время для прогулок по городу благодаря мягкой погоде.',
      fa: 'تابستان از ژوئن تا سپتامبر گرم و خشک است، و زمستان از دسامبر تا فوریه سرد و مرطوب با بارش گاه‌به‌گاه برف است. بهار و پاییز به‌دلیل آب‌وهوای معتدل بهترین زمان برای گشت‌وگذار در شهر هستند.',
    },
  },
  {
    icon: 'shield-check',
    title: {
      ar: 'الأمان والحياة اليومية',
      en: 'Safety & daily life',
      ru: 'Безопасность и повседневная жизнь',
      fa: 'امنیت و زندگی روزمره',
    },
    body: {
      ar: 'إسطنبول مدينة آمنة بشكل عام مقارنة بمدن كبرى أخرى، لكن انتبه من النشل بالأماكن المزدحمة والتاكسي غير المرخّص. احتفظ بنسخة من جواز سفرك وتجنّب حمل كل نقودك بمكان واحد.',
      en: 'Istanbul is generally a safe city compared to other major metros, but watch for pickpocketing in crowded spots and unlicensed taxis. Keep a copy of your passport and avoid carrying all your cash in one place.',
      ru: 'Стамбул в целом безопасный город по сравнению с другими крупными мегаполисами, но остерегайтесь карманников в людных местах и нелицензированных такси. Держите копию паспорта и не носите все наличные в одном месте.',
      fa: 'استانبول نسبت به سایر کلان‌شهرها به‌طور کلی شهری امن است، اما در مکان‌های شلوغ مراقب جیب‌بری و تاکسی‌های غیرمجاز باشید. یک کپی از پاسپورت خود نگه دارید و همه پول نقدتان را یک‌جا حمل نکنید.',
    },
  },
  {
    icon: 'drama',
    title: {
      ar: 'الثقافة والعادات',
      en: 'Culture & customs',
      ru: 'Культура и обычаи',
      fa: 'فرهنگ و آداب‌ورسوم',
    },
    body: {
      ar: 'الضيافة جزء أساسي من الثقافة التركية؛ الشاي حاضر بكل تفاعل اجتماعي أو تجاري. الاحترام للكبار بالسن مهم جداً، وأغلب الأتراك يتفهّمون الأجانب اللي بيحاولوا التحدث بالتركية حتى لو بأخطاء.',
      en: 'Hospitality is central to Turkish culture; tea shows up in nearly every social or business interaction. Respect for elders matters a lot, and most Turks appreciate foreigners who try to speak Turkish even imperfectly.',
      ru: 'Гостеприимство — основа турецкой культуры; чай присутствует почти в каждом социальном или деловом взаимодействии. Уважение к старшим очень важно, а большинство турок ценят иностранцев, пытающихся говорить по-турецки, даже с ошибками.',
      fa: 'مهمان‌نوازی بخش اصلی فرهنگ ترکیه است؛ چای در تقریباً هر تعامل اجتماعی یا کاری حاضر است. احترام به بزرگ‌ترها بسیار مهم است و اکثر ترک‌ها از خارجی‌هایی که سعی می‌کنند ترکی صحبت کنند، حتی با اشتباه، قدردانی می‌کنند.',
    },
  },
  {
    icon: 'message-circle',
    title: {
      ar: 'اللغة الأساسية للتعامل اليومي',
      en: 'Basic language for daily life',
      ru: 'Базовый язык для повседневной жизни',
      fa: 'زبان پایه برای زندگی روزمره',
    },
    body: {
      ar: 'الإنجليزية محدودة خارج المناطق السياحية والشركات، فتعلّم كلمات تركية بسيطة (مرحبا، شكراً، كم السعر، وين) بيسهّل حياتك اليومية كتير بالأسواق والمواصلات.',
      en: 'English is limited outside tourist areas and offices, so learning a few basic Turkish words (hello, thank you, how much, where) makes daily life much easier at markets and on transport.',
      ru: 'Английский язык распространён слабо за пределами туристических зон и офисов, поэтому знание нескольких базовых турецких слов (привет, спасибо, сколько стоит, где) сильно облегчает повседневную жизнь на рынках и в транспорте.',
      fa: 'انگلیسی خارج از مناطق گردشگری و ادارات محدود است، بنابراین یادگیری چند کلمه ساده ترکی (سلام، ممنون، چقدر، کجا) زندگی روزمره در بازار و حمل‌ونقل را خیلی راحت‌تر می‌کند.',
    },
  },
];
