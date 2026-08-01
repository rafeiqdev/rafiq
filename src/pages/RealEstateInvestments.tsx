import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';

/**
 * Investment opportunities.
 *
 * The opportunity files themselves are supplied per project and are not in the
 * database yet, so this ships as an honest empty state rather than a page of
 * invented yields — a fabricated return figure on a property page is the one
 * mistake here that costs real money and real trust. The route exists now so
 * the strip on the listings page leads somewhere real, and so the layout is
 * ready the moment the first opportunity is loaded.
 */
export function RealEstateInvestments() {
  const { t } = useTranslation();
  usePageMeta({
    title: `${t('realEstate.invest.title')} — ${t('common.appName')}`,
    description: t('realEstate.invest.body'),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="text-sm text-gray-500 flex items-center gap-1.5">
        <Link to="/real-estate" className="hover:text-navy">{t('realEstate.title')}</Link>
        <AppIcon name="arrow-right" className="w-3 h-3 dir-arrow" />
        <span className="font-bold text-navy">{t('realEstate.invest.title')}</span>
      </nav>

      <div className="card mt-5 overflow-hidden">
        <div className="bg-gradient-to-r from-gold-dark via-gold to-navy px-6 py-8 text-white">
          <AppIcon name="trending-up" className="w-8 h-8" />
          <h1 className="mt-3 text-2xl font-extrabold">{t('realEstate.invest.title')}</h1>
          <p className="mt-1.5 text-sm text-white/80">{t('realEstate.invest.body')}</p>
        </div>

        <div className="p-6">
          <h2 className="font-bold text-navy">{t('realEstate.invest.emptyTitle')}</h2>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{t('realEstate.invest.emptyBody')}</p>

          <ul className="mt-5 flex flex-col gap-2.5">
            {(['yield', 'payback', 'photos', 'risks'] as const).map((k) => (
              <li key={k} className="flex items-start gap-2.5 text-sm text-gray-600">
                <AppIcon name="check-circle" className="w-4 h-4 mt-0.5 shrink-0 text-navy" />
                {t(`realEstate.invest.point.${k}`)}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/premium" className="btn-primary">
              <AppIcon name="message-circle" className="w-4 h-4" />
              {t('realEstate.invest.contact')}
            </Link>
            <Link to="/real-estate" className="btn-secondary">{t('realEstate.detail.backToList')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
