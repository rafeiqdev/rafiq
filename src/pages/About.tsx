import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ABOUT_PAGE } from '../data/aboutPage';
import { usePageMeta } from '../lib/seo';
import { AboutPageSchema } from '../components/AboutPageSchema';

/**
 * /about — who Rafiq is, how the work is done, and what it does not promise.
 *
 * See src/data/aboutPage.ts for the content and for why this page exists: the
 * site previously published no business identity at all, which is a ceiling on
 * both search ranking and AI-answer citation for content about residency,
 * banking and medical treatment.
 *
 * Layout deliberately reuses the same header/card classes as Faq.tsx and
 * CategoryGuide.tsx rather than introducing new ones — this is a text page,
 * and a bespoke visual treatment here would only be one more thing to keep in
 * sync with the rest of the site.
 */
export function About() {
  const { i18n } = useTranslation();
  const language = i18n.language as 'ar' | 'en' | 'ru' | 'fa';
  const isRtl = language === 'ar' || language === 'fa';
  const content = ABOUT_PAGE[language] ?? ABOUT_PAGE.ar;

  usePageMeta({ title: content.seoTitle, description: content.metaDescription });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <AboutPageSchema />

      <header className="rounded-card bg-navy px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{content.title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/90 sm:text-base">{content.intro}</p>
      </header>

      <div className="mt-6 space-y-4">
        {content.sections.map((section) => (
          <section key={section.heading} className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">{section.heading}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-650">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-navy">{content.ctaHeading}</h2>
        <p className="mt-3 text-sm leading-7 text-gray-650">{content.ctaBody}</p>
        <Link
          to="/contact"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-btn bg-navy px-5 text-[14px] font-bold text-white"
        >
          {content.ctaLabel}
        </Link>
      </section>
    </main>
  );
}
