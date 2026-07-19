import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { placeFavorites, places as placesApi, placeSearch } from '../../lib/api';
import { PLACE_CATEGORIES } from '../../lib/types';
import type { FavoritePlace, GooglePlaceResult, PlaceCategory, PlaceOverlay } from '../../lib/types';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';
import { PlaceCard } from './PlaceCard';

const ISTANBUL = { lat: 41.0151, lng: 28.9795 };
const DEFAULT_ZOOM = 12;
const SEARCH_RADIUS_M = 6000;

/**
 * AdvancedMarkerElement requires a Map ID that actually exists in the Google
 * Cloud project — an arbitrary string is rejected and the markers never render.
 * `DEMO_MAP_ID` is Google's documented development placeholder; production
 * should set a real Map ID (Cloud Console → Map Management) so custom styling
 * and quota attribution work.
 */
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID';

const CATEGORY_ICONS: Record<PlaceCategory, IconName> = {
  dining: 'utensils',
  hotels: 'hotel',
  hospitals: 'stethoscope',
  notary: 'file-text',
  government: 'landmark',
  shopping: 'shopping-bag',
  arabic: 'languages',
};

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface MapExplorerProps {
  /** Phones get a stacked layout and a taller map; desktop gets the split view. */
  compact?: boolean;
}

/**
 * The whole map feature in one place.
 *
 * Both routes (/map desktop and mobile) render this — the previous Leaflet
 * implementation was two 250–300 line near-identical files, and every fix had
 * to be made twice.
 *
 * Data model: Google Places is the discovery pool; `places.overlay()` adds
 * Rafiq's editorial layer on top, keyed by Google place id. A place is only
 * ever badged "recommended" when an admin reviewed it — the database refuses
 * the row otherwise, so no code path here can invent one.
 */
export function MapExplorer({ compact = false }: MapExplorerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { status: mapsStatus } = useGoogleMaps();

  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  // One Autocomplete session token per typing session. Google bills a session
  // as ONE request when the token is reused across keystrokes and then passed
  // to the follow-up Details call — a fresh token per keystroke is billed per
  // keystroke, which is the classic way this feature gets expensive.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [overlays, setOverlays] = useState<Map<string, PlaceOverlay>>(new Map());
  const [state, setState] = useState<LoadState>('idle');
  const [selected, setSelected] = useState<GooglePlaceResult | null>(null);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.googlePlaceId)), [favorites]);

  // ---- map bootstrap --------------------------------------------------------
  useEffect(() => {
    if (mapsStatus !== 'ready' || !mapNodeRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(mapNodeRef.current, {
      center: ISTANBUL,
      zoom: DEFAULT_ZOOM,
      mapId: MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
    });
  }, [mapsStatus]);

  useEffect(() => {
    placeFavorites.list().then(setFavorites).catch(() => {});
  }, []);

  // ---- markers + clustering -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapsStatus !== 'ready') return;

    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    const withCoords = results.filter((r) => r.lat !== null && r.lng !== null);
    const markers = withCoords.map((r) => {
      const overlay = overlays.get(r.placeId);
      const pin = new google.maps.marker.PinElement({
        // Recommended places are visually distinct on the map itself, not only
        // in the list — that is the whole point of the editorial layer.
        background: overlay?.recommended ? '#C9A227' : '#1B2A4A',
        borderColor: '#ffffff',
        glyphColor: '#ffffff',
        scale: overlay?.recommended ? 1.2 : 1,
      });
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: r.lat as number, lng: r.lng as number },
        title: r.name,
        content: pin.element,
      });
      marker.addListener('click', () => openPlace(r));
      return marker;
    });

    markersRef.current = markers;
    // Clustering keeps the map readable when a category returns 20 pins in a
    // few streets — without it central Istanbul is an unreadable pin stack.
    clustererRef.current =
      clustererRef.current ?? new MarkerClusterer({ map, markers: [] });
    clustererRef.current.addMarkers(markers);

    if (withCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      withCoords.forEach((r) => bounds.extend({ lat: r.lat as number, lng: r.lng as number }));
      map.fitBounds(bounds, 48);
    }
    // openPlace is stable enough for this effect; results/overlays drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, overlays, mapsStatus]);

  // ---- searching ------------------------------------------------------------
  const runSearch = useCallback(
    async (kind: 'nearby' | 'text', arg: string) => {
      setState('loading');
      setSelected(null);
      setSuggestions([]);
      const map = mapRef.current;
      const centre = map?.getCenter();
      const lat = centre?.lat() ?? ISTANBUL.lat;
      const lng = centre?.lng() ?? ISTANBUL.lng;

      const res =
        kind === 'nearby'
          ? await placeSearch.nearby(arg, lat, lng, SEARCH_RADIUS_M, lang)
          : await placeSearch.text(arg, lat, lng, SEARCH_RADIUS_M, lang);

      if (res.error) {
        setResults([]);
        setState('error');
        return;
      }
      setResults(res.places);
      // One overlay query for the whole page of results, not one per card.
      setOverlays(await placesApi.overlay(res.places.map((p) => p.placeId)));
      setState(res.places.length === 0 ? 'empty' : 'ready');
    },
    [lang],
  );

  const pickCategory = (c: PlaceCategory) => {
    setQuery('');
    setCategory(c);
    runSearch('nearby', c);
  };

  const submitQuery = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setCategory(null);
    // The typing session ends here — the next keystroke starts a fresh one.
    sessionTokenRef.current = null;
    runSearch('text', q);
  };

  // ---- autocomplete ---------------------------------------------------------
  useEffect(() => {
    if (mapsStatus !== 'ready') return;
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    // Debounced: Autocomplete is billed per session, but an un-debounced field
    // still floods the network on every keystroke.
    const timer = setTimeout(async () => {
      try {
        sessionTokenRef.current =
          sessionTokenRef.current ?? new google.maps.places.AutocompleteSessionToken();
        const { suggestions: raw } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sessionTokenRef.current,
            language: lang,
            region: 'tr',
            locationBias: new google.maps.Circle({
              center: ISTANBUL,
              radius: SEARCH_RADIUS_M * 4,
            }),
          });
        if (!alive) return;
        setSuggestions(
          raw
            .map((s) => s.placePrediction)
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
            .slice(0, 5)
            .map((p) => ({ placeId: p.placeId, text: p.text.toString() })),
        );
      } catch {
        if (alive) setSuggestions([]);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, lang, mapsStatus]);

  /** A suggestion resolves straight to Details — that closes the billing session. */
  const pickSuggestion = async (placeId: string, text: string) => {
    setQuery(text);
    setSuggestions([]);
    setState('loading');
    const place = await placeSearch.details(placeId, lang);
    sessionTokenRef.current = null;
    if (!place) {
      setState('error');
      return;
    }
    setResults([place]);
    setOverlays(await placesApi.overlay([place.placeId]));
    setState('ready');
    setSelected(place);
  };

  // ---- selection ------------------------------------------------------------
  const openPlace = async (p: GooglePlaceResult) => {
    // Show what we already have immediately, then fill in the rich fields —
    // the card must never be a spinner over data we are holding.
    setSelected(p);
    const full = await placeSearch.details(p.placeId, lang);
    if (full) setSelected((cur) => (cur?.placeId === p.placeId ? full : cur));
    const map = mapRef.current;
    if (map && p.lat !== null && p.lng !== null) {
      map.panTo({ lat: p.lat, lng: p.lng });
      if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
    }
  };

  const toggleFavorite = async (p: GooglePlaceResult) => {
    const saved = favoriteIds.has(p.placeId);
    // Optimistic: the star must respond on tap, not after a round-trip.
    setFavorites((f) =>
      saved
        ? f.filter((x) => x.googlePlaceId !== p.placeId)
        : [
            {
              id: `tmp-${p.placeId}`,
              googlePlaceId: p.placeId,
              name: p.name,
              category,
              address: p.address,
              lat: p.lat,
              lng: p.lng,
              createdAt: new Date().toISOString(),
            },
            ...f,
          ],
    );
    try {
      if (saved) await placeFavorites.remove(p.placeId);
      else await placeFavorites.add(p, category);
      setFavorites(await placeFavorites.list());
    } catch {
      // Roll back to the server's truth rather than leaving a lie on screen.
      setFavorites(await placeFavorites.list().catch(() => []));
    }
  };

  // ---- SDK-level failures ---------------------------------------------------
  if (mapsStatus === 'no-key' || mapsStatus === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip mx-auto">
            <AppIcon name="alert-triangle" className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-navy">{t('map.error.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t(mapsStatus === 'no-key' ? 'map.error.noKey' : 'map.error.body')}
          </p>
        </div>
      </div>
    );
  }

  const recommendedCount = results.filter((r) => overlays.get(r.placeId)?.recommended).length;

  return (
    <div className={`mx-auto max-w-6xl px-4 ${compact ? 'py-5 pb-28' : 'py-10'}`}>
      <header>
        <h1 className={`font-extrabold text-navy ${compact ? 'text-xl' : 'text-3xl'}`}>{t('map.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('map.subtitle')}</p>
      </header>

      {/* search */}
      <div className="relative mt-5">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              className="input w-full pe-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitQuery()}
              placeholder={t('map.searchPlaceholder')}
              aria-label={t('map.searchPlaceholder')}
              autoComplete="off"
            />
            <AppIcon
              name="search"
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-navy/40"
            />
          </div>
          <button onClick={() => submitQuery()} disabled={!query.trim()} className="btn-primary min-h-[44px] px-5 disabled:opacity-50">
            {t('map.searchBtn')}
          </button>
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute z-20 inset-x-0 top-full mt-1 rounded-xl border border-gray-200 bg-white shadow-cardHover overflow-hidden">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  onClick={() => pickSuggestion(s.placeId, s.text)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-start text-sm text-navy hover:bg-cream min-h-[44px]"
                >
                  <AppIcon name="map-pin" className="w-4 h-4 shrink-0 text-navy/50" />
                  <span className="min-w-0 break-words">{s.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* category filters */}
      <div className={`mt-4 flex gap-2 ${compact ? 'overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}>
        {PLACE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => pickCategory(c)}
            aria-pressed={category === c}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3.5 min-h-[40px] text-[13px] font-semibold transition-colors ${
              category === c ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-navy hover:border-navy/40'
            }`}
          >
            <AppIcon name={CATEGORY_ICONS[c]} className="w-4 h-4" />
            {t(`map.categories.${c}`)}
          </button>
        ))}
      </div>

      <div className={`mt-5 grid gap-5 ${compact ? '' : 'lg:grid-cols-[1.3fr_1fr]'}`}>
        {/* map */}
        <div
          ref={mapNodeRef}
          role="application"
          aria-label={t('map.title')}
          className={`w-full rounded-2xl border border-gray-200 overflow-hidden bg-cream ${compact ? 'h-[320px]' : 'h-[560px]'}`}
        />

        {/* results, kept in sync with the markers */}
        <section aria-live="polite" className={compact ? '' : 'max-h-[560px] overflow-y-auto pe-1'}>
          {state === 'idle' && (
            <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              {t('map.idle')}
            </p>
          )}

          {state === 'loading' && (
            <ul className="flex flex-col gap-2.5" role="status" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="h-[86px] rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </ul>
          )}

          {state === 'error' && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center">
              <AppIcon name="alert-triangle" className="mx-auto w-5 h-5 text-amber-700" />
              <p className="mt-2 text-sm font-semibold text-navy">{t('map.error.title')}</p>
              <p className="mt-1 text-xs text-gray-600">{t('map.error.body')}</p>
              <button
                onClick={() => (category ? runSearch('nearby', category) : submitQuery())}
                className="btn-secondary mt-4 min-h-[44px]"
              >
                {t('map.retry')}
              </button>
            </div>
          )}

          {state === 'empty' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
              <AppIcon name="inbox" className="mx-auto w-5 h-5 text-navy/50" />
              <p className="mt-2 text-sm font-semibold text-navy">{t('map.empty.title')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('map.empty.body')}</p>
            </div>
          )}

          {state === 'ready' && (
            <>
              <p className="text-xs font-semibold text-navy/60">
                {t('map.directory.count', { count: results.length })}
                {recommendedCount > 0 && ` · ${t('map.recommendedCount', { count: recommendedCount })}`}
              </p>
              <ul className="mt-2.5 flex flex-col gap-2.5">
                {results.map((r) => {
                  const overlay = overlays.get(r.placeId);
                  const active = selected?.placeId === r.placeId;
                  return (
                    <li key={r.placeId}>
                      <button
                        onClick={() => openPlace(r)}
                        aria-pressed={active}
                        className={`w-full rounded-xl border p-3 text-start transition-colors ${
                          active ? 'border-navy bg-brand-blue' : 'border-gray-200 bg-white hover:border-navy/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 font-bold text-navy break-words">{r.name}</span>
                          {overlay?.recommended && (
                            <span className="shrink-0 rounded-full bg-gold-soft text-gold-dark text-[10px] font-bold px-2 py-0.5">
                              {t('map.recommended')}
                            </span>
                          )}
                        </div>
                        {r.address && <p className="mt-0.5 text-xs text-gray-500 break-words">{r.address}</p>}
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-navy/70">
                          {r.rating !== null && (
                            <span className="flex items-center gap-1">
                              <AppIcon name="star" className="w-3.5 h-3.5 text-gold-dark" />
                              <span dir="ltr">{r.rating.toFixed(1)}</span>
                            </span>
                          )}
                          {favoriteIds.has(r.placeId) && (
                            <span className="flex items-center gap-1 text-gold-dark">
                              <AppIcon name="bookmark" className="w-3.5 h-3.5" />
                              {t('map.saved')}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      {selected && (
        <PlaceCard
          place={selected}
          overlay={overlays.get(selected.placeId)}
          saved={favoriteIds.has(selected.placeId)}
          onToggleSave={() => toggleFavorite(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
