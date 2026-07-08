/**
 * Istanbul districts used for broadcast matching: a customer picks their area on
 * a request; a company picks the areas it covers. Both reference these ids, so a
 * lead reaches a company only when ids overlap (see company_leads RPC).
 *
 * Names are localized for the 4 app languages (ar/en/ru/fa) plus tr; ids are
 * stable latin slugs and must never change once data references them.
 */
export type AreaName = { ar: string; en: string; ru: string; fa: string; tr: string };

export interface Area {
  id: string;
  name: AreaName;
}

export const ISTANBUL_AREAS: Area[] = [
  { id: 'fatih',        name: { en: 'Fatih',        tr: 'Fatih',        ar: 'الفاتح',        ru: 'Фатих',        fa: 'فاتح' } },
  { id: 'beyoglu',      name: { en: 'Beyoğlu',      tr: 'Beyoğlu',      ar: 'بيوغلو',        ru: 'Бейоглу',      fa: 'بی‌اوغلو' } },
  { id: 'sisli',        name: { en: 'Şişli',        tr: 'Şişli',        ar: 'شيشلي',         ru: 'Шишли',        fa: 'شیشلی' } },
  { id: 'besiktas',     name: { en: 'Beşiktaş',     tr: 'Beşiktaş',     ar: 'بشكتاش',        ru: 'Бешикташ',     fa: 'بشیکتاش' } },
  { id: 'sariyer',      name: { en: 'Sarıyer',      tr: 'Sarıyer',      ar: 'سارير',         ru: 'Сарыер',       fa: 'ساری‌یر' } },
  { id: 'kadikoy',      name: { en: 'Kadıköy',      tr: 'Kadıköy',      ar: 'قاضي كوي',      ru: 'Кадыкёй',      fa: 'قادیکوی' } },
  { id: 'uskudar',      name: { en: 'Üsküdar',      tr: 'Üsküdar',      ar: 'أسكودار',       ru: 'Ускюдар',      fa: 'اسکودار' } },
  { id: 'atasehir',     name: { en: 'Ataşehir',     tr: 'Ataşehir',     ar: 'آتاشهير',       ru: 'Аташехир',     fa: 'آتاشهیر' } },
  { id: 'maltepe',      name: { en: 'Maltepe',      tr: 'Maltepe',      ar: 'مالتبه',        ru: 'Мальтепе',     fa: 'مالتپه' } },
  { id: 'pendik',       name: { en: 'Pendik',       tr: 'Pendik',       ar: 'بنديك',         ru: 'Пендик',       fa: 'پندیک' } },
  { id: 'kartal',       name: { en: 'Kartal',       tr: 'Kartal',       ar: 'كارتال',        ru: 'Картал',       fa: 'کارتال' } },
  { id: 'umraniye',     name: { en: 'Ümraniye',     tr: 'Ümraniye',     ar: 'أومرانية',      ru: 'Умрание',      fa: 'اومرانیه' } },
  { id: 'bakirkoy',     name: { en: 'Bakırköy',     tr: 'Bakırköy',     ar: 'باكركوي',       ru: 'Бакыркёй',     fa: 'باکیرکوی' } },
  { id: 'bahcelievler', name: { en: 'Bahçelievler', tr: 'Bahçelievler', ar: 'بهتشيليفلر',    ru: 'Бахчелиэвлер', fa: 'باغچه‌لی‌اولر' } },
  { id: 'zeytinburnu',  name: { en: 'Zeytinburnu',  tr: 'Zeytinburnu',  ar: 'زيتون بورنو',   ru: 'Зейтинбурну',  fa: 'زیتین‌بورنو' } },
  { id: 'basaksehir',   name: { en: 'Başakşehir',   tr: 'Başakşehir',   ar: 'باشاك شهير',    ru: 'Башакшехир',   fa: 'باشاک‌شهیر' } },
  { id: 'esenyurt',     name: { en: 'Esenyurt',     tr: 'Esenyurt',     ar: 'اسنيورت',       ru: 'Эсеньюрт',     fa: 'اسن‌یورت' } },
  { id: 'beylikduzu',   name: { en: 'Beylikdüzü',   tr: 'Beylikdüzü',   ar: 'بيلك دوزو',     ru: 'Бейликдюзю',   fa: 'بیلیک‌دوزو' } },
  { id: 'avcilar',      name: { en: 'Avcılar',      tr: 'Avcılar',      ar: 'آفجلار',        ru: 'Авджылар',     fa: 'آوجیلار' } },
  { id: 'bagcilar',     name: { en: 'Bağcılar',     tr: 'Bağcılar',     ar: 'باغجلار',       ru: 'Багджылар',    fa: 'باغجیلار' } },
  { id: 'gaziosmanpasa',name: { en: 'Gaziosmanpaşa',tr: 'Gaziosmanpaşa',ar: 'غازي عثمان باشا',ru: 'Газиосманпаша',fa: 'غازی‌عثمان‌پاشا' } },
  { id: 'eyupsultan',   name: { en: 'Eyüpsultan',   tr: 'Eyüpsultan',   ar: 'أيوب سلطان',    ru: 'Эйюпсултан',   fa: 'ایوب‌سلطان' } },
  { id: 'sancaktepe',   name: { en: 'Sancaktepe',   tr: 'Sancaktepe',   ar: 'سنجاك تبه',     ru: 'Санджактепе',  fa: 'سنجاک‌تپه' } },
  { id: 'sultanbeyli',  name: { en: 'Sultanbeyli',  tr: 'Sultanbeyli',  ar: 'سلطان بيلي',    ru: 'Султанбейли',  fa: 'سلطان‌بیلی' } },
];

const AREA_BY_ID: Record<string, Area> = Object.fromEntries(ISTANBUL_AREAS.map((a) => [a.id, a]));

/** Localized district name for the current language (falls back to English). */
export function pickArea(id: string, lang: string): string {
  const a = AREA_BY_ID[id];
  if (!a) return id;
  return (a.name as Record<string, string>)[lang] ?? a.name.en;
}
