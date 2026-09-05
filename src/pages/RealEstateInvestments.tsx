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
    <div className="pb-10">
      {/* Breadcrumb — deliberately short labels (no repeated "Istanbul") and
          nowrap, so it stays on one line instead of stacking above the hero. */}
      <nav className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-hidden whitespace-nowrap px-4 pt-4 pb-3 text-sm text-gray-500">
        <Link to="/real-estate" className="shrink-0 hover:text-navy">{t('invest.crumbParent')}</Link>
        <AppIcon name="arrow-right" className="w-3 h-3 shrink-0 dir-arrow" />
        <span className="truncate font-bold text-navy">{t('invest.crumbHere')}</span>
      </nav>

      {/* Hero — same edge-to-edge curved photo template as /services. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="investHeroCurve" clipPathUnits="objectBoundingBox">
            <path d="M0,0 H1 V0.93 C0.77,0.93 0.63,1 0.46,1 C0.29,1 0.17,0.94 0,0.93 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="relative overflow-hidden animate-fade-in" style={{ clipPath: 'url(#investHeroCurve)' }}>
        <img
          src="/img/discover-real-estate.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          width={1200}
          height={750}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/50 to-black/25" />
        <div className="relative px-6 py-12 sm:py-24 pb-16 sm:pb-28 text-center">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur ring-1 ring-white/25"
            aria-hidden="true"
          >
            <AppIcon name="trending-up" className="w-6 h-6" />
          </span>
          <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
            {t('invest.title')}
          </h1>
          <p className="mt-3 mx-auto max-w-2xl text-sm sm:text-base text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
            {t('invest.body')}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
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
    </div>
  );
}
