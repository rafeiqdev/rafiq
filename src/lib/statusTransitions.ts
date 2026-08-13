/**
 * Legal next-status maps for Service Requests and Medical Tourism requests.
 *
 * Pure, no I/O — shared by the admin UI (which offers only these choices) and
 * mirrored exactly by the server-side RPCs (set_service_request_status,
 * set_medical_request_status in supabase/migrations/20260813_status_guardrails.sql)
 * so a transition rejected here is also rejected at the database, not just
 * hidden from the button.
 *
 * These maps are this batch's best-effort default reading of the existing
 * workflow (Stage 1 audit: "done" and "rejected"/"cancelled" are terminal
 * states) — easy to adjust in one place if the real operational flow differs.
 */

export const SERVICE_REQUEST_TRANSITIONS: Record<string, string[]> = {
  new: ['accepted', 'rejected'],
  accepted: ['done', 'rejected'],
  done: [],
  rejected: [],
};

export const MEDICAL_REQUEST_TRANSITIONS: Record<string, string[]> = {
  pending_review: ['under_review', 'cancelled'],
  under_review: ['collecting_offers', 'cancelled'],
  collecting_offers: ['offers_available', 'cancelled'],
  offers_available: ['awaiting_payment', 'collecting_offers', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['booked', 'cancelled'],
  booked: ['cancelled'],
  cancelled: [],
};

export function allowedNext(map: Record<string, string[]>, current: string): string[] {
  return map[current] ?? [];
}
