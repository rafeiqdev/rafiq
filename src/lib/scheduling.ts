/**
 * Heuristic "next available" appointment slot for the in-chat auto-booking
 * flow (see useChatAssistant). There is no real slots/capacity system in this
 * project — no calendar table, no working-hours config, no per-slot limits —
 * so this is a fixed offset, not a conflict-checked booking system. Replace
 * with real capacity checking if the business ever needs one.
 */

/** Local hour appointments are offered at. */
const SLOT_HOUR = 10;

/** Turkey's weekend: Saturday (6) and Sunday (0). */
function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Next business day at SLOT_HOUR:00, or later today if that hour hasn't passed yet. */
export function nextAvailableSlot(now: Date = new Date()): Date {
  const slot = new Date(now);
  slot.setHours(SLOT_HOUR, 0, 0, 0);
  if (slot <= now) slot.setDate(slot.getDate() + 1);
  while (isWeekend(slot)) slot.setDate(slot.getDate() + 1);
  return slot;
}
