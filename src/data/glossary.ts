/**
 * Glossary of Turkish administrative terms that show up verbatim in the
 * services catalog and request flows (e.g. "Tax number (Vergi No)"). Each
 * entry's `match` finds the Turkish term inside already-rendered text —
 * the term itself doesn't get translated in the source strings, so matching
 * on the Turkish text works the same regardless of the surrounding language.
 */
import type { Lang } from '../lib/types';

export interface GlossaryTerm {
  id: string;
  /** Matches the Turkish term as it appears inside catalog/service text. */
  match: RegExp;
  explanation: Record<Lang, string>;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'vergi-no',
    match: /Vergi No(?:su)?/i,
    explanation: {
      ar: 'الرقم الضريبي التركي — رقم تعرّفك به الدولة لأغراض ضريبية ومالية. مطلوب لفتح حساب بنكي، وفي أغلب المعاملات الرسمية. يُستخرج مجانًا وفي دقائق.',
      en: 'Your Turkish tax number — a personal ID number used for tax and financial purposes. Required to open a bank account and for most official transactions. Free and quick to get.',
      ru: 'Турецкий налоговый номер — персональный номер для налоговых и финансовых целей. Нужен для открытия банковского счёта и большинства официальных процедур. Оформляется бесплатно и быстро.',
      fa: 'شماره مالیاتی ترکیه — شماره شناسایی شخصی برای امور مالیاتی و مالی. برای افتتاح حساب بانکی و بیشتر معاملات رسمی لازم است. دریافت آن رایگان و سریع است.',
    },
  },
  {
    id: 'nufus',
    match: /Nüfus(?: Müdürlüğü)?/i,
    explanation: {
      ar: 'دائرة النفوس — الجهة التركية المسؤولة عن سجلات الأحوال المدنية (الولادة، الزواج، العنوان). بعض معاملات الإقامة والجنسية تحتاج مستندًا صادرًا منها.',
      en: 'The Turkish civil registry office — handles records like birth, marriage, and address registration. Some residence and citizenship procedures require a document issued by it.',
      ru: 'Турецкое управление ЗАГС — ведёт записи о рождении, браке и регистрации по адресу. Для некоторых процедур по виду на жительство и гражданству нужен документ оттуда.',
      fa: 'اداره ثبت‌احوال ترکیه — مسئول ثبت رویدادهایی مانند تولد، ازدواج و آدرس است. برخی از مراحل اقامت و تابعیت به مدرکی از این اداره نیاز دارند.',
    },
  },
  {
    id: 'goc-idaresi',
    match: /Göç İdaresi/i,
    explanation: {
      ar: 'إدارة الهجرة التركية — الجهة الرسمية المسؤولة عن تصاريح الإقامة للأجانب. عندها تُقدَّم طلبات الإقامة ومواعيدها.',
      en: 'The Turkish Directorate of Migration Management — the official authority for foreigners\' residence permits. Residence applications and appointments go through it.',
      ru: 'Турецкое управление миграции — официальный орган, выдающий вид на жительство иностранцам. Через него подаются заявления и записываются на приём.',
      fa: 'اداره کل مهاجرت ترکیه — نهاد رسمی صدور اقامت برای خارجی‌ها. درخواست‌ها و نوبت‌های اقامت از طریق همین اداره انجام می‌شود.',
    },
  },
  {
    id: 'apostille',
    match: /Apostille|Apostil/i,
    explanation: {
      ar: 'الأبوستيل — ختم توثيق دولي يجعل مستندًا رسميًا (كشهادة ميلاد أو دبلوم) معترفًا به في دول أخرى دون توثيق إضافي.',
      en: 'An apostille — an international certification stamp that makes an official document (like a birth certificate or diploma) recognized abroad without extra legalization.',
      ru: 'Апостиль — международный штамп удостоверения, благодаря которому официальный документ (свидетельство о рождении, диплом) признаётся за границей без дополнительной легализации.',
      fa: 'آپوستیل — مهر تأیید بین‌المللی که یک مدرک رسمی (مانند شناسنامه یا مدرک تحصیلی) را بدون نیاز به تأیید اضافی در کشورهای دیگر معتبر می‌کند.',
    },
  },
  {
    id: 'ikamet',
    match: /e-İkamet|İkamet/i,
    explanation: {
      ar: 'الإقامة (İkamet) — تصريح الإقامة القانونية للأجانب في تركيا. "e-İkamet" هو النظام الإلكتروني لتقديم طلب الإقامة ومتابعته.',
      en: 'İkamet — the legal residence permit for foreigners in Turkey. "e-İkamet" is the online system used to apply for and track it.',
      ru: 'İkamet — вид на жительство для иностранцев в Турции. «e-İkamet» — онлайн-система для подачи заявления и отслеживания его статуса.',
      fa: 'اقامت (İkamet) — مجوز قانونی اقامت خارجی‌ها در ترکیه. «e-İkamet» سامانه آنلاین ثبت و پیگیری درخواست اقامت است.',
    },
  },
  {
    id: 'yabanci-kimlik',
    match: /Yabancı Kimlik(?: No)?/i,
    explanation: {
      ar: 'الرقم الأجنبي (Yabancı Kimlik) — رقم الهوية الذي يُمنح للأجانب المقيمين في تركيا، ويُستخدم في المعاملات الرسمية بدلًا من رقم الهوية التركي.',
      en: 'Yabancı Kimlik No — the foreigner ID number issued to non-citizens residing in Turkey, used in official transactions in place of a Turkish citizen ID number.',
      ru: 'Yabancı Kimlik No — номер удостоверения личности иностранца, проживающего в Турции. Используется в официальных процедурах вместо турецкого ID-номера.',
      fa: 'Yabancı Kimlik No — شماره هویت خارجی‌های مقیم ترکیه که در معاملات رسمی به‌جای شماره ملی ترک استفاده می‌شود.',
    },
  },
  {
    id: 'noter',
    match: /\bNoter\b/i,
    explanation: {
      ar: 'النوتر — كاتب العدل في تركيا، مسؤول عن توثيق التوقيعات والعقود والترجمات لتصبح معترفًا بها رسميًا.',
      en: 'Noter — the Turkish notary public, who certifies signatures, contracts, and translations so they carry official legal weight.',
      ru: 'Noter — турецкий нотариус, заверяющий подписи, договоры и переводы, чтобы они имели официальную юридическую силу.',
      fa: 'Noter — دفتر اسناد رسمی ترکیه که امضاها، قراردادها و ترجمه‌ها را برای اعتبار رسمی تأیید می‌کند.',
    },
  },
  {
    id: 'yeminli-tercume',
    match: /yeminli tercüme/i,
    explanation: {
      ar: 'الترجمة المحلفة (yeminli tercüme) — ترجمة رسمية معتمدة من مترجم مقسم يعترف به النوتر، مطلوبة لمعظم المستندات الرسمية المترجمة.',
      en: 'Sworn translation (yeminli tercüme) — an official translation certified by a notary-recognized sworn translator, required for most translated official documents.',
      ru: 'Присяжный перевод (yeminli tercüme) — официальный перевод, заверенный признанным нотариусом присяжным переводчиком; требуется для большинства переведённых официальных документов.',
      fa: 'ترجمه رسمی سوگندخورده (yeminli tercüme) — ترجمه‌ای که توسط مترجم رسمی مورد تأیید نوتر تأیید شده و برای بیشتر مدارک ترجمه‌شده رسمی لازم است.',
    },
  },
  {
    id: 'kdv',
    match: /\bKDV\b/i,
    explanation: {
      ar: 'كي دي في (KDV) — ضريبة القيمة المضافة في تركيا، تُضاف على معظم السلع والخدمات وتُقدَّم إقراراتها دوريًا.',
      en: 'KDV — Turkey\'s value-added tax (VAT), added to most goods and services and declared periodically.',
      ru: 'KDV — турецкий налог на добавленную стоимость (НДС), взимается с большинства товаров и услуг и декларируется периодически.',
      fa: 'KDV — مالیات بر ارزش افزوده ترکیه که بر بیشتر کالاها و خدمات اعمال و به‌صورت دوره‌ای اظهار می‌شود.',
    },
  },
  {
    id: 'beyanname',
    match: /beyanname/i,
    explanation: {
      ar: 'الإقرار الضريبي (beyanname) — النموذج الرسمي الذي يُقدَّم للدولة لتصريح الدخل أو الضريبة المستحقة خلال فترة معينة.',
      en: 'Beyanname — the official tax declaration form filed with the state to report income or tax due for a given period.',
      ru: 'Beyanname — официальная налоговая декларация, подаваемая государству для отчёта о доходах или налоге за определённый период.',
      fa: 'بیاننامه (beyanname) — فرم رسمی اظهارنامه مالیاتی که برای اعلام درآمد یا مالیات دوره‌ای به دولت ارائه می‌شود.',
    },
  },
];
