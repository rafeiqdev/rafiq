import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { COMPARISONS } from '../data/comparisons';
import { usePageMeta } from '../lib/seo';

function copyFor(language: string) {
  if (language === 'en') {
    return {
      notFoundTitle: 'Comparison not found',
      notFoundText: 'Return to the services list and choose the category that fits your needs.',
      allServices: 'View all services',
      comparisonLabel: 'Comparison',
      faqHeading: 'Common questions',
      aspectHeading: 'What matters',
    };
  }
  if (language === 'ru') {
    return {
      notFoundTitle: 'Сравнение не найдено',
      notFoundText: 'Вернитесь к списку услуг и выберите подходящую категорию.',
      allServices: 'Все услуги',
      comparisonLabel: 'Сравнение',
      faqHeading: 'Частые вопросы',
      aspectHeading: 'Что важно',
    };
  }
  if (language === 'fa') {
    return {
      notFoundTitle: 'مقایسه یافت نشد',
      notFoundText: 'به فهرست خدمات برگردید و دسته مناسب را انتخاب کنید.',
      allServices: 'مشاهده همه خدمات',
      comparisonLabel: 'مقایسه',
      faqHeading: 'پرسش‌های رایج',
      aspectHeading: 'نکته مهم',
    };
  }
  return {
    notFoundTitle: 'المقارنة غير موجودة',
    notFoundText: 'يمكنك العودة إلى قائمة الخدمات واختيار الفئة المناسبة لك.',
    allServices: 'عرض كل الخدمات',
    comparisonLabel: 'مقارنة',
    faqHeading: 'أسئلة شائعة',
    aspectHeading: 'النقطة',
  };
}

function ComparisonNotFound() {
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

/**
 * "Rafiq vs. X" comparison page. Deliberately mirrors CategoryGuide.tsx's
 * layout (same header/card/sticky-CTA structure, same class names) so this
 * new content type reads as a native part of the site instead of a
 * bolted-on design — see src/data/comparisons.ts for why the content itself
 * is a separate data source.
 */
export function Comparison() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const language = i18n.language as 'ar' | 'en' | 'ru' | 'fa';
  const copy = copyFor(language);
  const isRtl = language === 'ar' || language === 'fa';
  const comparison = id ? COMPARISONS[id]?.[language] : undefined;

  if (!comparison) return <ComparisonNotFound />;

  usePageMeta({ title: comparison.seoTitle, description: comparison.metaDescription });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <nav aria-label={copy.comparisonLabel} className="mb-6 text-sm text-navy/65">
        <Link to="/services" className="hover:text-navy hover:underline">{copy.allServices}</Link>
        <span className="mx-2">/</span>
        <span>{copy.comparisonLabel}</span>
      </nav>

      <header className="rounded-card bg-navy px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <AppIcon name="scale" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gold-light">{copy.comparisonLabel}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{comparison.seoTitle}</h1>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/90 sm:text-base">{comparison.intro}</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="bg-cream/60 text-start">
                    <th className="p-4 text-start font-extrabold text-navy">{copy.aspectHeading}</th>
                    <th className="p-4 text-start font-extrabold text-navy">{comparison.aloneLabel}</th>
                    <th className="p-4 text-start font-extrabold text-navy">{comparison.rafiqLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.aspect} className="border-t border-cream-dark">
                      <td className="p-4 align-top font-bold text-navy">{row.aspect}</td>
                      <td className="p-4 align-top leading-6 text-gray-650">{row.alone}</td>
                      <td className="p-4 align-top leading-6 text-gray-650">{row.rafiq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {comparison.sections.map((section) => (
            <section key={section.heading} className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-650">{section.body}</p>
            </section>
          ))}

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">{copy.faqHeading}</h2>
            <div className="mt-4 space-y-3">
              {comparison.faqs.map((faq) => (
                <details key={faq.question} className="rounded-lg border border-cream-dark bg-cream/45 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-navy">{faq.question}</summary>
                  <p className="mt-3 text-sm leading-7 text-gray-650">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold text-navy">{comparison.ctaTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{comparison.ctaBody}</p>
          <Link to="/services" className="btn-primary mt-5 block w-full text-center">{copy.allServices}</Link>
        </aside>
      </div>
    </main>
  );
}
