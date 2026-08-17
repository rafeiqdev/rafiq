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
import { PlaceThumb } from './PlaceThumb';
import { MapUnavailable } from './MapUnavailable';
import { MapFilterSheet } from './MapFilterSheet';

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
  dining: 'utensils-crossed',
  hotels: 'hotel',
  hospitals: 'hospital',
  notary: 'scroll-text',
  government: 'landmark',
  shopping: 'shopping-bag',
  arabic: 'languages',
};

/** Pin + chip colour per category, from the supplied design's vibrant palette. */
const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  dining: '#E11D48',
  hotels: '#7C3AED',
  hospitals: '#DB2777',
  notary: '#2563EB',
  government: '#0F766E',
  shopping: '#059669',
  arabic: '#B45309',
};

/** Soft card-badge classes mirroring the pin colours, per the design. */
const CATEGORY_BADGE: Record<PlaceCategory, string> = {
  dining: 'bg-rose-50 text-rose-700 border-rose-200/80',
  hotels: 'bg-violet-50 text-violet-800 border-violet-200/80',
  hospitals: 'bg-pink-50 text-pink-800 border-pink-200/80',
  notary: 'bg-blue-50 text-blue-800 border-blue-200/80',
  government: 'bg-teal-50 text-teal-800 border-teal-200/80',
  shopping: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  arabic: 'bg-amber-50 text-amber-800 border-amber-200/80',
};

/**
 * The glyph drawn inside each map pin. Hand-written rather than pulled from
 * lucide because marker content is raw DOM, not React — these strings are
 * injected into an SVG that the AdvancedMarkerElement owns.
 */
const PIN_GLYPHS: Record<PlaceCategory, string> = {
  dining:
    '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  hotels: '<path d="M3 18V8"/><path d="M3 12h18v6"/><path d="M21 18v-4"/><circle cx="7.5" cy="10.5" r="1.8"/>',
  hospitals:
    '<path d="M12 7v4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M14 9h-4"/><path d="M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/>',
  notary:
    '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  government:
    '<path d="M12 3 3 8h18z"/><path d="M6 10v8"/><path d="M12 10v8"/><path d="M18 10v8"/><path d="M3 21h18"/>',
  shopping: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  arabic: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>',
};

const DEFAULT_GLYPH = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>';

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type SortKey = 'best' | 'rating' | 'distance' | 'recommended';
const SORT_KEYS: SortKey[] = ['best', 'rating', 'distance', 'recommended'];

export type QuickFilters = { openNow: boolean; topRated: boolean };

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
  /** Phones get the stacked layout with a collapsible map; desktop the split view. */
  compact?: boolean;
}

/**
 * The whole map feature in one place.
 *
 * Both routes (/map desktop and mobile) render this — the previous Leaflet
 * implementation was two 250–300 line near-identical files, and every fix had
 * to be made twice.
 *
 * The LAYOUT is a port of the supplied map design (sidebar + expansive map on
 * desktop, collapsible map accordion on phones, Apple-Maps-style teardrop
 * pins). The DATA underneath is unchanged: Google Places is the discovery pool
 * and `places.overlay()` adds Rafiq's editorial layer on top, keyed by Google
 * place id. A place is only ever badged "recommended" when an admin reviewed
 * it — the database refuses the row otherwise, so no code path here can invent
 * one.
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
  /** Which set of places the camera was last framed to — see the markers effect. */
  const fittedSignatureRef = useRef<string>('');
  // One Autocomplete session token per typing session. Google bills a session
  // as ONE request when the token is reused across keystrokes and then passed
  // to the follow-up Details call — a fresh token per keystroke is billed per
  // keystroke, which is the classic way this feature gets expensive.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [results, setResults] = useState<GooglePlaceResult[]>([]);
  const [overlays, setOverlays] = useState<Map<string, PlaceOverlay>>(new Map());
  const [state, setState] = useState<LoadState>('idle');
  /** A real tile has painted — only then is it safe to uncover the container. */
  const [tilesReady, setTilesReady] = useState(false);
  /**
   * The google.maps.Map instance exists. State, not just the ref, because the
   * effects that draw onto the map have to re-run once it appears — on phones
   * construction is deferred until the pane is opened, which can happen long
   * after a search has already filled `results`.
   */
  const [mapCreated, setMapCreated] = useState(false);
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
  // Phone-only: the map is a collapsible pane above the list, per the design.
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({ openNow: false, topRated: false });
  const [toast, setToast] = useState<string | null>(null);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.googlePlaceId)), [favorites]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  /** Brief confirmation pill, as in the design — actions must acknowledge themselves. */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2600);
  }, []);

  // ---- map bootstrap --------------------------------------------------------
  //
  // The container stays covered by our own placeholder until a tile actually
  // paints. This is what stops Google's "didn't load Google Maps correctly" card
  // from ever being seen: constructing the Map is what triggers the rejection,
  // and gm_authFailure fires in that same moment — but only AFTER the element
  // exists. Revealing on `tilesloaded` means the container is only uncovered
  // once Google has genuinely rendered something.
  //
  // On phones the map surface lives inside a pane that is `h-0` until the
  // visitor opens it. Constructing a Map into a zero-height element makes
  // Google skip the tile request entirely, so `tilesloaded` never fires and the
  // timeout below would condemn a perfectly healthy map as unavailable — which
  // also removed the very button needed to open the pane. So on compact layouts
  // the map is not built until the pane actually has height.
  useEffect(() => {
    if (mapsStatus !== 'ready' || !mapNodeRef.current || mapRef.current) return;
    if (compact && !mobileMapOpen) return;
    const map = new google.maps.Map(mapNodeRef.current, {
      center: ISTANBUL,
      zoom: DEFAULT_ZOOM,
      mapId: MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      clickableIcons: false,
    });
    mapRef.current = map;
    setMapCreated(true);
    const listener = google.maps.event.addListenerOnce(map, 'tilesloaded', () => setTilesReady(true));
    return () => listener?.remove();
  }, [mapsStatus, compact, mobileMapOpen]);

  // Belt-and-braces for the failures Google gives us no signal for at all: if
  // the SDK authenticated but no tile ever arrives (a degraded/over-quota
  // project, a silently dropped tile request), the visitor would otherwise sit
  // in front of our placeholder forever. After this timeout we stop pretending
  // and show the same fallback.
  // Only armed once a Map actually exists: before that there is nothing that
  // could have painted, and on phones "no map yet" is the normal collapsed
  // state rather than a fault.
  useEffect(() => {
    if (mapsStatus !== 'ready' || !mapCreated || tilesReady) return;
    const timer = setTimeout(() => {
      setTilesTimedOut(true);
      devDiagnose(
        'ready',
        `The SDK authenticated but no map tile rendered within ${TILE_TIMEOUT_MS}ms. ` +
          'Typically a project-level quota/billing problem, which Google exposes no callback for.',
      );
    }, TILE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mapsStatus, mapCreated, tilesReady]);

  useEffect(() => {
    placeFavorites.list().then(setFavorites).catch(() => {});
  }, []);

  // Quick filters narrow the pool that BOTH the pins and the list draw from, so
  // the two can never disagree. Both checks use fields Google itself returned.
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
      const isSelected = selected?.placeId === r.placeId;
      // Recommended places are gold on the map itself, not only in the list —
      // that is the whole point of the editorial layer.
      const color = overlay?.recommended ? '#C9A227' : category ? CATEGORY_COLORS[category] : '#1B2A4A';
      const glyph = category ? PIN_GLYPHS[category] : DEFAULT_GLYPH;

      const el = document.createElement('div');
      el.className = `rmap-pin${isSelected ? ' rmap-pin-active' : ''}`;
      // textContent on a throwaway node is the safe way to escape a place name
      // before it goes anywhere near innerHTML.
      const nameEsc = document.createElement('div');
      nameEsc.textContent = r.name;
      el.innerHTML = `
        <div class="rmap-pin-bubble" style="background:linear-gradient(135deg, ${color}, ${color}dd)">
          <svg class="rmap-pin-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
        </div>
        <div class="rmap-pin-needle" style="border-top-color:${color}"></div>
        ${isSelected ? `<div class="rmap-pin-label">${nameEsc.innerHTML}</div>` : ''}
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: r.lat as number, lng: r.lng as number },
        title: r.name,
        content: el,
      });
      marker.addListener('click', () => openPlace(r));
      return marker;
    });

    markersRef.current = markers;
    // Clustering keeps the map readable when a category returns 20 pins in a
    // few streets — without it central Istanbul is an unreadable pin stack.
    clustererRef.current = clustererRef.current ?? new MarkerClusterer({ map, markers: [] });
    clustererRef.current.addMarkers(markers);

    // Re-frame ONLY when the set of places changed. This effect also re-runs on
    // selection (to redraw the active pin), and fitting bounds there would
    // yank the map straight back off the place the user just tapped.
    const signature = withCoords.map((r) => r.placeId).join(',');
    if (withCoords.length > 0 && signature !== fittedSignatureRef.current) {
      fittedSignatureRef.current = signature;
      const bounds = new google.maps.LatLngBounds();
      withCoords.forEach((r) => bounds.extend({ lat: r.lat as number, lng: r.lng as number }));
      if (userLocationRef.current) bounds.extend(userLocationRef.current);
      map.fitBounds(bounds, 48);
    }
    // openPlace is stable enough for this effect; results/overlays drive it.
    // `mapCreated` is here so pins searched before the phone's map pane was
    // opened get drawn the moment it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredResults, overlays, mapsStatus, mapCreated, category, selected]);

  // Un-hiding the mobile map pane resizes its container without a window resize
  // event ever firing — Maps must be told explicitly or it keeps painting at
  // its old (collapsed) size.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !compact || !mobileMapOpen) return;
    const timer = setTimeout(() => google.maps.event.trigger(map, 'resize'), 60);
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
    dot.className = 'rmap-me';
    dot.innerHTML = '<div class="rmap-me-halo"></div><div class="rmap-me-core"></div>';
    if (userMarkerRef.current) userMarkerRef.current.map = null;
    userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      position: userLocation,
      title: t('map.myLocation'),
      content: dot,
      zIndex: 9999,
    });
    userMarkerRef.current.map = map;
  }, [userLocation, mapsStatus, mapCreated, t]);

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
    setSearchFocused(false);
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
    showToast(t(saved ? 'map.toastUnsaved' : 'map.toastSaved'));
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
  //
  // This takes out the MAP, not the page. Place search runs on our own server,
  // so the sidebar — search, categories, filters, results, saving, directions
  // links — keeps working perfectly while Google's tiles are down. Replacing
  // the whole screen with this notice used to throw away a set of results the
  // visitor had just successfully searched for.
  const mapUnavailable = isMapUnavailable(mapsStatus) || tilesTimedOut;

  const recommendedCount = filteredResults.filter((r) => overlays.get(r.placeId)?.recommended).length;
  const activeQuickCount = (quickFilters.openNow ? 1 : 0) + (quickFilters.topRated ? 1 : 0);
  const filtersActive = category !== null || activeQuickCount > 0;

  // ---- shared pieces --------------------------------------------------------

  const searchBlock = (
    <div className="relative w-full bg-white px-4 pb-2 pt-3">
      {/* area label + saved count, per the design's compact top row */}
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
          <span className="truncate text-xs font-extrabold tracking-tight text-navy">
            {t('map.areaLabel')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            aria-label={t('map.nearMe')}
            title={t('map.nearMe')}
            className="flex min-h-[34px] items-center gap-1 rounded-full border border-gray-200/60 bg-gray-100 px-2.5 py-1.5 text-[11px] font-extrabold text-navy transition-colors hover:bg-gray-200 disabled:opacity-60"
          >
            <AppIcon name="navigation" className={`h-3.5 w-3.5 ${locating ? 'animate-pulse' : ''}`} />
            <span>{locating ? t('map.locating') : t('map.nearMe')}</span>
          </button>
          <span
            className="flex min-h-[34px] items-center gap-1 rounded-full border border-gray-200/60 bg-gray-100 px-2.5 py-1.5 text-[11px] font-extrabold text-navy"
            aria-label={t('map.savedCountAria', { count: favorites.length })}
          >
            <AppIcon name="bookmark" className="h-3.5 w-3.5 fill-gold-dark text-gold-dark" />
            {favorites.length > 0 && (
              <span className="rounded-full bg-gold-dark px-1.5 text-[10px] font-extrabold text-white">
                {favorites.length}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* sleek search input */}
      <div className="relative flex items-center">
        <label htmlFor="map-search-input" className="sr-only">
          {t('map.searchPlaceholder')}
        </label>
        <div className="pointer-events-none absolute start-3 flex items-center justify-center text-gray-400">
          <AppIcon
            name="search"
            className={`h-4 w-4 transition-colors ${searchFocused ? 'text-navy' : 'text-gray-400'}`}
          />
        </div>
        <input
          id="map-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuery()}
          placeholder={t('map.searchPlaceholder')}
          autoComplete="off"
          className="min-h-[40px] w-full rounded-2xl border border-transparent bg-gray-100/90 py-2 pe-9 ps-9 text-xs font-semibold text-navy transition-all placeholder:text-gray-400 focus:border-navy focus:bg-white focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('map.clearSearch')}
            className="absolute end-2.5 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200/80 hover:text-gray-600"
          >
            <AppIcon name="x" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* live suggestions */}
      {searchFocused && suggestions.length > 0 && (
        <div className="absolute inset-x-4 top-full z-[600] mt-1.5 overflow-hidden rounded-2xl border border-gray-100 bg-white/98 shadow-cardHover backdrop-blur-md">
          <div className="divide-y divide-gray-50 p-1.5">
            {suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={() => pickSuggestion(s.placeId, s.text)}
                className="flex w-full items-center justify-between rounded-xl p-2.5 text-start transition-colors hover:bg-gray-50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-100">
                    <AppIcon name="map-pin" className="h-4 w-4 text-navy/50" />
                  </span>
                  <span className="min-w-0 truncate text-xs font-bold text-navy">{s.text}</span>
                </div>
                <AppIcon name="arrow-left" className="dir-arrow h-3.5 w-3.5 shrink-0 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const filterPills = (
    <div className="relative w-full border-b border-gray-100 bg-white py-2">
      <div className="flex items-center gap-2 px-3">
        {/* the sheet trigger, highlighted whenever anything is narrowing results */}
        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          aria-label={t('map.filterSheet.title')}
          className={`flex min-h-[42px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-extrabold transition-all ${
            filtersActive
              ? 'border-navy bg-navy text-white ring-2 ring-navy/20'
              : 'border-gray-200 bg-gray-100 text-navy hover:bg-gray-200'
          }`}
        >
          <AppIcon name="sliders-horizontal" className="h-4 w-4" />
          <span>{t('map.filter')}</span>
          {filtersActive && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
        </button>

        <div className="h-6 w-px shrink-0 bg-gray-200" />

        {/* scrollable category chips */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
            {PLACE_CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickCategory(c)}
                  aria-pressed={active}
                  className={`relative flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors ${
                    active
                      ? 'border-navy bg-navy text-white shadow-sm'
                      : 'border-gray-200/60 bg-gray-100/80 text-navy/80 hover:text-navy'
                  }`}
                >
                  <AppIcon name={CATEGORY_ICONS[c]} className="h-3.5 w-3.5" />
                  <span>{t(`map.categories.${c}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const summaryBar = (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/90 px-4 py-2.5">
      <div aria-live="polite" className="min-w-0 text-xs font-extrabold text-navy">
        {state === 'loading'
          ? t('map.searching')
          : state === 'ready'
            ? `${t('map.directory.count', { count: visibleResults.length })}${
                recommendedCount > 0 ? ` · ${t('map.recommendedCount', { count: recommendedCount })}` : ''
              }`
            : t('map.idleShort')}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {state === 'ready' && (
          <label className="flex items-center gap-1 text-[11px] text-navy/70">
            <span className="sr-only">{t('map.sortBy')}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-navy focus:border-navy/40 focus:outline-none"
            >
              {SORT_KEYS.map((k) => (
                <option key={k} value={k} disabled={k === 'distance' && !origin}>
                  {t(`map.sort.${k}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        {/* No toggle when there is no map behind it — offering to "show the
            map" only to reveal an outage notice is a dead end. */}
        {compact && !mapUnavailable && (
          <button
            id="mobile-map-toggle-btn"
            type="button"
            aria-pressed={mobileMapOpen}
            onClick={() => setMobileMapOpen((v) => !v)}
            className="flex min-h-[30px] shrink-0 items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-[11px] font-bold text-white shadow-sm active:scale-95"
          >
            <AppIcon name={mobileMapOpen ? 'menu' : 'map'} className="h-3 w-3" />
            <span>{mobileMapOpen ? t('map.hideMap') : t('map.showMap')}</span>
          </button>
        )}
      </div>
    </div>
  );

  /** The map surface plus its floating controls. Rendered once, in one place. */
  const mapPane = mapUnavailable ? (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-cream p-4">
      <div className="w-full max-w-md">
        <MapUnavailable variant="map" />
      </div>
    </div>
  ) : (
    <>
      <div ref={mapNodeRef} role="application" aria-label={t('map.title')} className="h-full w-full bg-cream" />
      {/* Our own placeholder, covering the container until a tile paints.
          Two jobs: it is the loading state, and it is the shield that keeps
          Google's error card off the screen during the moment when a rejected
          key is being discovered. Deliberately branded, not an empty rectangle. */}
      {!tilesReady && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-cream">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy/40">
            <AppIcon name="map-pin" className="h-5 w-5 animate-pulse" />
            {t('common.loading')}
          </span>
        </div>
      )}
      {mapsStatus === 'ready' && tilesReady && (
        <div className="absolute bottom-4 end-4 z-[400] flex flex-col gap-2">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            aria-label={t('map.myLocation')}
            title={t('map.myLocation')}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200/80 bg-white/95 text-blue-600 shadow-md backdrop-blur-md transition-all hover:bg-white active:scale-95 disabled:opacity-60"
          >
            <AppIcon name="navigation" className={`h-5 w-5 ${locating ? 'animate-pulse' : ''}`} />
          </button>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-md backdrop-blur-md">
            <button
              type="button"
              onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? DEFAULT_ZOOM) + 1)}
              aria-label={t('map.zoomIn')}
              className="flex h-11 w-11 items-center justify-center border-b border-gray-100 text-navy transition-colors hover:bg-gray-100 active:scale-95"
            >
              <AppIcon name="plus" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? DEFAULT_ZOOM) - 1)}
              aria-label={t('map.zoomOut')}
              className="flex h-11 w-11 items-center justify-center text-navy transition-colors hover:bg-gray-100 active:scale-95"
            >
              <span className="block h-0.5 w-4 rounded bg-current" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  const resultsFeed = (
    <div className="flex-1 overflow-y-auto overscroll-contain p-3.5">
      {translation && (
        <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-brand-blue/50 bg-brand-blue/40 px-3 py-2 text-xs text-navy">
          <AppIcon name="languages" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            {t('map.translatedAs', { original: translation.original, turkish: translation.translated })}
          </span>
        </div>
      )}
      {locError && (
        <p className="mb-2.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-brand-red">
          {t('map.locationDenied')}
        </p>
      )}

      {state === 'idle' && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          {t('map.idle')}
        </p>
      )}

      {state === 'loading' && (
        <ul className="flex flex-col gap-2.5" role="status" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[86px] animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </ul>
      )}

      {state === 'error' && (
        /* A server-key problem cannot be fixed by retrying, so no retry button
           is offered for it — but the visitor is told the same plain thing
           either way. What used to be here named the GOOGLE_MAPS_SERVER_KEY
           environment variable on screen. */
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
          <AppIcon name="inbox" className="mx-auto h-5 w-5 text-navy/50" />
          <p className="mt-2 text-sm font-semibold text-navy">{t('map.empty.title')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('map.empty.body')}</p>
        </div>
      )}

      {state === 'ready' && visibleResults.length === 0 && (
        <div className="space-y-3 px-4 py-12 text-center text-gray-500">
          <AppIcon name="search" className="mx-auto h-10 w-10 text-gray-300" />
          <p className="text-sm font-extrabold text-navy">{t('map.empty.title')}</p>
          <p className="mx-auto max-w-xs text-xs text-gray-500">{t('map.empty.body')}</p>
          <button
            type="button"
            onClick={() => setQuickFilters({ openNow: false, topRated: false })}
            className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-navy-light"
          >
            {t('map.resetFilters')}
          </button>
        </div>
      )}

      {state === 'ready' && visibleResults.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {visibleResults.map((r) => {
            const overlay = overlays.get(r.placeId);
            const active = selected?.placeId === r.placeId;
            const dist = distanceOf(r);
            const photo = placeSearch.photoUrl(r.photoRef, 160);
            const badge = category ? CATEGORY_BADGE[category] : 'bg-gray-100 text-gray-800 border-gray-200';
            return (
              <li key={r.placeId}>
                <button
                  type="button"
                  onClick={() => openPlace(r)}
                  aria-pressed={active}
                  className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-start shadow-sm transition-all duration-200 hover:shadow-md ${
                    active ? 'border-navy bg-brand-blue' : 'border-gray-200/90 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-100/80 bg-gray-100 shadow-sm sm:h-[72px] sm:w-[72px]">
                    <PlaceThumb
                      name={r.name}
                      photo={photo}
                      icon={category ? CATEGORY_ICONS[category] : 'map-pin'}
                      className="transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-1.5">
                      <h3 className="truncate text-sm font-extrabold leading-snug text-navy sm:text-base">
                        {r.name}
                      </h3>
                      {overlay?.recommended ? (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-extrabold text-gold-dark">
                          {t('map.recommended')}
                        </span>
                      ) : (
                        category && (
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${badge}`}
                          >
                            {t(`map.categories.${category}`)}
                          </span>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      {r.rating !== null && (
                        <span className="flex items-center gap-1 font-extrabold text-amber-600">
                          <AppIcon name="star" className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          <span dir="ltr">{r.rating.toFixed(1)}</span>
                          {r.ratingCount !== null && (
                            <span className="text-[11px] font-medium text-gray-400" dir="ltr">
                              ({r.ratingCount})
                            </span>
                          )}
                        </span>
                      )}
                      {dist !== null && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="flex items-center gap-1 text-navy/70">
                            <AppIcon name="navigation" className="h-3.5 w-3.5 text-gray-400" />
                            <span dir="ltr">{formatDistance(dist)}</span>
                          </span>
                        </>
                      )}
                      {r.openNow === true && (
                        <span className="ms-auto flex shrink-0 items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-800">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          {t('map.openNow')}
                        </span>
                      )}
                      {favoriteIds.has(r.placeId) && (
                        <AppIcon name="bookmark" className="h-3.5 w-3.5 shrink-0 fill-gold-dark text-gold-dark" />
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const sidebar = (
    <aside
      className={`z-10 flex w-full shrink-0 flex-col bg-white ${
        compact ? 'h-full' : 'h-full border-e border-gray-200 md:w-[420px] lg:w-[450px] xl:w-[480px]'
      }`}
    >
      <header className="z-[500] border-b border-gray-100 bg-white shadow-sm">
        {searchBlock}
        {filterPills}
      </header>
      {summaryBar}
      {/* Phone only: the map opens as an interactive preview above the feed.
          When there is no map to open, the outage is still stated once —
          silently dropping it would leave the visitor wondering where the map
          went, and the notice carries the keyless Google Maps link. */}
      {compact &&
        (mapUnavailable ? (
          <div className="w-full shrink-0 border-b border-gray-200 bg-cream p-3">
            <MapUnavailable variant="map" />
          </div>
        ) : (
          <div
            className={`relative w-full shrink-0 overflow-hidden border-b border-gray-200 bg-gray-100 transition-[height] duration-200 ${
              mobileMapOpen ? 'h-[280px]' : 'h-0 border-b-0'
            }`}
          >
            {mapPane}
          </div>
        ))}
      {resultsFeed}
    </aside>
  );

  return (
    <div
      className={`flex w-full overflow-hidden bg-white ${
        compact ? 'h-[calc(100dvh-8.5rem)] flex-col' : 'h-[calc(100vh-7rem)] min-h-[560px] flex-row'
      }`}
    >
      <h1 className="sr-only">{t('map.title')}</h1>

      {/* toast */}
      {toast && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed start-1/2 top-4 z-[4000] -translate-x-1/2 rounded-full border border-white/10 bg-navy/95 px-4 py-2 text-xs font-bold text-white shadow-xl"
        >
          {toast}
        </div>
      )}

      {sidebar}

      {/* desktop: the expansive map pane fills whatever the sidebar leaves */}
      {!compact && <main className="relative h-full flex-1 overflow-hidden bg-gray-100">{mapPane}</main>}

      {selected && (
        <PlaceCard
          place={selected}
          overlay={overlays.get(selected.placeId)}
          saved={favoriteIds.has(selected.placeId)}
          onToggleSave={() => toggleFavorite(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {filterSheetOpen && (
        <MapFilterSheet
          category={category}
          quickFilters={quickFilters}
          counts={results}
          onApply={(nextCategory, nextQuick) => {
            setQuickFilters(nextQuick);
            if (nextCategory !== category) {
              if (nextCategory) pickCategory(nextCategory);
              else setCategory(null);
            }
            setFilterSheetOpen(false);
          }}
          onReset={() => {
            setCategory(null);
            setQuickFilters({ openNow: false, topRated: false });
            setFilterSheetOpen(false);
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </div>
  );
}
