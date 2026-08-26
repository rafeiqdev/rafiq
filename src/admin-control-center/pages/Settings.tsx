import { useCC } from '../i18n';
import { Accordion } from '../components/Accordion';
import { Security, SystemHealth, Documents, Notifications } from './Platform';

/** Settings & Security — the audit log up front; health, documents and notification history tucked into accordions. */
export function Settings() {
  const { cc } = useCC();
  return (
    <div className="flex flex-col gap-6">
      <Security />
      <Accordion title={cc('accordion.systemHealth')} icon="sliders-horizontal">
        <SystemHealth />
      </Accordion>
      <Accordion title={cc('accordion.documents')} icon="file-text">
        <Documents />
      </Accordion>
      <Accordion title={cc('accordion.notifications')} icon="bell">
        <Notifications />
      </Accordion>
    </div>
  );
}
