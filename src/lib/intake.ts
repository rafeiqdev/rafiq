/**
 * Qualifying intake taken BEFORE handing a chat over to a human.
 *
 * Goal: the admin opens a request already knowing what the customer wants, what
 * they already hold, and — most useful — WHICH DOCUMENTS ARE STILL MISSING,
 * instead of re-asking everything by phone.
 *
 * Everything is derived from data that already exists in the app: the service
 * catalog (categories), the 78 step-by-step guides (their `documents` list per
 * language) and the chat's detected subject. No new content to maintain.
 */
import { SERVICES } from '../data/services';
import { getGuideContent, guideSlugForServiceId } from '../data/guides';

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
 * The document checklist to show, taken from the guide that best matches the
 * conversation. Falls back to the tourist-residence guide, which covers the
 * documents almost every newcomer needs (passport, tax number, insurance…).
 */
export function documentsForSubject(subject: string | null, lang: string, permitType?: PermitType | null): string[] {
  const preferred = permitType ? PERMIT_SERVICE[permitType] : undefined;
  const candidates = [
    ...(preferred ? [preferred] : []),
    ...SERVICES.filter((s) => subject && s.category === subject).map((s) => s.id),
    'res-tourist',
  ];

  for (const serviceId of candidates) {
    const slug = guideSlugForServiceId(serviceId);
    if (!slug) continue;
    const guide = getGuideContent(slug, lang);
    const docs = guide?.documents ?? [];
    if (docs.length > 0) return docs.slice(0, 8);
  }
  return [];
}

/** Permit type → the catalog service whose guide lists the right documents. */
const PERMIT_SERVICE: Record<PermitType, string> = {
  tourist: 'res-tourist',
  property: 'res-property',
  work: 'res-work',
  student: 'res-student',
  family: 'res-family',
  renewal: 'res-renew',
};

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
