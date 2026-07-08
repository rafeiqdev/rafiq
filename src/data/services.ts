/**
 * Rafiq Istanbul — full services catalog (single source of truth).
 *
 * Purely additive: this data file drives the new /services page. Edit text and
 * prices here in one place. Titles/descriptions are inline per-language
 * (ar/en/tr); ru/fa fall back to English at render time.
 *
 *  - serviceType 'direct'  → we provide it ourselves (own car + AR/TR/EN staff)
 *  - serviceType 'partner' → vetted partner office, we take commission
 *  - onRequest: true       → priced per booking; request → admin gives a quote
 */
import type { IconName } from '../components/AppIcon';
import { SERVICES_RU_FA } from './services-i18n';

export type ServiceType = 'direct' | 'partner';
export type Lang3 = 'ar' | 'en' | 'tr';
/** ar/en/tr are inline (source); ru/fa are merged from services-i18n at load. */
export type I18nText = Record<Lang3, string> & { ru?: string; fa?: string };

export interface ServiceCategory {
  id: string;
  icon: IconName;
  title: I18nText;
}

export interface ServiceItem {
  id: string;
  category: string;
  type: ServiceType;
  icon: IconName;
  title: I18nText;
  desc: I18nText;
  /** VIP / high-cost services priced per booking instead of a fixed price. */
  onRequest?: boolean;
}

/** Pick the best available language for a piece of catalog text (ru/fa → en if missing). */
export function pickText(text: I18nText, lang: string): string {
  return (text as Record<string, string>)[lang] ?? text.en;
}

/**
 * Normalize text for forgiving search: lowercases, strips Arabic diacritics /
 * tatweel, and unifies alef/ya/ta-marbuta variants so e.g. "اقامه" matches
 * "إقامة" and "vize" matches "vizesi".
 */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extra search synonyms per service id (Arabic + English + Turkish + common
 * misspellings). The search includes these so a near/related query still lands
 * on the right service.
 */
export const SERVICE_KEYWORDS: Record<string, string> = {
  'res-tourist': 'اقامة سياحية سياحه قصيرة المدى تقديم اول مرة tourist residence permit turist ikamet vize visa فيزا',
  'res-property': 'اقامة عقارية تملك عقار شراء بيت emlak ikameti property residence اقامه عقاريه',
  'res-work': 'اقامة عمل تصريح عمل وظيفة شغل work permit calisma izni residence',
  'res-student': 'اقامة طالب طلابية جامعة دراسة student residence ogrenci ikameti',
  'res-family': 'لم الشمل اقامة عائلية زوجة اولاد family reunification aile ikameti',
  'res-renew': 'تجديد اقامة تمديد renew residence yenileme uzatma',
  'res-rejected': 'رفض مرفوض اعتراض استئناف مشكلة اقامة rejected appeal itiraz red',
  'res-tax': 'رقم ضريبي ضريبة vergi numarasi tax number vergi no',
  'res-foreignid': 'رقم اجنبي كملك هوية yabanci kimlik foreigner id number',
  'res-appointment': 'موعد هجرة دائرة الهجرة حجز goc idaresi randevu immigration appointment',
  'res-citizenship': 'جنسية تركية تجنيس جواز تركي citizenship vatandaslik passport',
  'legal-ltd': 'تاسيس شركة محدودة ليمتد limited sirket company formation ltd',
  'legal-as': 'شركة مساهمة انونيم anonim sirket joint stock company',
  'legal-contracts': 'عقود تجارية شراكة اتفاقية contract sozlesme partnership',
  'legal-poa': 'توكيل تفويض وكالة vekalet power of attorney',
  'legal-rent': 'قضية ايجار عقار اخلاء نزاع rental dispute kira davasi eviction',
  'legal-labor': 'قضية عمل عمالية فصل حقوق labor case is davasi',
  'legal-family': 'زواج طلاق حضانة احوال شخصية divorce custody bosanma velayet',
  'legal-liquidation': 'تصفية اغلاق شركة liquidation tasfiye close company',
  'legal-consult': 'استشارة قانونية محامي محاماة lawyer avukat legal advice',
  'acc-monthly': 'محاسبة شهرية دفاتر حسابات muhasebe accounting bookkeeping',
  'acc-kdv': 'اقرار ضريبي ضريبة القيمة المضافة kdv vat tax declaration beyanname',
  'acc-payroll': 'رواتب تأمينات موظفين sgk payroll bordro salary',
  'acc-efatura': 'فاتورة الكترونية فواتير e-fatura efatura e-invoice',
  'acc-consult': 'استشارة ضريبية تخطيط ضريبي tax consulting vergi danismanligi',
  're-rent': 'ايجار شقة مفروشة سكن اجار rent apartment kiralik daire furnished',
  're-buy': 'شراء بيع عقار شقة buy sell property satilik emlak',
  're-citizenship': 'عقار جنسية استثمار citizenship property investment vatandaslik',
  're-valuation': 'تقييم عقاري تثمين ekspertiz valuation appraisal',
  're-management': 'ادارة املاك تأجير property management investor',
  're-contracts': 'عقد ايجار موثق تسجيل عنوان kira sozlesmesi notarized contract',
  'tour-airport': 'استقبال مطار توصيل سيارة airport pickup transfer havalimani karsilama',
  'tour-vip': 'في اي بي مطار استقبال خاص vip airport reception karsilama',
  'tour-daytrips': 'جولة يومية اسطنبول سياحة tour gezi istanbul daily',
  'tour-multicity': 'جولة مدن طرابزون كابادوكيا بورصة يلوا سبانجا trabzon cappadocia bursa yalova sapanca tour',
  'tour-packages': 'باقة سياحية شاملة رحلة tour package tatil holiday',
  'tour-bosphorus': 'بوسفور رحلة بحرية مضيق boat cruise bogaz tekne turu',
  'tour-driver': 'سائق خاص شوفر driver sofor chauffeur private',
  'tour-carrental': 'تاجير سيارة rent a car arac kiralama car rental',
  'tour-hotels': 'حجز فندق فنادق hotel booking otel rezervasyon',
  'tour-tickets': 'تذاكر اماكن فعاليات متحف tickets bilet events museum',
  'tr-companion': 'مترجم مرافق ترجمة مستشفى دوائر tercuman interpreter translator companion',
  'tr-sworn': 'ترجمة محلفة معتمدة تصديق yeminli sworn certified translation',
  'tr-notary': 'نوتر ابوستيل تصديق noter apostil notary apostille',
  'tr-docs': 'ترجمة وثائق اوراق document translation belge ceviri',
  'tr-medical': 'ترجمة طبية طبيب مستشفى medical interpreter saglik',
  'bank-account': 'فتح حساب بنكي مصرف بنك bank account banka hesabi open',
  'ins-residence': 'تأمين صحي اقامة تامين health insurance saglik sigortasi',
  'ins-family': 'تأمين عائلي عائلة family insurance aile sigortasi',
  'ins-carhome': 'تأمين سيارة منزل كاسكو car home insurance kasko dask',
  'bank-transfer': 'تحويل مالي حوالة money transfer havale western union',
  'tel-sim': 'شريحة جوال خط هاتف رقم turkcell vodafone sim kart line',
  'tel-internet': 'انترنت منزلي نت واي فاي internet wifi fiber',
  'tel-utilities': 'كهرباء ماء غاز عداد فواتير electric water gas elektrik su dogalgaz',
  'tel-istanbulkart': 'اسطنبول كارت مواصلات بطاقة istanbulkart transport card',
  'tel-address': 'تسجيل عنوان نفوس adres kaydi address registration',
  'health-hospitals': 'مستشفى خاص علاج قسم عربي hospital hastane treatment',
  'health-doctors': 'طبيب عربي دكتور عيادة doctor doktor clinic',
  'health-appointments': 'موعد طبي حجز دكتور appointment randevu medical',
  'health-tourism': 'زراعة شعر اسنان تجميل sac ekimi hair transplant dental aesthetic علاج',
  'edu-schools': 'تسجيل مدرسة اطفال اولاد دراسة school okul enrollment',
  'edu-denklik': 'معادلة شهادة تعديل denklik equivalency diploma',
  'edu-university': 'تسجيل جامعة قبول جامعي university universite admission',
  'edu-tomer': 'تومر لغة تركية تعلم تركي tomer turkish language turkce kursu',
  'biz-restaurant': 'مطعم كافيه رخصة فتح restaurant cafe ruhsat license',
  'biz-location': 'موقع تجاري محل مكان مشروع location shop dukkan',
  'biz-licenses': 'رخصة عمل تصريح بلدية ruhsat business license',
  'biz-supply': 'توريد معدات تجهيز supply equipment',
  'biz-hiring': 'توظيف عمالة عمال موظفين hiring staff recruitment',
  'biz-web': 'موقع متجر الكتروني برمجة تصميم website ecommerce web tasarim',
  'daily-concierge': 'مرافق شخصي مساعد concierge personal assistant',
  'daily-moving': 'نقل اثاث عفش شحن nakliyat moving furniture',
  'daily-license': 'رخصة قيادة سواقة تبديل driving license ehliyet',
  'daily-marriage': 'زواج رسمي عقد زواج اجانب marriage evlilik',
  'daily-shopping': 'تسوق مرافقة shopping alisveris personal shopper',
  'daily-emergency': 'طوارئ مساعدة عاجلة مشكلة emergency acil urgent',
  'daily-embassy': 'سفارة جواز سفر قنصلية embassy passport pasaport konsolosluk',
  'daily-reminders': 'تذكير تجديد وثائق متابعة reminder hatirlatma renewal',
};

export function keywordsFor(id: string): string {
  return SERVICE_KEYWORDS[id] ?? '';
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'residency',   icon: 'id-card',        title: { ar: 'الإقامة والمعاملات',        en: 'Residency & Official Procedures', tr: 'İkamet ve Resmî İşlemler' } },
  { id: 'legal',       icon: 'landmark',       title: { ar: 'الخدمات القانونية',          en: 'Legal Services',                 tr: 'Hukuki Hizmetler' } },
  { id: 'accounting',  icon: 'calculator',     title: { ar: 'المحاسبة والضرائب',          en: 'Accounting & Tax',               tr: 'Muhasebe ve Vergi' } },
  { id: 'realestate',  icon: 'building',       title: { ar: 'العقارات',                   en: 'Real Estate',                    tr: 'Gayrimenkul' } },
  { id: 'tourism',     icon: 'car',            title: { ar: 'السياحة والتنقل',            en: 'Tourism & Transport',            tr: 'Turizm ve Ulaşım' } },
  { id: 'translation', icon: 'languages',      title: { ar: 'الترجمة والمرافقة',          en: 'Translation & Companion',        tr: 'Tercüme ve Refakat' } },
  { id: 'banking',     icon: 'credit-card',    title: { ar: 'الخدمات البنكية والتأمين',    en: 'Banking & Insurance',            tr: 'Bankacılık ve Sigorta' } },
  { id: 'telecom',     icon: 'smartphone',     title: { ar: 'الاتصالات والمرافق',         en: 'Telecom & Utilities',            tr: 'İletişim ve Faturalar' } },
  { id: 'health',      icon: 'heart-pulse',    title: { ar: 'الصحة',                      en: 'Health',                         tr: 'Sağlık' } },
  { id: 'education',   icon: 'graduation-cap', title: { ar: 'التعليم',                    en: 'Education',                      tr: 'Eğitim' } },
  { id: 'business',    icon: 'briefcase',      title: { ar: 'تأسيس وتشغيل المشاريع',       en: 'Business Setup & Operations',    tr: 'İş Kurma ve İşletme' } },
  { id: 'daily',       icon: 'compass',        title: { ar: 'خدمات يومية وأخرى',          en: 'Daily & Other Services',         tr: 'Günlük ve Diğer Hizmetler' } },
];

export const SERVICES: ServiceItem[] = [
  // ───────────────────────── Residency (partner) ─────────────────────────
  { id: 'res-tourist', category: 'residency', type: 'partner', icon: 'id-card', title: { ar: 'إقامة سياحية (تقديم أول مرة)', en: 'Tourist residence permit (first application)', tr: 'Turistik ikamet (ilk başvuru)' }, desc: { ar: 'تجهيز الملف والتقديم على e-İkamet', en: 'File prep & e-İkamet application', tr: 'Dosya hazırlığı ve e-İkamet başvurusu' } },
  { id: 'res-property', category: 'residency', type: 'partner', icon: 'building', title: { ar: 'إقامة عقارية', en: 'Property-based residence permit', tr: 'Gayrimenkul ikameti' }, desc: { ar: 'إقامة على أساس تملّك عقار', en: 'Residence based on property ownership', tr: 'Mülk sahipliğine dayalı ikamet' } },
  { id: 'res-work', category: 'residency', type: 'partner', icon: 'briefcase', title: { ar: 'إقامة عمل', en: 'Work residence permit', tr: 'Çalışma ikameti' }, desc: { ar: 'متابعة تصريح وإقامة العمل', en: 'Work permit & residence follow-up', tr: 'Çalışma izni ve ikamet takibi' } },
  { id: 'res-student', category: 'residency', type: 'partner', icon: 'graduation-cap', title: { ar: 'إقامة طالب', en: 'Student residence permit', tr: 'Öğrenci ikameti' }, desc: { ar: 'إقامة على أساس التسجيل الجامعي', en: 'Residence based on enrollment', tr: 'Kayda dayalı öğrenci ikameti' } },
  { id: 'res-family', category: 'residency', type: 'partner', icon: 'users', title: { ar: 'لمّ الشمل العائلي', en: 'Family reunification', tr: 'Aile birleşimi' }, desc: { ar: 'إقامة عائلية للزوج/الأبناء', en: 'Family residence for spouse/children', tr: 'Eş/çocuklar için aile ikameti' } },
  { id: 'res-renew', category: 'residency', type: 'partner', icon: 'calendar', title: { ar: 'تجديد الإقامة (كل الأنواع)', en: 'Residence renewal (all types)', tr: 'İkamet yenileme (tüm türler)' }, desc: { ar: 'تجديد قبل انتهاء الصلاحية', en: 'Renew before expiry', tr: 'Süresi dolmadan yenileme' } },
  { id: 'res-rejected', category: 'residency', type: 'partner', icon: 'file-check', title: { ar: 'متابعة الطلبات المرفوضة والاعتراض', en: 'Rejected applications & appeals', tr: 'Reddedilen başvurular ve itiraz' }, desc: { ar: 'دراسة سبب الرفض وتقديم اعتراض', en: 'Review rejection & file an appeal', tr: 'Ret nedenini inceleme ve itiraz' } },
  { id: 'res-tax', category: 'residency', type: 'partner', icon: 'receipt', title: { ar: 'استخراج الرقم الضريبي', en: 'Tax number (Vergi No)', tr: 'Vergi numarası çıkarma' }, desc: { ar: 'مجاني وسريع — نتولّاه عنك', en: 'Quick — we handle it for you', tr: 'Hızlı — sizin adınıza hallederiz' } },
  { id: 'res-foreignid', category: 'residency', type: 'partner', icon: 'id-card', title: { ar: 'استخراج الرقم الأجنبي (Yabancı Kimlik)', en: 'Foreigner ID (Yabancı Kimlik)', tr: 'Yabancı Kimlik No' }, desc: { ar: 'رقم الهوية للأجانب', en: 'Foreigner identification number', tr: 'Yabancılar için kimlik numarası' } },
  { id: 'res-appointment', category: 'residency', type: 'partner', icon: 'calendar', title: { ar: 'حجز مواعيد دائرة الهجرة', en: 'Immigration office appointments', tr: 'Göç İdaresi randevusu' }, desc: { ar: 'حجز ومتابعة موعد الهجرة', en: 'Book & track migration appointments', tr: 'Göç randevusu alma ve takip' } },
  { id: 'res-citizenship', category: 'residency', type: 'partner', icon: 'star', title: { ar: 'خدمات الجنسية التركية', en: 'Turkish citizenship services', tr: 'Türk vatandaşlığı hizmetleri' }, desc: { ar: 'تجهيز ومتابعة ملف الجنسية', en: 'Prepare & follow the citizenship file', tr: 'Vatandaşlık dosyası hazırlığı ve takibi' } },

  // ───────────────────────── Legal (partner) ─────────────────────────
  { id: 'legal-ltd', category: 'legal', type: 'partner', icon: 'building', title: { ar: 'تأسيس شركة محدودة (Limited)', en: 'Limited company formation', tr: 'Limited şirket kuruluşu' }, desc: { ar: 'تأسيس Limited بالكامل', en: 'Full Limited company setup', tr: 'Eksiksiz Limited şirket kurulumu' } },
  { id: 'legal-as', category: 'legal', type: 'partner', icon: 'layers', title: { ar: 'تأسيس شركة مساهمة (Anonim)', en: 'Joint-stock company (Anonim)', tr: 'Anonim şirket kuruluşu' }, desc: { ar: 'تأسيس Anonim Şirket', en: 'Anonim Şirket formation', tr: 'Anonim şirket kurulumu' } },
  { id: 'legal-contracts', category: 'legal', type: 'partner', icon: 'file-text', title: { ar: 'العقود التجارية والشراكات', en: 'Commercial contracts & partnerships', tr: 'Ticari sözleşmeler ve ortaklıklar' }, desc: { ar: 'صياغة ومراجعة العقود', en: 'Draft & review contracts', tr: 'Sözleşme hazırlama ve inceleme' } },
  { id: 'legal-poa', category: 'legal', type: 'partner', icon: 'stamp', title: { ar: 'التوكيلات الرسمية (Vekalet)', en: 'Power of attorney (Vekalet)', tr: 'Resmî vekâlet (Vekalet)' }, desc: { ar: 'إعداد توكيل رسمي عند النوتر', en: 'Notarized power of attorney', tr: 'Noterde vekâlet hazırlığı' } },
  { id: 'legal-rent', category: 'legal', type: 'partner', icon: 'home', title: { ar: 'قضايا الإيجار والعقارات', en: 'Rental & property disputes', tr: 'Kira ve gayrimenkul davaları' }, desc: { ar: 'نزاعات الإيجار والإخلاء', en: 'Rent & eviction disputes', tr: 'Kira ve tahliye uyuşmazlıkları' } },
  { id: 'legal-labor', category: 'legal', type: 'partner', icon: 'briefcase', title: { ar: 'قضايا العمل', en: 'Labor cases', tr: 'İş davaları' }, desc: { ar: 'حقوق العمل والفصل', en: 'Employment & dismissal rights', tr: 'İşçi hakları ve fesih' } },
  { id: 'legal-family', category: 'legal', type: 'partner', icon: 'users', title: { ar: 'الأحوال الشخصية (زواج/طلاق/حضانة)', en: 'Family law (marriage/divorce/custody)', tr: 'Aile hukuku (evlilik/boşanma/velayet)' }, desc: { ar: 'قضايا الأحوال الشخصية', en: 'Personal status cases', tr: 'Aile hukuku davaları' } },
  { id: 'legal-liquidation', category: 'legal', type: 'partner', icon: 'x-circle', title: { ar: 'تصفية وإغلاق الشركات', en: 'Company liquidation & closure', tr: 'Şirket tasfiyesi ve kapanışı' }, desc: { ar: 'إغلاق الشركة قانونياً', en: 'Close the company legally', tr: 'Şirketi yasal olarak kapatma' } },
  { id: 'legal-consult', category: 'legal', type: 'partner', icon: 'message-circle', title: { ar: 'استشارة قانونية عامة', en: 'General legal consultation', tr: 'Genel hukuki danışmanlık' }, desc: { ar: 'استشارة مع محامٍ معتمد', en: 'Consult a vetted lawyer', tr: 'Onaylı avukatla danışma' } },

  // ───────────────────────── Accounting (partner) ─────────────────────────
  { id: 'acc-monthly', category: 'accounting', type: 'partner', icon: 'calculator', title: { ar: 'المحاسبة الشهرية للشركات', en: 'Monthly company accounting', tr: 'Aylık şirket muhasebesi' }, desc: { ar: 'مسك دفاتر ومتابعة شهرية', en: 'Monthly bookkeeping', tr: 'Aylık defter tutma' } },
  { id: 'acc-kdv', category: 'accounting', type: 'partner', icon: 'receipt', title: { ar: 'الإقرارات الضريبية (KDV)', en: 'Tax declarations (KDV/VAT)', tr: 'Vergi beyannameleri (KDV)' }, desc: { ar: 'إعداد وتقديم الإقرارات', en: 'Prepare & file declarations', tr: 'Beyanname hazırlama ve verme' } },
  { id: 'acc-payroll', category: 'accounting', type: 'partner', icon: 'users', title: { ar: 'إدارة الرواتب والتأمينات (SGK)', en: 'Payroll & social security (SGK)', tr: 'Bordro ve SGK yönetimi' }, desc: { ar: 'رواتب الموظفين وتأميناتهم', en: 'Employee payroll & SGK', tr: 'Personel bordrosu ve SGK' } },
  { id: 'acc-efatura', category: 'accounting', type: 'partner', icon: 'file-text', title: { ar: 'الفواتير الإلكترونية (e-Fatura)', en: 'E-invoicing (e-Fatura)', tr: 'E-Fatura' }, desc: { ar: 'إعداد نظام e-Fatura', en: 'Set up e-Fatura', tr: 'e-Fatura kurulumu' } },
  { id: 'acc-consult', category: 'accounting', type: 'partner', icon: 'lightbulb', title: { ar: 'استشارات ضريبية', en: 'Tax consulting', tr: 'Vergi danışmanlığı' }, desc: { ar: 'تخطيط ضريبي للشركات', en: 'Tax planning for businesses', tr: 'İşletmeler için vergi planlaması' } },

  // ───────────────────────── Real estate (partner) ─────────────────────────
  { id: 're-rent', category: 'realestate', type: 'partner', icon: 'home', title: { ar: 'إيجار شقق مفروشة وغير مفروشة', en: 'Furnished & unfurnished rentals', tr: 'Eşyalı ve eşyasız kiralık' }, desc: { ar: 'إيجارات سكنية مناسبة لك', en: 'Residential rentals to fit you', tr: 'Size uygun konut kiralama' } },
  { id: 're-buy', category: 'realestate', type: 'partner', icon: 'building', title: { ar: 'بيع وشراء العقارات', en: 'Buying & selling property', tr: 'Gayrimenkul alım-satım' }, desc: { ar: 'وساطة بيع وشراء موثوقة', en: 'Trusted sale/purchase brokerage', tr: 'Güvenilir alım-satım aracılığı' } },
  { id: 're-citizenship', category: 'realestate', type: 'partner', icon: 'star', title: { ar: 'عقارات مؤهلة للجنسية', en: 'Citizenship-eligible property', tr: 'Vatandaşlığa uygun gayrimenkul' }, desc: { ar: 'عقارات تحقق شرط الجنسية', en: 'Property meeting citizenship threshold', tr: 'Vatandaşlık şartını karşılayan mülk' } },
  { id: 're-valuation', category: 'realestate', type: 'partner', icon: 'file-check', title: { ar: 'التقييم العقاري (Ekspertiz)', en: 'Property valuation (Ekspertiz)', tr: 'Gayrimenkul değerleme (Ekspertiz)' }, desc: { ar: 'تقرير تقييم رسمي', en: 'Official valuation report', tr: 'Resmî değerleme raporu' } },
  { id: 're-management', category: 'realestate', type: 'partner', icon: 'briefcase', title: { ar: 'إدارة الأملاك للمستثمرين', en: 'Property management for investors', tr: 'Yatırımcılar için mülk yönetimi' }, desc: { ar: 'إدارة وتأجير نيابةً عنك', en: 'Manage & rent on your behalf', tr: 'Adınıza yönetim ve kiralama' } },
  { id: 're-contracts', category: 'realestate', type: 'partner', icon: 'stamp', title: { ar: 'عقود الإيجار الموثّقة', en: 'Notarized rental contracts', tr: 'Noter onaylı kira sözleşmeleri' }, desc: { ar: 'عقد موثّق لتسجيل العنوان', en: 'Notarized contract for address reg.', tr: 'Adres kaydı için noter sözleşmesi' } },

  // ───────────────────────── Tourism & transport (direct) ─────────────────────────
  { id: 'tour-airport', category: 'tourism', type: 'direct', icon: 'plane', title: { ar: 'استقبال وتوصيل المطار', en: 'Airport pickup & drop-off', tr: 'Havalimanı karşılama ve transfer' }, desc: { ar: 'سيارتنا الخاصة وسائق ناطق بالعربية', en: 'Our own car, Arabic-speaking driver', tr: 'Kendi aracımız, Arapça konuşan şoför' } },
  { id: 'tour-vip', category: 'tourism', type: 'direct', icon: 'star', onRequest: true, title: { ar: 'استقبال VIP من المطار', en: 'VIP airport reception', tr: 'VIP havalimanı karşılama' }, desc: { ar: 'خدمة مميزة — تُسعّر حسب الطلب', en: 'Premium — priced per booking', tr: 'Premium — talebe göre fiyatlandırılır' } },
  { id: 'tour-daytrips', category: 'tourism', type: 'direct', icon: 'map-pin', title: { ar: 'جولات يومية داخل إسطنبول', en: 'Daily tours within Istanbul', tr: 'İstanbul içi günlük turlar' }, desc: { ar: 'جولات بمرشد ناطق بالعربية', en: 'Tours with Arabic-speaking guide', tr: 'Arapça rehberli turlar' } },
  { id: 'tour-multicity', category: 'tourism', type: 'direct', icon: 'compass', title: { ar: 'جولات متعددة المدن', en: 'Multi-city tours', tr: 'Çok şehirli turlar' }, desc: { ar: 'طرابزون، كابادوكيا، بورصة، يلوا، سبانجا', en: 'Trabzon, Cappadocia, Bursa, Yalova, Sapanca', tr: 'Trabzon, Kapadokya, Bursa, Yalova, Sapanca' } },
  { id: 'tour-packages', category: 'tourism', type: 'direct', icon: 'luggage', title: { ar: 'باقات سياحية شاملة', en: 'All-inclusive tour packages', tr: 'Her şey dâhil tur paketleri' }, desc: { ar: 'برنامج كامل: نقل وفندق وجولات', en: 'Transport, hotel & tours in one plan', tr: 'Ulaşım, otel ve turlar tek pakette' } },
  { id: 'tour-bosphorus', category: 'tourism', type: 'direct', icon: 'navigation', title: { ar: 'رحلات بحرية (البوسفور)', en: 'Bosphorus cruises', tr: 'Boğaz turları' }, desc: { ar: 'رحلة بحرية في مضيق البوسفور', en: 'Cruise along the Bosphorus', tr: 'Boğaz’da tekne turu' } },
  { id: 'tour-driver', category: 'tourism', type: 'direct', icon: 'car', title: { ar: 'سائق خاص بالساعة/اليوم', en: 'Private driver (hourly/daily)', tr: 'Özel şoför (saatlik/günlük)' }, desc: { ar: 'سيارة وسائق تحت تصرّفك', en: 'Car & driver at your service', tr: 'Emrinizde araç ve şoför' } },
  { id: 'tour-carrental', category: 'tourism', type: 'direct', icon: 'car', title: { ar: 'تأجير سيارات طويل المدى', en: 'Long-term car rental', tr: 'Uzun dönem araç kiralama' }, desc: { ar: 'تأجير شهري بأسعار مناسبة', en: 'Monthly rental, fair rates', tr: 'Uygun fiyatlı aylık kiralama' } },
  { id: 'tour-hotels', category: 'tourism', type: 'direct', icon: 'hotel', title: { ar: 'حجز الفنادق', en: 'Hotel booking', tr: 'Otel rezervasyonu' }, desc: { ar: 'حجز فنادق بأفضل الأسعار', en: 'Book hotels at the best rates', tr: 'En iyi fiyatlarla otel' } },
  { id: 'tour-tickets', category: 'tourism', type: 'direct', icon: 'calendar', title: { ar: 'تذاكر الأماكن والفعاليات', en: 'Attraction & event tickets', tr: 'Mekân ve etkinlik biletleri' }, desc: { ar: 'حجز تذاكر المعالم والفعاليات', en: 'Tickets for sights & events', tr: 'Yer ve etkinlik biletleri' } },

  // ───────────────────────── Translation & companion (direct) ─────────────────────────
  { id: 'tr-companion', category: 'translation', type: 'direct', icon: 'languages', title: { ar: 'مترجم مرافق (مستشفى/دوائر/تسوّق)', en: 'Companion interpreter (hospital/offices/shopping)', tr: 'Refakatçi tercüman (hastane/daire/alışveriş)' }, desc: { ar: 'يرافقك ميدانياً ويترجم لك', en: 'On-site interpreter with you', tr: 'Yanınızda yerinde tercüman' } },
  { id: 'tr-sworn', category: 'translation', type: 'partner', icon: 'stamp', title: { ar: 'ترجمة محلّفة (عبر شريك)', en: 'Sworn translation (via partner)', tr: 'Yeminli tercüme (partner aracılığıyla)' }, desc: { ar: 'ترجمة معتمدة قانونياً', en: 'Legally certified translation', tr: 'Yasal onaylı tercüme' } },
  { id: 'tr-notary', category: 'translation', type: 'partner', icon: 'stamp', title: { ar: 'تصديق النوتر والأبوستيل (عبر شريك)', en: 'Notary & apostille (via partner)', tr: 'Noter ve apostil (partner aracılığıyla)' }, desc: { ar: 'تصديق رسمي للوثائق', en: 'Official document certification', tr: 'Resmî belge onayı' } },
  { id: 'tr-docs', category: 'translation', type: 'direct', icon: 'file-text', title: { ar: 'ترجمة الوثائق الرسمية', en: 'Official document translation', tr: 'Resmî belge tercümesi' }, desc: { ar: 'ترجمة دقيقة لوثائقك', en: 'Accurate document translation', tr: 'Belgelerinizin doğru tercümesi' } },
  { id: 'tr-medical', category: 'translation', type: 'direct', icon: 'stethoscope', title: { ar: 'الترجمة الطبية المتخصصة', en: 'Specialized medical translation', tr: 'Uzman tıbbi tercüme' }, desc: { ar: 'ترجمة طبية أثناء العلاج', en: 'Medical interpreting during care', tr: 'Tedavi sırasında tıbbi tercüme' } },

  // ───────────────────────── Banking & insurance (mixed) ─────────────────────────
  { id: 'bank-account', category: 'banking', type: 'direct', icon: 'credit-card', title: { ar: 'مرافقة فتح حساب بنكي', en: 'Bank account opening (escort)', tr: 'Banka hesabı açma (refakat)' }, desc: { ar: 'نرافقك للبنك ونترجم لك', en: 'We escort & interpret at the bank', tr: 'Bankada refakat ve tercüme' } },
  { id: 'ins-residence', category: 'banking', type: 'partner', icon: 'shield-check', title: { ar: 'التأمين الصحي للإقامة', en: 'Health insurance for residence', tr: 'İkamet için sağlık sigortası' }, desc: { ar: 'تأمين مقبول لمعاملة الإقامة', en: 'Insurance accepted for ikamet', tr: 'İkamet için geçerli sigorta' } },
  { id: 'ins-family', category: 'banking', type: 'partner', icon: 'heart-pulse', title: { ar: 'التأمين الصحي العائلي', en: 'Family health insurance', tr: 'Aile sağlık sigortası' }, desc: { ar: 'تغطية صحية للعائلة', en: 'Health cover for the family', tr: 'Aile için sağlık teminatı' } },
  { id: 'ins-carhome', category: 'banking', type: 'partner', icon: 'car', title: { ar: 'تأمين السيارات والمنزل', en: 'Car & home insurance', tr: 'Araç ve konut sigortası' }, desc: { ar: 'تأمين المركبات والممتلكات', en: 'Vehicle & property insurance', tr: 'Araç ve mülk sigortası' } },
  { id: 'bank-transfer', category: 'banking', type: 'direct', icon: 'globe', title: { ar: 'ربط بشركات التحويل المالي', en: 'Money-transfer connections', tr: 'Para transfer şirketlerine bağlama' }, desc: { ar: 'حلول تحويل مالي موثوقة', en: 'Trusted money-transfer options', tr: 'Güvenilir para transfer seçenekleri' } },

  // ───────────────────────── Telecom & utilities (direct) ─────────────────────────
  { id: 'tel-sim', category: 'telecom', type: 'direct', icon: 'smartphone', title: { ar: 'شريحة جوال تركية', en: 'Turkish SIM card', tr: 'Türk SIM kartı' }, desc: { ar: 'استخراج شريحة باسمك', en: 'Get a SIM in your name', tr: 'Adınıza SIM kart' } },
  { id: 'tel-internet', category: 'telecom', type: 'direct', icon: 'globe', title: { ar: 'إنترنت منزلي', en: 'Home internet', tr: 'Ev interneti' }, desc: { ar: 'اشتراك إنترنت للمنزل', en: 'Home internet subscription', tr: 'Ev internet aboneliği' } },
  { id: 'tel-utilities', category: 'telecom', type: 'direct', icon: 'home', title: { ar: 'اشتراكات الكهرباء/الماء/الغاز (نقل وفتح)', en: 'Electricity/water/gas (transfer & open)', tr: 'Elektrik/su/doğalgaz (devir ve açma)' }, desc: { ar: 'فتح ونقل عدادات المرافق', en: 'Open & transfer utility meters', tr: 'Sayaç açma ve devir' } },
  { id: 'tel-istanbulkart', category: 'telecom', type: 'direct', icon: 'credit-card', title: { ar: 'استخراج إسطنبول كارت', en: 'Istanbulkart issuance', tr: 'İstanbulkart çıkarma' }, desc: { ar: 'بطاقة المواصلات العامة', en: 'Public transport card', tr: 'Toplu taşıma kartı' } },
  { id: 'tel-address', category: 'telecom', type: 'direct', icon: 'map-pin', title: { ar: 'تسجيل العنوان (Adres Kaydı)', en: 'Address registration (Adres Kaydı)', tr: 'Adres kaydı' }, desc: { ar: 'تسجيل عنوان السكن رسمياً', en: 'Officially register your address', tr: 'İkamet adresini resmen kaydetme' } },

  // ───────────────────────── Health (partner) ─────────────────────────
  { id: 'health-hospitals', category: 'health', type: 'partner', icon: 'building', title: { ar: 'ربط بمستشفيات خاصة (أقسام عربية)', en: 'Private hospitals (Arabic desks)', tr: 'Özel hastaneler (Arapça birimler)' }, desc: { ar: 'مستشفيات بأقسام ناطقة بالعربية', en: 'Hospitals with Arabic-speaking desks', tr: 'Arapça birimli hastaneler' } },
  { id: 'health-doctors', category: 'health', type: 'partner', icon: 'stethoscope', title: { ar: 'أطباء ناطقون بالعربية', en: 'Arabic-speaking doctors', tr: 'Arapça konuşan doktorlar' }, desc: { ar: 'ربطك بطبيب يفهم لغتك', en: 'Matched to a doctor who speaks your language', tr: 'Dilinizi konuşan doktorla eşleştirme' } },
  { id: 'health-appointments', category: 'health', type: 'partner', icon: 'calendar', title: { ar: 'حجز المواعيد الطبية', en: 'Medical appointment booking', tr: 'Tıbbi randevu alma' }, desc: { ar: 'حجز ومتابعة المواعيد الطبية', en: 'Book & track medical appointments', tr: 'Tıbbi randevu alma ve takip' } },
  { id: 'health-tourism', category: 'health', type: 'partner', icon: 'heart-pulse', title: { ar: 'السياحة العلاجية (زراعة شعر، أسنان، تجميل)', en: 'Medical tourism (hair, dental, aesthetics)', tr: 'Sağlık turizmi (saç, diş, estetik)' }, desc: { ar: 'علاج بمستوى عالمي بأسعار مناسبة', en: 'World-class care at fair prices', tr: 'Uygun fiyata dünya standardında bakım' } },

  // ───────────────────────── Education (partner) ─────────────────────────
  { id: 'edu-schools', category: 'education', type: 'partner', icon: 'school', title: { ar: 'تسجيل الأطفال بالمدارس', en: 'School enrollment for children', tr: 'Çocuklar için okul kaydı' }, desc: { ar: 'تسجيل أبنائك في المدارس', en: 'Enroll your children in school', tr: 'Çocuklarınızı okula kaydetme' } },
  { id: 'edu-denklik', category: 'education', type: 'partner', icon: 'file-check', title: { ar: 'معادلة الشهادات (Denklik)', en: 'Diploma equivalency (Denklik)', tr: 'Diploma denkliği (Denklik)' }, desc: { ar: 'معادلة شهاداتك الدراسية', en: 'Equivalency for your diplomas', tr: 'Diplomalarınızın denkliği' } },
  { id: 'edu-university', category: 'education', type: 'partner', icon: 'graduation-cap', title: { ar: 'التسجيل الجامعي للأجانب', en: 'University admission for foreigners', tr: 'Yabancılar için üniversite kaydı' }, desc: { ar: 'قبول وتسجيل جامعي', en: 'University acceptance & enrollment', tr: 'Üniversite kabulü ve kaydı' } },
  { id: 'edu-tomer', category: 'education', type: 'partner', icon: 'languages', title: { ar: 'معاهد اللغة التركية (TÖMER)', en: 'Turkish language institutes (TÖMER)', tr: 'Türkçe dil kursları (TÖMER)' }, desc: { ar: 'تعلّم التركية في معهد معتمد', en: 'Learn Turkish at a certified institute', tr: 'Onaylı kursta Türkçe öğrenin' } },

  // ───────────────────────── Business setup (mixed) ─────────────────────────
  { id: 'biz-restaurant', category: 'business', type: 'partner', icon: 'utensils', title: { ar: 'تأسيس مطعم/كافيه (رخص بلدية وصحية)', en: 'Restaurant/café setup (permits)', tr: 'Restoran/kafe kurulumu (ruhsatlar)' }, desc: { ar: 'رخص البلدية والصحة', en: 'Municipality & health permits', tr: 'Belediye ve sağlık ruhsatları' } },
  { id: 'biz-location', category: 'business', type: 'direct', icon: 'map-pin', title: { ar: 'اختيار الموقع التجاري', en: 'Commercial location scouting', tr: 'Ticari konum seçimi' }, desc: { ar: 'دراسة واختيار موقع مناسب', en: 'Study & pick the right location', tr: 'Uygun konum analizi ve seçimi' } },
  { id: 'biz-licenses', category: 'business', type: 'partner', icon: 'file-check', title: { ar: 'رخص العمل (Ruhsat)', en: 'Business licenses (Ruhsat)', tr: 'İşyeri ruhsatı (Ruhsat)' }, desc: { ar: 'استخراج رخص التشغيل', en: 'Obtain operating licenses', tr: 'İşletme ruhsatı çıkarma' } },
  { id: 'biz-supply', category: 'business', type: 'direct', icon: 'shopping-bag', title: { ar: 'التوريد والمعدات', en: 'Supply & equipment', tr: 'Tedarik ve ekipman' }, desc: { ar: 'تجهيز معدات وتوريد مشروعك', en: 'Equip & supply your business', tr: 'İşletme ekipman ve tedariki' } },
  { id: 'biz-hiring', category: 'business', type: 'direct', icon: 'users', title: { ar: 'التوظيف والعمالة', en: 'Hiring & staffing', tr: 'İşe alım ve personel' }, desc: { ar: 'إيجاد وتوظيف العمالة', en: 'Find & hire staff', tr: 'Personel bulma ve işe alma' } },
  { id: 'biz-web', category: 'business', type: 'direct', icon: 'globe', title: { ar: 'تصميم وبناء المواقع والمتاجر الإلكترونية', en: 'Websites & online stores', tr: 'Web sitesi ve e-ticaret' }, desc: { ar: 'خبرتنا الرقمية لمشروعك', en: 'Our digital expertise for you', tr: 'İşletmeniz için dijital uzmanlığımız' } },

  // ───────────────────────── Daily & other (direct) ─────────────────────────
  { id: 'daily-concierge', category: 'daily', type: 'direct', icon: 'smile', onRequest: true, title: { ar: 'المرافق الشخصي (Concierge) — يرافقك ميدانياً', en: 'Personal concierge — on-site with you', tr: 'Kişisel concierge — yanınızda' }, desc: { ar: 'مرافق شخصي — تُسعّر حسب الطلب', en: 'Personal companion — priced per request', tr: 'Kişisel refakat — talebe göre fiyat' } },
  { id: 'daily-moving', category: 'daily', type: 'direct', icon: 'luggage', title: { ar: 'نقل الأثاث (Nakliyat)', en: 'Furniture moving (Nakliyat)', tr: 'Eşya taşıma (Nakliyat)' }, desc: { ar: 'نقل أثاثك بأمان', en: 'Move your furniture safely', tr: 'Eşyanızı güvenle taşıma' } },
  { id: 'daily-license', category: 'daily', type: 'direct', icon: 'id-card', title: { ar: 'تبديل/استخراج رخصة القيادة', en: 'Driving licence swap/issue', tr: 'Sürücü belgesi değişimi/çıkarma' }, desc: { ar: 'تبديل رخصتك أو استخراجها', en: 'Convert or obtain your licence', tr: 'Ehliyet değişimi veya çıkarma' } },
  { id: 'daily-marriage', category: 'daily', type: 'direct', icon: 'users', title: { ar: 'الزواج الرسمي للأجانب (إجراءات)', en: 'Official marriage for foreigners', tr: 'Yabancılar için resmî evlilik' }, desc: { ar: 'إنهاء إجراءات الزواج الرسمي', en: 'Complete official marriage steps', tr: 'Resmî evlilik işlemleri' } },
  { id: 'daily-shopping', category: 'daily', type: 'direct', icon: 'shopping-bag', title: { ar: 'التسوّق المرافق', en: 'Accompanied shopping', tr: 'Refakatli alışveriş' }, desc: { ar: 'نرافقك في التسوّق ونترجم', en: 'We accompany & interpret while shopping', tr: 'Alışverişte refakat ve tercüme' } },
  { id: 'daily-emergency', category: 'daily', type: 'direct', icon: 'alert-triangle', title: { ar: 'خدمة الطوارئ والمواقف الصعبة', en: 'Emergency & tough-situation help', tr: 'Acil durum ve zor durum yardımı' }, desc: { ar: 'دعم سريع وقت الحاجة', en: 'Fast support when you need it', tr: 'İhtiyaç anında hızlı destek' } },
  { id: 'daily-embassy', category: 'daily', type: 'direct', icon: 'landmark', title: { ar: 'توجيه خدمات السفارات وتجديد الجوازات', en: 'Embassy guidance & passport renewal', tr: 'Elçilik rehberliği ve pasaport yenileme' }, desc: { ar: 'إرشادك لإجراءات السفارة والجواز', en: 'Guidance for embassy & passport steps', tr: 'Elçilik ve pasaport işlemlerinde rehberlik' } },
  { id: 'daily-reminders', category: 'daily', type: 'direct', icon: 'alarm-clock', title: { ar: 'تذكير ومتابعة تجديد الوثائق الدورية', en: 'Document-renewal reminders & follow-up', tr: 'Belge yenileme hatırlatma ve takip' }, desc: { ar: 'ننبهك قبل انتهاء وثائقك', en: 'We alert you before documents expire', tr: 'Belgeleriniz dolmadan uyarırız' } },
];

// Merge ru/fa translations (services-i18n.ts) into the catalog at load, so
// pickText() resolves Russian/Persian natively instead of falling back to English.
for (const c of SERVICE_CATEGORIES) {
  const tr = SERVICES_RU_FA[c.id];
  if (tr) {
    c.title.ru = tr.title.ru;
    c.title.fa = tr.title.fa;
  }
}
for (const s of SERVICES) {
  const tr = SERVICES_RU_FA[s.id];
  if (!tr) continue;
  s.title.ru = tr.title.ru;
  s.title.fa = tr.title.fa;
  if (tr.desc) {
    s.desc.ru = tr.desc.ru;
    s.desc.fa = tr.desc.fa;
  }
}
