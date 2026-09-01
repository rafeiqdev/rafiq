import type { Situation } from '../lib/types';

export interface SituationSuggestion {
  /** i18n key suffix: services.situationSuggest.questions.<id> */
  id: string;
  situation: Situation;
  /** must be a real id in SERVICES — enforced by situationSuggestions.test.ts */
  serviceId: string;
}

/**
 * Question prompts shown on the Services landing page to a signed-in visitor
 * who hasn't been routed to a specific service, tailored to their onboarding
 * "situation". Every `serviceId` here must exist in the SERVICES catalog —
 * these open a real chat about a real service, never an invented one.
 */
export const SITUATION_SUGGESTIONS: SituationSuggestion[] = [
  { id: 'planning-eligibility', situation: 'planning', serviceId: 'res-eligibility' },
  { id: 'planning-visa', situation: 'planning', serviceId: 'visa-check' },
  { id: 'planning-bank', situation: 'planning', serviceId: 'bank-account' },

  { id: 'arrived-tax', situation: 'arrived', serviceId: 'res-tax' },
  { id: 'arrived-sim', situation: 'arrived', serviceId: 'tel-sim' },
  { id: 'arrived-address', situation: 'arrived', serviceId: 'tel-address' },

  { id: 'visiting-airport', situation: 'visiting', serviceId: 'tour-airport' },
  { id: 'visiting-tours', situation: 'visiting', serviceId: 'tour-daytrips' },
  { id: 'visiting-hotel', situation: 'visiting', serviceId: 'tour-hotels' },

  { id: 'student-residence', situation: 'student', serviceId: 'res-student' },
  { id: 'student-insurance', situation: 'student', serviceId: 'ins-student' },
  { id: 'student-university', situation: 'student', serviceId: 'edu-university' },

  { id: 'resident-renew', situation: 'resident', serviceId: 'res-renew' },
  { id: 'resident-company', situation: 'resident', serviceId: 'legal-ltd' },
  { id: 'resident-accounting', situation: 'resident', serviceId: 'acc-monthly' },

  { id: 'longres-citizenship', situation: 'long_resident', serviceId: 'res-citizenship' },
  { id: 'longres-realestate', situation: 'long_resident', serviceId: 're-buy' },
  { id: 'longres-eldercare', situation: 'long_resident', serviceId: 'daily-eldercare' },
];

export function suggestionsFor(situation: Situation | null | undefined): SituationSuggestion[] {
  if (!situation) return [];
  return SITUATION_SUGGESTIONS.filter((s) => s.situation === situation);
}
