import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

/**
 * "Discover Rafiq" — the guest homepage section that introduces the parts of
 * the site that are NOT the local services: the map, the news feed, real
 * estate and health tourism. It replaced the "from the problem to the right
 * step" animation section (2026-09-02, owner's brief): that one restated the
 * "how it works" section right above it with more shapes and more text, and
 * told the visitor nothing they didn't already have.
 *
 * Four photo tiles, one per feature: photo, title, one line, "open". Two per
 * row on phones, four across on desktop. No motion — the photos do the work.
 * Photos are ones the site already ships (public/img), so nothing new to load
 * or license. Copy lives here, like the cinematic footer's: these strings
 * belong to this layout alone.
 */
type Tile = { key: string; href: string; img: string; position?: string };

const TILES: Tile[] = [
  { key: 'map', href: '/map', img: '/img/istanbul-map.webp', position: '50% 45%' },
  { key: 'news', href: '/news', img: '/img/1524231757912-21f4fe3a7200.webp' },
  { key: 'realEstate', href: '/real-estate', img: '/img/1545324418-cc1a3fa10c00.webp', position: '50% 60%' },
  { key: 'health', href: '/health-tourism', img: '/img/1538108149393-fbbd81895907.webp' },
];

type TileCopy = { title: string; line: string };
type Copy = {
  eyebrow: string;
  heading: string;
  open: string;
  tiles: Record<string, TileCopy>;
};

const COPY: Record<string, Copy> = {
  ar: {
    eyebrow: 'اكتشف رفيق',
    heading: 'أكثر من خدمات… رفيق معك في كل تفاصيل إسطنبول',
    open: 'افتح',
    tiles: {
      map: { title: 'الخريطة', line: 'الدوائر الحكومية والمشافي والمؤسسات القريبة منك.' },
      news: { title: 'الأخبار العاجلة', line: 'كل جديد يخص المقيمين في تركيا، بلغتك.' },
      realEstate: { title: 'العقارات', line: 'شقق للإيجار والبيع مع إجراءات واضحة.' },
      health: { title: 'السياحة العلاجية', line: 'مشافٍ مرخّصة وأطباء استشاريون بلغتك.' },
    },
  },
  en: {
    eyebrow: 'Discover Rafiq',
    heading: 'More than services — Rafiq is with you across Istanbul',
    open: 'Open',
    tiles: {
      map: { title: 'City map', line: 'Government offices, hospitals and institutions near you.' },
      news: { title: 'Breaking news', line: 'Everything new for residents of Türkiye, in your language.' },
      realEstate: { title: 'Real estate', line: 'Apartments to rent or buy, with clear paperwork.' },
      health: { title: 'Health tourism', line: 'Licensed hospitals and consultant doctors in your language.' },
    },
  },
  ru: {
    eyebrow: 'Откройте Rafiq',
    heading: 'Больше, чем услуги — Rafiq рядом во всём Стамбуле',
    open: 'Открыть',
    tiles: {
      map: { title: 'Карта города', line: 'Госучреждения, больницы и организации рядом с вами.' },
      news: { title: 'Срочные новости', line: 'Всё новое для жителей Турции, на вашем языке.' },
      realEstate: { title: 'Недвижимость', line: 'Квартиры в аренду и на продажу с понятными документами.' },
      health: { title: 'Медицинский туризм', line: 'Лицензированные клиники и врачи на вашем языке.' },
    },
  },
  fa: {
    eyebrow: 'رفیق را بشناسید',
    heading: 'فراتر از خدمات — رفیق در همه‌جای استانبول همراه شماست',
    open: 'باز کردن',
    tiles: {
      map: { title: 'نقشه شهر', line: 'ادارات دولتی، بیمارستان‌ها و مؤسسات نزدیک شما.' },
      news: { title: 'اخبار فوری', line: 'هر خبر تازه برای مقیمان ترکیه، به زبان شما.' },
      realEstate: { title: 'املاک', line: 'آپارتمان برای اجاره و خرید با روند روشن.' },
      health: { title: 'گردشگری سلامت', line: 'بیمارستان‌های مجاز و پزشکان مشاور به زبان شما.' },
    },
  },
};

export function DiscoverRafiq() {
  const { language, dir, isRtl } = useLanguage();
  const c = COPY[language] ?? COPY.ar;
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section
      id="discover-rafiq"
      dir={dir}
      lang={language}
      aria-labelledby="discover-rafiq-heading"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#FAF8F0] via-[#FAF6ED] to-[#FAF8F0] pt-10 pb-0 text-[#12294D] font-sans sm:pt-16 md:pt-20"
    >
      <div className="container relative z-10 mx-auto max-w-6xl px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8">
        <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-10">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <span className="h-px w-6 bg-[#1A3A6B]/30 sm:w-10" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-widest text-[#1A3A6B] sm:text-sm">{c.eyebrow}</span>
            <span className="h-px w-6 bg-[#1A3A6B]/30 sm:w-10" aria-hidden="true" />
          </div>
          <h2 id="discover-rafiq-heading" className="text-2xl font-black leading-tight tracking-tight text-[#12294D] sm:text-4xl">
            {c.heading}
          </h2>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4" role="list">
          {TILES.map((tile) => {
            const tc = c.tiles[tile.key];
            return (
              <li key={tile.key} className="min-w-0">
                <a
                  href={`/${language}${tile.href}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#EFEADB] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#1A3A6B]/35 hover:shadow-xl hover:shadow-[#1A3A6B]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A3A6B] sm:rounded-3xl"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E8F0FB]">
                    <img
                      src={tile.img}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={tile.position ? { objectPosition: tile.position } : undefined}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A1832]/55 via-transparent to-transparent" aria-hidden="true" />
                    <h3 className="absolute inset-x-3 bottom-2.5 text-base font-black leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] sm:inset-x-4 sm:bottom-3 sm:text-xl">
                      {tc.title}
                    </h3>
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-3 p-3 sm:p-4">
                    <p className="text-xs leading-relaxed text-[#4A5F7D] sm:text-sm">{tc.line}</p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1A3A6B] sm:text-sm">
                      {c.open}
                      <Arrow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Same organic wave the previous section carried into the FAQ scroller */}
      <div className="relative z-20 -mb-1 w-full overflow-hidden leading-none pointer-events-none">
        <svg className="h-10 w-full text-[#FAF8F0] sm:h-16" viewBox="0 0 1440 60" fill="currentColor" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,32 C360,58 720,12 1080,42 C1260,54 1380,36 1440,28 L1440,60 L0,60 Z" />
        </svg>
      </div>
    </section>
  );
}

export default DiscoverRafiq;
