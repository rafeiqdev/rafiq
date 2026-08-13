import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { useCatalog } from '../data/catalogStore';
import { pickText } from '../data/services';
import { CATEGORY_GUIDES } from '../data/categoryGuides';
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
      nextHeading: 'Plan the next step',
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
      nextHeading: 'Запланируйте следующий шаг',
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
      nextHeading: 'گام بعدی را هماهنگ کنید',
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
    nextHeading: 'نسّق الخطوة التالية',
    browseServices: 'عرض الخدمات المرتبطة',
  };
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
  const language = i18n.language as 'ar' | 'en' | 'ru' | 'fa';
  const copy = copyFor(language);
  const isRtl = language === 'ar' || language === 'fa';
  const guide = id ? CATEGORY_GUIDES[id]?.[language] : undefined;
  const category = categories.find((item) => item.id === id);

  if (!guide || !category) return <GuideNotFound />;

  const categoryTitle = pickText(category.title, language);
  const related = services.filter((item) => item.category === id);
  usePageMeta({ title: guide.seoTitle, description: guide.metaDescription });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <nav aria-label={copy.allGuides} className="mb-6 text-sm text-navy/65">
        <Link to="/services" className="hover:text-navy hover:underline">{copy.allServices}</Link>
        <span className="mx-2">/</span>
        <span>{copy.allGuides}</span>
        <span className="mx-2">/</span>
        <span>{categoryTitle}</span>
      </nav>

      <header className="rounded-card bg-navy px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <AppIcon name={category.icon} className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gold-light">{copy.guideLabel}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{guide.seoTitle}</h1>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/90 sm:text-base">{guide.intro}</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {guide.sections.map((section) => (
            <section key={section.heading} className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-650">{section.body}</p>
            </section>
          ))}

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">{copy.faqHeading}</h2>
            <div className="mt-4 space-y-3">
              {guide.faqs.map((faq) => (
                <details key={faq.question} className="rounded-lg border border-cream-dark bg-cream/45 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-navy">{faq.question}</summary>
                  <p className="mt-3 text-sm leading-7 text-gray-650">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">{copy.relatedServices}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((service) => (
                <Link
                  key={service.id}
                  to={`/services/${service.id}`}
                  className="rounded-lg border border-cream-dark bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-cream"
                >
                  {pickText(service.title, language)}
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold text-navy">{guide.ctaTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{guide.ctaBody}</p>
          <Link to="/services" className="btn-primary mt-5 block w-full text-center">{copy.browseServices}</Link>
        </aside>
      </div>
    </main>
  );
}
