import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { ServiceRequestModal } from '../components/ServiceRequestModal';
import { useCatalog } from '../data/catalogStore';
import { pickText } from '../data/services';
import type { ServiceType } from '../data/services';
import { SERVICE_SEO_AR } from '../data/serviceSeoAr';
import { SERVICE_SEO_EN } from '../data/serviceSeoEn';
import { SERVICE_SEO_RU } from '../data/serviceSeoRu';
import { SERVICE_SEO_FA } from '../data/serviceSeoFa';
import { usePageMeta } from '../lib/seo';

function copyFor(language: string) {
  if (language === 'en') {
    return {
      notFoundTitle: 'Service not found',
      notFoundText: 'Return to the services list and choose the service that fits your needs.',
      allServices: 'View all services',
      breadcrumb: 'Services',
      breadcrumbLabel: 'Breadcrumb',
      howHeading: 'How can Rafiq help with this service?',
      directSupport: 'Rafiq coordinates {service} directly. Send your needs and we will discuss an appropriate next step with you.',
      partnerSupport: 'Rafiq coordinates {service} through a partner. Send your needs for guidance on an appropriate next step.',
      topicsHeading: 'Common questions and related topics',
      topicsIntro: 'These are common topics customers research before starting. Requirements and final decisions depend on your situation and the relevant authorities or providers.',
      relatedHeading: 'Related services',
      requestHeading: 'Request assistance',
      requestText: 'Send details about your needs and we will coordinate an appropriate next step for the requested service.',
      requestButton: 'Request help for this service',
      returnButton: 'Return to all services',
      readMore: 'Read more',
      readLess: 'Show less',
    };
  }
  if (language === 'ru') {
    return {
      notFoundTitle: 'Услуга не найдена',
      notFoundText: 'Вернитесь к списку услуг и выберите услугу, которая соответствует вашим потребностям.',
      allServices: 'Все услуги',
      breadcrumb: 'Услуги',
      breadcrumbLabel: 'Навигационная цепочка',
      howHeading: 'Как Rafiq может помочь с этой услугой?',
      directSupport: 'Rafiq координирует услугу «{service}» напрямую. Отправьте свой запрос, и мы обсудим подходящий следующий шаг.',
      partnerSupport: 'Rafiq координирует услугу «{service}» через партнёра. Отправьте свой запрос, чтобы получить ориентир по следующему шагу.',
      topicsHeading: 'Частые вопросы и связанные темы',
      topicsIntro: 'Это распространённые темы, которые клиенты изучают до начала процесса. Требования и окончательные решения зависят от вашей ситуации и компетентных органов или поставщиков.',
      relatedHeading: 'Связанные услуги',
      requestHeading: 'Запросить помощь',
      requestText: 'Отправьте сведения о своей потребности, и мы скоординируем подходящий следующий шаг для запрошенной услуги.',
      requestButton: 'Запросить помощь по услуге',
      returnButton: 'Вернуться ко всем услугам',
      readMore: 'Читать далее',
      readLess: 'Свернуть',
    };
  }
  if (language === 'fa') {
    return {
      notFoundTitle: 'خدمت یافت نشد',
      notFoundText: 'به فهرست خدمات برگردید و خدمتی را انتخاب کنید که با نیاز شما متناسب است.',
      allServices: 'مشاهده همه خدمات',
      breadcrumb: 'خدمات',
      breadcrumbLabel: 'مسیر راهنما',
      howHeading: 'Rafiq چگونه می‌تواند در این خدمت کمک کند؟',
      directSupport: 'Rafiq خدمت «{service}» را مستقیماً هماهنگ می‌کند. نیاز خود را بفرستید تا درباره گام بعدی مناسب صحبت کنیم.',
      partnerSupport: 'Rafiq خدمت «{service}» را از طریق همکار هماهنگ می‌کند. نیاز خود را بفرستید تا برای گام بعدی مناسب راهنمایی شوید.',
      topicsHeading: 'پرسش‌های رایج و موضوعات مرتبط',
      topicsIntro: 'این‌ها موضوعات رایجی هستند که مشتریان پیش از شروع بررسی می‌کنند. شرایط و تصمیم‌های نهایی به وضعیت شما و مراجع یا ارائه‌کنندگان مربوط بستگی دارد.',
      relatedHeading: 'خدمات مرتبط',
      requestHeading: 'درخواست کمک',
      requestText: 'جزئیات نیاز خود را بفرستید تا گام بعدی مناسب برای خدمت درخواستی را هماهنگ کنیم.',
      requestButton: 'درخواست کمک برای این خدمت',
      returnButton: 'بازگشت به همه خدمات',
      readMore: 'ادامه مطلب',
      readLess: 'نمایش کمتر',
    };
  }
  return {
    notFoundTitle: 'الخدمة غير موجودة',
    notFoundText: 'يمكنك العودة إلى قائمة الخدمات واختيار الخدمة المناسبة لك.',
    allServices: 'عرض كل الخدمات',
    breadcrumb: 'الخدمات',
    breadcrumbLabel: 'مسار التنقل',
    howHeading: 'كيف يساعدك رفيق في هذه الخدمة؟',
    directSupport: 'يقدّم رفيق تنسيق خدمة «{service}» مباشرة، ويمكنك إرسال احتياجك ليتم ترتيب الخطوة التالية معك.',
    partnerSupport: 'ينسّق رفيق خدمة «{service}» عبر شريك مختص، ويمكنك إرسال احتياجك ليتم توجيهك إلى الخطوة المناسبة.',
    topicsHeading: 'أسئلة ومواضيع مرتبطة بالخدمة',
    topicsIntro: 'هذه أبرز الموضوعات التي يبحث عنها العملاء قبل بدء الإجراءات. المتطلبات والقرارات النهائية تعتمد على حالتك والجهات المختصة.',
    relatedHeading: 'خدمات ذات صلة',
    requestHeading: 'اطلب المساعدة',
    requestText: 'أرسل تفاصيل احتياجك وسننسق معك الخطوة التالية للخدمة المطلوبة.',
    requestButton: 'طلب مساعدة لهذه الخدمة',
    returnButton: 'العودة إلى كل الخدمات',
    readMore: 'قراءة المزيد',
    readLess: 'عرض أقل',
  };
}

/**
 * Fallback hero photo per category, used only when a service has no admin-set
 * image of its own. Each service normally shows its OWN photo (`service.image`,
 * set per service in the admin panel); this map just keeps the header looking
 * intentional for the few services/categories that don't have one yet. A
 * category absent here simply falls back to the plain blue gradient.
 */
const CATEGORY_HERO_IMAGE: Record<string, string> = {
  residency: '/images/services/official/residence.webp',
  realestate: '/images/services/official/real-estate.webp',
  tourism: '/images/services/official/tourism.webp',
  translation: '/images/services/official/translation.webp',
  banking: '/images/services/official/banking.webp',
  health: '/images/services/official/health.webp',
};

/** Renders "**bold**" spans within a line; everything else passes through as-is. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-bold text-navy">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

/**
 * Splits a service body on blank lines and renders each block by shape:
 * a single "## "/"### " line becomes a heading, a block of "| ... |" lines
 * becomes a table, a block where every line starts with "- " or "1. " becomes
 * a list, otherwise it's a paragraph. "**bold**" works inside any block.
 */
function renderServiceBody(body: string) {
  return body.split('\n\n').map((block, index) => {
    const lines = block.split('\n').filter(Boolean);

    if (lines.length === 1 && lines[0].startsWith('### ')) {
      return (
        <h3 key={index} className="pt-1 text-base font-extrabold text-navy">
          {renderInline(lines[0].slice(4))}
        </h3>
      );
    }
    if (lines.length === 1 && lines[0].startsWith('## ')) {
      return (
        <h2 key={index} className="pt-1 text-lg font-extrabold text-navy">
          {renderInline(lines[0].slice(3))}
        </h2>
      );
    }

    const isTable = lines.length >= 2 && lines.every((line) => line.trim().startsWith('|'));
    if (isTable) {
      const rows = lines
        .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
        .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
      const [head, ...bodyRows] = rows;
      return (
        <div key={index} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {head.map((cell, i) => (
                  <th key={i} className="border-b border-gray-200 py-2 ps-3 text-start font-bold text-navy">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((cells, r) => (
                <tr key={r}>
                  {cells.map((cell, c) => (
                    <td key={c} className="border-b border-gray-100 py-2 ps-3 text-gray-650">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const isBulletList = lines.length > 0 && lines.every((line) => line.startsWith('- '));
    if (isBulletList) {
      return (
        <ul key={index} className="list-disc space-y-1.5 ps-5 text-sm leading-7 text-gray-650">
          {lines.map((line) => (
            <li key={line}>{renderInline(line.slice(2))}</li>
          ))}
        </ul>
      );
    }

    const isNumberedList = lines.length > 0 && lines.every((line) => /^\d+\.\s/.test(line));
    if (isNumberedList) {
      return (
        <ol key={index} className="list-decimal space-y-1.5 ps-5 text-sm leading-7 text-gray-650">
          {lines.map((line) => (
            <li key={line}>{renderInline(line.replace(/^\d+\.\s/, ''))}</li>
          ))}
        </ol>
      );
    }

    return (
      <p key={index} className="text-sm leading-7 text-gray-650">
        {renderInline(block)}
      </p>
    );
  });
}

function ServiceNotFound() {
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
 * A crawlable service page. Arabic, English, Russian and Persian pages add
 * reviewed, service-specific search intents; other languages keep their catalog
 * text until their own reviewed SEO copy is ready.
 */
export function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { services, categories } = useCatalog();
  const { i18n } = useTranslation();
  const [showRequest, setShowRequest] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const service = services.find((item) => item.id === id);

  const language = i18n.language;
  const isRtl = language === 'ar' || language === 'fa';
  const copy = copyFor(language);
  const category = service ? categories.find((item) => item.id === service.category) : undefined;
  const title = service ? pickText(service.title, language) : '';
  const description = service ? pickText(service.desc, language) : '';
  const categoryTitle = category ? pickText(category.title, language) : '';
  const serviceSeo = service
    ? language === 'ar'
      ? SERVICE_SEO_AR[service.id]
      : language === 'en'
        ? SERVICE_SEO_EN[service.id]
        : language === 'ru'
          ? SERVICE_SEO_RU[service.id]
          : language === 'fa'
            ? SERVICE_SEO_FA[service.id]
            : undefined
    : undefined;
  const seoTitle = service ? (serviceSeo?.seoTitle ?? `${title} — ${categoryTitle}`) : copy.notFoundTitle;
  const seoDescription = service ? (serviceSeo?.metaDescription ?? description) : copy.notFoundText;
  const related = service
    ? services.filter((item) => item.category === service.category && item.id !== service.id).slice(0, 4)
    : [];
  const serviceMode = service?.type as ServiceType;
  // Each service shows its own admin-set photo; the curated category photo is
  // only a fallback when a service has none.
  const heroImage = service ? (service.image ?? CATEGORY_HERO_IMAGE[service.category]) : undefined;

  // usePageMeta is a hook and must run unconditionally on every render — the
  // catalog loads admin overrides asynchronously, so `service` can flip from
  // found to not-found between renders of this same component instance.
  // Returning <ServiceNotFound /> before this call (as before) changed the
  // hook count between renders and crashed with React error #300 whenever
  // that happened (e.g. tour-vip while overrides were loading/hiding it).
  usePageMeta({ title: seoTitle, description: seoDescription, noindex: !service });

  if (!service) return <ServiceNotFound />;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <nav aria-label={copy.breadcrumbLabel} className="mb-6 text-sm text-navy/65">
        <Link to="/services" className="hover:text-navy hover:underline">{copy.breadcrumb}</Link>
        <span className="mx-2">/</span>
        {/* Links back to the category guide so every service page also feeds
            link equity to its guide, not just the other way around. */}
        <Link to={`/guides/${service.category}`} className="hover:text-navy hover:underline">{categoryTitle}</Link>
      </nav>

      <header className="relative overflow-hidden rounded-card shadow-card">
        {/* Improved blue: a deep diagonal gradient instead of the old flat navy. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-navy-dark via-navy to-navy-light"
        />
        {heroImage && (
          <>
            {/* Category photo bleeds in from the trailing edge. */}
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              loading="lazy"
              onError={(e) => {
                // If a service's photo URL fails, hide the image so only the
                // blue gradient shows — never a broken-image icon.
                e.currentTarget.style.display = 'none';
              }}
              className={`pointer-events-none absolute inset-y-0 h-full w-3/5 object-cover object-center ${
                isRtl ? 'left-0' : 'right-0'
              }`}
            />
            {/* Navy gradient keeps the title fully readable over the photo. */}
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
              <AppIcon name={service.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gold-light">{categoryTitle}</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{seoTitle}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">{seoDescription}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {serviceSeo?.body && (
            <section key={service.id} className="card p-5 sm:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
              {/* The full body always renders in the DOM — collapsing is purely
                  visual (max-height + fade), so search engines still see the
                  whole thing even though most readers only see a preview. */}
              <div className={`relative space-y-3 overflow-hidden ${bodyExpanded ? '' : 'max-h-[26rem]'}`}>
                {renderServiceBody(serviceSeo.body)}
                {!bodyExpanded && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setBodyExpanded((value) => !value)}
                className="mt-3 text-sm font-bold text-gold-dark hover:underline"
              >
                {bodyExpanded ? copy.readLess : copy.readMore}
              </button>
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">{copy.howHeading}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-650">{description}</p>
            <p className="mt-3 text-sm leading-7 text-gray-650">
              {(serviceMode === 'direct' ? copy.directSupport : copy.partnerSupport).replace('{service}', title)}
            </p>
          </section>

          {serviceSeo && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">{copy.topicsHeading}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{copy.topicsIntro}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2" dir={isRtl ? 'rtl' : 'ltr'}>
                {serviceSeo.searchPhrases.map((phrase) => (
                  <li key={phrase} className="flex gap-2 rounded-lg bg-cream px-3 py-2 text-sm leading-6 text-navy/85">
                    <AppIcon name="check" className="mt-1 h-3.5 w-3.5 shrink-0 text-gold-dark" />
                    <span>{phrase}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">{copy.relatedHeading}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    to={`/services/${item.id}`}
                    className="rounded-lg border border-cream-dark bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-cream"
                  >
                    {pickText(item.title, language)}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold text-navy">{copy.requestHeading}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{copy.requestText}</p>
          <button type="button" className="btn-primary mt-5 w-full" onClick={() => setShowRequest(true)}>
            {copy.requestButton}
          </button>
          <Link to="/services" className="btn-secondary mt-3 w-full text-center">
            {copy.returnButton}
          </Link>
        </aside>
      </div>

      {showRequest && (
        <ServiceRequestModal
          source={{ id: service.id, title, category: service.category, type: serviceMode }}
          onClose={() => setShowRequest(false)}
        />
      )}
    </main>
  );
}
