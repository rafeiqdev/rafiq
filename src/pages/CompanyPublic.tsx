import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { companies } from '../lib/api';
import type { CompanyPublic as CompanyPublicT, Review } from '../lib/types';
import { SERVICE_CATEGORIES, SERVICES, pickText } from '../data/services';
import { pickArea } from '../data/istanbulAreas';
import { ReviewStars } from '../components/ReviewStars';
import { AppIcon, BackArrow } from '../components/AppIcon';
import { RafiqLoaderScreen } from '../components/RafiqLoader';

export function CompanyPublic() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id = '' } = useParams();
  const [company, setCompany] = useState<CompanyPublicT | null | undefined>(undefined);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    companies.byId(id).then((c) => {
      setCompany(c);
      if (c) companies.reviewsFor(id).then(setReviews).catch(() => {});
    }).catch(() => setCompany(null));
  }, [id]);

  if (company === undefined) {
    return <RafiqLoaderScreen />;
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <p className="text-sm text-navy/70">{t('company.public.notFound')}</p>
          <Link to="/services" className="btn-primary w-full mt-6">{t('nav.allServices')}</Link>
        </div>
      </div>
    );
  }

  const catLabels = company.categories.map((c) => SERVICE_CATEGORIES.find((x) => x.id === c)).filter(Boolean).map((c) => pickText(c!.title, lang));
  const svcLabels = company.services.map((s) => SERVICES.find((x) => x.id === s)).filter(Boolean).map((s) => pickText(s!.title, lang));

  return (
    <div className="pb-16">
      <section className="bg-gradient-to-br from-navy to-navy-light text-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link to="/services" className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white">
            <BackArrow className="w-3 h-3" />
            {t('company.public.back')}
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 overflow-hidden flex items-center justify-center shrink-0">
              {company.logo ? <img src={company.logo} alt="" className="w-full h-full object-cover" /> : <AppIcon name="building" className="w-7 h-7" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight">{company.name}</h1>
              <div className="mt-2"><ReviewStars rating={company.rating} count={company.reviewsCount} /></div>
            </div>
          </div>
          {company.description && <p className="mt-4 text-white/85 text-sm">{company.description}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        {catLabels.length > 0 && (
          <div className="card p-5">
            <h2 className="font-bold text-navy text-sm">{t('company.public.services')}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...catLabels, ...svcLabels].map((l, i) => (
                <span key={i} className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-navy/80">{l}</span>
              ))}
            </div>
          </div>
        )}

        {company.areas.length > 0 && (
          <div className="card p-5">
            <h2 className="font-bold text-navy text-sm">{t('company.public.areas')}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {company.areas.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-navy/80">
                  <AppIcon name="map-pin" className="w-3 h-3" />{pickArea(a, lang)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5">
          <h2 className="font-bold text-navy text-sm">{t('company.public.reviews')}</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{t('company.public.noReviews')}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl bg-cream px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <ReviewStars rating={r.rating} />
                    <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString(i18n.language)}</span>
                  </div>
                  {r.text && <p className="mt-2 text-sm text-navy/80 break-anywhere">{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-navy/40">{t('company.public.contactInPlatform')}</p>
      </div>
    </div>
  );
}
