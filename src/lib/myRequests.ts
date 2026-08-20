/**
 * ONE list for everything a customer has asked us for.
 *
 * A request can be born in three unrelated places and lands in three unrelated
 * tables: a service form writes `service_requests`, the AI assistant's handoff
 * writes `bookings`, and a property enquiry writes `leads`. /requests only ever
 * read the first of those, so a customer who booked a call with the assistant
 * or asked for a viewing on a listing opened "طلباتي" and was told they had
 * never contacted us — on the one page built to prove they had.
 *
 * This module is the shared vocabulary that makes the three comparable:
 * a reference number, a kind, a normalised status and a creation date, plus the
 * original row for whatever else a renderer needs. It is deliberately pure —
 * no network, no react — so the merge rules can be tested without a database.
 */
import type { Booking, CustomerRequest, Lead } from './types';
import { shortSummary } from './bookingSummary';

/** Where the request came from. Drives the icon, the label and the details. */
export type RequestKind = 'service' | 'ai' | 'realestate' | 'health';

/**
 * The four states a customer is shown, whatever table the row lives in.
 *
 * Every source has its own status vocabulary (`new` in one, `confirmed` in
 * another, `closed` in a third). Normalising here means RequestStatusPill keeps
 * a single set of words, and a customer is never asked to work out whether
 * "confirmed" is better or worse than "accepted".
 */
export type UnifiedStatus = 'pending' | 'accepted' | 'done' | 'rejected';

interface Common {
  id: string;
  /** Human-quotable id, e.g. `SR-4F2A9C`. Derived, never stored — see referenceFor. */
  reference: string;
  status: UnifiedStatus;
  /** The row's own status word, kept for debugging/analytics — not rendered. */
  rawStatus: string;
  createdAt: string;
  /** One line naming what was asked for. */
  title: string;
}

export type UnifiedRequest =
  | (Common & { kind: 'service'; service: CustomerRequest })
  | (Common & { kind: 'ai'; booking: Booking })
  | (Common & {
      kind: 'realestate' | 'health';
      lead: Lead;
      /** `viewing` | `contracts` | `legal` | `citizenship` when the lead carries
       *  the `[key]` tag ListingServices writes; null for older/plain leads. */
      serviceKey: string | null;
      /** The lead text with the `[key]` tag removed. */
      itemText: string;
    });

const PREFIX: Record<RequestKind, string> = {
  service: 'SR',
  ai: 'AI',
  realestate: 'RE',
  health: 'HT',
};

/** Deterministic base-36 digest, used only to pad a reference that is short. */
function digest(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase();
}

/**
 * The number a customer reads out on WhatsApp.
 *
 * Derived from the row id rather than stored, so it needs no column, no
 * sequence and no migration — which matters here, because a reference that
 * depends on a migration is a reference that is blank on the day the feature
 * ships. The same id always yields the same reference, on every device, so it
 * is quotable even though nothing persists it.
 */
export function referenceFor(kind: RequestKind, id: string): string {
  const clean = (id ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const body = (clean.length >= 6 ? clean : clean + digest(String(id ?? ''))).slice(0, 6).padEnd(6, '0');
  return `${PREFIX[kind]}-${body}`;
}

/** service_requests: 'new' is the pre-workflow spelling of 'pending'. */
export function serviceStatus(raw: string): UnifiedStatus {
  if (raw === 'accepted') return 'accepted';
  if (raw === 'done') return 'done';
  if (raw === 'rejected') return 'rejected';
  return 'pending';
}

/** bookings: an appointment is 'confirmed', which is this list's 'accepted'. */
export function bookingStatus(raw: string): UnifiedStatus {
  if (raw === 'confirmed') return 'accepted';
  if (raw === 'done') return 'done';
  if (raw === 'cancelled') return 'rejected';
  return 'pending';
}

/** leads: the admin vocabulary here has drifted over time — map it defensively. */
export function leadStatus(raw: string): UnifiedStatus {
  if (raw === 'contacted' || raw === 'accepted' || raw === 'in_progress') return 'accepted';
  if (raw === 'done' || raw === 'closed' || raw === 'won') return 'done';
  if (raw === 'rejected' || raw === 'lost' || raw === 'cancelled') return 'rejected';
  return 'pending';
}

/** Splits `[viewing] Beşiktaş 2+1 · $250,000 · #abc` into its tag and its text. */
export function parseLeadItem(item: string): { serviceKey: string | null; itemText: string } {
  const m = /^\s*\[([a-zA-Z0-9_-]+)\]\s*(.*)$/.exec(item ?? '');
  if (!m) return { serviceKey: null, itemText: (item ?? '').trim() };
  return { serviceKey: m[1], itemText: m[2].trim() };
}

export function fromServiceRequest(r: CustomerRequest): UnifiedRequest {
  return {
    kind: 'service',
    id: r.id,
    reference: referenceFor('service', r.id),
    status: serviceStatus(r.status),
    rawStatus: r.status,
    createdAt: r.createdAt,
    title: r.serviceTitle,
    service: r,
  };
}

export function fromBooking(b: Booking): UnifiedRequest {
  return {
    kind: 'ai',
    id: b.id,
    reference: referenceFor('ai', b.id),
    status: bookingStatus(b.status),
    rawStatus: b.status,
    createdAt: b.createdAt,
    // The prose brief only — problem_summary also carries the appended case
    // file, and nobody wants their appointment titled by a JSON blob.
    title: shortSummary(b.problemSummary),
    booking: b,
  };
}

export function fromLead(l: Lead): UnifiedRequest {
  const { serviceKey, itemText } = parseLeadItem(l.item);
  return {
    kind: l.kind === 'health' ? 'health' : 'realestate',
    id: l.id,
    reference: referenceFor(l.kind === 'health' ? 'health' : 'realestate', l.id),
    status: leadStatus(l.status),
    rawStatus: l.status,
    createdAt: l.createdAt,
    title: itemText,
    lead: l,
    serviceKey,
    itemText,
  };
}

/**
 * Newest first, across all three sources.
 *
 * Every argument is optional and defaults to empty, because the caller loads
 * the three independently: a source that is still loading, or that failed,
 * contributes nothing to the list rather than blanking it. That is the whole
 * point of loading them separately.
 */
export function mergeRequests(input: {
  services?: CustomerRequest[] | null;
  bookings?: Booking[] | null;
  leads?: Lead[] | null;
}): UnifiedRequest[] {
  return [
    ...(input.services ?? []).map(fromServiceRequest),
    ...(input.bookings ?? []).map(fromBooking),
    ...(input.leads ?? []).map(fromLead),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
