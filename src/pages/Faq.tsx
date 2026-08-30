import { useTranslation } from 'react-i18next';
import { FAQ_HUB } from '../data/faqHub';
import { usePageMeta } from '../lib/seo';

/**
 * /faq — one consolidated page of short answers across categories, distinct
 * from CategoryGuide (one deep topic) and Comparison (two paths contrasted).
 * See src/data/faqHub.ts for why this shape matters for AI-answer-engine
 * citation. Layout intentionally reuses the same header/card classes as
 * CategoryGuide.tsx and Comparison.tsx rather than introducing new ones.
 */
export function Faq() {
  const { i18n } = useTranslation();
  const language = i18n.language as 'ar' | 'en' | 'ru' | 'fa';
  const isRtl = language === 'ar' || language === 'fa';
  const content = FAQ_HUB[language] ?? FAQ_HUB.ar;

  usePageMeta({ title: content.seoTitle, description: content.metaDescription });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="rounded-card bg-navy px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{content.seoTitle}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/90 sm:text-base">{content.intro}</p>
      </header>

      <div className="mt-6 space-y-6">
        {content.categories.map((category) => (
          <section key={category.heading} className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">{category.heading}</h2>
            <div className="mt-4 space-y-3">
              {category.items.map((item) => (
                <details key={item.question} className="rounded-lg border border-cream-dark bg-cream/45 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-navy">{item.question}</summary>
                  <p className="mt-3 text-sm leading-7 text-gray-650">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
