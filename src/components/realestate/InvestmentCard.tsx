import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import { LISTING_PHOTOS } from '../../lib/images';
import {
  type Eligibility,
  citizenshipEligibility,
  priceRange,
  residencyEligibility,
} from '../../data/investments';
import type { InvestmentRecord, LocalizedText } from '../../lib/types';

/** Picks the localised side of a `{ar,en,fa,ru}` field for the active language. */
export function useLocalized() {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || 'en').split('-')[0] as 'ar' | 'en' | 'fa' | 'ru');
  return (field: LocalizedText): string => field[lang] ?? field.en;
}

/**
 * Project photo with a fallback.
 *
 * The official photo packs are requested from each developer's sales office;
 * until they land, `/img/investments/<slug>/…` is missing and this renders a
 * neutral Istanbul photo carrying an explicit "illustrative image" label. That
 * label is not decoration — showing a stand-in photo unlabelled next to a real
 * project name is a misrepresentation a buyer could reasonably rely on.
 */
export function InvestmentPhoto({
  opp,
  index = 0,
  className = '',
}: {
  opp: InvestmentRecord;
  index?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const primary = opp.images[index] ? `/img/investments/${opp.slug}/${opp.images[index]}` : null;
  const fallback = LISTING_PHOTOS[index % LISTING_PHOTOS.length];
  const [failed, setFailed] = useState(!primary);
  const src = failed ? fallback : (primary as string);

  return (
    <>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${className}`}
      />
      {failed && (
        <span className="absolute bottom-1.5 start-1.5 rounded bg-navy/70 px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
          {t('invest.illustrative')}
        </span>
      )}
    </>
  );
}

const TONE: Record<Eligibility, { cls: string; icon: 'check' | 'alert-triangle' | 'x-circle' }> = {
  yes: { cls: 'text-emerald-700', icon: 'check' },
  partial: { cls: 'text-amber-700', icon: 'alert-triangle' },
  no: { cls: 'text-brand-red', icon: 'x-circle' },
};

export function EligibilityValue({ state, kind }: { state: Eligibility; kind: 'citizenship' | 'residency' }) {
  const { t } = useTranslation();
  const tone = TONE[state];
  return (
    <b className={`flex items-center gap-1.5 text-sm ${tone.cls}`}>
      <AppIcon name={tone.icon} className="w-4 h-4 shrink-0" />
      {t(`invest.eligibility.${kind}.${state}`)}
    </b>
  );
}

/**
 * The wide opportunity card injected into the listings feed.
 *
 * It spans the full grid width and carries the project's own accent colour so
 * it never reads as just another apartment card — mixing an editorial
 * investment file in with priced units without that separation would mislead.
 */
export function InvestmentCard({ opp }: { opp: InvestmentRecord }) {
  const { t } = useTranslation();
  const L = useLocalized();

  return (
    <Link
      to={`/real-estate/investments/${opp.slug}`}
      style={{ ['--brand' as string]: opp.brand }}
      className="sm:col-span-2 card overflow-hidden flex flex-col sm:flex-row card-hover"
    >
      {/* A fixed height on both axes. `sm:h-auto` here let the <img> inside
          resolve `h-full` against an auto-height parent, so the photo rendered
          at its intrinsic size and stretched the whole card — and with it the
          page. Never pair an auto-height parent with an h-full image. */}
      <div className="relative w-full h-40 sm:h-52 sm:w-[38%] sm:min-w-[180px] shrink-0 overflow-hidden bg-navy-50">
        {/* No brand-colour film over the photo: nothing sits on it that needs
            the contrast, and the tint only made the project harder to see.
            The card's accent border below already does the separating. */}
        <InvestmentPhoto opp={opp} />
      </div>
      <div className="flex-1 p-4 sm:p-5 flex flex-col gap-2 border-t-4 sm:border-t-0 sm:border-s-4" style={{ borderColor: 'var(--brand)' }}>
        <span
          className="self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold text-white"
          style={{ background: 'var(--brand)' }}
        >
          <AppIcon name="trending-up" className="w-3.5 h-3.5" />
          {t('invest.badge')}
        </span>
        <h3 className="text-lg font-extrabold text-navy leading-snug">{L(opp.name)}</h3>
        <p className="text-xs text-gray-500">
          {opp.developer !== '—' ? `${opp.developer} · ` : ''}{L(opp.district)}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
          <div>
            <span className="block text-[11px] font-semibold text-gray-500">{t('invest.priceRange')}</span>
            <b className="text-sm text-navy" dir="ltr">{priceRange(opp, t('invest.from'))}</b>
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-gray-500">{t('invest.citizenshipShort')}</span>
            <EligibilityValue state={citizenshipEligibility(opp)} kind="citizenship" />
          </div>
          <div className="hidden sm:block">
            <span className="block text-[11px] font-semibold text-gray-500">{t('invest.residencyShort')}</span>
            <EligibilityValue state={residencyEligibility(opp)} kind="residency" />
          </div>
        </div>
        <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--brand)' }}>
          {t('invest.openFile')}
          <AppIcon name="arrow-right" className="w-4 h-4 dir-arrow" />
        </span>
      </div>
    </Link>
  );
}
