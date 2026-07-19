/**
 * Cities offered during onboarding ("في أي مدينة تعيش؟").
 * Stable latin ids; localized labels for the 4 app languages (+tr).
 */
export type CityName = { ar: string; en: string; ru: string; fa: string; tr: string };

export interface City {
  id: string;
  name: CityName;
}

export const TURKEY_CITIES: City[] = [
  { id: 'istanbul',  name: { en: 'Istanbul',  tr: 'İstanbul',  ar: 'إسطنبول',      ru: 'Стамбул',   fa: 'استانبول' } },
  { id: 'ankara',    name: { en: 'Ankara',    tr: 'Ankara',    ar: 'أنقرة',        ru: 'Анкара',    fa: 'آنکارا' } },
  { id: 'izmir',     name: { en: 'Izmir',     tr: 'İzmir',     ar: 'إزمير',        ru: 'Измир',     fa: 'ازمیر' } },
  { id: 'bursa',     name: { en: 'Bursa',     tr: 'Bursa',     ar: 'بورصة',        ru: 'Бурса',     fa: 'بورسا' } },
  { id: 'antalya',   name: { en: 'Antalya',   tr: 'Antalya',   ar: 'أنطاليا',      ru: 'Анталья',   fa: 'آنتالیا' } },
  { id: 'gaziantep', name: { en: 'Gaziantep', tr: 'Gaziantep', ar: 'غازي عنتاب',   ru: 'Газиантеп', fa: 'غازی‌آنتپ' } },
  { id: 'mersin',    name: { en: 'Mersin',    tr: 'Mersin',    ar: 'مرسين',        ru: 'Мерсин',    fa: 'مرسین' } },
  { id: 'adana',     name: { en: 'Adana',     tr: 'Adana',     ar: 'أضنة',         ru: 'Адана',     fa: 'آدانا' } },
  { id: 'konya',     name: { en: 'Konya',     tr: 'Konya',     ar: 'قونية',        ru: 'Конья',     fa: 'قونیه' } },
  { id: 'trabzon',   name: { en: 'Trabzon',   tr: 'Trabzon',   ar: 'طرابزون',      ru: 'Трабзон',   fa: 'ترابزون' } },
  { id: 'sakarya',   name: { en: 'Sakarya',   tr: 'Sakarya',   ar: 'سكاريا',       ru: 'Сакарья',   fa: 'ساکاریا' } },
  { id: 'yalova',    name: { en: 'Yalova',    tr: 'Yalova',    ar: 'يلوا',         ru: 'Ялова',     fa: 'یالووا' } },
];

const BY_ID: Record<string, City> = Object.fromEntries(TURKEY_CITIES.map((c) => [c.id, c]));

/** Localized city label; unknown ids (e.g. a free-typed city) pass through. */
export function pickCity(id: string, lang: string): string {
  const c = BY_ID[id];
  if (!c) return id;
  return (c.name as Record<string, string>)[lang] ?? c.name.en;
}
