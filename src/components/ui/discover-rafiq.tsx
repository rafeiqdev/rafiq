import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CardStack, type CardStackItem } from '@/components/ui/card-stack';

/**
 * "Discover Rafiq" — the guest homepage section that introduces the parts of
 * the site that are NOT the local services: the map, the news feed, real
 * estate and health tourism. It replaced the "from the problem to the right
 * step" animation section (2026-09-02, owner's brief): that one restated the
 * "how it works" section right above it with more shapes and more text, and
 * told the visitor nothing they didn't already have.
 *
 * The four features are shown in the owner's chosen CardStack (a fanned,
 * swipeable 3D card deck — components/ui/card-stack.tsx, ported 1:1 from the
 * prompt he sent). One card per feature: photo, title, one line, and an
 * "open" pill on the card in front. Photos are ones the site already ships
 * (public/img) until the owner supplies replacements. Copy lives here, like
 * the cinematic footer's: these strings belong to this layout alone.
 */
type Feature = { key: string; href: string; img: string };

const FEATURES: Feature[] = [
  { key: 'map', href: '/map', img: '/img/istanbul-map.webp' },
  { key: 'news', href: '/news', img: '/img/1524231757912-21f4fe3a7200.webp' },
  { key: 'realEstate', href: '/real-estate', img: '/img/discover-real-estate.webp' } // owner's rooftop photo, 1200×750,
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
  const isMobile = useIsMobile();
  const c = COPY[language] ?? COPY.ar;
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const items: CardStackItem[] = FEATURES.map((f) => ({
    id: f.key,
    title: c.tiles[f.key].title,
    description: c.tiles[f.key].line,
    imageSrc: f.img,
    href: `/${language}${f.href}`,
    ctaLabel: c.open,
  }));

  // Desktop only: the 3D fan deck at the prompt's own sizes. On phones the
  // deck was, in the owner's words, very bad — the tilted neighbours spilled
  // off a 375px screen, the drag handler fought the page's own scrolling, and
  // the perspective transforms stuttered — so phones get the same four cards
  // as a plain horizontal swipe row instead (below).
  const cardWidth = 520;
  const cardHeight = 325; // 520×325 = 16:10, the same ratio as the phone card and the owner's 1200×750 images

  return (
    <section
      id="discover-rafiq"
      dir={dir}
      lang={language}
      aria-labelledby="discover-rafiq-heading"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#FAF8F0] via-[#FAF6ED] to-[#FAF8F0] pt-10 pb-0 text-[#12294D] font-sans sm:pt-16 md:pt-20"
    >
      <div className="container relative z-10 mx-auto max-w-6xl px-4 pb-6 sm:px-6 sm:pb-10 lg:px-8">
        <div className="mx-auto mb-2 max-w-3xl text-center sm:mb-4">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <span className="h-px w-6 bg-[#1A3A6B]/30 sm:w-10" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-widest text-[#1A3A6B] sm:text-sm">{c.eyebrow}</span>
            <span className="h-px w-6 bg-[#1A3A6B]/30 sm:w-10" aria-hidden="true" />
          </div>
          <h2 id="discover-rafiq-heading" className="text-2xl font-black leading-tight tracking-tight text-[#12294D] sm:text-4xl">
            {c.heading}
          </h2>
        </div>

        {/* The deck lays cards out left-to-right in pixels, so it runs LTR even
            on the Arabic/Farsi page; the text inside each card keeps the
            page direction. */}
        {isMobile ? (
          <ul
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-3 scrollbar-none"
            role="list"
          >
            {items.map((item) => (
              <li key={item.id} className="w-[82%] max-w-[82%] shrink-0 snap-center">
                <a
                  href={item.href}
                  className="relative block aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[#EFEADB] bg-[#1A3A6B] shadow-md"
                >
                  <img
                    src={item.imageSrc}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="text-lg font-black text-white drop-shadow">{item.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-white/85">{item.description}</div>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#1A3A6B] shadow-md">
                      {item.ctaLabel}
                      <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
        <div dir="ltr">
          <CardStack
            items={items}
            initialIndex={0}
            maxVisible={5}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            overlap={0.48}
            spreadDeg={48}
            autoAdvance
            intervalMs={3200}
            pauseOnHover
            showDots
            renderCard={(item, { active }) => (
              <div dir={dir} className="relative h-full w-full">
                <div className="absolute inset-0">
                  <img
                    src={item.imageSrc}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                    draggable={false}
                    loading="eager"
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="relative z-10 flex h-full flex-col justify-end p-4 sm:p-5">
                  <div className="text-lg font-black text-white drop-shadow sm:text-2xl">{item.title}</div>
                  {item.description ? (
                    <div className="mt-1 line-clamp-2 text-xs text-white/85 sm:text-sm">{item.description}</div>
                  ) : null}
                  {active && item.href ? (
                    <a
                      href={item.href}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#1A3A6B] shadow-md transition hover:bg-[#FAF8F0] sm:text-sm"
                    >
                      {item.ctaLabel}
                      <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          />
        </div>
        )}
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
