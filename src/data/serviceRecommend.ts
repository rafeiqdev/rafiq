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
import type { Profile, Situation, StudentStage, JourneyTaskKey } from '../lib/types';

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
  planning: {
    top: ['re-rent', 'tr-sworn', 'tour-airport'],
    base: [
      're-rent', 're-contracts', 'tr-sworn', 'tr-notary', 'tr-docs', 'tour-airport',
      'res-tourist', 'ins-residence', 'bank-account', 'tel-sim', 'edu-tomer', 'edu-denklik',
    ],
  },
  arrived: {
    top: ['tel-sim', 'bank-account', 'res-tax'],
    base: [
      'tel-sim', 'tel-istanbulkart', 'bank-account', 'res-tax', 'res-foreignid', 'tel-address',
      'res-tourist', 'ins-residence', 're-rent', 're-contracts', 'tr-companion', 'daily-moving',
    ],
  },
  visiting: {
    top: ['tour-airport', 'tour-daytrips', 'tour-hotels'],
    base: [
      'tour-airport', 'tour-daytrips', 'tour-hotels', 'tour-bosphorus', 'tour-multicity',
      'tour-driver', 'tour-carrental', 'tour-tickets', 'tour-packages', 'tr-companion', 'health-tourism',
    ],
  },
  resident: {
    top: ['res-renew', 'ins-residence', 'daily-license'],
    base: [
      'res-renew', 'ins-residence', 'daily-license', 're-rent', 're-buy', 'tel-utilities',
      'tr-companion', 'health-doctors', 'ins-carhome', 'res-work', 'daily-reminders', 'bank-account',
    ],
  },
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
  const ranked = situation === 'student' ? recommendForStudent(profile) : recommendForPersona(situation, profile);
  return without(ranked, ownedServices(profile));
}
