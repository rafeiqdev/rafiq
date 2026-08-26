import { AppIcon } from '../../components/AppIcon';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Card, Kpi, num } from '../components/CCKit';
import { fetchContent, fetchPlaces } from '../api/platform';

/**
 * Properties & Map — everything about listings, investment opportunities and
 * the places shown on the site map, in one place. Deliberately a numbers +
 * links summary rather than an embedded map widget: adding/editing a
 * property or a map pin stays in the classic Admin, same as every other
 * write action in the Control Center.
 */
export function Properties() {
  const { cc, lang } = useCC();
  const contentSec = useAsyncSection(() => fetchContent(), []);
  const placesSec = useAsyncSection(() => fetchPlaces(), []);

  return (
    <div className="flex flex-col gap-6">
      <CCState section={contentSec} title={cc('section.properties')} isEmpty={() => false}>
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon="home" label={cc('properties.listings')} value={num(d.listings.total, lang)} />
              <Kpi
                icon="landmark"
                label={cc('properties.investments')}
                value={num(d.investments.total, lang)}
                hint={`${cc('ct.published')}: ${num(d.investments.published, lang)}`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title={cc('properties.listings')} icon="home" to="/admin?tab=listings">
                <p className="mt-2 text-3xl font-extrabold text-navy" dir="ltr">{num(d.listings.total, lang)}</p>
              </Card>
              <Card title={cc('properties.investments')} icon="landmark" to="/admin?tab=investments">
                <p className="mt-2 text-3xl font-extrabold text-navy" dir="ltr">
                  {num(d.investments.published, lang)} / {num(d.investments.total, lang)}
                </p>
                <p className="text-xs text-navy/50">{cc('ct.published')}</p>
              </Card>
            </div>
          </div>
        )}
      </CCState>

      <CCState section={placesSec} title={cc('properties.places')} isEmpty={(d) => d.total === 0}>
        {(d) => (
          <Card title={cc('properties.places')} icon="map-pin" to="/admin?tab=places">
            <p className="mt-1 text-xs text-navy/50">{cc('properties.placesHint')}</p>
            <p className="mt-2 text-3xl font-extrabold text-navy" dir="ltr">{num(d.total, lang)}</p>
            {d.recent.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {d.recent.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                    <AppIcon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-navy/50" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-navy">{p.name}</span>
                    <span className="shrink-0 text-xs text-navy/40">{p.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </CCState>
    </div>
  );
}
