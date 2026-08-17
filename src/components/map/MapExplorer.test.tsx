import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * What the visitor keeps when Google's map goes down.
 *
 * Place search runs on OUR server, not on the Google Maps JS SDK, so an outage
 * on Google's side takes out the tiles and nothing else. The page used to
 * replace itself wholesale with the "map view isn't available" card, which threw
 * away a set of results the visitor had just searched for — the map failing is
 * not a reason to stop showing them the places they asked for.
 */

let mapsStatus = 'error';
vi.mock('../../hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => ({ status: mapsStatus }),
  isMapUnavailable: (s: string) => s === 'no-key' || s === 'error' || s === 'blocked',
  devDiagnose: () => {},
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}));

vi.mock('@googlemaps/markerclusterer', () => ({
  MarkerClusterer: class {
    clearMarkers() {}
    addMarkers() {}
  },
}));

vi.mock('../../lib/api', () => ({
  placeFavorites: { list: () => Promise.resolve([]), add: () => Promise.resolve(), remove: () => Promise.resolve() },
  places: { overlay: () => Promise.resolve(new Map()) },
  placeSearch: {
    photoUrl: () => null,
    nearby: () => Promise.resolve({ places: [], error: null }),
    text: () => Promise.resolve({ places: [], error: null }),
    details: () => Promise.resolve(null),
  },
}));

// Just enough of the Maps SDK for the healthy-path render; the outage paths
// never touch it.
(globalThis as unknown as { google: unknown }).google = {
  maps: {
    Map: class {
      getZoom() {
        return 12;
      }
    },
    event: { addListenerOnce: () => ({ remove() {} }), trigger: () => {} },
  },
};

import { MapExplorer } from './MapExplorer';

function show(compact = false) {
  return render(
    <MemoryRouter>
      <MapExplorer compact={compact} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('a Google outage takes out the map, not the page', () => {
  it('still renders the search box, categories and filters', () => {
    mapsStatus = 'error';
    show();

    // the notice is shown...
    expect(screen.getByText('map.unavailable.title')).toBeInTheDocument();
    // ...but the directory around it survives
    expect(screen.getByLabelText('map.searchPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('map.categories.dining')).toBeInTheDocument();
    // the advanced-filter entry point (quick filters live inside that sheet)
    expect(screen.getByText('map.filter')).toBeInTheDocument();
  });

  // The map is the leisure side of the city. Hotels, hospitals, the noter and
  // government offices are handled by the services pages, and carrying them
  // here made a chip row too long to ever scroll to the end of.
  it('offers the leisure categories and none of the paperwork ones', () => {
    mapsStatus = 'ready';
    show(true);

    expect(screen.getByText('map.categories.attractions')).toBeInTheDocument();
    for (const gone of ['hotels', 'hospitals', 'notary', 'government']) {
      expect(screen.queryByText(`map.categories.${gone}`)).not.toBeInTheDocument();
    }
  });

  it('does not offer a "show map" toggle that leads only to the outage notice', () => {
    mapsStatus = 'error';
    show(true);

    expect(screen.getByText('map.unavailable.title')).toBeInTheDocument();
    expect(document.querySelector('#mobile-map-toggle-btn')).toBeNull();
  });

  it('offers the map toggle again once Google is healthy', () => {
    mapsStatus = 'ready';
    show(true);

    expect(screen.queryByText('map.unavailable.title')).not.toBeInTheDocument();
    expect(document.querySelector('#mobile-map-toggle-btn')).not.toBeNull();
  });
});

/**
 * The phone's map pane is `h-0` while collapsed. Building a Map into a
 * zero-height element makes Google skip the tile request altogether, so
 * `tilesloaded` never fires — and the tile timeout then condemned a perfectly
 * healthy map as unavailable, taking the "show map" button away with it. The
 * map is therefore not constructed until the pane actually has height.
 */
describe('a collapsed phone map pane is not mistaken for an outage', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the toggle after the tile timeout would have elapsed', () => {
    mapsStatus = 'ready';
    show(true);

    // The pane opens by default, so collapse it first — this guard is about
    // what happens to a map the visitor has deliberately folded away.
    const toggle = document.querySelector('#mobile-map-toggle-btn') as HTMLElement;
    act(() => {
      toggle.click();
    });

    vi.useFakeTimers();
    // Well past TILE_TIMEOUT_MS, with the pane closed.
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.queryByText('map.unavailable.title')).not.toBeInTheDocument();
    expect(document.querySelector('#mobile-map-toggle-btn')).not.toBeNull();
  });
});

/**
 * /map is the map screen. Landing on a list of result cards with the map folded
 * away made the visitor hunt for a button to reach the thing they came for.
 */
describe('the phone map pane starts open', () => {
  it('renders the map surface without anyone tapping a toggle', () => {
    mapsStatus = 'ready';
    show(true);

    expect(screen.getByLabelText('map.title')).toBeInTheDocument();
    // ...and the toggle now offers to HIDE it, not to show it.
    expect(screen.getByText('map.hideMap')).toBeInTheDocument();
  });
});
