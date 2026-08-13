import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { ServiceRequestModal } from '../components/ServiceRequestModal';
import { useCatalog } from '../data/catalogStore';
import { pickText } from '../data/services';
import type { ServiceType } from '../data/services';
import { SERVICE_SEO_AR } from '../data/serviceSeoAr';
import { usePageMeta } from '../lib/seo';

function ServiceNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <AppIcon name="search" className="mx-auto h-12 w-12 text-navy/25" />
      <h1 className="mt-4 text-xl font-extrabold text-navy">الخدمة غير موجودة</h1>
      <p className="mt-2 text-sm text-gray-600">يمكنك العودة إلى قائمة الخدمات واختيار الخدمة المناسبة لك.</p>
      <Link to="/services" className="btn-primary mt-6 inline-flex">عرض كل الخدمات</Link>
    </main>
  );
}

/**
 * A crawlable service page. Arabic pages add verified, service-specific search
 * intents; the other site languages retain their own catalog title/description
 * and therefore never claim Arabic copy as translated content.
 */
export function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { services, categories } = useCatalog();
  const { i18n } = useTranslation();
  const [showRequest, setShowRequest] = useState(false);
  const service = services.find((item) => item.id === id);

  if (!service) return <ServiceNotFound />;

  const language = i18n.language;
  const isArabic = language === 'ar';
  const category = categories.find((item) => item.id === service.category);
  const title = pickText(service.title, language);
  const description = pickText(service.desc, language);
  const categoryTitle = category ? pickText(category.title, language) : '';
  const arabicSeo = isArabic ? SERVICE_SEO_AR[service.id] : undefined;
  const seoTitle = arabicSeo?.seoTitle ?? `${title} — ${categoryTitle}`;
  const seoDescription = arabicSeo?.metaDescription ?? description;
  const related = services.filter((item) => item.category === service.category && item.id !== service.id).slice(0, 4);
  const serviceMode = service.type as ServiceType;

  usePageMeta({ title: seoTitle, description: seoDescription });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <nav aria-label="مسار التنقل" className="mb-6 text-sm text-navy/65">
        <Link to="/services" className="hover:text-navy hover:underline">الخدمات</Link>
        <span className="mx-2">/</span>
        <span>{categoryTitle}</span>
      </nav>

      <header className="rounded-card bg-navy px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <AppIcon name={service.icon} className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gold-light">{categoryTitle}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{seoTitle}</h1>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/90 sm:text-base">{seoDescription}</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy">كيف يساعدك رفيق في هذه الخدمة؟</h2>
            <p className="mt-3 text-sm leading-7 text-gray-650">{description}</p>
            <p className="mt-3 text-sm leading-7 text-gray-650">
              {serviceMode === 'direct'
                ? 'يقدّم رفيق تنسيق هذه الخدمة مباشرة، ويمكنك إرسال احتياجك ليتم ترتيب الخطوة التالية معك.'
                : 'ينسّق رفيق هذه الخدمة عبر شريك مختص، ويمكنك إرسال احتياجك ليتم توجيهك إلى الخطوة المناسبة.'}
            </p>
          </section>

          {arabicSeo && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-navy">أسئلة ومواضيع مرتبطة بالخدمة</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                هذه أبرز الموضوعات التي يبحث عنها العملاء قبل بدء الإجراءات. المتطلبات والقرارات النهائية تعتمد على حالتك والجهات المختصة.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2" dir="rtl">
                {arabicSeo.searchPhrases.map((phrase) => (
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
              <h2 className="text-lg font-extrabold text-navy">خدمات ذات صلة</h2>
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
          <h2 className="text-lg font-extrabold text-navy">اطلب المساعدة</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">أرسل تفاصيل احتياجك وسننسق معك الخطوة التالية للخدمة المطلوبة.</p>
          <button type="button" className="btn-primary mt-5 w-full" onClick={() => setShowRequest(true)}>
            طلب مساعدة لهذه الخدمة
          </button>
          <Link to="/services" className="btn-secondary mt-3 w-full text-center">
            العودة إلى كل الخدمات
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
