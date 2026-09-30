/**
 * The smart assistant's map of the whole site.
 *
 * One place that says what every page is, where it lives, what it is called in
 * each language and which words point at it. It feeds three things:
 *   1. the assistant's prompt (api/ai-chat.ts) — so it knows every section;
 *   2. the link buttons under its replies (chatLinks.ts / ChatLinks.tsx);
 *   3. an offline matcher that still finds the right page when the AI is down.
 *
 * Pure data + string helpers, no React and no catalog import: the edge function
 * imports this file, and services.ts drags in ~2 MB of SEO text it cannot afford.
 *
 * Link ids the assistant may emit:
 *   news                 a destination below
 *   service:<id>         /services/<id>
 *   category:<id>        /services?category=<id>
 *   guide:<id>           /guides/<id>
 */
import { CATEGORY_INDEX, SERVICE_INDEX } from './serviceIndex.generated.js';

export type SiteLang = 'ar' | 'en' | 'ru' | 'fa';

export interface SiteDestination {
  id: string;
  /** Router path, language-relative — the router basename adds /ar, /en, … */
  path: string;
  label: Record<SiteLang, string>;
  /** Plain-English description handed to the assistant: what a visitor finds here. */
  about: string;
  /** Phrases (any language) that point at this page, for the offline matcher. */
  keywords: string[];
  /** Needs a signed-in account — the chat always is, so this only steers wording. */
  needsAuth?: boolean;
}

export const SITE_MAP: readonly SiteDestination[] = [
  {
    id: 'home',
    path: '/',
    label: { ar: 'الصفحة الرئيسية', en: 'Home page', ru: 'Главная страница', fa: 'صفحه اصلی' },
    about: 'The home page: an overview of Rafiq, its main sections, featured services and news.',
    keywords: ['الصفحه الرئيسيه', 'الرئيسيه', 'home page', 'homepage', 'главная', 'صفحه اصلي'],
  },
  {
    id: 'services',
    path: '/services',
    label: { ar: 'كل الخدمات', en: 'All services', ru: 'Все услуги', fa: 'همه خدمات' },
    about:
      'The full services catalogue, grouped by category (residence permits, legal, accounting and tax, real estate, tourism and transport, translation and companion, banking and insurance, telecom, health, education, business setup, daily services). Every service has its own page with a request button. Rafiq either performs a service itself or passes it to a vetted partner office.',
    keywords: ['كل الخدمات', 'قائمه الخدمات', 'الخدمات', 'all services', 'services list', 'your services', 'все услуги', 'каталог услуг', 'همه خدمات', 'فهرست خدمات'],
  },
  {
    id: 'realestate',
    path: '/real-estate',
    label: { ar: 'صفحة العقارات', en: 'Real estate page', ru: 'Страница недвижимости', fa: 'صفحه املاک' },
    about:
      'Real-estate listings in Istanbul with search and filters, and a marker for listings that qualify for Turkish citizenship by investment. For people who want to see or buy property.',
    keywords: ['عقار', 'شقق', 'شقه', 'بيت للبيع', 'منزل للبيع', 'تملك', 'تمليك', 'real estate', 'property', 'properties', 'apartment', 'flat for sale', 'house for sale', 'недвижим', 'квартир', 'املاك', 'ملك', 'اپارتمان', 'آپارتمان', 'خريد خانه'],
  },
  {
    id: 'investments',
    path: '/real-estate/investments',
    label: { ar: 'فرص الاستثمار العقاري', en: 'Investment opportunities', ru: 'Инвестиционные проекты', fa: 'فرصت‌های سرمایه‌گذاری' },
    about: 'Curated real-estate investment projects in Turkey, for people who want to invest rather than just buy a home.',
    keywords: ['فرص الاستثمار', 'استثمار عقاري', 'مشاريع استثماريه', 'investment opportunit', 'investment project', 'invest in', 'инвестиц', 'سرمايه گذاري', 'سرمایه‌گذاری', 'سرمایه گذاری'],
  },
  {
    id: 'propertyResidence',
    path: '/real-estate/residence-permit',
    label: { ar: 'الإقامة عبر العقار', en: 'Residence through property', ru: 'ВНЖ через недвижимость', fa: 'اقامت از طریق ملک' },
    about: 'An information page on getting a residence permit by owning property in Turkey.',
    keywords: ['اقامه عقاريه', 'اقامه بالعقار', 'اقامه عن طريق العقار', 'اقامه مقابل عقار', 'residence through property', 'property residence', 'residence permit by property', 'внж через недвижим', 'внж при покупке'],
  },
  {
    id: 'health',
    path: '/health-tourism',
    label: { ar: 'السياحة العلاجية', en: 'Medical tourism', ru: 'Медицинский туризм', fa: 'گردشگری درمانی' },
    about:
      'Medical tourism: hospitals and treatments in Istanbul for people travelling for care, with a request form that a Rafiq medical coordinator follows up.',
    keywords: ['سياحه علاجيه', 'السياحه العلاجيه', 'علاج في تركيا', 'زراعه شعر', 'عمليه تجميل', 'تجميل اسنان', 'medical tourism', 'health tourism', 'hair transplant', 'dental', 'treatment in turkey', 'медицинск', 'пересадка волос', 'лечение в турции', 'گردشگري درماني', 'گردشگری درمانی', 'کاشت مو', 'درمان در ترکیه'],
  },
  {
    id: 'news',
    path: '/news',
    label: { ar: 'صفحة الأخبار', en: 'News page', ru: 'Новости', fa: 'صفحه اخبار' },
    about:
      'The latest news that matters to foreigners in Turkey (residence and legal changes, rules, announcements), gathered from reliable sources and Rafiq\'s own channel.',
    keywords: ['اخبار', 'مستجدات', 'جديد القوانين', 'news', 'latest updates', 'новост'],
  },
  {
    id: 'tricks',
    path: '/tricks',
    label: { ar: 'حيل إسطنبول', en: 'Istanbul tricks', ru: 'Лайфхаки Стамбула', fa: 'ترفندهای استانبول' },
    about: 'Apps and shortcuts that locals know and use to make daily life in Istanbul easier.',
    keywords: ['حيل اسطنبول', 'حيل', 'تطبيقات مفيده', 'اختصارات', 'istanbul tricks', 'life hack', 'lifehack', 'useful apps', 'tips and tricks', 'лайфхак', 'полезные приложения', 'ترفند', 'اپ هاي مفيد'],
  },
  {
    id: 'map',
    path: '/map',
    label: { ar: 'الخريطة', en: 'Map', ru: 'Карта', fa: 'نقشه' },
    about: 'An interactive map of places and services around Istanbul, with recommendations reviewed by Rafiq.',
    keywords: ['الخريطه', 'خريطه', 'خارطه', 'على الخريطه', 'map of', 'the map', 'nearby places', 'карта', 'на карте', 'نقشه'],
  },
  {
    id: 'referrals',
    path: '/referrals',
    label: { ar: 'ادعُ واربح', en: 'Invite & earn', ru: 'Приглашай и зарабатывай', fa: 'دعوت و درآمد' },
    about: 'Invite friends with a personal link and earn a 5% commission when they use Rafiq.',
    keywords: ['ادعو واربح', 'ادعُ واربح', 'دعوه اصدقاء', 'عموله', 'رابط الاحاله', 'كود الاحاله', 'referral', 'invite friends', 'earn commission', 'реферал', 'пригласить друзей', 'معرفي', 'دعوت دوستان', 'کمیسیون'],
  },
  {
    id: 'wallet',
    path: '/wallet',
    label: { ar: 'محفظتي', en: 'My wallet', ru: 'Мой кошелёк', fa: 'کیف پول من' },
    about: 'The user\'s referral wallet: earned commissions and payout requests.',
    keywords: ['محفظتي', 'المحفظه', 'سحب الارباح', 'my wallet', 'withdraw earnings', 'payout', 'кошелек', 'кошелёк', 'کيف پول', 'کیف پول'],
    needsAuth: true,
  },
  {
    id: 'journey',
    path: '/journey',
    label: { ar: 'مسيرتي', en: 'My journey', ru: 'Мой путь', fa: 'مسیر من' },
    about: 'A personal checklist of the steps for settling in Turkey, with progress tracking.',
    keywords: ['مسيرتي', 'خطواتي', 'قائمه الخطوات', 'my journey', 'my checklist', 'settling checklist', 'мой путь', 'чек-лист', 'مسير من'],
    needsAuth: true,
  },
  {
    id: 'dashboard',
    path: '/home',
    label: { ar: 'لوحتي الشخصية', en: 'My dashboard', ru: 'Мой кабинет', fa: 'داشبورد من' },
    about: 'The user\'s personal dashboard: next steps, suggested services and progress.',
    keywords: ['لوحتي', 'لوحه التحكم', 'my dashboard', 'личный кабинет', 'мой кабинет', 'داشبورد'],
    needsAuth: true,
  },
  {
    id: 'requests',
    path: '/requests',
    label: { ar: 'طلباتي', en: 'My requests', ru: 'Мои заявки', fa: 'درخواست‌های من' },
    about: 'The status of service requests the user already sent, price offers from Rafiq, and payments.',
    keywords: ['طلباتي', 'حاله طلبي', 'وين طلبي', 'my requests', 'my orders', 'request status', 'мои заявки', 'статус заявки', 'درخواست هاي من', 'درخواست‌های من'],
    needsAuth: true,
  },
  {
    id: 'consultation',
    path: '/help?book=1',
    label: { ar: 'احجز استشارة مجانية', en: 'Book a free consultation', ru: 'Записаться на бесплатную консультацию', fa: 'رزرو مشاوره رایگان' },
    about: 'Book a free first consultation with a human Rafiq advisor.',
    keywords: ['استشاره مجانيه', 'احجز موعد', 'حجز موعد', 'اكلم مستشار', 'مستشار بشري', 'book a consultation', 'book an appointment', 'free consultation', 'talk to an advisor', 'talk to a human', 'записаться на консультацию', 'бесплатная консультация', 'مشاوره رايگان', 'مشاوره رایگان', 'وقت مشاوره'],
  },
  {
    id: 'faq',
    path: '/faq',
    label: { ar: 'الأسئلة الشائعة', en: 'FAQ', ru: 'Частые вопросы', fa: 'سؤالات متداول' },
    about: 'Frequently asked questions about Rafiq and living in Turkey.',
    keywords: ['الاسئله الشائعه', 'اسئله شائعه', 'faq', 'frequently asked', 'частые вопросы', 'سوالات متداول', 'سؤالات متداول'],
  },
  {
    id: 'about',
    path: '/about',
    label: { ar: 'من نحن', en: 'About Rafiq', ru: 'О Rafiq', fa: 'درباره رفیق' },
    about: 'Who Rafiq is and what the service does.',
    keywords: ['من نحن', 'من انتم', 'عن رفيق', 'about rafiq', 'about us', 'who are you', 'о нас', 'кто вы', 'درباره ما', 'درباره رفيق', 'درباره رفیق'],
  },
  {
    id: 'contact',
    path: '/contact',
    label: { ar: 'تواصل معنا', en: 'Contact us', ru: 'Связаться с нами', fa: 'تماس با ما' },
    about: 'How to reach the Rafiq team (WhatsApp, email).',
    keywords: ['تواصل معنا', 'رقم الواتساب', 'واتساب', 'ايميل', 'contact', 'whatsapp', 'email you', 'контакты', 'связаться', 'تماس با ما', 'تماس'],
  },
  {
    id: 'profile',
    path: '/profile',
    label: { ar: 'ملفي الشخصي', en: 'My profile', ru: 'Мой профиль', fa: 'پروفایل من' },
    about: 'The user\'s profile and account settings.',
    keywords: ['ملفي', 'حسابي', 'بياناتي', 'my profile', 'my account', 'account settings', 'мой профиль', 'мой аккаунт', 'پروفايل', 'پروفایل', 'حساب من'],
    needsAuth: true,
  },
  {
    id: 'notifications',
    path: '/notifications',
    label: { ar: 'الإشعارات', en: 'Notifications', ru: 'Уведомления', fa: 'اعلان‌ها' },
    about: 'The user\'s notifications.',
    keywords: ['الاشعارات', 'اشعارات', 'notifications', 'уведомлен', 'اعلان ها', 'اعلان‌ها'],
    needsAuth: true,
  },
  {
    id: 'forCompanies',
    path: '/company/register',
    label: { ar: 'للشركات', en: 'For companies', ru: 'Для компаний', fa: 'برای شرکت‌ها' },
    about: 'For businesses that want to register with Rafiq as a service provider.',
    keywords: ['للشركات', 'تسجيل شركه', 'شركه تقدم خدمات', 'for companies', 'register my company', 'list my business', 'для компаний', 'зарегистрировать компанию', 'براي شركت', 'برای شرکت'],
  },
  {
    id: 'terms',
    path: '/terms',
    label: { ar: 'شروط الخدمة', en: 'Terms of service', ru: 'Условия использования', fa: 'شرایط خدمات' },
    about: 'The terms of service.',
    keywords: ['شروط الخدمه', 'الشروط والاحكام', 'terms of service', 'terms and conditions', 'условия использования', 'شرايط خدمات', 'شرایط خدمات'],
  },
  {
    id: 'privacy',
    path: '/privacy',
    label: { ar: 'سياسة الخصوصية', en: 'Privacy policy', ru: 'Политика конфиденциальности', fa: 'سیاست حریم خصوصی' },
    about: 'The privacy policy (KVKK): what data Rafiq keeps and why.',
    keywords: ['سياسه الخصوصيه', 'الخصوصيه', 'بياناتي الشخصيه', 'privacy', 'kvkk', 'my data', 'конфиденциальност', 'حريم خصوصي', 'حریم خصوصی'],
  },
  {
    id: 'refund',
    path: '/refund',
    label: { ar: 'سياسة الاسترداد', en: 'Refund policy', ru: 'Политика возврата', fa: 'سیاست بازپرداخت' },
    about: 'The refund policy.',
    keywords: ['سياسه الاسترداد', 'استرداد', 'استرجاع المبلغ', 'refund', 'возврат', 'بازپرداخت', 'بازگشت وجه'],
  },
];

const DESTINATION_BY_ID = new Map(SITE_MAP.map((d) => [d.id, d]));
const SERVICE_IDS = new Set(SERVICE_INDEX.map((s) => s.id));
const CATEGORY_IDS = new Set(CATEGORY_INDEX.map((c) => c.id));

export type ParsedLink =
  | { kind: 'page'; id: string }
  | { kind: 'service'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'guide'; id: string };

/** Split a link id into its kind + target, or null when it points at nothing real. */
export function parseLinkId(raw: string): ParsedLink | null {
  const id = raw.trim();
  const colon = id.indexOf(':');
  if (colon === -1) return DESTINATION_BY_ID.has(id) ? { kind: 'page', id } : null;
  const kind = id.slice(0, colon);
  const target = id.slice(colon + 1);
  if (kind === 'service' && SERVICE_IDS.has(target)) return { kind: 'service', id: target };
  if (kind === 'category' && CATEGORY_IDS.has(target)) return { kind: 'category', id: target };
  if (kind === 'guide' && CATEGORY_IDS.has(target)) return { kind: 'guide', id: target };
  return null;
}

/** Only real pages survive — a model that invents an id simply loses that button. */
export function isKnownLinkId(id: string): boolean {
  return parseLinkId(id) !== null;
}

/** Language-relative router path for a link id, or null when the id is unknown. */
export function linkPath(id: string): string | null {
  const p = parseLinkId(id);
  if (!p) return null;
  switch (p.kind) {
    case 'page':
      return DESTINATION_BY_ID.get(p.id)!.path;
    case 'service':
      return `/services/${p.id}`;
    case 'category':
      return `/services?category=${p.id}`;
    case 'guide':
      return `/guides/${p.id}`;
  }
}

export function getDestination(id: string): SiteDestination | undefined {
  return DESTINATION_BY_ID.get(id);
}

export function siteLang(lang: string): SiteLang {
  const base = (lang || 'en').split('-')[0];
  return (['ar', 'en', 'ru', 'fa'].includes(base) ? base : 'en') as SiteLang;
}

// ---------- offline matcher --------------------------------------------------

/**
 * Forgiving text for keyword matching: lower-case, no Arabic diacritics or
 * tatweel, alef/ya/ta-marbuta variants unified, and Persian ye/kaf folded into
 * their Arabic forms so one keyword list serves both Arabic and Persian.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/\s+/g, ' ')
    .trim();
}

const isArabicScript = (s: string) => /[؀-ۿ]/.test(s);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A keyword has to START a word. Arabic/Persian words take one-letter prefixes
 * ("ال", "ب", "و", "ل"…), so those are allowed in front — that is what lets
 * "اخبار" find "الاخبار", while "خبر" inside "أخبرني" (= "tell me") is not a
 * match. Latin and Cyrillic keywords are prefix matches too, so "map" does not
 * fire inside "example" but "недвижим" still catches "недвижимость".
 */
function keywordHits(haystack: string, keyword: string): boolean {
  const k = normalizeForMatch(keyword);
  if (!k) return false;
  const pattern = isArabicScript(k)
    ? `(?<![\u0600-\u06FF])(?:وال|بال|فال|كال|لل|ال|و|ب|ل|ف|ك)?${escapeRe(k)}`
    : `(?<![\\p{L}\\p{N}])${escapeRe(k)}`;
  return new RegExp(pattern, 'u').test(haystack);
}

/** Destination ids whose keywords appear in the text, best match first. */
export function matchDestinations(text: string, max = 2): string[] {
  const haystack = normalizeForMatch(text);
  if (!haystack) return [];
  const scored: { id: string; score: number; order: number }[] = [];
  SITE_MAP.forEach((d, order) => {
    const score = d.keywords.reduce((n, k) => n + (keywordHits(haystack, k) ? 1 : 0), 0);
    if (score > 0) scored.push({ id: d.id, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, max).map((s) => s.id);
}

/** Phrases that mean "show me / where is / take me to" — someone asking to be sent somewhere. */
const NAVIGATION_PHRASES = [
  // ar
  'وين', 'فين', 'اين', 'شوف', 'اشوف', 'اتصفح', 'تصفح', 'افتح', 'خذني', 'وديني', 'رابط', 'صفحه', 'قسم', 'اروح', 'ادخل', 'اريد ان ارى', 'ابغى اشوف', 'بدي شوف',
  // en
  'where', 'show me', 'take me', 'go to', 'open the', 'link to', 'page', 'section', 'browse', 'how do i see', 'where can i',
  // ru
  'где', 'покажи', 'открой', 'перейти', 'страниц', 'раздел', 'посмотреть',
  // fa
  'کجا', 'نشان بده', 'باز کن', 'بخش', 'ببينم', 'ببینم',
];

export function hasNavigationIntent(text: string): boolean {
  const haystack = normalizeForMatch(text);
  return NAVIGATION_PHRASES.some((p) => keywordHits(haystack, p));
}

/** Drop repeats and anything unknown, keeping order and at most `max` links. */
export function cleanLinkIds(ids: readonly string[], max = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id) || !isKnownLinkId(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
