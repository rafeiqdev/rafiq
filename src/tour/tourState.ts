import { TOURS, type TourDef, type TourStepDef } from './tours';

/**
 * Pure helpers behind the tour: which tour a path gets, which of its steps
 * can actually be shown right now, what the visitor has already seen, and
 * whether something on screen should hold the tour back. No React here so
 * every rule is unit-testable with a plain jsdom document.
 */

export const SEEN_KEY_PREFIX = 'rafiq_tour_seen:';

export function findTour(pathname: string, tours: TourDef[] = TOURS): TourDef | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return tours.find((t) => t.paths.includes(clean)) ?? null;
}

export function targetSelector(target: string): string {
  return `[data-tour="${target}"]`;
}

/**
 * A step is showable when it has no target (centered card) or its target is
 * in the document AND takes up space — `display:none` targets (a voice button
 * on a phone without speech support, a section hidden for guests) report a
 * zero rect and would otherwise spotlight an empty corner.
 */
export function resolveSteps(tour: TourDef, doc: Document): TourStepDef[] {
  return tour.steps.filter((s) => {
    if (!s.target) return true;
    const el = doc.querySelector<HTMLElement>(targetSelector(s.target));
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });
}

/** True when at least one step points at a real element — a tour of only a
 *  welcome card has nothing to teach and must not interrupt the visitor. */
export function hasAnchoredStep(steps: TourStepDef[]): boolean {
  return steps.some((s) => Boolean(s.target));
}

export function hasSeenTour(id: string, storage: Storage | null = safeStorage()): boolean {
  try {
    return storage?.getItem(SEEN_KEY_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(id: string, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(SEEN_KEY_PREFIX + id, '1');
  } catch {
    /* private mode / quota — the tour simply shows again next time */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Something else owns the screen: the cookie-consent strip (first visit — the
 * exact moment the tour would also want to start), or any other modal dialog
 * (service request form, booking, auth sheet). The tour waits its turn.
 */
export function isTourBlocked(doc: Document): boolean {
  if (doc.querySelector('[aria-labelledby="consent-title"]')) return true;
  const modals = Array.from(doc.querySelectorAll('[aria-modal="true"]'));
  return modals.some((m) => !m.closest('[data-tour-layer]'));
}
