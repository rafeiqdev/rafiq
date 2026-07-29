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
