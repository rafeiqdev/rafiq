import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { ServiceRequestModal } from '../components/ServiceRequestModal';
import { useCatalog } from '../data/catalogStore';
import { pickText } from '../data/services';
import { CATEGORY_GUIDES } from '../data/categoryGuides';
import { CATEGORY_HERO_IMAGE } from '../data/categoryHeroImages';
import { usePageMeta } from '../lib/seo';

function copyFor(language: string) {
  if (language === 'en') {
    return {
      notFoundTitle: 'Guide not found',
      notFoundText: 'Return to the services list and choose the category that fits your needs.',
      allServices: 'View all services',
      allGuides: 'Service guides',
      guideLabel: 'Practical guide',
      relatedServices: 'Related services',
      faqHeading: 'Common questions',
      onThisPage: 'On this page',
      requestButton: 'Request help',
      browseServices: 'Browse related services',
    };
  }
  if (language === 'ru') {
    return {
      notFoundTitle: 'Руководство не найдено',
      notFoundText: 'Вернитесь к списку услуг и выберите подходящую категорию.',
      allServices: 'Все услуги',
      allGuides: 'Гиды по услугам',
      guideLabel: 'Практическое руководство',
      relatedServices: 'Связанные услуги',
      faqHeading: 'Частые вопросы',
      onThisPage: 'На этой странице',
      requestButton: 'Запросить помощь',
      browseServices: 'Посмотреть связанные услуги',
    };
  }
  if (language === 'fa') {
    return {
      notFoundTitle: 'راهنما یافت نشد',
      notFoundText: 'به فهرست خدمات برگردید و دسته مناسب را انتخاب کنید.',
      allServices: 'مشاهده همه خدمات',
      allGuides: 'راهنماهای خدمات',
      guideLabel: 'راهنمای عملی',
      relatedServices: 'خدمات مرتبط',
      faqHeading: 'پرسش‌های رایج',
      onThisPage: 'در این صفحه',
      requestButton: 'درخواست کمک',
      browseServices: 'مشاهده خدمات مرتبط',
    };
  }
  return {
    notFoundTitle: 'الدليل غير موجود',
    notFoundText: 'يمكنك العودة إلى قائمة الخدمات واختيار الفئة المناسبة لك.',
    allServices: 'عرض كل الخدمات',
    allGuides: 'أدلة الخدمات',
    guideLabel: 'دليل عملي',
    relatedServices: 'الخدمات المرتبطة',
    faqHeading: 'أسئلة شائعة',
    onThisPage: 'في هذه الصفحة',
    requestButton: 'اطلب المساعدة',
    browseServices: 'عرض الخدمات المرتبطة',
  };
}

/**
 * The browser-tab title carries the brand ("… | Rafiq coordination"), which
 * reads like a filename once it sits on the page as a headline. Drop that
 * trailing brand chunk from the visible H1 only — the <title> keeps it.
 */
function headlineFrom(seoTitle: string): string {
  const chunks = seoTitle.split(/\s+[|—–-]\s+/).map((part) => part.trim()).filter(Boolean);
  const isBrand = (part: string) => /rafiq|رفيق|رفیق/i.test(part);
  while (chunks.length > 1 && isBrand(chunks[chunks.length - 1])) chunks.pop();
  return chunks.join(' — ') || seoTitle;
}

/**
 * Each guide section arrives as one long block of text. A 700-character
 * paragraph is what made these pages read as a wall of text on a phone, so
 * split on sentence ends and re-group in pairs. This is purely visual: no word
 * is added, removed or reordered, so the page still says what was reviewed.
 */
function paragraphsFrom(body: string): string[] {
  const sentences = body.match(/[^.!?؟۔]+[.!?؟۔]+\s*|[^.!?؟۔]+$/g);
  if (!sentences || sentences.length < 3) return [body];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join('').trim());
  }
  return out.filter(Boolean);
}

function GuideNotFound() {
  const { i18n } = useTranslation();
  const copy = copyFor(i18n.language);
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <AppIcon name="search" className="mx-auto h-12 w-12 text-navy/25" />
      <h1 className="mt-4 text-xl font-extrabold text-navy">{copy.notFoundTitle}</h1>
      <p className="mt-2 text-sm text-gray-600">{copy.notFoundText}</p>
      <Link to="/services" className="btn-primary mt-6 inline-flex">{copy.allServices}</Link>
    </main>
  );
}

/** Evergreen, category-level guide with internal service links and reviewed SEO copy. */
export function CategoryGuide() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const { categories, services } = useCatalog();
  const [showRequest, setShowRequest] = useState(false);
  const language = i18n.language as 'ar' | 'en' | 'ru' | 'fa';
  const copy = copyFor(language);
  const isRtl = language === 'ar' || language === 'fa';
  const guide = id ? CATEGORY_GUIDES[id]?.[language] : undefined;
  const category = categories.find((item) => item.id === id);

  // usePageMeta is a hook, so it has to run on every render — including the
  // ones where the catalog is still loading and `category` is undefined.
  usePageMeta({
    title: guide?.seoTitle ?? copy.notFoundTitle,
    description: guide?.metaDescription ?? copy.notFoundText,
  });

  if (!guide || !category) return <GuideNotFound />;

  const categoryTitle = pickText(category.title, language);
  const related = services.filter((item) => item.category === id);
  const heroImage = id ? CATEGORY_HERO_IMAGE[id] : undefined;
  const sectionId = (index: number) => `section-${index + 1}`;
  // The Q&A already visible on the page, marked up so search engines can show
  // it as a rich result instead of guessing at it.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <nav aria-label={copy.allGuides} className="mb-6 text-sm text-navy/65">
        <Link to="/services" className="hover:text-navy hover:underline">{copy.allServices}</Link>
        <span className="mx-2">/</span>
        <span>{copy.allGuides}</span>
        <span className="mx-2">/</span>
        <span>{categoryTitle}</span>
      </nav>

      {/* Same header treatment as a service page: deep gradient, category photo
          bleeding in from the trailing edge, title over a readability overlay. */}
      <header className="relative overflow-hidden rounded-card shadow-card">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-navy-dark via-navy to-navy-light" />
        {heroImage && (
          <>
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              onError={(e) => {
                // A missing photo must never show a broken-image icon — hide it
                // and let the blue gradient carry the header on its own.
                e.currentTarget.style.display = 'none';
              }}
              className={`pointer-events-none absolute inset-y-0 h-full w-3/5 object-cover object-center ${
                isRtl ? 'left-0' : 'right-0'
              }`}
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 from-navy-dark via-navy/95 to-navy/10 ${
                isRtl ? 'bg-gradient-to-l' : 'bg-gradient-to-r'
              }`}
            />
          </>
        )}
        <div className="relative px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <AppIcon name={category.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gold-light">{copy.guideLabel}</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{headlineFrom(guide.seoTitle)}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">{guide.intro}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <button type="button" className="btn-gold" onClick={() => setShowRequest(true)}>
              <AppIcon name="message-circle" className="h-4 w-4" />
              {copy.requestButton}
            </button>
            {related.length > 0 && (
              <a
                href="#related"
                className="inline-flex h-11 items-center gap-2 rounded-btn border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {copy.relatedServices}
                <span className="text-white/70">({related.length})</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {guide.sections.map((section, index) => (
            <section key={section.heading} id={sectionId(index)} className="card scroll-mt-24 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-sm font-extrabold text-gold-dark">
                  {index + 1}
                </span>
                <h2 className="text-lg font-extrabold leading-snug text-navy sm:text-xl">{section.heading}</h2>
              </div>
              <div className="mt-4 max-w-2xl space-y-4">
                {paragraphsFrom(section.body).map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-[15px] leading-8 text-gray-650">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section id="faq" className="card scroll-mt-24 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="icon-chip !h-9 !w-9">
                <AppIcon name="info" className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold text-navy sm:text-xl">{copy.faqHeading}</h2>
            </div>
            <div className="mt-4 space-y-2.5">
              {guide.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-cream-dark bg-cream/45 px-4 py-3 transition-colors hover:border-gold/60 open:bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-bold text-navy [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{faq.question}</span>
                    <AppIcon
                      name="chevron-down"
                      className="h-4 w-4 shrink-0 text-navy/45 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 max-w-2xl text-[15px] leading-8 text-gray-650">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {related.length > 0 && (
            <section id="related" className="card scroll-mt-24 p-5 sm:p-7">
              <h2 className="text-lg font-extrabold text-navy sm:text-xl">{copy.relatedServices}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((service) => (
                  <Link
                    key={service.id}
                    to={`/services/${service.id}`}
                    className="group flex items-start gap-3 rounded-xl border border-cream-dark bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-card"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream text-gold-dark transition-colors group-hover:bg-gold group-hover:text-white">
                      <AppIcon name={service.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-navy">{pickText(service.title, language)}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-6 text-gray-600">
                        {pickText(service.desc, language)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <nav aria-label={copy.onThisPage} className="card hidden p-5 lg:block">
            <p className="text-xs font-bold uppercase tracking-wide text-navy/50">{copy.onThisPage}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {guide.sections.map((section, index) => (
                <li key={section.heading}>
                  <a href={`#${sectionId(index)}`} className="text-navy/75 transition-colors hover:text-navy hover:underline">
                    {section.heading}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq" className="text-navy/75 transition-colors hover:text-navy hover:underline">{copy.faqHeading}</a>
              </li>
            </ul>
          </nav>

          <div className="card p-5">
            <h2 className="text-lg font-extrabold text-navy">{guide.ctaTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">{guide.ctaBody}</p>
            <button type="button" className="btn-gold mt-5 w-full" onClick={() => setShowRequest(true)}>
              {copy.requestButton}
            </button>
            <Link to="/services" className="btn-secondary mt-3 w-full text-center">{copy.browseServices}</Link>
          </div>
        </aside>
      </div>

      {showRequest && (
        <ServiceRequestModal
          source={{ id: category.id, title: categoryTitle, category: category.id, type: 'guide' }}
          onClose={() => setShowRequest(false)}
        />
      )}
    </main>
  );
}
