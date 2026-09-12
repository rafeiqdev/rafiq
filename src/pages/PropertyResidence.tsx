import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { ServiceRequestModal } from '../components/ServiceRequestModal';
import { PROPERTY_RESIDENCE } from '../data/propertyResidence';
import { CATEGORY_HERO_IMAGE } from '../data/categoryHeroImages';
import { usePageMeta } from '../lib/seo';
import { track } from '../lib/analytics';
import { HAS_WHATSAPP, whatsappHref } from '../lib/contact';
import type { Lang } from '../lib/types';

/**
 * The canonical page for "الإقامة العقارية في إسطنبول" (property residence
 * permit in Istanbul) — see src/data/propertyResidence.ts for the content and
 * for why this lives apart from /services/res-property instead of on it.
 *
 * Layout deliberately mirrors CategoryGuide.tsx (same header treatment, card
 * shapes, sticky sidebar and class names) so it reads as a native part of the
 * site rather than a bolted-on landing page.
 */

/**
 * Each section arrives as one long block. Split on sentence ends and re-group
 * into readable paragraphs — purely visual, no word added, removed or
 * reordered. Same helper CategoryGuide.tsx uses for the same reason.
 */
function paragraphsFrom(body: string): string[] {
  const sentences = body.match(/[^.!?؟۔]+[.!?؟۔]+\s*|[^.!?؟۔]+$/g);
  if (!sentences || sentences.length < 2 || body.length < 320) return [body];
  const wanted = Math.min(sentences.length, Math.max(2, Math.ceil(body.length / 250)));
  const perParagraph = Math.ceil(sentences.length / wanted);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) {
    out.push(sentences.slice(i, i + perParagraph).join('').trim());
  }
  return out.filter(Boolean);
}

export function PropertyResidence() {
  const { t, i18n } = useTranslation();
  const [showRequest, setShowRequest] = useState(false);
  const language = (['ar', 'en', 'ru', 'fa'] as const).includes(i18n.language as Lang)
    ? (i18n.language as Lang)
    : 'ar';
  const content = PROPERTY_RESIDENCE[language];
  const isRtl = language === 'ar' || language === 'fa';
  const heroImage = CATEGORY_HERO_IMAGE.realestate;
  const waHref = whatsappHref(content.whatsappMessage);
  // The service page this one hands off to — looked up by path, not index, so
  // reordering `related` in the content file cannot silently change the link.
  const serviceLink = content.related.find((item) => item.to === '/services/res-property');

  usePageMeta({ title: content.seoTitle, description: content.metaDescription });

  const sectionId = (index: number) => `section-${index + 1}`;
  // The Q&A already visible on the page, marked up so search engines can show
  // it as a rich result instead of guessing at it.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <nav aria-label={content.breadcrumbLabel} className="mb-6 text-sm text-navy/65">
        <Link to="/real-estate" className="hover:text-navy hover:underline">{t('nav.realEstate')}</Link>
        <span className="mx-2">/</span>
        <span>{content.navLabel}</span>
      </nav>

      {/* Same header treatment as a category guide: deep gradient, a real
          photo bleeding in from the trailing edge, title over an overlay. */}
      <header className="relative overflow-hidden rounded-card shadow-card">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-navy-dark via-navy to-navy-light" />
        <img
          src={heroImage}
          alt={content.heroAlt}
          loading="eager"
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
        <div className="relative px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <AppIcon name="building" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gold-light">{content.eyebrow}</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{content.h1}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">{content.intro}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {content.highlights.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs leading-6 text-white/90 sm:text-[13px]"
              >
                <AppIcon name="check" className="mt-1 h-3.5 w-3.5 shrink-0 text-gold-light" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className="btn-gold"
              onClick={() => {
                track('request_started', { target: 'res-property', meta: { category: 'residency' } });
                setShowRequest(true);
              }}
            >
              <AppIcon name="message-circle" className="h-4 w-4" />
              {content.ctaButton}
            </button>
            <a
              href="#faq"
              className="inline-flex h-11 items-center gap-2 rounded-btn border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {content.faqHeading}
            </a>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {content.sections.map((section, index) => (
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

          <section id="documents" className="card scroll-mt-24 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="icon-chip !h-9 !w-9">
                <AppIcon name="file-check" className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold text-navy sm:text-xl">{content.documentsHeading}</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">{content.documentsIntro}</p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {content.documents.map((doc) => (
                <li key={doc.label} className="rounded-xl border border-cream-dark bg-cream/45 px-4 py-3">
                  <span className="block text-sm font-bold text-navy">{doc.label}</span>
                  <span className="mt-1 block text-[13px] leading-6 text-gray-650">{doc.note}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="steps" className="card scroll-mt-24 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="icon-chip !h-9 !w-9">
                <AppIcon name="compass" className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold text-navy sm:text-xl">{content.stepsHeading}</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">{content.stepsIntro}</p>
            <ol className="mt-4 space-y-3">
              {content.steps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3 rounded-xl border border-cream-dark bg-white px-4 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-extrabold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-navy">{step.title}</span>
                    <span className="mt-1 block text-[15px] leading-8 text-gray-650">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section id="faq" className="card scroll-mt-24 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="icon-chip !h-9 !w-9">
                <AppIcon name="info" className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold text-navy sm:text-xl">{content.faqHeading}</h2>
            </div>
            <div className="mt-4 space-y-2.5">
              {content.faqs.map((faq) => (
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

          {/* The outbound half of the topic cluster: every page a reader of
              this one plausibly needs next, linked with its own descriptive
              anchor rather than a bare "read more". */}
          <section id="related" className="card scroll-mt-24 p-5 sm:p-7">
            <h2 className="text-lg font-extrabold text-navy sm:text-xl">{content.relatedHeading}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{content.relatedIntro}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {content.related.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-start gap-3 rounded-xl border border-cream-dark bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-card"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream text-gold-dark transition-colors group-hover:bg-gold group-hover:text-white">
                    <AppIcon name="arrow-right" className="h-4 w-4 dir-arrow" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-navy">{item.label}</span>
                    <span className="mt-1 block text-xs leading-6 text-gray-600">{item.note}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <nav aria-label={content.onThisPage} className="card hidden p-5 lg:block">
            <p className="text-xs font-bold uppercase tracking-wide text-navy/50">{content.onThisPage}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {content.sections.map((section, index) => (
                <li key={section.heading}>
                  <a href={`#${sectionId(index)}`} className="text-navy/75 transition-colors hover:text-navy hover:underline">
                    {section.heading}
                  </a>
                </li>
              ))}
              <li>
                <a href="#documents" className="text-navy/75 transition-colors hover:text-navy hover:underline">
                  {content.documentsHeading}
                </a>
              </li>
              <li>
                <a href="#steps" className="text-navy/75 transition-colors hover:text-navy hover:underline">
                  {content.stepsHeading}
                </a>
              </li>
              <li>
                <a href="#faq" className="text-navy/75 transition-colors hover:text-navy hover:underline">
                  {content.faqHeading}
                </a>
              </li>
            </ul>
          </nav>

          <div className="card p-5">
            <h2 className="text-lg font-extrabold text-navy">{content.ctaTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">{content.ctaBody}</p>
            <button
              type="button"
              className="btn-gold mt-5 w-full"
              onClick={() => {
                track('request_started', { target: 'res-property', meta: { category: 'residency' } });
                setShowRequest(true);
              }}
            >
              {content.ctaButton}
            </button>
            {HAS_WHATSAPP && waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => track('whatsapp_clicked', { target: 'property_residence_sidebar' })}
                className="btn-secondary mt-3 flex w-full items-center justify-center gap-2"
              >
                <AppIcon name="message-circle" className="h-4 w-4" />
                {content.whatsappButton}
              </a>
            )}
            {serviceLink && (
              <Link
                to={serviceLink.to}
                className="mt-3 block text-center text-sm font-semibold text-navy/70 hover:text-navy hover:underline"
              >
                {serviceLink.label}
              </Link>
            )}
            <p className="mt-5 border-t border-cream-dark pt-4 text-xs leading-6 text-gray-600">{content.disclaimer}</p>
          </div>
        </aside>
      </div>

      {showRequest && (
        <ServiceRequestModal
          source={{ id: 'res-property', title: content.navLabel, category: 'residency', type: 'partner' }}
          onClose={() => setShowRequest(false)}
        />
      )}
    </main>
  );
}
