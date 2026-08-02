import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import { condenseDescription } from '../../lib/listingText';
import type { Listing } from '../../lib/types';

/**
 * Collapsible box for a listing description. Renders nothing when condensing
 * leaves no text.
 *
 * Prefers the current locale's translated description (translated once at
 * import time — see scripts/translate-listings.mjs) and falls back to the raw
 * Turkish text so an untranslated row still renders instead of going blank.
 */
export function DescriptionBox({ listing }: { listing: Pick<Listing, 'description' | 'translations'> }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const lang = (i18n.language || 'en').split('-')[0] as 'ar' | 'en' | 'fa' | 'ru';
  const source = listing.translations?.[lang]?.description || listing.description;
  const condensed = condenseDescription(source);

  if (!condensed) return null;

  return (
    <div className="mt-4 rounded-btn border border-cream-dark overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start"
      >
        <span className="flex items-center gap-2 font-bold text-sm text-navy">
          <AppIcon name="file-text" className="w-4 h-4 text-navy/60" />
          {t('realEstate.detail.aboutBox')}
        </span>
        <AppIcon
          name="chevron-down"
          className={`w-4 h-4 shrink-0 text-navy/60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-cream-dark px-3 py-2.5">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{condensed}</p>
        </div>
      )}
    </div>
  );
}
