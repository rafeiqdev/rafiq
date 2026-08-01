import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';
import {
  CITIZENSHIP_THRESHOLD_USD,
  INVESTMENTS,
  RESIDENCY_THRESHOLD_USD,
  citizenshipEligibility,
  investmentBySlug,
  priceRange,
  residencyEligibility,
} from '../data/investments';
import {
  EligibilityValue,
  InvestmentPhoto,
  useLocalized,
} from '../components/realestate/InvestmentCard';
import {
  LISTING_SERVICES,
  ServiceRow,
  useListingService,
} from '../components/realestate/ListingServices';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

export function InvestmentDetail() {
  const { t } = useTranslation();
  const L = useLocalized();
  const { slug } = useParams<{ slug: string }>();
  const opp = investmentBySlug(slug ?? '');
  const [tab, setTab] = useState<'overview' | 'pros' | 'cons'>('overview');

  usePageMeta({
    title: opp ? `${L(opp.name)} — ${t('invest.title')}` : t('invest.title'),
    description: opp ? L(opp.summary) : t('invest.body'),
  });

  // The lead goes through the same pipeline as a listing request, so an
  // opportunity enquiry lands in the admin inbox next to everything else.
  const { sent, busy, request } = useListingService(
    opp ? { id: opp.slug, district: L(opp.name), rooms: opp.developer, m2: 0, priceUsd: opp.minUsd, citizenship: false } : null,
  );

  if (!opp) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <AppIcon name="trending-up" className="w-12 h-12 mx-auto text-navy/25" />
        <h1 className="mt-4 text-xl font-extrabold text-navy">{t('invest.missingTitle')}</h1>
        <Link to="/real-estate/investments" className="btn-primary mt-6">{t('invest.backToList')}</Link>
      </div>
    );
  }

  const cit = citizenshipEligibility(opp);
  const res = residencyEligibility(opp);
  const others = INVESTMENTS.filter((o) => o.slug !== opp.slug).slice(0, 3);
  const brand = { ['--brand' as string]: opp.brand };

  const Facts = (
    <table className="w-full text-sm mt-3">
      <tbody>
        {[
          [t('invest.facts.developer'), opp.developer === '—' ? t('invest.facts.unknown') : opp.developer],
          [t('invest.facts.location'), `${L(opp.district)} — ${t(`invest.side.${opp.side}`)}`],
          [t('invest.facts.type'), L(opp.type)],
          [t('invest.facts.price'), priceRange(opp, t('invest.from'))],
        ].map(([k, v]) => (
          <tr key={k} className="border-b border-cream-dark last:border-0">
            <td className="py-2.5 pe-3 text-gray-500 font-semibold align-top w-[38%]">{k}</td>
            <td className="py-2.5 text-navy">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Pros = (
    <ul className="flex flex-col gap-3 mt-3">
      {opp.pros.map((p) => (
        <li key={L(p)} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <AppIcon name="check" className="w-3 h-3" />
          </span>
          {L(p)}
        </li>
      ))}
    </ul>
  );

  const Cons = (
    <>
      <p className="mt-1 text-xs text-gray-500">{t('invest.risksNote')}</p>
      <ul className="flex flex-col gap-3 mt-3">
        {opp.cons.map((c) => (
          <li key={L(c)} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AppIcon name="alert-triangle" className="w-3 h-3" />
            </span>
            {L(c)}
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div style={brand}>
      {/* hero — the project's own colour washes the bottom of the photo */}
      <div className="relative min-h-[220px] sm:min-h-[280px] flex items-end text-white">
        <div className="absolute inset-0">
          <InvestmentPhoto opp={opp} />
        </div>
        <span
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, var(--brand) 8%, rgba(0,0,0,.45) 55%, rgba(0,0,0,.15))' }}
        />
        <div className="relative w-full mx-auto max-w-6xl px-4 pb-6 pt-10">
          {opp.developer !== '—' && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 px-3 py-1 text-xs font-bold mb-3">
              {opp.developer}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{L(opp.name)}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
            <AppIcon name="map-pin" className="w-4 h-4" />
            {L(opp.district)} — {t(`invest.side.${opp.side}`)}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        {/* eligibility bar */}
        <div className="relative z-10 -mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-card bg-cream-dark shadow-card">
          <div className="bg-white p-3.5">
            <span className="block text-[11.5px] font-semibold text-gray-500">{t('invest.priceRange')}</span>
            <b className="text-sm text-navy" dir="ltr">{priceRange(opp, t('invest.from'))}</b>
          </div>
          <div className="bg-white p-3.5">
            <span className="block text-[11.5px] font-semibold text-gray-500">
              {t('invest.citizenshipWith', { amount: usd(CITIZENSHIP_THRESHOLD_USD) })}
            </span>
            <EligibilityValue state={cit} kind="citizenship" />
          </div>
          <div className="bg-white p-3.5">
            <span className="block text-[11.5px] font-semibold text-gray-500">
              {t('invest.residencyWith', { amount: usd(RESIDENCY_THRESHOLD_USD) })}
            </span>
            <EligibilityValue state={res} kind="residency" />
          </div>
          <div className="bg-white p-3.5">
            <span className="block text-[11.5px] font-semibold text-gray-500">{t('invest.facts.type')}</span>
            <b className="text-sm text-navy line-clamp-2">{L(opp.type)}</b>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
          <div className="flex flex-col gap-5">
            {opp.images.length > 1 && (
              <div className="grid grid-cols-3 gap-2 rounded-card overflow-hidden">
                <div className="relative col-span-2 row-span-2 h-44 sm:h-64">
                  <InvestmentPhoto opp={opp} index={0} />
                </div>
                {opp.images.slice(1, 3).map((_, i) => (
                  <div key={i} className="relative h-[86px] sm:h-[126px]">
                    <InvestmentPhoto opp={opp} index={i + 1} />
                  </div>
                ))}
              </div>
            )}

            {/* mobile: tabs keep the page short. desktop: all three stacked. */}
            <div className="lg:hidden flex gap-1.5 rounded-card bg-white p-1.5 shadow-card">
              {(['overview', 'pros', 'cons'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex-1 rounded-btn py-2 text-xs font-bold transition-colors ${
                    tab === k ? 'text-white' : 'text-gray-500'
                  }`}
                  style={tab === k ? { background: 'var(--brand)' } : undefined}
                >
                  {t(`invest.tab.${k}`)}
                </button>
              ))}
            </div>

            <div className={`card p-5 ${tab === 'overview' ? '' : 'hidden lg:block'}`}>
              <h2 className="flex items-center gap-2 font-bold text-navy">
                <span className="h-4 w-1 rounded-sm" style={{ background: 'var(--brand)' }} />
                {t('invest.tab.overview')}
              </h2>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{L(opp.summary)}</p>
              {Facts}
            </div>

            <div className={`card p-5 ${tab === 'pros' ? '' : 'hidden lg:block'}`}>
              <h2 className="flex items-center gap-2 font-bold text-navy">
                <span className="h-4 w-1 rounded-sm" style={{ background: 'var(--brand)' }} />
                {t('invest.tab.pros')}
              </h2>
              {Pros}
            </div>

            <div className={`card p-5 ${tab === 'cons' ? '' : 'hidden lg:block'}`}>
              <h2 className="flex items-center gap-2 font-bold text-navy">
                <span className="h-4 w-1 rounded-sm" style={{ background: 'var(--brand)' }} />
                {t('invest.tab.cons')}
              </h2>
              {Cons}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-card p-5 text-white shadow-card" style={{ background: 'var(--brand)' }}>
              <span className="text-xs font-semibold text-white/80">{t('invest.priceRange')}</span>
              <b className="mt-0.5 block text-2xl font-extrabold" dir="ltr">{priceRange(opp, t('invest.from'))}</b>
              <p className="mt-2 text-xs text-white/80">{t('invest.priceCaveat')}</p>
              <button
                onClick={() => request('opportunity')}
                disabled={sent.opportunity || busy === 'opportunity'}
                className="btn mt-4 w-full bg-white font-bold disabled:opacity-70"
                style={{ color: 'var(--brand)' }}
              >
                {sent.opportunity ? t('realEstate.requested') : t('invest.requestFile')}
              </button>
            </div>

            <div className="card p-5">
              <h2 className="font-bold text-navy">{t('invest.servicesTitle')}</h2>
              <div className="mt-3 flex flex-col gap-2.5">
                {LISTING_SERVICES.map((s) => (
                  <ServiceRow
                    key={s.key}
                    serviceKey={s.key}
                    icon={s.icon}
                    sent={!!sent[s.key]}
                    busy={busy === s.key}
                    onClick={() => request(s.key)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-card bg-brand-blue px-4 py-3 text-xs text-navy">
              <AppIcon name="lock" className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {t('invest.disclaimer')}{' '}
                <a href={opp.source.url} target="_blank" rel="noopener noreferrer nofollow" className="font-bold underline">
                  {opp.source.label}
                </a>
              </span>
            </div>
          </div>
        </div>

        <h2 className="mt-9 font-extrabold text-navy text-lg">{t('invest.others')}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {others.map((o) => (
            <Link key={o.slug} to={`/real-estate/investments/${o.slug}`} className="card card-hover overflow-hidden">
              <div className="relative h-24">
                <InvestmentPhoto opp={o} />
                <span className="absolute inset-0 opacity-40" style={{ background: o.brand }} />
              </div>
              <div className="p-3">
                <b className="block text-sm text-navy">{L(o.name)}</b>
                <small className="text-xs text-gray-500" dir="ltr">{priceRange(o, t('invest.from'))}</small>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
