/**
 * Essential Istanbul apps — static directory shown on the Istanbul Tricks page.
 * Descriptions/category names are inline per-language (ar/en/ru/fa). No external
 * data source. Pick text with pickAppText().
 */
import type { IconName } from '../components/AppIcon';

export type AppLang = 'ar' | 'en' | 'ru' | 'fa';
export type LocalizedText = Record<AppLang, string>;

export interface AppCategory {
  id: string;
  icon: IconName;
  name: LocalizedText;
}

export interface AppLinks {
  web?: string;
  android?: string;
  ios?: string;
}

export interface IstanbulApp {
  cat: string;
  name: string;
  links: AppLinks;
  desc: LocalizedText;
}

const LANGS: AppLang[] = ['ar', 'en', 'ru', 'fa'];
export function pickAppText(obj: LocalizedText, lang: string): string {
  const l = (LANGS.includes(lang as AppLang) ? lang : 'en') as AppLang;
  return obj[l] ?? obj.en;
}

export const APP_CATEGORIES: AppCategory[] = [
  { id: 'gov', icon: 'id-card', name: { ar: 'الإقامة والخدمات الحكومية', en: 'Residence & Government', ru: 'ВНЖ и госуслуги', fa: 'اقامت و خدمات دولتی' } },
  { id: 'transit', icon: 'bus', name: { ar: 'بطاقة إسطنبول والنقل العام', en: 'İstanbulkart & Public Transport', ru: 'İstanbulkart и транспорт', fa: 'کارت استانبول و حمل‌ونقل' } },
  { id: 'taxi', icon: 'car', name: { ar: 'سيارات الأجرة والسكوتر', en: 'Taxi & Scooter', ru: 'Такси и самокаты', fa: 'تاکسی و اسکوتر' } },
  { id: 'food', icon: 'utensils-crossed', name: { ar: 'توصيل الطعام والبقالة', en: 'Food & Grocery Delivery', ru: 'Доставка еды и продуктов', fa: 'تحویل غذا و خواربار' } },
  { id: 'shop', icon: 'shopping-bag', name: { ar: 'التسوّق وبيع/شراء الأغراض', en: 'Shopping & Buy/Sell', ru: 'Покупки и продажа', fa: 'خرید و فروش' } },
];

export const ISTANBUL_APPS: IstanbulApp[] = [
  { cat: 'gov', name: 'e-Devlet', links: { web: 'https://www.turkiye.gov.tr' }, desc: { ar: 'بوابة الحكومة: الإقامة، الضرائب، التأمين، العنوان وكل المعاملات الرسمية.', en: 'Government portal: residence, taxes, insurance, address and all official paperwork.', ru: 'Госпортал: ВНЖ, налоги, страховка, адрес и все официальные документы.', fa: 'درگاه دولت: اقامت، مالیات، بیمه، آدرس و همه کارهای رسمی.' } },
  { cat: 'gov', name: 'e-İkamet', links: { web: 'https://e-ikamet.goc.gov.tr' }, desc: { ar: 'دائرة الهجرة: تقديم وتجديد ومتابعة طلب الإقامة.', en: 'Migration office: apply, renew and track your residence permit.', ru: 'Миграционная служба: подача, продление и отслеживание ВНЖ.', fa: 'اداره مهاجرت: درخواست، تمدید و پیگیری اقامت.' } },
  { cat: 'transit', name: 'İstanbulkart', links: { android: 'https://play.google.com/store/apps/details?id=com.belbim.istanbulkart', ios: 'https://apps.apple.com/tr/app/i-stanbulkart-dijital-hesab%C4%B1m/id1352307391' }, desc: { ar: 'البطاقة الرقمية للنقل: شحن الرصيد، الدفع بـ QR، الاشتراكات.', en: 'Digital transit card: top-up, QR payment, subscription passes.', ru: 'Цифровая транспортная карта: пополнение, оплата QR, абонементы.', fa: 'کارت دیجیتال حمل‌ونقل: شارژ، پرداخت QR، اشتراک.' } },
  { cat: 'transit', name: 'İstanbul Senin', links: { android: 'https://play.google.com/store/apps/details?id=com.tr.gov.ibb.istanbulsenin', ios: 'https://apps.apple.com/us/app/i-stanbul-senin/id1534342254' }, desc: { ar: 'تطبيق البلدية الشامل: «كيف أصل؟»، مواعيد الباصات، محفظة، واي فاي مجاني.', en: 'City super-app: How do I get there?, bus times, wallet, free Wi-Fi.', ru: 'Супер-приложение города: Как доехать?, расписание, кошелёк, Wi-Fi.', fa: 'ابرنرم‌افزار شهر: چطور برسم؟، زمان اتوبوس، کیف پول، وای‌فای رایگان.' } },
  { cat: 'transit', name: 'Metro İstanbul', links: { web: 'https://iett.istanbul/en', ios: 'https://apps.apple.com/tr/app/metro-i-stanbul/id570644574' }, desc: { ar: 'خرائط ومواعيد المترو والخطوط.', en: 'Metro maps, lines and schedules.', ru: 'Карты, линии и расписание метро.', fa: 'نقشه، خطوط و زمان‌بندی مترو.' } },
  { cat: 'taxi', name: 'BiTaksi', links: { web: 'https://bitaksi.com' }, desc: { ar: 'الأشهر لطلب تاكسي بعدّاد ويقلّل الاحتيال.', en: 'Most popular metered-taxi app; reduces scams.', ru: 'Самое популярное приложение такси по счётчику; меньше обмана.', fa: 'محبوب‌ترین اپ تاکسی کنتوری؛ کاهش کلاهبرداری.' } },
  { cat: 'taxi', name: 'iTaksi', links: { web: 'https://itaksi.istanbul' }, desc: { ar: 'تطبيق البلدية الرسمي، تعرفة مضبوطة بلا زيادات.', en: 'Official municipal taxi app; fixed regulated fares.', ru: 'Официальное муниципальное такси; фиксированные тарифы.', fa: 'اپ رسمی تاکسی شهرداری؛ کرایه ثابت و مصوب.' } },
  { cat: 'taxi', name: 'Uber', links: { web: 'https://www.uber.com' }, desc: { ar: 'يربطك بتاكسي مرخّص في إسطنبول.', en: 'Connects you with licensed taxis in Istanbul.', ru: 'Связывает с лицензированными такси в Стамбуле.', fa: 'شما را به تاکسی‌های مجاز استانبول وصل می‌کند.' } },
  { cat: 'taxi', name: 'Martı', links: { web: 'https://www.marti.tech' }, desc: { ar: 'سكوتر كهربائي ومشاركة رحلات في المدينة.', en: 'E-scooters and ride-sharing around the city.', ru: 'Электросамокаты и совместные поездки по городу.', fa: 'اسکوتر برقی و سواری اشتراکی در شهر.' } },
  { cat: 'food', name: 'Yemeksepeti', links: { web: 'https://www.yemeksepeti.com' }, desc: { ar: 'الأكبر والأقدم لتوصيل الطعام، بواجهة إنجليزية.', en: 'Largest and oldest food-delivery network; English interface.', ru: 'Крупнейшая и старейшая доставка еды; английский интерфейс.', fa: 'بزرگ‌ترین و قدیمی‌ترین شبکه تحویل غذا؛ رابط انگلیسی.' } },
  { cat: 'food', name: 'Getir', links: { web: 'https://www.getir.com' }, desc: { ar: 'الأسرع لتوصيل البقالة والطعام خلال دقائق.', en: 'Fastest grocery & food delivery in minutes.', ru: 'Самая быстрая доставка продуктов и еды за минуты.', fa: 'سریع‌ترین تحویل خواربار و غذا در چند دقیقه.' } },
  { cat: 'food', name: 'Trendyol Go', links: { web: 'https://www.trendyol.com' }, desc: { ar: 'توصيل طعام بخصومات كبيرة وعروض يومية.', en: 'Food delivery with big discounts and daily deals.', ru: 'Доставка еды с большими скидками и акциями.', fa: 'تحویل غذا با تخفیف‌های زیاد و پیشنهادهای روزانه.' } },
  { cat: 'shop', name: 'Sahibinden', links: { web: 'https://www.sahibinden.com' }, desc: { ar: 'الأشهر لكل شيء: سيارات، عقارات، أثاث مستعمل، وظائف.', en: 'The go-to for everything: cars, property, used goods, jobs.', ru: 'Всё в одном: авто, недвижимость, б/у вещи, работа.', fa: 'همه‌چیز در یک‌جا: خودرو، ملک، کالای دست‌دوم، شغل.' } },
  { cat: 'shop', name: 'Dolap', links: { android: 'https://play.google.com/store/apps/details?id=com.dolap.android', ios: 'https://apps.apple.com/us/app/dolap-i-kinci-el-al%C4%B1%C5%9Fveri%C5%9F/id1127881507' }, desc: { ar: 'بيع وشراء الملابس والأغراض المستعملة (من Trendyol).', en: 'Buy & sell used clothes and items (by Trendyol).', ru: 'Покупка и продажа б/у одежды и вещей (от Trendyol).', fa: 'خرید و فروش لباس و وسایل دست‌دوم (از Trendyol).' } },
  { cat: 'shop', name: 'Letgo', links: { web: 'https://www.letgo.com' }, desc: { ar: 'بيع وشراء محلي قرب حيّك مباشرة.', en: 'Local buy & sell with people near you.', ru: 'Местная купля-продажа рядом с вами.', fa: 'خرید و فروش محلی نزدیک شما.' } },
  { cat: 'shop', name: 'Trendyol', links: { web: 'https://www.trendyol.com' }, desc: { ar: 'أكبر متجر إلكتروني تركي لكل المنتجات.', en: 'Turkey’s biggest online store for everything.', ru: 'Крупнейший интернет-магазин Турции.', fa: 'بزرگ‌ترین فروشگاه آنلاین ترکیه.' } },
  { cat: 'shop', name: 'Hepsiburada', links: { web: 'https://www.hepsiburada.com' }, desc: { ar: 'منافس رئيسي للتسوّق الإلكتروني.', en: 'Major e-commerce competitor.', ru: 'Крупный конкурент в e-commerce.', fa: 'رقیب اصلی تجارت الکترونیک.' } },
];
