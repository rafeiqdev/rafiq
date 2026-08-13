import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * Regression test for the tour-vip crash.
 *
 * useCatalog() (src/data/catalogStore.ts) starts every mount with the static
 * catalog, then re-renders once admin overrides load from Supabase — which
 * can hide a service that was present on the first render. ServiceDetail
 * used to call the usePageMeta() hook AFTER an early `return
 * <ServiceNotFound />` for a missing service, so a service disappearing
 * between renders changed the number of hooks React saw for the same
 * component instance and crashed with "Rendered fewer hooks than expected"
 * (React error #300) instead of showing a not-found page. This test mounts
 * on a service that IS present, then flips the catalog to omit it — exactly
 * the sequence that crashed live on /ar/services/tour-vip — and asserts the
 * component survives and falls back to the not-found view.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}));

vi.mock('../components/AppIcon', () => ({
  AppIcon: () => null,
}));

let setSnapshot: ((snap: unknown) => void) | undefined;

vi.mock('../data/catalogStore', async () => {
  const React = await import('react');
  const { SERVICES, SERVICE_CATEGORIES } = await import('../data/services');
  return {
    useCatalog: () => {
      const [snap, setSnap] = React.useState({ services: SERVICES, categories: SERVICE_CATEGORIES });
      setSnapshot = setSnap as (snap: unknown) => void;
      return snap;
    },
  };
});

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/services/${id}`]}>
      <Routes>
        <Route path="/services/:id" element={<TestServiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Imported lazily inside a wrapper so the catalogStore mock above is in place
// before ServiceDetail's own top-level import of it resolves.
import { ServiceDetail as TestServiceDetail } from './ServiceDetail';
import { SERVICES, SERVICE_CATEGORIES } from '../data/services';

describe('ServiceDetail survives a service disappearing after mount', () => {
  it('renders the service, then falls back to not-found (no crash) when the catalog update hides it', async () => {
    renderAt('tour-vip');

    // First render: static catalog still has tour-vip.
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();

    // Simulate the admin-overrides fetch resolving and hiding this service —
    // the exact transition that used to throw React error #300.
    act(() => {
      setSnapshot?.({
        services: SERVICES.filter((s) => s.id !== 'tour-vip'),
        categories: SERVICE_CATEGORIES,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('الخدمة غير موجودة')).toBeInTheDocument();
    });
  });
});
