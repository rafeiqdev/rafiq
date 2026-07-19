/**
 * ONBOARDING SOURCE OF TRUTH
 * ==========================
 * Structured `profiles` columns are CANONICAL for:
 *   city · situation · family_status · onboarding_completed
 *
 * `profiles.onboarding` (jsonb) stays canonical for:
 *   • the flexible `has` checklist,
 *   • legacy fields not migrated to columns,
 *   • compatibility with the existing recommendation engine
 *     (blocks/registry.ts reads `path` / `reason` / `has` / `family`).
 *
 * Writes: one save updates BOTH representations in a single statement. Only a
 * confirmed missing-schema error may fall back to jsonb-only (pre-migration);
 * once the columns exist, a failure to write them is a genuine error.
 *
 * Reads: prefer the structured columns, fall back to jsonb only when a column
 * is absent (pre-migration rows, or rows written by older code).
 */
import { EMPTY_PROFILE } from './types';
import type { JourneyStatus, Profile, Situation } from './types';

export interface ProfileColumns {
  city?: string | null;
  situation?: string | null;
  family_status?: string | null;
  onboarding_completed?: boolean | null;
}

/** Structured columns win; jsonb fills the gaps. */
export function resolveOnboarding(jsonb: Partial<Profile> | null | undefined, cols: ProfileColumns): Profile {
  const legacy: Profile = { ...EMPTY_PROFILE, ...(jsonb ?? {}) };
  const familyFromColumn =
    cols.family_status === 'family' ? 'yes' : cols.family_status === 'alone' ? 'no' : null;

  return {
    ...legacy,
    city: cols.city ?? legacy.city ?? null,
    situation: (cols.situation as Situation | null | undefined) ?? legacy.situation ?? null,
    family: familyFromColumn ?? legacy.family ?? null,
  };
}

/** The column value written for a Profile.family answer. */
export function familyStatusColumn(family: Profile['family']): string | null {
  if (family === 'yes') return 'family';
  if (family === 'no') return 'alone';
  return null;
}

/**
 * Mirrors the ON CONFLICT rule inside ensure_my_journey(): editing onboarding
 * answers may only UPGRADE a task todo → done. A task completed manually is
 * never reverted, even if the new answers contradict it.
 */
export function nextStatusOnOnboardingEdit(current: JourneyStatus, onboardingSaysDone: boolean): JourneyStatus {
  if (current === 'done') return 'done'; // manual progress always wins
  return onboardingSaysDone ? 'done' : 'todo';
}
