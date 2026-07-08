/**
 * Service guides data layer.
 *
 * Arabic is the source of truth (parsed from rafiq-78-services-guides-AR.md into
 * guides-ar.json by bgtool/parse-guides.mjs). Other languages are translated
 * incrementally into TRANSLATIONS; any untranslated language falls back to Arabic.
 * Guides are matched to the existing catalog services by Arabic name (so the
 * card title/icon/type come from the i18n'd service).
 */
import guidesArr from './guides-ar.json';
import { SERVICES } from './services';
import type { ServiceItem } from './services';

export interface GuideSections {
  intro: string;
  whoFor: string;
  documents: string[];
  steps: string[];
  duration: string;
  cost: string;
  mistakes: string[];
  rafiqHelp: string;
}
export interface GuideEntry extends GuideSections {
  slug: string;
  name: string;
  category: string;
  type: string;
}

const clean = (s: string) => (s || '').replace(/\s*-{3,}\s*/g, ' ').trim();

const AR: GuideEntry[] = (guidesArr as GuideEntry[]).map((g) => ({
  ...g,
  intro: clean(g.intro),
  rafiqHelp: clean(g.rafiqHelp),
  cost: clean(g.cost),
  duration: clean(g.duration),
  whoFor: clean(g.whoFor),
}));

export const GUIDE_BY_SLUG: Record<string, GuideEntry> = Object.fromEntries(AR.map((g) => [g.slug, g]));
export const GUIDE_SLUGS = AR.map((g) => g.slug);

// match service ⇄ guide by core Arabic name (ignore parenthetical Turkish terms)
const norm = (s: string) =>
  (s || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();

const SERVICE_BY_NAME: Record<string, ServiceItem> = {};
for (const s of SERVICES) SERVICE_BY_NAME[norm(s.title.ar)] = s;

const SLUG_FOR_SERVICE: Record<string, string> = {};
export const SERVICE_FOR_SLUG: Record<string, ServiceItem | undefined> = {};
for (const g of AR) {
  const svc = SERVICE_BY_NAME[norm(g.name)];
  SERVICE_FOR_SLUG[g.slug] = svc;
  if (svc) SLUG_FOR_SERVICE[svc.id] = g.slug;
}

/** Guide slug for a catalog service id (if a guide exists for it). */
export function guideSlugForServiceId(id: string): string | undefined {
  return SLUG_FOR_SERVICE[id];
}

type Lang = 'ar' | 'en' | 'ru' | 'fa';

// Professional translations. Partial fields override Arabic; missing fields fall
// back to Arabic. (Batch 1 — design samples; remaining guides added in batches.)
const TRANSLATIONS: Record<string, Partial<Record<Lang, Partial<GuideSections>>>> = {
  'tourist-residence-permit': {
    en: {
      intro: 'The most common residence permit for people starting out in Istanbul — usually for one or two years on a tourist basis. We prepare your file and apply on the e-İkamet system.',
      whoFor: "Newly-arrived foreigners who want to stay legally beyond the visa / visa-exemption period and don't qualify on another basis (work, study, property).",
      documents: ['Valid passport (ideally valid beyond the requested residence period).', 'Recent biometric photos.', 'Tax number (Vergi No).', 'Valid health insurance accepted for residence.', 'Proof of a registered address (notarized rental contract + address registration).', 'Fee payment receipt.'],
      steps: ['Get your tax number.', 'Obtain health insurance for residence.', 'Register your address (notarized rental contract).', 'Fill the e-İkamet application and book the appointment.', 'Attend the appointment with your documents and give fingerprints.', 'Receive the card by mail.'],
      duration: 'A few weeks until the card arrives — varies with appointment demand.',
      cost: 'Card fee + permit fee (varies by nationality and duration) + insurance cost. The total is confirmed on request.',
      mistakes: ["Signing a rental contract in a district 'closed' to new residence registrations — check before signing.", "Health insurance that isn't accepted or has expired.", "Photos that don't meet the biometric specs."],
      rafiqHelp: 'Through a vetted partner we prepare your full file, make sure your district is open, and book and follow up your appointment until you receive the card.',
    },
    ru: {
      intro: 'Самый распространённый вид на жительство для тех, кто начинает жизнь в Стамбуле — обычно на один–два года на туристической основе. Мы готовим ваш файл и подаём в системе e-İkamet.',
      whoFor: 'Недавно приехавшие иностранцы, желающие остаться легально дольше визы / безвиза и не подходящие под другие основания (работа, учёба, недвижимость).',
      documents: ['Действующий паспорт (желательно дольше срока запрашиваемого ВНЖ).', 'Свежие биометрические фото.', 'Налоговый номер (Vergi No).', 'Действующая медстраховка, принимаемая для ВНЖ.', 'Подтверждение зарегистрированного адреса (нотариальный договор аренды + регистрация адреса).', 'Квитанция об оплате пошлины.'],
      steps: ['Получите налоговый номер.', 'Оформите медстраховку для ВНЖ.', 'Зарегистрируйте адрес (нотариальный договор аренды).', 'Заполните заявку e-İkamet и запишитесь на приём.', 'Придите на приём с документами и сдайте отпечатки.', 'Получите карту по почте.'],
      duration: 'Несколько недель до получения карты — зависит от загрузки записи.',
      cost: 'Сбор за карту + сбор за разрешение (зависит от гражданства и срока) + стоимость страховки. Итог уточняется по запросу.',
      mistakes: ['Подписание договора аренды в районе, «закрытом» для новых регистраций ВНЖ — проверьте до подписания.', 'Непринимаемая или просроченная медстраховка.', 'Фото, не соответствующие биометрическим требованиям.'],
      rafiqHelp: 'Через проверенного партнёра мы готовим весь ваш файл, проверяем, открыт ли район, записываем и сопровождаем приём до получения карты.',
    },
    fa: {
      intro: 'رایج‌ترین اجازه اقامت برای کسانی که زندگی در استانبول را آغاز می‌کنند — معمولاً یک یا دو سال بر مبنای توریستی. ما پرونده شما را آماده و در سامانه e-İkamet ثبت می‌کنیم.',
      whoFor: 'اتباع خارجی تازه‌وارد که می‌خواهند بیش از مدت ویزا/معافیت قانونی بمانند و مشمول مبنای دیگری (کار، تحصیل، مالکیت) نیستند.',
      documents: ['گذرنامه معتبر (ترجیحاً بیش از مدت اقامت درخواستی).', 'عکس بیومتریک جدید.', 'شماره مالیاتی (Vergi No).', 'بیمه درمانی معتبر و مورد قبول برای اقامت.', 'اثبات آدرس ثبت‌شده (قرارداد اجاره محضری + ثبت آدرس).', 'رسید پرداخت هزینه.'],
      steps: ['شماره مالیاتی بگیرید.', 'بیمه درمانی برای اقامت تهیه کنید.', 'آدرس را ثبت کنید (قرارداد اجاره محضری).', 'فرم e-İkamet را پر کنید و نوبت بگیرید.', 'با مدارک در نوبت حاضر شوید و اثر انگشت بدهید.', 'کارت را با پست دریافت کنید.'],
      duration: 'چند هفته تا رسیدن کارت — بسته به ازدحام نوبت‌ها متفاوت است.',
      cost: 'هزینه کارت + هزینه مجوز (بسته به ملیت و مدت) + هزینه بیمه. مجموع هنگام درخواست تعیین می‌شود.',
      mistakes: ['امضای قرارداد اجاره در محله‌ای که برای ثبت اقامت جدید «بسته» است — قبل از امضا بررسی کنید.', 'بیمه درمانی نامعتبر یا منقضی.', 'عکس‌های نامطابق با مشخصات بیومتریک.'],
      rafiqHelp: 'از طریق شریک مورد اعتماد، پرونده کامل شما را آماده می‌کنیم، از باز بودن محله مطمئن می‌شویم و نوبت شما را تا دریافت کارت پیگیری می‌کنیم.',
    },
  },
  'airport-pickup': {
    en: {
      intro: 'We pick you up from the airport and drive you in a private car with an Arabic-speaking driver.',
      whoFor: 'Newcomers and visitors who want a comfortable start without the hassle of public transport.',
      documents: ['Flight details (flight number, time) and destination address.'],
      steps: ['Send your flight and destination details.', 'Confirm the booking and price.', 'We meet you at the gate and drive you.'],
      duration: 'Based on your flight time (on-demand service).',
      cost: 'Depends on the airport, destination and car type. Confirmed on request.',
      mistakes: ['Not sending your flight number so we can track any delay.'],
      rafiqHelp: "A direct service with our own car and Arabic-speaking driver, right to your destination's door.",
    },
    ru: {
      intro: 'Встречаем вас в аэропорту и везём на частном авто с водителем, говорящим по-арабски.',
      whoFor: 'Новоприбывшие и гости, желающие комфортно начать без хлопот общественного транспорта.',
      documents: ['Данные рейса (номер рейса, время) и адрес назначения.'],
      steps: ['Пришлите детали рейса и адрес назначения.', 'Подтвердите бронь и цену.', 'Встречаем у выхода и отвозим.'],
      duration: 'По времени вашего рейса (услуга по запросу).',
      cost: 'Зависит от аэропорта, направления и класса авто. Уточняется по запросу.',
      mistakes: ['Не указали номер рейса — мы не сможем отследить задержку.'],
      rafiqHelp: 'Прямая услуга на нашем авто с арабоговорящим водителем — прямо до двери.',
    },
    fa: {
      intro: 'شما را از فرودگاه استقبال و با خودروی خصوصی و راننده عرب‌زبان به مقصد می‌رسانیم.',
      whoFor: 'تازه‌واردان و مسافرانی که شروعی راحت بدون دردسر حمل‌ونقل عمومی می‌خواهند.',
      documents: ['اطلاعات پرواز (شماره پرواز، زمان) و آدرس مقصد.'],
      steps: ['جزئیات پرواز و مقصد را بفرستید.', 'رزرو و قیمت را تأیید کنید.', 'در گیت استقبال و شما را می‌رسانیم.'],
      duration: 'بسته به زمان پرواز (خدمت فوری).',
      cost: 'بسته به فرودگاه، مقصد و نوع خودرو. هنگام درخواست تعیین می‌شود.',
      mistakes: ['نفرستادن شماره پرواز برای پیگیری تأخیر احتمالی.'],
      rafiqHelp: 'خدمت مستقیم با خودرو و راننده عرب‌زبان ما تا درِ مقصد.',
    },
  },
};

/** Guide content in the requested language; untranslated fields fall back to Arabic. */
export function getGuideContent(slug: string, lang: string): GuideEntry | null {
  const base = GUIDE_BY_SLUG[slug];
  if (!base) return null;
  if (lang === 'ar') return base;
  const tr = TRANSLATIONS[slug]?.[lang as Lang];
  return tr ? { ...base, ...tr } : base;
}

/** Whether a full translation exists for this slug+lang (else Arabic is shown). */
export function isTranslated(slug: string, lang: string): boolean {
  return lang === 'ar' || !!TRANSLATIONS[slug]?.[lang as Lang];
}
