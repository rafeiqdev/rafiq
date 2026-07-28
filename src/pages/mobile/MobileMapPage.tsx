import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth, UpsellGate } from '../../components/Gates';
import { MapTeaser } from '../../components/map/MapTeaser';
import { MobileTabBar } from '../../components/MobileTabBar';
import { RafiqLoader } from '../../components/RafiqLoader';
import { usePageMeta } from '../../lib/seo';

/**
 * Phone map. Same feature as the desktop route — only the layout differs, via
 * MapExplorer's `compact` flag. Keeping one implementation is deliberate: the
 * two Leaflet pages this replaced had already drifted apart.
 *
 * MapExplorer is lazy for the same reason as the desktop route: gated
 * visitors must not download the map stack to look at a padlock.
 */
const MapExplorer = lazy(() =>
  import('../../components/map/MapExplorer').then((m) => ({ default: m.MapExplorer })),
);

export function MobileMapPage() {
  const { t } = useTranslation();

  usePageMeta({
    title: `${t('map.title')} — ${t('common.appName')}`,
    description: t('map.subtitle'),
  });

  // UpsellGate sits OUTSIDE RequireAuth so a logged-out visitor sees the
  // blurred teaser and what the map actually contains — not a bare padlock.
  return (
    <UpsellGate
      titleKey="map.locked.title"
      bodyKey="map.locked.body"
      ctaKey="map.locked.cta"
      blurredPreview={<MapTeaser />}
    >
      <RequireAuth>
        <>
          <Suspense fallback={<RafiqLoader size="sm" className="min-h-[60vh]" />}>
            <MapExplorer compact />
          </Suspense>
          <MobileTabBar />
        </>
      </RequireAuth>
    </UpsellGate>
  );
}
