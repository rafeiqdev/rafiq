import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth, UpsellGate } from '../components/Gates';
import { RafiqLoader } from '../components/RafiqLoader';
import { usePageMeta } from '../lib/seo';

/**
 * Desktop map. All behaviour lives in MapExplorer — this file only carries the
 * route's gate and page title, so the mobile route cannot drift from it (the
 * previous Leaflet version was two near-identical 250-line files).
 *
 * MapExplorer is lazy so the explorer + google-maps chunks download only after
 * the gates pass — a logged-out or free visitor hitting /map used to fetch
 * the whole map stack just to be shown a padlock.
 */
const MapExplorer = lazy(() =>
  import('../components/map/MapExplorer').then((m) => ({ default: m.MapExplorer })),
);

export function MapPage() {
  const { t } = useTranslation();

  usePageMeta({
    title: `${t('map.title')} — ${t('common.appName')}`,
    description: t('map.subtitle'),
  });

  return (
    <RequireAuth>
      <UpsellGate titleKey="map.locked.title" bodyKey="map.locked.body" ctaKey="map.locked.cta">
        <Suspense fallback={<RafiqLoader size="sm" className="min-h-[60vh]" />}>
          <MapExplorer />
        </Suspense>
      </UpsellGate>
    </RequireAuth>
  );
}
