import { useTranslation } from 'react-i18next';
import { RequireAuth, UpsellGate } from '../../components/Gates';
import { MapExplorer } from '../../components/map/MapExplorer';
import { MobileTabBar } from '../../components/MobileTabBar';
import { usePageMeta } from '../../lib/seo';

/**
 * Phone map. Same feature as the desktop route — only the layout differs, via
 * MapExplorer's `compact` flag. Keeping one implementation is deliberate: the
 * two Leaflet pages this replaced had already drifted apart.
 */
export function MobileMapPage() {
  const { t } = useTranslation();

  usePageMeta({
    title: `${t('map.title')} — ${t('common.appName')}`,
    description: t('map.subtitle'),
  });

  return (
    <RequireAuth>
      <UpsellGate titleKey="map.locked.title" bodyKey="map.locked.body" ctaKey="map.locked.cta">
        <>
          <MapExplorer compact />
          <MobileTabBar />
        </>
      </UpsellGate>
    </RequireAuth>
  );
}
