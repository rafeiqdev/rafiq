import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { placeFavorites, places as placesApi, placeSearch } from '../../lib/api';
import type { PlaceSearchError } from '../../lib/api';
import { PLACE_CATEGORIES } from '../../lib/types';
import type { FavoritePlace, GooglePlaceResult, PlaceCategory, PlaceOverlay } from '../../lib/types';
import { useGoogleMaps, isMapUnavailable, devDiagnose } from '../../hooks/useGoogleMaps';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';
import { PlaceCard } from './PlaceCard';
import { MapUnavailable } from './MapUnavailable';

const ISTANBUL = { lat: 41.0151, lng: 28.9795 };
const DEFAULT_ZOOM = 12;
const SEARCH_RADIUS_M = 6000;

/**
 * How long to wait for a first tile after the SDK reports success. Google gives
 * no callback for quota/billing degradation, so this timeout is the only way to
 * notice it — generous enough not to punish a slow connection.
 */
const TILE_TIMEOUT_MS = 12000;

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

/** Pin colour per category — purely visual, distinguishes marker clusters at a glance. */
const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  dining: '#E11D48',
  hotels: '#7C3AED',
  hospitals: '#DB2777',
  notary: '#2563EB',
  government: '#0F766E',
  shopping: '#059669',
  arabic: '#B45309',
};

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type SortKey = 'best' | 'rating' | 'distance' | 'recommended';
const SORT_KEYS: SortKey[] = ['best', 'rating', 'distance', 'recommended'];

type LatLng = { lat: number; lng: number };

/** Great-circle distance in metres — good enough for a "how far" label. */
function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

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
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
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
  /** A real tile has painted — only then is it safe to uncover the container. */
  const [tilesReady, setTilesReady] = useState(false);
  /** Authenticated but nothing ever rendered; treated as unavailable. */
  const [tilesTimedOut, setTilesTimedOut] = useState(false);
  // Which kind of failure: a configuration problem (missing/rejected server
  // key) gets its own message — telling the user to "try again later" for a
  // key that will never appear on its own sent them chasing a ghost.
  const [searchError, setSearchError] = useState<PlaceSearchError | null>(null);
  const [selected, setSelected] = useState<GooglePlaceResult | null>(null);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  // The user's real GPS position, once granted — searches then centre on them
  // instead of the middle of Istanbul, so "near me" actually means near them.
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const userLocationRef = useRef<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);
  // Centre the last search ran from, so distances stay stable while sorting.
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [sort, setSort] = useState<SortKey>('best');
  // What the user typed vs. what we actually sent to Google, for the honesty chip.
  const [translation, setTranslation] = useState<{ original: string; translated: string } | null>(null);
  // Phone-only: map is a collapsible pane above the list, not a permanent half
  // of the screen — there isn't room for both at once on a phone.
  const [mobileMapOpen, setMobileMapOpen] = useState(true);
  // Client-side refinements over data Google already gave us — never a claim
  // we can't back (no "Arabic-speaking staff" toggle: nothing in the API says so).
  const [quickFilters, setQuickFilters] = useState({ openNow: false, topRated: false });

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.googlePlaceId)), [favorites]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // ---- map bootstrap --------------------------------------------------------
  //
  // The container stays covered by our own placeholder until a tile actually
  // paints. This is what stops Google's "didn't load Google Maps correctly" card
  // from ever being seen: constructing the Map is what triggers the rejection,
  // and gm_authFailure fires in that same moment — but only AFTER the element
  // exists. Revealing on `tilesloaded` means the container is only uncovered
  // once Google has genuinely rendered something.
  useEffect(() => {
    if (mapsStatus !== 'ready' || !mapNodeRef.current || mapRef.current) return;
    const map = new google.maps.Map(mapNodeRef.current, {
      center: ISTANBUL,
      zoom: DEFAULT_ZOOM,
      mapId: MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
    });
    mapRef.current = map;
    const listener = google.maps.event.addListenerOnce(map, 'tilesloaded', () => setTilesReady(true));
    return () => listener?.remove();
  }, [mapsStatus]);

  // Belt-and-braces for the failures Google gives us no signal for at all: if
  // the SDK authenticated but no tile ever arrives (a degraded/over-quota
  // project, a silently dropped tile request), the visitor would otherwise sit
  // in front of our placeholder forever. After this timeout we stop pretending
  // and show the same fallback.
  useEffect(() => {
    if (mapsStatus !== 'ready' || tilesReady) return;
    const timer = setTimeout(() => {
      setTilesTimedOut(true);
      devDiagnose(
        'ready',
        `The SDK authenticated but no map tile rendered within ${TILE_TIMEOUT_MS}ms. ` +
          'Typically a project-level quota/billing problem, which Google exposes no callback for.',
      );
    }, TILE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mapsStatus, tilesReady]);

  useEffect(() => {
    placeFavorites.list().then(setFavorites).catch(() => {});
  }, []);

  // Quick filters narrow the pool everything downstream (map pins + list)
  // draws from — both fields come straight from Google, nothing invented.
  const filteredResults = useMemo(
    () =>
      results.filter((r) => {
        if (quickFilters.openNow && r.openNow !== true) return false;
        if (quickFilters.topRated && (r.rating ?? 0) < 4.5) return false;
        return true;
      }),
    [results, quickFilters],
  );

  // ---- markers + clustering -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapsStatus !== 'ready') return;

    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    const withCoords = filteredResults.filter((r) => r.lat !== null && r.lng !== null);
    const markers = withCoords.map((r) => {
      const overlay = overlays.get(r.placeId);
      const pin = new google.maps.marker.PinElement({
        // Recommended places are visually distinct on the map itself, not only
        // in the list — that is the whole point of the editorial layer. Other
        // pins are tinted by the active category so a results page reads as
        // one colour family on the map, not a wall of identical navy drops.
        background: overlay?.recommended ? '#C9A227' : category ? CATEGORY_COLORS[category] : '#1B2A4A',
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
      if (userLocationRef.current) bounds.extend(userLocationRef.current);
      map.fitBounds(bounds, 48);
    }
    // openPlace is stable enough for this effect; results/overlays drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredResults, overlays, mapsStatus, category]);

  // Un-hiding the mobile map pane resizes its container without a window
  // resize event ever firing — Maps needs to be told explicitly or it keeps
  // painting at its old (zero) size.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !compact || !mobileMapOpen) return;
    const timer = setTimeout(() => google.maps.event.trigger(map, 'resize'), 50);
    return () => clearTimeout(timer);
  }, [mobileMapOpen, compact]);

  // ---- "you are here" marker ------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapsStatus !== 'ready') return;
    if (!userLocation) {
      if (userMarkerRef.current) userMarkerRef.current.map = null;
      userMarkerRef.current = null;
      return;
    }
    const dot = document.createElement('div');
    dot.setAttribute(
      'style',
      'width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.35);',
    );
    if (userMarkerRef.current) userMarkerRef.current.map = null;
    userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      position: userLocation,
      title: t('map.myLocation'),
      content: dot,
      zIndex: 9999,
    });
    userMarkerRef.current.map = map;
  }, [userLocation, mapsStatus, t]);

  // ---- searching ------------------------------------------------------------
  const runSearch = useCallback(
    async (kind: 'nearby' | 'text', arg: string, originOverride?: LatLng) => {
      setState('loading');
      setSelected(null);
      setSuggestions([]);
      const map = mapRef.current;
      const centre = map?.getCenter();
      const from: LatLng =
        originOverride ??
        userLocationRef.current ??
        (centre ? { lat: centre.lat(), lng: centre.lng() } : ISTANBUL);
      setOrigin(from);

      const res =
        kind === 'nearby'
          ? await placeSearch.nearby(arg, from.lat, from.lng, SEARCH_RADIUS_M, lang)
          : await placeSearch.text(arg, from.lat, from.lng, SEARCH_RADIUS_M, lang);

      if (res.error) {
        setResults([]);
        setSearchError(res.error);
        setState('error');
        return;
      }
      setSearchError(null);
      // Show the Turkish-translation hint only when translation actually changed
      // the text — a Turkish or Latin query is searched verbatim.
      if (
        kind === 'text' &&
        res.query &&
        res.translatedQuery &&
        res.translatedQuery.trim().toLowerCase() !== res.query.trim().toLowerCase()
      ) {
        setTranslation({ original: res.query, translated: res.translatedQuery });
      } else {
        setTranslation(null);
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
    setSort('best');
    runSearch('nearby', c);
  };

  const submitQuery = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setCategory(null);
    setSort('best');
    // The typing session ends here — the next keystroke starts a fresh one.
    sessionTokenRef.current = null;
    runSearch('text', q);
  };

  // ---- geolocation ("near me") ---------------------------------------------
  const locateMe = () => {
    if (!('geolocation' in navigator)) {
      setLocError(true);
      return;
    }
    setLocating(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        userLocationRef.current = loc;
        const map = mapRef.current;
        if (map) {
          map.panTo(loc);
          if ((map.getZoom() ?? 0) < 14) map.setZoom(14);
        }
        setLocating(false);
        // Refresh whatever the user was looking at, now centred on them. With no
        // active search, show what's around them (dining is the safest default).
        if (category) runSearch('nearby', category, loc);
        else if (query.trim()) runSearch('text', query.trim(), loc);
        else {
          setCategory('dining');
          setSort('distance');
          runSearch('nearby', 'dining', loc);
        }
      },
      () => {
        setLocating(false);
        setLocError(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
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
              center: userLocationRef.current ?? ISTANBUL,
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
      } catch (e) {
        // Suggestions vanishing is not itself alarming to a visitor (the search
        // button still works), so this stays silent on screen — but it is often
        // the FIRST sign of a rejected key, so the owner gets it in dev.
        devDiagnose('ready', 'Places Autocomplete request failed — often the earliest sign of a key problem.', e);
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
    setTranslation(null);
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

  // ---- derived: distance + sorted list --------------------------------------
  const distanceOf = useCallback(
    (r: GooglePlaceResult): number | null => {
      if (!origin || r.lat === null || r.lng === null) return null;
      return distanceM(origin, { lat: r.lat, lng: r.lng });
    },
    [origin],
  );

  // The list mirrors the map pins exactly: same filteredResults pool, just sorted.
  const visibleResults = useMemo(() => {
    const arr = [...filteredResults];
    if (sort === 'rating') {
      arr.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === 'distance') {
      arr.sort((a, b) => (distanceOf(a) ?? Infinity) - (distanceOf(b) ?? Infinity));
    } else if (sort === 'recommended') {
      arr.sort(
        (a, b) =>
          Number(Boolean(overlays.get(b.placeId)?.recommended)) -
          Number(Boolean(overlays.get(a.placeId)?.recommended)),
      );
    }
    return arr;
  }, [filteredResults, sort, distanceOf, overlays]);

  const formatDistance = (m: number): string =>
    m < 950
      ? t('map.distanceM', { m: Math.round(m / 10) * 10 })
      : t('map.distanceKm', { km: (m / 1000).toFixed(1) });

  // ---- SDK-level failures ---------------------------------------------------
  // no-key / error / blocked, plus the case where the SDK reported success but
  // no tile ever painted. All four resolve to the SAME dignified fallback: the
  // visitor is never told which, and never shown Google's own error card.
  if (isMapUnavailable(mapsStatus) || tilesTimedOut) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <MapUnavailable variant="map" />
      </div>
    );
  }

  const recommendedCount = filteredResults.filter((r) => overlays.get(r.placeId)?.recommended).length;

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

      {/* near-me + translated-query hint */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={locateMe}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 bg-white px-3.5 min-h-[40px] text-[13px] font-semibold text-navy hover:border-navy/40 disabled:opacity-60"
        >
          <AppIcon name="navigation" className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
          {locating ? t('map.locating') : t('map.nearMe')}
        </button>
        {userLocation && !locError && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
            <AppIcon name="map-pin" className="w-3.5 h-3.5" />
            {t('map.usingYourLocation')}
          </span>
        )}
        {locError && <span className="text-xs text-brand-red">{t('map.locationDenied')}</span>}
      </div>

      {translation && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-brand-blue/50 bg-brand-blue/40 px-3 py-2 text-xs text-navy">
          <AppIcon name="languages" className="w-4 h-4 shrink-0" />
          <span className="min-w-0 break-words">
            {t('map.translatedAs', { original: translation.original, turkish: translation.translated })}
          </span>
        </div>
      )}

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

      {/* quick filters — real fields Google already returned, nothing invented */}
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => setQuickFilters((f) => ({ ...f, openNow: !f.openNow }))}
          aria-pressed={quickFilters.openNow}
          className={`flex items-center gap-1.5 rounded-full border px-3 min-h-[34px] text-[12px] font-semibold transition-colors ${
            quickFilters.openNow
              ? 'border-green-600 bg-green-50 text-green-800'
              : 'border-gray-200 bg-white text-navy/70 hover:border-navy/40'
          }`}
        >
          <AppIcon name="clock" className="w-3.5 h-3.5" />
          {t('map.quickFilters.openNow')}
        </button>
        <button
          onClick={() => setQuickFilters((f) => ({ ...f, topRated: !f.topRated }))}
          aria-pressed={quickFilters.topRated}
          className={`flex items-center gap-1.5 rounded-full border px-3 min-h-[34px] text-[12px] font-semibold transition-colors ${
            quickFilters.topRated
              ? 'border-gold-dark bg-gold-soft text-gold-dark'
              : 'border-gray-200 bg-white text-navy/70 hover:border-navy/40'
          }`}
        >
          <AppIcon name="star" className="w-3.5 h-3.5" />
          {t('map.quickFilters.topRated')}
        </button>
      </div>

      <div className={compact ? 'mt-4 flex flex-col gap-4' : 'mt-5 flex items-start gap-5'}>
        {/* results sidebar — full width stack on phones, fixed-width pane on desktop */}
        <section
          aria-live="polite"
          className={compact ? 'order-2' : 'order-1 w-full lg:w-[400px] shrink-0 max-h-[75vh] min-h-[520px] overflow-y-auto pe-1'}
        >
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
            /* A server-key problem cannot be fixed by retrying, so no retry
               button is offered for it — but the visitor is told the same
               plain thing either way. What used to be here named the
               GOOGLE_MAPS_SERVER_KEY environment variable on screen. */
            <MapUnavailable
              variant="search"
              onRetry={
                searchError === 'no_key' || searchError === 'key_rejected'
                  ? undefined
                  : () => (category ? runSearch('nearby', category) : submitQuery())
              }
            />
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-navy/60">
                  {t('map.directory.count', { count: visibleResults.length })}
                  {recommendedCount > 0 && ` · ${t('map.recommendedCount', { count: recommendedCount })}`}
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-navy/70">
                    <span className="shrink-0">{t('map.sortBy')}</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-navy focus:border-navy/40 focus:outline-none"
                    >
                      {SORT_KEYS.map((k) => (
                        <option key={k} value={k} disabled={k === 'distance' && !origin}>
                          {t(`map.sort.${k}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {/* Phone only: collapses the map pane back into an accordion so
                      the list gets the full screen height. */}
                  {compact && (
                    <button
                      id="mobile-map-toggle-btn"
                      type="button"
                      onClick={() => setMobileMapOpen((v) => !v)}
                      aria-pressed={mobileMapOpen}
                      className="flex items-center gap-1 rounded-full bg-navy px-2.5 min-h-[30px] text-[11px] font-bold text-white active:scale-95"
                    >
                      <AppIcon name="map" className="w-3.5 h-3.5" />
                      {mobileMapOpen ? t('map.hideMap') : t('map.showMap')}
                    </button>
                  )}
                </div>
              </div>

              {visibleResults.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 text-center text-xs text-gray-500">
                  {t('map.empty.body')}
                </p>
              ) : (
                <ul className="mt-2.5 flex flex-col gap-2.5">
                  {visibleResults.map((r) => {
                    const overlay = overlays.get(r.placeId);
                    const active = selected?.placeId === r.placeId;
                    const dist = distanceOf(r);
                    const photo = placeSearch.photoUrl(r.photoRef, 140);
                    return (
                      <li key={r.placeId}>
                        <button
                          onClick={() => openPlace(r)}
                          aria-pressed={active}
                          className={`w-full flex items-start gap-3 rounded-xl border p-3 text-start transition-colors ${
                            active ? 'border-navy bg-brand-blue' : 'border-gray-200 bg-white hover:border-navy/40'
                          }`}
                        >
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-cream shrink-0 border border-gray-100">
                            {photo ? (
                              <img src={photo} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                <AppIcon
                                  name={category ? CATEGORY_ICONS[category] : 'map-pin'}
                                  className="w-5 h-5 text-navy/30"
                                />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
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
                              {dist !== null && (
                                <span className="flex items-center gap-1">
                                  <AppIcon name="navigation" className="w-3.5 h-3.5 text-navy/50" />
                                  <span dir="ltr">{formatDistance(dist)}</span>
                                </span>
                              )}
                              {favoriteIds.has(r.placeId) && (
                                <span className="flex items-center gap-1 text-gold-dark">
                                  <AppIcon name="bookmark" className="w-3.5 h-3.5" />
                                  {t('map.saved')}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        {/* map pane — a permanent expansive half on desktop, a collapsible
            accordion above the list on phones (never unmounted: collapsing it
            keeps Google's Map instance alive, just zero-height). */}
        <div
          className={
            compact
              ? `order-1 relative transition-[height] duration-200 ${mobileMapOpen ? 'h-[300px]' : 'h-0'} overflow-hidden rounded-2xl`
              : 'order-2 relative flex-1 h-[75vh] min-h-[520px] sticky top-24'
          }
        >
          <div
            ref={mapNodeRef}
            role="application"
            aria-label={t('map.title')}
            className="w-full h-full rounded-2xl border border-gray-200 overflow-hidden bg-cream"
          />
          {/* Our own placeholder, covering the container until a tile paints.
              Two jobs: it is the loading state, and it is the shield that keeps
              Google's error card off the screen during the moment when a
              rejected key is being discovered. Deliberately branded rather than
              an empty grey rectangle. */}
          {!tilesReady && (
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-gray-200 bg-cream"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-navy/40">
                <AppIcon name="map-pin" className="w-5 h-5 animate-pulse" />
                {t('common.loading')}
              </span>
            </div>
          )}
          {/* my-location control, floating over the map */}
          {mapsStatus === 'ready' && tilesReady && (
            <button
              onClick={locateMe}
              disabled={locating}
              aria-label={t('map.myLocation')}
              title={t('map.myLocation')}
              className="absolute bottom-3 end-3 flex items-center justify-center w-11 h-11 rounded-full border border-gray-200 bg-white shadow-cardHover text-navy hover:border-navy/40 disabled:opacity-60"
            >
              <AppIcon name="navigation" className={`w-5 h-5 ${locating ? 'animate-pulse' : ''}`} />
            </button>
          )}
        </div>
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
