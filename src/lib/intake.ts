/**
 * Qualifying intake taken BEFORE handing a chat over to a human.
 *
 * Goal: the admin opens a request already knowing what the customer wants, what
 * they already hold, and — most useful — WHICH DOCUMENTS ARE STILL MISSING,
 * instead of re-asking everything by phone.
 */

/** Residence-permit types we ask about when the chat is about residency. */
export const PERMIT_TYPES = ['tourist', 'property', 'work', 'student', 'family', 'renewal'] as const;
export type PermitType = (typeof PERMIT_TYPES)[number];

/** Whether the customer already holds (or held) a permit. */
export const PRIOR_PERMIT = ['none', 'active', 'expired'] as const;
export type PriorPermit = (typeof PRIOR_PERMIT)[number];

export interface IntakeAnswers {
  /** service category the conversation was about (from subject detection) */
  subject: string | null;
  permitType?: PermitType | null;
  priorPermit?: PriorPermit | null;
  /** documents the customer says they already have (exact strings from the guide) */
  documentsHeld: string[];
}

export const EMPTY_INTAKE: IntakeAnswers = {
  subject: null,
  permitType: null,
  priorPermit: null,
  documentsHeld: [],
};

/** The residency questions only make sense for residency conversations. */
export function needsPermitQuestions(subject: string | null): boolean {
  return subject === 'residency';
}

/**
 * The document checklist to show for this conversation. No structured document
 * data is currently maintained, so this is always empty — the intake UI shows
 * its "nothing specific" state and just asks what the customer already holds.
 */
export function documentsForSubject(_subject: string | null, _lang: string, _permitType?: PermitType | null): string[] {
  return [];
}

/** Documents from the checklist the customer did NOT tick. */
export function missingDocuments(required: string[], held: string[]): string[] {
  const heldSet = new Set(held);
  return required.filter((d) => !heldSet.has(d));
}

/**
 * A compact, human-readable block appended to the booking summary so the admin
 * sees the essentials without opening the transcript. Localised labels are
 * passed in by the caller (which has i18n), keeping this module pure.
 */
export function buildIntakeSummary(
  answers: IntakeAnswers,
  required: string[],
  labels: {
    permitType: string;
    priorPermit: string;
    has: string;
    missing: string;
    none: string;
    permitTypeValue?: string;
    priorPermitValue?: string;
  },
): string {
  const lines: string[] = [];
  if (answers.permitType && labels.permitTypeValue) {
    lines.push(`${labels.permitType}: ${labels.permitTypeValue}`);
  }
  if (answers.priorPermit && labels.priorPermitValue) {
    lines.push(`${labels.priorPermit}: ${labels.priorPermitValue}`);
  }
  lines.push(`${labels.has}: ${answers.documentsHeld.length ? answers.documentsHeld.join(' • ') : labels.none}`);
  const missing = missingDocuments(required, answers.documentsHeld);
  lines.push(`${labels.missing}: ${missing.length ? missing.join(' • ') : labels.none}`);
  return lines.join('\n');
}
