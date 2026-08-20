import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '../components/Gates';
import { MedicalRequestsPanel } from '../components/medical/MedicalRequestsPanel';
import { RequestsFeed } from '../components/requests/RequestsFeed';
import { AppIcon } from '../components/AppIcon';
import { RafiqLoader } from '../components/RafiqLoader';

/**
 * "طلباتي" — every request this customer has ever made, whichever door they
 * came through: a service form, the AI assistant's handoff, or a property
 * enquiry. The merge, the three independent loads and the loading/error/empty
 * rules all live in RequestsFeed, shared with the phone.
 */

// Kept as a re-export: this page owned the helper, and humanMessage.test.ts
// asserts both entry points behave identically. They now cannot differ — there
// is one implementation, in lib/bookingSummary.
export { humanMessage } from '../lib/bookingSummary';

function MyRequestsInner() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('requests.title')}</h1>
      <p className="mt-2 text-sm text-navy/60">{t('requests.subtitle')}</p>

      <RequestsFeed
        loading={<RafiqLoader size="sm" className="min-h-[50vh]" />}
        empty={
          <div className="card p-8 mt-6 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="inbox" className="w-6 h-6" />
            </div>
            <p className="mt-4 text-sm text-navy/60">{t('requests.empty')}</p>
            <Link to="/services" className="btn-primary mt-6">
              {t('requests.browseServices')}
            </Link>
          </div>
        }
      />

      <MedicalRequestsPanel />
    </div>
  );
}

export function MyRequests() {
  return (
    <RequireAuth>
      <MyRequestsInner />
    </RequireAuth>
  );
}
