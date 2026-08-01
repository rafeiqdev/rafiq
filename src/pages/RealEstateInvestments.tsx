import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';
import { useInvestments } from '../hooks/useInvestments';
import { InvestmentCard } from '../components/realestate/InvestmentCard';

/** Index of every investment opportunity, reached from the strip on /real-estate. */
export function RealEstateInvestments() {
  const { t } = useTranslation();
  const { items, loading } = useInvestments();
  usePageMeta({
    title: `${t('invest.title')} — ${t('common.appName')}`,
    description: t('invest.body'),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-gray-500 flex items-center gap-1.5">
        <Link to="/real-estate" className="hover:text-navy">{t('realEstate.title')}</Link>
        <AppIcon name="arrow-right" className="w-3 h-3 dir-arrow" />
        <span className="font-bold text-navy">{t('invest.title')}</span>
      </nav>

      <div className="mt-4 rounded-card bg-gradient-to-r from-navy-dark via-navy to-navy-light px-6 py-7 text-white shadow-card">
        <AppIcon name="trending-up" className="w-7 h-7" />
        <h1 className="mt-2.5 text-2xl font-extrabold">{t('invest.title')}</h1>
        <p className="mt-1.5 text-sm text-white/80 max-w-prose">{t('invest.body')}</p>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-card bg-brand-blue px-4 py-3 text-sm text-navy">
        <AppIcon name="info" className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{t('invest.thresholdNotice')}</span>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {loading
          ? [0, 1, 2, 3].map((i) => <div key={i} className="card h-40 animate-pulse bg-cream-dark/40 sm:col-span-2" />)
          : items.map((opp) => <InvestmentCard key={opp.slug} opp={opp} />)}
      </div>
    </div>
  );
}
