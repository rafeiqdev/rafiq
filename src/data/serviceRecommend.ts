/**
 * Answer → service matcher.
 *
 * Turns the post-login onboarding answers into a RANKED list of catalog
 * service ids (see data/services.ts). The dashboard shows the first few of
 * these in the "خدمات تهمّك" rail, and the rest live on /services.
 *
 * Design notes:
 *  - Pure and data-only. No i18n, no React, no catalog objects — it deals in
 *    service *ids* so it can be unit-tested in isolation and stays valid even
 *    when an admin edits a card's text or image.
 *  - Additive by construction: any situation we don't have a bundle for returns
 *    `[]`, and the dashboard falls back to its previous behaviour.
 *  - We recommend what the user still NEEDS, never what they already have: the
 *    onboarding "has" answers (phone / tax number / permit / bank) prune the
 *    matching services out. Recommending a bank account to someone who ticked
 *    "I have a bank account" is exactly the mistake this avoids.
 *  - Every id returned MUST exist in SERVICES; a test asserts that, so a typo
 *    or a removed service can never surface a dead card.
 */
import type {
  Profile,
  Situation,
  StudentStage,
  ArrivedReason,
  VisitorTrip,
  ResidentType,
  ResidentPlan,
  PlanningReason,
  JourneyTaskKey,
} from '../lib/types';

/**
 * Services made redundant by an onboarding "has" answer. When the user ticked
 * that they already have the thing, we never recommend the service that
 * delivers it. `residencePermit` drops the *first-application* permits only —
 * renewal (res-renew) and a different-purpose permit (res-work) stay relevant.
 */
const HAS_TO_SERVICES: Record<JourneyTaskKey, string[]> = {
  turkishPhone: ['tel-sim'],
  taxNumber: ['res-tax'],
  bankAccount: ['bank-account'],
  residencePermit: ['res-student', 'res-tourist'],
};

/** A persona's services: `top` lead the list, then the rest of `base`. */
interface Bundle {
  top: string[];
  base: string[];
}

/**
 * Non-student personas. Each `base` is the full set of catalog services that
 * fit that situation, richest-first; `top` are the three we lead with on the
 * dashboard. Student is handled separately (it has follow-up questions).
 */
const PERSONA_BUNDLES: Partial<Record<Situation, Bundle>> = {
  // NOTE: `planning` → recommendForPlanning (branches on reason for relocating);
  //       `arrived` → recommendForArrived (branches on reason for coming);
  //       `visiting` → recommendForVisitor (branches on trip type + VIP level);
  //       `resident` → recommendForResident (branches on nature of residence + plan).
  long_resident: {
    top: ['res-citizenship', 're-buy', 'legal-ltd'],
    base: [
      'res-citizenship', 're-buy', 'res-family', 'legal-ltd', 'acc-monthly', 'ins-family',
      'daily-license', 're-management', 'res-renew', 'legal-consult',
    ],
  },
};

/** Top picks per student stage — these float to the head of the ranked list. */
const STUDENT_STAGE_TOP: Record<StudentStage, string[]> = {
  coming: ['edu-university', 'tr-sworn', 'tour-airport'],
  arrived: ['res-student', 'ins-residence', 'bank-account'],
  settled: ['res-renew', 'ins-residence', 'res-work'],
};

/** The full set of catalog services relevant to a student, richest-first. */
const STUDENT_BASE: string[] = [
  'res-student', 'ins-residence', 'bank-account', 'tel-address', 're-rent', 're-contracts',
  'edu-university', 'edu-denklik', 'edu-tomer', 'tr-sworn', 'tr-notary', 'tr-docs',
  'res-foreignid', 'res-tax', 'tel-sim', 'tel-istanbulkart', 'tour-airport', 'daily-moving',
  'res-renew', 'res-work', 'daily-license',
];

/**
 * Stable de-dupe that preserves first-seen order — the way we promote a subset
 * to the front and then append the remainder without repeats.
 */
function orderedUnique(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Remove ids from a list (used to prune services an answer makes irrelevant). */
function without(ids: string[], drop: string[]): string[] {
  const dropSet = new Set(drop);
  return ids.filter((id) => !dropSet.has(id));
}

/** Service ids the user already has, from their onboarding "has" answers. */
function ownedServices(profile: Profile): string[] {
  return (Object.keys(HAS_TO_SERVICES) as JourneyTaskKey[])
    .filter((k) => profile.has?.[k])
    .flatMap((k) => HAS_TO_SERVICES[k]);
}

/** The student basket, re-ranked and pruned by the follow-up answers. */
function recommendForStudent(profile: Profile): string[] {
  // Default to the "just arrived" ordering — the highest-need moment — when the
  // stage question hasn't been answered yet.
  const stage: StudentStage = profile.studentStage ?? 'arrived';

  let base = [...STUDENT_BASE];

  // Residence status re-weights the permit itself.
  if (profile.studentResidency === 'have') {
    base = without(base, ['res-student']);
    base = orderedUnique(['res-renew', ...base]);
  } else if (profile.studentResidency === 'none' || profile.studentResidency === 'applied') {
    base = orderedUnique(['res-student', ...base]);
  }

  // Housing status decides whether the whole housing sub-bundle is relevant.
  if (profile.studentHousing === 'dorm') {
    base = without(base, ['re-rent', 're-contracts', 'daily-moving']);
  } else if (profile.studentHousing === 'none' || profile.studentHousing === 'temporary') {
    base = orderedUnique(['re-rent', 're-contracts', 'daily-moving', 'tel-address', ...base]);
  }

  const familyExtras = profile.family === 'yes' ? ['edu-schools', 'ins-family'] : [];
  return orderedUnique([...STUDENT_STAGE_TOP[stage], ...base, ...familyExtras]);
}

/**
 * A newcomer's top three, chosen by WHY they came — the research's clearest
 * finding. Falls back to the generic "settling-in essentials" when the reason
 * hasn't been answered (or is "other").
 */
const ARRIVED_REASON_TOP: Partial<Record<ArrivedReason, string[]>> = {
  work: ['res-work', 'bank-account', 'tel-sim'],
  living: ['re-rent', 'tel-address', 'ins-residence'],
  family: ['res-family', 'edu-schools', 'ins-family'],
  business: ['legal-ltd', 'acc-monthly', 'legal-consult'],
  study: ['res-student', 'ins-residence', 'edu-tomer'],
  short: ['tour-daytrips', 'tour-hotels', 'tel-sim'],
};
const ARRIVED_DEFAULT_TOP = ['tel-sim', 'bank-account', 'res-tax'];

/** The full set of services a newcomer might need, across every reason. */
const ARRIVED_BASE: string[] = [
  'tel-sim', 'tel-istanbulkart', 'bank-account', 'res-tax', 'res-foreignid', 'tel-address',
  'res-tourist', 'res-work', 'ins-residence', 're-rent', 're-contracts', 'tr-sworn', 'tr-companion',
  'daily-moving', 'tel-utilities', 'legal-ltd', 'acc-monthly', 'legal-consult', 'res-family',
  'edu-schools', 'ins-family', 'health-doctors', 'daily-reminders',
];

/** The newcomer basket: reason picks the lead, housing/family re-rank the rest. */
function recommendForArrived(profile: Profile): string[] {
  const top = (profile.arrivedReason && ARRIVED_REASON_TOP[profile.arrivedReason]) || ARRIVED_DEFAULT_TOP;
  let base = [...ARRIVED_BASE];

  // Housing status decides whether the housing sub-bundle is relevant.
  const needsHome =
    profile.arrivedHousing === 'none' ||
    profile.arrivedHousing === 'temporary' ||
    profile.arrivedHousing === 'withRelative';
  if (needsHome) {
    base = orderedUnique(['re-rent', 're-contracts', 'daily-moving', 'tel-address', ...base]);
  } else if (profile.arrivedHousing === 'owned') {
    base = without(base, ['re-rent', 're-contracts', 'daily-moving']);
  } else if (profile.arrivedHousing === 'rented') {
    // Already has a leased home → no search/move, but the contract/address may
    // still need sorting.
    base = without(base, ['re-rent', 'daily-moving']);
  }

  // Schooling / family insurance for a newcomer bringing family.
  const familyExtras = profile.family === 'yes' ? ['edu-schools', 'ins-family'] : [];
  return orderedUnique([...top, ...base, ...familyExtras]);
}

/**
 * A visitor's top three, chosen by WHAT they want to do. The service-level
 * answer (VIP / comfort) then promotes the private/premium services ahead of
 * the trip picks.
 */
const VISITOR_TRIP_TOP: Partial<Record<VisitorTrip, string[]>> = {
  sights: ['tour-daytrips', 'tour-tickets', 'tour-airport'],
  shopping: ['daily-shopping', 'tour-driver', 'tour-airport'],
  nature: ['tour-bosphorus', 'tour-daytrips', 'tour-airport'],
  multicity: ['tour-multicity', 'tour-packages', 'tour-airport'],
  medical: ['health-tourism', 'tr-medical', 'tour-airport'],
  family: ['tour-packages', 'tour-daytrips', 'tour-airport'],
};
const VISITOR_DEFAULT_TOP = ['tour-airport', 'tour-daytrips', 'tour-hotels'];

/** Every service a visitor might want, across all trip types. */
const VISITOR_BASE: string[] = [
  'tour-airport', 'tour-vip', 'tour-daytrips', 'tour-hotels', 'tour-bosphorus', 'tour-multicity',
  'tour-driver', 'tour-carrental', 'tour-tickets', 'tour-packages', 'daily-shopping', 'tr-companion',
  'health-tourism', 'tr-medical', 'health-hospitals',
];

/** The visitor basket: trip type leads, VIP/comfort promote the premium services. */
function recommendForVisitor(profile: Profile): string[] {
  const tripTop = (profile.visitorTrip && VISITOR_TRIP_TOP[profile.visitorTrip]) || VISITOR_DEFAULT_TOP;
  const serviceLead =
    profile.visitorService === 'vip'
      ? ['tour-vip', 'tour-driver']
      : profile.visitorService === 'comfort'
        ? ['tour-driver']
        : [];
  return orderedUnique([...serviceLead, ...tripTop, ...VISITOR_BASE]);
}

/**
 * A relocation planner's top three, chosen by WHY they are moving. Falls back
 * to generic pre-arrival essentials when the reason hasn't been answered.
 */
const PLANNING_REASON_TOP: Partial<Record<PlanningReason, string[]>> = {
  work: ['res-work', 'tr-sworn', 'ins-residence'],
  study: ['edu-university', 'tr-sworn', 'edu-denklik'],
  family: ['res-family', 'tr-sworn', 'edu-schools'],
  business: ['legal-ltd', 'acc-monthly', 're-buy'],
  retirement: ['re-rent', 'ins-residence', 'health-doctors'],
};
const PLANNING_DEFAULT_TOP = ['re-rent', 'tr-sworn', 'tour-airport'];

/** Every service a pre-arrival planner might need, across every reason. */
const PLANNING_BASE: string[] = [
  're-rent', 're-contracts', 'tr-sworn', 'tr-notary', 'tr-docs', 'tour-airport', 'res-tourist',
  'res-work', 'res-student', 'res-family', 'ins-residence', 'ins-family', 'bank-account', 'tel-sim',
  'edu-university', 'edu-denklik', 'edu-tomer', 'edu-schools', 'legal-ltd', 'acc-monthly',
  'legal-consult', 're-buy', 'health-doctors',
];

/** The planner basket: reason picks the lead, family adds schooling/insurance. */
function recommendForPlanning(profile: Profile): string[] {
  const top = (profile.planningReason && PLANNING_REASON_TOP[profile.planningReason]) || PLANNING_DEFAULT_TOP;
  const familyExtras = profile.family === 'yes' ? ['edu-schools', 'ins-family'] : [];
  return orderedUnique([...top, ...PLANNING_BASE, ...familyExtras]);
}

/**
 * A resident's top three, chosen by the NATURE of their residence. The plan for
 * the coming period then promotes the matching "development" services (a
 * property plan leads with buying/managing property; a citizenship plan with
 * the citizenship file) ahead of the type picks.
 */
const RESIDENT_TYPE_TOP: Record<ResidentType, string[]> = {
  employee: ['res-renew', 'res-work', 'ins-residence'],
  business: ['acc-monthly', 'legal-ltd', 'res-renew'],
  family: ['res-renew', 'ins-family', 'edu-schools'],
  retired: ['res-renew', 'ins-residence', 'health-doctors'],
  investor: ['re-buy', 're-management', 'res-citizenship'],
  student: ['res-renew', 'ins-residence', 'edu-tomer'],
  unsure: ['res-renew', 'ins-residence', 'daily-license'],
};
const RESIDENT_DEFAULT_TOP = ['res-renew', 'ins-residence', 'daily-license'];

const RESIDENT_PLAN_LEAD: Record<ResidentPlan, string[]> = {
  job: ['res-work'],
  business: ['legal-ltd', 'acc-monthly'],
  property: ['re-buy', 're-management'],
  citizenship: ['res-citizenship', 're-citizenship'],
  family: ['edu-schools', 'ins-family'],
  maintain: [],
  explore: [],
};

/** Every service a settled resident might need, across every nature/plan. */
const RESIDENT_BASE: string[] = [
  'res-renew', 'ins-residence', 'ins-family', 'daily-license', 're-rent', 're-contracts', 're-buy',
  're-management', 're-valuation', 'res-work', 'res-citizenship', 're-citizenship', 'tel-utilities',
  'tel-address', 'acc-monthly', 'acc-consult', 'legal-ltd', 'legal-consult', 'health-doctors',
  'tr-companion', 'bank-transfer', 'daily-reminders', 'edu-schools',
];

/** The resident basket: nature leads, an explicit plan promotes its services. */
function recommendForResident(profile: Profile): string[] {
  const typeTop = (profile.residentType && RESIDENT_TYPE_TOP[profile.residentType]) || RESIDENT_DEFAULT_TOP;
  const planLead = (profile.residentPlan && RESIDENT_PLAN_LEAD[profile.residentPlan]) || [];
  const familyExtras = profile.family === 'yes' ? ['edu-schools', 'ins-family'] : [];
  return orderedUnique([...planLead, ...typeTop, ...RESIDENT_BASE, ...familyExtras]);
}

/** A non-student persona bundle, with family extras where they make sense. */
function recommendForPersona(situation: Situation, profile: Profile): string[] {
  const bundle = PERSONA_BUNDLES[situation];
  if (!bundle) return [];
  // Schooling / family insurance only make sense for someone staying — never a
  // visitor passing through.
  const familyExtras =
    profile.family === 'yes' && situation !== 'visiting' ? ['edu-schools', 'ins-family'] : [];
  return orderedUnique([...bundle.top, ...bundle.base, ...familyExtras]);
}

/**
 * Ranked catalog service ids for this profile, most relevant first, with the
 * services the user already owns pruned out. Returns an empty array for a
 * profile with no situation — callers treat `[]` as "keep the previous
 * behaviour".
 */
export function recommendedServiceIds(profile: Profile): string[] {
  const situation = profile.situation;
  if (!situation) return [];
  const ranked =
    situation === 'planning'
      ? recommendForPlanning(profile)
      : situation === 'student'
      ? recommendForStudent(profile)
      : situation === 'arrived'
        ? recommendForArrived(profile)
        : situation === 'visiting'
          ? recommendForVisitor(profile)
          : situation === 'resident'
            ? recommendForResident(profile)
            : recommendForPersona(situation, profile);
  return without(ranked, ownedServices(profile));
}
