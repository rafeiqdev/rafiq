import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth, UpsellGate } from '../components/Gates';
import { MapExplorer } from '../components/map/MapExplorer';

/**
 * Desktop map. All behaviour lives in MapExplorer — this file only carries the
 * route's gate and page title, so the mobile route cannot drift from it (the
 * previous Leaflet version was two near-identical 250-line files).
 *
 * The Pro wall moved from a hand-rolled blurred preview to the shared
 * UpsellGate, which also waits out `authLoading` instead of flashing the
 * paywall at a subscriber.
 */
export function MapPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('map.title')} — ${t('common.appName')}`;
  }, [t]);

  return (
    <RequireAuth>
      <UpsellGate titleKey="map.locked.title" bodyKey="map.locked.body" ctaKey="map.locked.cta">
        <MapExplorer />
      </UpsellGate>
    </RequireAuth>
  );
}
