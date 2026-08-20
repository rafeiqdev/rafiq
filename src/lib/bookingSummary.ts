/**
 * A booking's problem_summary carries TWO audiences in one column: the short
 * prose brief the user approved, then (for AI-booked appointments) the full
 * structured case file appended for the team. The admin screens want all of
 * it; the customer's own lists (profile activity, home dashboard) must show
 * only the human line — nobody wants their appointment titled by a JSON blob.
 */

/** Divider BookingModal writes between the prose brief and the case file. */
export const CASE_FILE_DIVIDER = '--- ملف الطلب / CASE FILE ---';

const MAX_LEN = 140;

/** The user-facing line: prose before the divider, first line, length-capped. */
export function shortSummary(problemSummary: string): string {
  const prose = problemSummary.split(CASE_FILE_DIVIDER)[0];
  const firstLine = prose
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0] ?? '';
  return firstLine.length > MAX_LEN ? `${firstLine.slice(0, MAX_LEN - 1).trimEnd()}…` : firstLine;
}

/**
 * The same two-audience problem, one screen further along: a service request's
 * `message` can carry the assistant's case file after the divider, and can be
 * far longer than a row on "طلباتي" should render inline.
 *
 * Lived as a copy-pasted helper in MyRequests.tsx AND MobileMyRequests.tsx.
 * Both now re-export this one, so the phone and the desktop can no longer
 * disagree about what a customer's own message says.
 */
const MESSAGE_PREVIEW_LEN = 220;

export function humanMessage(raw: string): { preview: string; full: string; truncated: boolean } {
  const prose = raw.split(CASE_FILE_DIVIDER)[0].trim();
  if (prose.length <= MESSAGE_PREVIEW_LEN) return { preview: prose, full: prose, truncated: false };
  return { preview: `${prose.slice(0, MESSAGE_PREVIEW_LEN).trimEnd()}…`, full: prose, truncated: true };
}
