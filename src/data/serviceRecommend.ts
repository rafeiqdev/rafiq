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
 *  - Additive by construction: any profile we don't yet have bespoke logic for
 *    returns `[]`, and the dashboard falls back to its previous behaviour. The
 *    only persona wired up so far is the student.
 *  - Every id returned MUST exist in SERVICES; a test asserts that, so a typo
 *    or a removed service can never surface a dead card.
 */
import type { Profile, StudentStage } from '../lib/types';

/**
 * The full set of catalog services relevant to a student, richest-first as a
 * sensible default. Stage/residency/housing/family then re-rank and prune this
 * — they never introduce an id from outside it, so the student basket is always
 * a subset of this list.
 */
const STUDENT_BASE: string[] = [
  'res-student', // student residence permit
  'ins-residence', // health insurance (required for the permit)
  'bank-account', // bank account
  'tel-address', // address registration
  're-rent', // furnished rental
  're-contracts', // notarized rental contract (for address reg.)
  'edu-university', // university admission
  'edu-denklik', // diploma equivalency
  'edu-tomer', // Turkish language institute
  'tr-sworn', // sworn translation
  'tr-notary', // notary & apostille
  'tr-docs', // document translation
  'res-foreignid', // foreigner ID
  'res-tax', // tax number
  'tel-sim', // SIM card
  'tel-istanbulkart', // transport card
  'tour-airport', // airport pickup
  'daily-moving', // furniture moving
  'res-renew', // residence renewal
  'res-work', // work / internship permit
  'daily-license', // driving licence
];

/** Top picks per stage — these float to the head of the ranked list. */
const STUDENT_STAGE_TOP: Record<StudentStage, string[]> = {
  coming: ['edu-university', 'tr-sworn', 'tour-airport'],
  arrived: ['res-student', 'ins-residence', 'bank-account'],
  settled: ['res-renew', 'ins-residence', 'res-work'],
};

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

/** The student basket, re-ranked and pruned by the follow-up answers. */
function recommendForStudent(profile: Profile): string[] {
  // Default to the "just arrived" ordering — the highest-need moment — when the
  // stage question hasn't been answered yet, so an older profile still gets a
  // sensible top three instead of the raw base order.
  const stage: StudentStage = profile.studentStage ?? 'arrived';

  let base = [...STUDENT_BASE];

  // Residence status re-weights the permit itself.
  if (profile.studentResidency === 'have') {
    // Already holds a permit → renewal matters, first application does not.
    base = without(base, ['res-student']);
    base = orderedUnique(['res-renew', ...base]);
  } else if (profile.studentResidency === 'none' || profile.studentResidency === 'applied') {
    // No permit yet → the first application is the single most urgent step.
    base = orderedUnique(['res-student', ...base]);
  }

  // Housing status decides whether the whole housing sub-bundle is relevant.
  if (profile.studentHousing === 'dorm') {
    // University dorm → no rental/moving, but the address still needs registering.
    base = without(base, ['re-rent', 're-contracts', 'daily-moving']);
  } else if (profile.studentHousing === 'none' || profile.studentHousing === 'temporary') {
    // Needs a home → surface the housing bundle prominently.
    base = orderedUnique(['re-rent', 're-contracts', 'daily-moving', 'tel-address', ...base]);
  }

  // Family joining adds schooling + family insurance.
  const familyExtras = profile.family === 'yes' ? ['edu-schools', 'ins-family'] : [];

  // Stage picks lead the list, then the (possibly re-weighted) remainder.
  return orderedUnique([...STUDENT_STAGE_TOP[stage], ...base, ...familyExtras]);
}

/**
 * Ranked catalog service ids for this profile, most relevant first. Returns an
 * empty array for any profile we have no bespoke matcher for yet — callers
 * treat `[]` as "no recommendation, keep the previous behaviour".
 */
export function recommendedServiceIds(profile: Profile): string[] {
  if (profile.situation === 'student') return recommendForStudent(profile);
  return [];
}
