import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RequireAdmin } from '../components/Gates';
import { CCShell } from './components/CCShell';
import { Today } from './pages/Today';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Money } from './pages/Money';
import { Properties } from './pages/Properties';
import { Settings } from './pages/Settings';
import { Content } from './pages/Platform';
import { Placeholder } from './pages/Placeholder';
import { CC_DEFAULT_SECTION, CC_SECTIONS, resolveSectionId } from './sections';

/**
 * Section id → page. Every section here reads REAL data; a section absent from
 * this map falls back to the honest "not built yet" placeholder rather than
 * rendering invented numbers.
 */
const SECTION_PAGES: Record<string, () => ReactNode> = {
  today: () => <Today />,
  orders: () => <Orders />,
  customers: () => <Customers />,
  content: () => <Content />,
  money: () => <Money />,
  properties: () => <Properties />,
  settings: () => <Settings />,
};

/**
 * Admin Control Center — additive surface at /admin/control-center.
 *
 * - Gated by RequireAdmin (the SAME gate as classic /admin): no new access is
 *   granted at the UI layer; every underlying query is is_admin()-scoped by RLS.
 * - The active section lives in `?section=` (mirroring how /admin uses `?tab=`),
 *   so a bookmark/refresh/shared link lands on the right section — one route,
 *   no new nested routes added to the app router. Ids from the pre-redesign
 *   11-section layout (e.g. `?section=overview`) are redirected to their new
 *   home via `resolveSectionId` (see sections.ts).
 * - Every section reads real data; a section absent from SECTION_PAGES falls
 *   back to the honest "not built yet" placeholder rather than rendering
 *   invented numbers.
 *
 * This component is only ever mounted when the feature flag is on (see
 * flag.ts + the guarded route in App.tsx); with the flag off it is never
 * reached and the app renders its normal NotFound fallback.
 */
function ControlCenterInner() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('section');
  // Resolves both current ids and ids from the pre-redesign 11-section layout
  // (e.g. ?section=overview) onto their new home, so an old bookmark or
  // shared link still lands somewhere sensible.
  const active = resolveSectionId(raw);

  const select = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === CC_DEFAULT_SECTION) next.delete('section');
      else next.set('section', id);
      return next;
    });

  // A stale/legacy `?section=` value: rewrite the URL to the canonical id
  // (or drop the param entirely for the default) instead of leaving the
  // address bar out of sync with what's actually rendered. Runs as an effect,
  // not during render, so it doesn't trigger a setState-while-rendering warning.
  useEffect(() => {
    if (raw === null || raw === active) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (active === CC_DEFAULT_SECTION) next.delete('section');
        else next.set('section', active);
        return next;
      },
      { replace: true },
    );
  }, [raw, active, setParams]);

  const def = CC_SECTIONS.find((s) => s.id === active);
  const render = SECTION_PAGES[active];

  return (
    <CCShell activeSection={active} onSelect={select}>
      {render ? render() : <Placeholder sectionId={def?.id ?? active} />}
    </CCShell>
  );
}

export function ControlCenter() {
  return (
    <RequireAdmin>
      <ControlCenterInner />
    </RequireAdmin>
  );
}
