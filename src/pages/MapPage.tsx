import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useTranslation } from 'react-i18next';
import { ApiError, places as placesApi } from '../lib/api';
import type { Place } from '../lib/types';
import { RequireAuth } from '../components/Gates';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { IstanbulSkyline } from '../components/IstanbulSkyline';

// marker assets bundled by Vite — no runtime CDN dependency
const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

type Category = 'dining' | 'hotels' | 'notary' | 'hospitals' | 'government' | 'shopping';

const CATEGORY_ICON: Record<Category, IconName> = {
  dining: 'utensils',
  hotels: 'hotel',
  notary: 'stamp',
  hospitals: 'stethoscope',
  government: 'landmark',
  shopping: 'shopping-bag',
};

const TOPIC_TO_CATEGORY: Record<string, Category> = {
  ikamet: 'government',
  vergi: 'government',
  notary: 'notary',
  hospital: 'hospitals',
  hotel: 'hotels',
  eat: 'dining',
  shop: 'shopping',
};

function categoryForQuery(q: string): Category | 'all' {
  const lower = q.toLowerCase();
  if (/ikamet|residen|اقامة|внж|اقامت|göç|migration/.test(lower)) return 'government';
  if (/vergi|tax|ضريب|налог|مالیات/.test(lower)) return 'government';
  if (/notar|نوتر|كاتب عدل|нотариус|اسناد رسمی/.test(lower)) return 'notary';
  if (/hospital|doctor|مستشفى|больниц|بیمارستان|sağlık/.test(lower)) return 'hospitals';
  if (/hotel|فندق|отел|هتل/.test(lower)) return 'hotels';
  if (/eat|food|restaurant|مطعم|ресторан|رستوران/.test(lower)) return 'dining';
  if (/shop|bazaar|تسوق|магазин|خرید|çarşı/.test(lower)) return 'shopping';
  for (const [k, v] of Object.entries(TOPIC_TO_CATEGORY)) if (lower.includes(k)) return v;
  return 'all';
}

function IstanbulMap({ places, interactive }: { places: Place[]; interactive: boolean }) {
  const { t } = useTranslation();
  return (
    <MapContainer
      center={[41.0151, 28.9795]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      dragging={interactive}
      zoomControl={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {places.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {t(`map.categories.${p.category}`)}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function MapInner() {
  const { t } = useTranslation();
  const [allPlaces, setAllPlaces] = useState<Place[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [aiQuery, setAiQuery] = useState('');

  // POI data is served only to Pro/Elite — enforced by the server, not the client
  useEffect(() => {
    placesApi
      .list()
      .then(setAllPlaces)
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 402 || e.status === 401)) setLocked(true);
      });
  }, []);

  const visible = useMemo(
    () => (allPlaces ?? []).filter((p) => category === 'all' || p.category === category),
    [allPlaces, category],
  );

  const askAi = () => {
    if (!aiQuery.trim()) return;
    setCategory(categoryForQuery(aiQuery));
  };

  const cats: (Category | 'all')[] = ['all', 'dining', 'hotels', 'notary', 'hospitals', 'government', 'shopping'];

  if (locked) {
    // P3-5: the locked preview is an actually-blurred real map
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-navy">{t('map.title')}</h1>
        <p className="mt-1 text-navy/70">{t('map.subtitle')}</p>
        <div className="relative card mt-5 overflow-hidden" style={{ height: '60vh' }}>
          <div className="absolute inset-0 blur-md pointer-events-none select-none" aria-hidden>
            <IstanbulMap places={[]} interactive={false} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-navy/20">
            <div className="card p-6 sm:p-8 w-full max-w-md mx-4 text-center shadow-cardHover">
              <div className="icon-chip mx-auto">
                <AppIcon name="lock" className="w-6 h-6" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-navy">{t('map.locked.title')}</h2>
              <p className="mt-2 text-sm text-gray-500">{t('map.locked.body')}</p>
              <Link to="/pricing" className="btn-primary w-full mt-6">
                {t('map.locked.cta')}
                <DirArrow />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="relative animate-fade-in">
        <IstanbulSkyline height={180} />
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow">{t('map.title')}</h1>
          <p className="mt-1 text-white/85 max-w-md text-sm">{t('map.subtitle')}</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2 max-w-xl animate-fade-up">
        <input
          className="input min-w-0 flex-1"
          placeholder={t('map.ai')}
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && askAi()}
        />
        <button onClick={askAi} className="btn-primary px-5 shrink-0">
          <AppIcon name="search" className="w-4 h-4" />
          <span className="hidden sm:inline">{t('map.aiGo')}</span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`h-9 px-4 rounded-full text-xs font-semibold transition-colors ${
              category === c ? 'bg-navy text-white' : 'bg-white border border-cream-dark text-navy/70 hover:text-navy'
            }`}
          >
            {t(`map.categories.${c}`)}
          </button>
        ))}
      </div>

      <div className="card mt-5 overflow-hidden" style={{ height: '60vh' }}>
        <IstanbulMap places={visible} interactive />
      </div>

      {/* services directory — admin-managed, kept in sync with the map above */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-navy">{t('map.directory.title')}</h2>
          <span className="text-sm text-navy/60">{t('map.directory.count', { count: visible.length })}</span>
        </div>
        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('map.directory.empty')}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {visible.map((p, i) => (
              <div
                key={p.id}
                className="card card-hover flex items-start gap-3 p-4"
                style={{ '--i': i } as React.CSSProperties}
              >
                <span className="icon-chip shrink-0">
                  <AppIcon name={CATEGORY_ICON[p.category as Category] ?? 'map-pin'} />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-navy text-sm leading-snug">{p.name}</h3>
                  {p.address && (
                    <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-1">
                      <AppIcon name="map-pin" className="w-3 h-3 shrink-0" />
                      {p.address}
                    </p>
                  )}
                  <span className="mt-2 inline-block rounded-full bg-brand-blue px-2.5 py-0.5 text-[10px] font-bold text-navy">
                    {t(`map.categories.${p.category}`)}
                  </span>
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary !h-8 px-2.5 text-xs shrink-0"
                  aria-label={t('map.directory.directions')}
                >
                  <AppIcon name="navigation" className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MapPage() {
  return (
    <RequireAuth>
      <MapInner />
    </RequireAuth>
  );
}
