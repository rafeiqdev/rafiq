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
 * One card per feature: photo, title, one line, and an "open" pill. The card
 * is the same on every screen — the owner's chosen look (2026-09-04). The
 * earlier fanned 3D "card deck" was removed at his request: he found it bad
 * and wanted the plain photo cards the phone already had, on the desktop too.
 * Phones swipe the cards in a horizontal row; from `sm` up the four cards sit
 * in a clean grid. Photos are ones the site already ships (public/img) until
 * the owner supplies replacements. Copy lives here, like the cinematic
 * footer's: these strings belong to this layout alone.
 */
type Feature = { key: string; href: string; img: string };

const FEATURES: Feature[] = [
  { key: 'map', href: '/map', img: '/img/istanbul-map.webp' },
  { key: 'news', href: '/news', img: '/img/discover-news.webp' }, // owner's newspaper photo, 1200×750
  { key: 'realEstate', href: '/real-estate', img: '/img/discover-real-estate.webp' }, // owner's business-district photo, 4K source resized to 1200×750
  { key: 'health', href: '/health-tourism', img: '/img/discover-health.webp' }, // owner's clinic render, resized to 1200×750
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

  const items = FEATURES.map((f) => ({
    id: f.key,
    title: c.tiles[f.key].title,
    description: c.tiles[f.key].line,
    imageSrc: f.img,
    href: `/${language}${f.href}`,
    ctaLabel: c.open,
  }));

  return (
    <section
      id="discover-rafiq"
      dir={dir}
      lang={language}
      aria-labelledby="discover-rafiq-heading"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#FAF8F0] via-[#FAF6ED] to-[#FAF8F0] pt-10 pb-0 text-[#12294D] font-sans sm:pt-16 md:pt-20 lg:pt-14"
    >
      <div className="container relative z-10 mx-auto max-w-6xl px-4 pb-6 sm:px-6 sm:pb-12 lg:px-8">
        <div className="mx-auto mb-4 max-w-3xl text-center sm:mb-8">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <span className="h-px w-6 bg-[#1A3A6B]/30 sm:w-10" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-widest text-[#1A3A6B] sm:text-sm">{c.eyebrow}</span>
            <span className="h-px w-6 bg-[#1A3A6B]/30 sm:w-10" aria-hidden="true" />
          </div>
          <h2 id="discover-rafiq-heading" className="text-2xl font-black leading-tight tracking-tight text-[#12294D] sm:text-4xl lg:text-3xl">
            {c.heading}
          </h2>
        </div>

        {/* One card design everywhere. On phones it is a horizontal swipe row
            (each card 82% of the screen, snap-centered); from `sm` up the same
            cards fall into a 2-up, then 4-up grid. */}
        <ul
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
          role="list"
        >
          {items.map((item) => (
            <li key={item.id} className="w-[82%] max-w-[82%] shrink-0 snap-center sm:w-auto sm:max-w-none">
              <a
                href={item.href}
                className="group relative block aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[#EFEADB] bg-[#1A3A6B] shadow-md transition-shadow hover:shadow-xl"
              >
                <img
                  src={item.imageSrc}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1832]/95 via-[#0A1832]/55 via-45% to-[#0A1832]/5" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <div className="text-lg font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] sm:text-xl">{item.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] sm:text-sm">{item.description}</div>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#1A3A6B] shadow-md sm:text-sm">
                    {item.ctaLabel}
                    <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </a>
            </li>
          ))}
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
