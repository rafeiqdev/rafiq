import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { Accordion } from '../components/Accordion';
import { CCState } from '../components/CCState';
import { Kpi, num } from '../components/CCKit';
import { computeUserKpis, overviewApi } from '../api/overview';
import { CRM } from './CRM';
import { Journey } from './Journey';

/** Customers — who they are (total/paying users), the lead pipeline, and onboarding progress tucked into an accordion. */
export function Customers() {
  const { cc, lang } = useCC();
  const usersSec = useAsyncSection(() => overviewApi.users(), []);

  return (
    <div className="flex flex-col gap-6">
      <CCState section={usersSec} title={cc('section.customers')} isEmpty={() => false}>
        {(users) => {
          const k = computeUserKpis(users);
          return (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon="users" label={cc('overview.kpi.totalUsers')} value={num(k.totalUsers, lang)} />
              <Kpi icon="star" label={cc('overview.kpi.payingUsers')} value={num(k.payingUsers, lang)} />
              <Kpi icon="calendar" label={cc('overview.kpi.totalBookings')} value={num(k.totalBookings, lang)} />
              <Kpi icon="mail" label={cc('overview.kpi.totalLeads')} value={num(k.totalLeads, lang)} />
            </div>
          );
        }}
      </CCState>

      <CRM />
      <Accordion title={cc('accordion.journey')} icon="compass">
        <Journey />
      </Accordion>
    </div>
  );
}
