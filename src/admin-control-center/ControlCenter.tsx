import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RequireAdmin } from '../components/Gates';
import { CCShell } from './components/CCShell';
import { Overview } from './pages/Overview';
import { Analytics } from './pages/Analytics';
import { Operations } from './pages/Operations';
import { CRM } from './pages/CRM';
import { Finance } from './pages/Finance';
import { Referrals } from './pages/Referrals';
import { Journey } from './pages/Journey';
import { Content, Documents, Notifications, Security, SystemHealth } from './pages/Platform';
import { Placeholder } from './pages/Placeholder';
import { CC_DEFAULT_SECTION, CC_SECTIONS, isCCSection } from './sections';

/**
 * Section id → page. Every section here reads REAL data; a section absent from
 * this map falls back to the honest "not built yet" placeholder rather than
 * rendering invented numbers.
 */
const SECTION_PAGES: Record<string, () => ReactNode> = {
  overview: () => <Overview />,
  analytics: () => <Analytics />,
  operations: () => <Operations />,
  crm: () => <CRM />,
  finance: () => <Finance />,
  referrals: () => <Referrals />,
  journey: () => <Journey />,
  content: () => <Content />,
  documents: () => <Documents />,
  notifications: () => <Notifications />,
  security: () => <Security />,
  systemHealth: () => <SystemHealth />,
};

/**
 * Admin Control Center — additive surface at /admin/control-center.
 *
 * - Gated by RequireAdmin (the SAME gate as classic /admin): no new access is
 *   granted at the UI layer; every underlying query is is_admin()-scoped by RLS.
 * - The active section lives in `?section=` (mirroring how /admin uses `?tab=`),
 *   so a bookmark/refresh/shared link lands on the right section — one route,
 *   no new nested routes added to the app router.
 * - Only `overview` reads real data in Phase A; reserved sections render an
 *   explicit placeholder, never fabricated numbers.
 *
 * This component is only ever mounted when the feature flag is on (see
 * flag.ts + the guarded route in App.tsx); with the flag off it is never
 * reached and the app renders its normal NotFound fallback.
 */
function ControlCenterInner() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('section');
  const active = isCCSection(raw) ? (raw as string) : CC_DEFAULT_SECTION;

  const select = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === CC_DEFAULT_SECTION) next.delete('section');
      else next.set('section', id);
      return next;
    });

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
