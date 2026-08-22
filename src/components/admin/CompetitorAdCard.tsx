import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import type { CompetitorAd } from '../../lib/api';

const CONTENT_ICON: Record<string, 'camera' | 'file-text' | 'share-2'> = {
  'صورة': 'camera',
  'فيديو': 'share-2',
  'كاروسيل': 'share-2',
  'نص فقط': 'file-text',
};

function AdRow({ ad }: { ad: CompetitorAd }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const longText = (ad.adText?.length ?? 0) > 220;
  const shownText = longText && !expanded ? `${ad.adText!.slice(0, 220)}…` : ad.adText;

  return (
    <li className="rounded-lg bg-white p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <AppIcon name={CONTENT_ICON[ad.contentType ?? ''] ?? 'file-text'} className="h-3.5 w-3.5 shrink-0 text-navy/50" />
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            ad.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-cream-dark text-navy/50'
          }`}
        >
          {ad.status ?? '—'}
        </span>
        {ad.seenInPreviousImport && (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold-dark">
            {t('competitorAds.card.seenBefore')}
          </span>
        )}
        {ad.startedOn && <span className="text-navy/50">{ad.startedOn}</span>}
        {ad.adUrl && (
          <a href={ad.adUrl} target="_blank" rel="noopener noreferrer" className="ms-auto font-semibold text-navy underline-offset-2 hover:underline">
            {t('competitorAds.card.openInLibrary')}
          </a>
        )}
      </div>
      {ad.platforms && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {ad.platforms.split(',').map((p) => p.trim()).filter(Boolean).map((p) => (
            <span key={p} className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-navy/70">{p}</span>
          ))}
        </div>
      )}
      {shownText && (
        <p className="mt-1.5 whitespace-pre-wrap break-anywhere text-navy/80">
          {shownText}
          {longText && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="ms-1 font-semibold text-navy underline-offset-2 hover:underline">
              {expanded ? t('competitorAds.card.showLess') : t('competitorAds.card.showMore')}
            </button>
          )}
        </p>
      )}
      {ad.amountSpent && <p className="mt-1.5 text-[11px] text-navy/40">{ad.amountSpent}</p>}
    </li>
  );
}

export function CompetitorAdCard({ advertiserName, ads }: { advertiserName: string; ads: CompetitorAd[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeCount = ads.filter((a) => a.status === 'Active').length;
  const platforms = [...new Set(ads.flatMap((a) => (a.platforms ?? '').split(',').map((p) => p.trim()).filter(Boolean)))];

  return (
    <div className="card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-start"
      >
        <span className="flex-1 font-bold text-navy">{advertiserName}</span>
        <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-navy/70">
          {t('competitorAds.card.totalCount', { count: ads.length })}
        </span>
        {activeCount > 0 && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
            {t('competitorAds.card.activeCount', { count: activeCount })}
          </span>
        )}
        <AppIcon name={open ? 'chevron-down' : (document?.dir === 'rtl' ? 'arrow-left' : 'arrow-right')} className="h-4 w-4 shrink-0 text-navy/50" />
      </button>

      {!open && platforms.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {platforms.map((p) => (
            <span key={p} className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-navy/70">{p}</span>
          ))}
        </div>
      )}

      {open && (
        <ul className="mt-3 flex flex-col gap-2">
          {ads.map((ad) => <AdRow key={ad.id} ad={ad} />)}
        </ul>
      )}
    </div>
  );
}
