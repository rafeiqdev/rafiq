import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';

/**
 * What a visitor sees when the map cannot be shown.
 *
 * THE POINT OF THIS COMPONENT is that it says nothing technical. Not "API key",
 * not "quota", not "referrer", not an environment variable name — the previous
 * copy literally printed GOOGLE_MAPS_SERVER_KEY at people. This site's whole
 * proposition is being more trustworthy than the scam offices its users are
 * trying to avoid, and a raw engineering error shown to a frightened foreigner
 * costs more credibility than having no map at all. The real reason still gets
 * logged to the console in dev (see useGoogleMaps.devDiagnose).
 *
 * ADDRESS: read from VITE_OFFICE_ADDRESS and NEVER invented. There is no street
 * address anywhere in this codebase — LocalBusinessSchema deliberately carries
 * only "İstanbul, TR" — so when the variable is unset this renders the Istanbul
 * link alone rather than fabricating premises that do not exist. Publishing a
 * made-up address on a trust-led site would be the worse failure.
 */

const OFFICE_ADDRESS = (import.meta.env.VITE_OFFICE_ADDRESS as string | undefined)?.trim() || '';

/**
 * A keyless Google Maps URL. This is the Maps URLs endpoint, which is plain
 * navigation — it needs no API key, no billing and no SDK, so it keeps working
 * in exactly the situation that broke the embedded map.
 */
export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export interface MapUnavailableProps {
  /**
   * 'map'    — the interactive map itself cannot be shown.
   * 'search' — the map renders, but place search is unavailable.
   */
  variant?: 'map' | 'search';
  /** Retry handler; only offered when retrying could plausibly help. */
  onRetry?: () => void;
  className?: string;
}

export function MapUnavailable({ variant = 'map', onRetry, className = '' }: MapUnavailableProps) {
  const { t, i18n } = useTranslation();
  const isRTL = ['ar', 'fa'].includes((i18n.language || 'en').split('-')[0]);

  // With no configured address, "İstanbul, Türkiye" is the one location this
  // site actually asserts about itself (see LocalBusinessSchema), so the link
  // stays truthful either way.
  const mapsQuery = OFFICE_ADDRESS || 'İstanbul, Türkiye';

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-6 text-center ${className}`}
      data-testid={variant === 'map' ? 'map-unavailable' : 'map-search-unavailable'}
    >
      <div className="icon-chip mx-auto">
        <AppIcon name={variant === 'map' ? 'map-pin' : 'search'} className="w-6 h-6" />
      </div>

      <h2 className="mt-4 text-lg font-extrabold text-navy">
        {t(variant === 'map' ? 'map.unavailable.title' : 'map.unavailable.searchTitle')}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {t(variant === 'map' ? 'map.unavailable.body' : 'map.unavailable.searchBody')}
      </p>

      {variant === 'map' && (
        <>
          {OFFICE_ADDRESS && (
            <div className="mt-5 rounded-xl bg-cream px-4 py-3 text-start">
              <p className="text-xs font-bold text-navy/60">{t('map.unavailable.addressLabel')}</p>
              {/* The address is usually Turkish/Latin text on an Arabic or Farsi
                  page. <bdi> keeps it from being re-ordered by the surrounding
                  RTL paragraph direction, which is how "Cad. No:12" turns into
                  nonsense; the same pattern the guides already use. */}
              <bdi className="mt-1 block text-sm font-semibold text-navy">{OFFICE_ADDRESS}</bdi>
            </div>
          )}

          <a
            href={googleMapsSearchUrl(mapsQuery)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-5 inline-flex min-h-[44px] w-full"
          >
            <AppIcon name="map-pin" className="w-4 h-4" />
            {t('map.unavailable.openInMaps')}
            {/* Direction-aware: the "leaves the site" arrow must point the way
                the reader is going, not always to the right. */}
            <span aria-hidden className="ms-0.5">
              {isRTL ? '←' : '→'}
            </span>
          </a>
        </>
      )}

      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-3 min-h-[44px] w-full">
          {t('map.retry')}
        </button>
      )}
    </div>
  );
}
