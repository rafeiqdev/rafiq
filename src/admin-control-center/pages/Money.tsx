import { useCC } from '../i18n';
import { Accordion } from '../components/Accordion';
import { Finance } from './Finance';
import { Referrals } from './Referrals';

/** Finance — the four payment sources up front, referral commissions/payouts tucked into an accordion. */
export function Money() {
  const { cc } = useCC();
  return (
    <div className="flex flex-col gap-6">
      <Finance />
      <Accordion title={cc('accordion.referrals')} icon="gift">
        <Referrals />
      </Accordion>
    </div>
  );
}
