import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { suggestionsFor } from '../data/situationSuggestions';
import type { ServiceItem } from '../data/services';
import type { Situation } from '../lib/types';
import { AppIcon } from './AppIcon';

/**
 * Personalized "ask about this" prompts on the Services landing page, shown
 * only to a visitor who hasn't been routed to a specific service and whose
 * onboarding "situation" we know. Each one opens the chat pre-filled with
 * that exact question, tied to a service the catalog actually offers.
 */
export function SituationSuggestions({ situation, services }: { situation: Situation | null | undefined; services: ServiceItem[] }) {
  const { t } = useTranslation();
  // Defensive: only suggest a service that is actually live in the catalog
  // right now (an admin may have hidden/renamed one since this list was written).
  const items = suggestionsFor(situation).filter((s) => services.some((svc) => svc.id === s.serviceId));
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="situation-suggest-title" className="mt-6">
      <h2 id="situation-suggest-title" className="text-sm font-extrabold text-navy">
        {t('services.situationSuggest.title')}
      </h2>
      <p className="mt-0.5 text-xs text-navy/60">{t('services.situationSuggest.subtitle')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((s) => (
          <Link
            key={s.id}
            to={`/premium?topic=${s.serviceId}&ask=${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-dark bg-white px-4 py-2 text-xs font-semibold text-navy hover:border-navy/40 hover:underline"
          >
            <AppIcon name="message-circle" className="w-3.5 h-3.5 shrink-0" />
            {t(`services.situationSuggest.questions.${s.id}`)}
          </Link>
        ))}
      </div>
    </section>
  );
}
