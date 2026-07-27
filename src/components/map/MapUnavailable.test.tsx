import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * The map's failure modes, from the visitor's side.
 *
 * The rule these enforce is a business one, not a technical one: a scared
 * foreigner comparing this site against a scam agency office must never be shown
 * Google's raw "This page didn't load Google Maps correctly / needs an API key"
 * card, an empty grey rectangle, or any word like "key", "quota" or
 * "GOOGLE_MAPS_SERVER_KEY" (which the previous copy printed at them verbatim).
 */

let language = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language } }),
}));

import { MapUnavailable, googleMapsSearchUrl } from './MapUnavailable';

function show(props: Parameters<typeof MapUnavailable>[0] = {}) {
  return render(
    <MemoryRouter>
      <MapUnavailable {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  language = 'en';
});
afterEach(cleanup);

describe('the keyless Google Maps link', () => {
  it('uses the Maps URLs endpoint, which needs no API key or billing', () => {
    // The entire point: this must keep working in exactly the situation that
    // broke the embedded map.
    const url = googleMapsSearchUrl('İstanbul, Türkiye');
    expect(url).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(url).not.toMatch(/key=/);
  });

  it('encodes the query so a real address cannot break the URL', () => {
    expect(googleMapsSearchUrl('Örnek Cad. No:12, İstanbul')).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Örnek Cad. No:12, İstanbul'),
    );
  });

  it('is rendered as a real, openable link in the map fallback', () => {
    show({ variant: 'map' });
    const link = screen.getByRole('link', { name: /map\.unavailable\.openInMaps/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps/search/'));
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('nothing technical ever reaches the visitor', () => {
  const FORBIDDEN = [
    /api\s*key/i,
    /\bkey\b/i,
    /quota/i,
    /billing/i,
    /referrer/i,
    /GOOGLE_MAPS/i,
    /VITE_/i,
    /RefererNotAllowed/i,
    /console/i,
  ];

  it.each(['map', 'search'] as const)('%s variant leaks no technical vocabulary', (variant) => {
    const { container } = show({ variant });
    // i18n is stubbed to echo keys, so this checks the KEY NAMES too — a key
    // called map.error.searchKeyBody would itself fail here.
    const text = container.textContent ?? '';
    for (const pattern of FORBIDDEN) {
      expect(text, `"${text}" matched ${pattern}`).not.toMatch(pattern);
    }
  });

  it('does not render an alert/error styling that reads as a crash', () => {
    show({ variant: 'map' });
    // No role="alert": this is a calm degraded state, not an emergency.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the two variants say different, appropriate things', () => {
  it('the map variant offers the location link', () => {
    show({ variant: 'map' });
    expect(screen.getByTestId('map-unavailable')).toBeInTheDocument();
    expect(screen.getByText('map.unavailable.title')).toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('the search variant does NOT offer a location link — it is about search, not place', () => {
    show({ variant: 'search' });
    expect(screen.getByTestId('map-search-unavailable')).toBeInTheDocument();
    expect(screen.getByText('map.unavailable.searchTitle')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers retry only when a retry handler is supplied', () => {
    show({ variant: 'search' });
    expect(screen.queryByRole('button')).toBeNull();

    cleanup();
    show({ variant: 'search', onRetry: () => {} });
    expect(screen.getByRole('button', { name: 'map.retry' })).toBeInTheDocument();
  });

  it('calls the retry handler when tapped', async () => {
    const onRetry = vi.fn();
    show({ variant: 'search', onRetry });
    screen.getByRole('button', { name: 'map.retry' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('RTL rendering', () => {
  it.each(['ar', 'fa'])('points the outbound arrow leftwards in %s', (lang) => {
    language = lang;
    const { container } = show({ variant: 'map' });
    expect(container.textContent).toContain('←');
    expect(container.textContent).not.toContain('→');
  });

  it.each(['en', 'ru'])('points the outbound arrow rightwards in %s', (lang) => {
    language = lang;
    const { container } = show({ variant: 'map' });
    expect(container.textContent).toContain('→');
    expect(container.textContent).not.toContain('←');
  });

  it('uses logical (direction-aware) spacing utilities, never left/right ones', () => {
    language = 'ar';
    const { container } = show({ variant: 'map' });
    const html = container.innerHTML;
    // ms-/me-/text-start flip with direction; ml-/mr-/text-left do not, and are
    // how an RTL layout ends up with the arrow glued to the wrong edge.
    expect(html).not.toMatch(/\bml-\d/);
    expect(html).not.toMatch(/\bmr-\d/);
    expect(html).not.toMatch(/text-left|text-right/);
  });

  it('renders the same structure in every locale (no locale loses the link)', () => {
    for (const lang of ['ar', 'en', 'ru', 'fa']) {
      language = lang;
      cleanup();
      show({ variant: 'map' });
      expect(screen.getByRole('link'), `link missing in ${lang}`).toBeInTheDocument();
      expect(screen.getByTestId('map-unavailable'), `fallback missing in ${lang}`).toBeInTheDocument();
    }
  });
});
