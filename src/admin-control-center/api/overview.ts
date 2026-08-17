/**
 * Control Center — Overview service layer (READ-ONLY).
 *
 * Every function here delegates to the EXISTING, proven data access in
 * src/lib/api.ts. The Control Center introduces no parallel query path for data
 * that already has one, so its numbers can never silently diverge from the
 * classic Admin's. Nothing here writes.
 *
 * The pure compute helpers are separated from the async fetchers so the
 * "unreadable source ⇒ null (rendered as em-dash), never 0" invariant is unit
 * tested without a database (see overview.test.ts).
 */
import { adminAuditLog, adminPayments, adminUsers } from '../../lib/api';
import type { AdminUser } from '../../lib/types';

/** One audit-log row as returned by the existing admin audit reader. */
export type AuditEntry = Awaited<ReturnType<typeof adminAuditLog.list>>[number];

export interface UserKpis {
  /** profiles is the identity spine — if it read, this is exact. */
  totalUsers: number;
  payingUsers: number;
  /** null when ANY user's count was unreadable — never a partial/zero total. */
  totalBookings: number | null;
  totalLeads: number | null;
}

/**
 * Roll up the users list into overview KPIs.
 *
 * Bookings/leads on an AdminUser are `number | null`, where null means "that
 * table could not be read for this user", NOT zero. A single null poisons the
 * whole sum to null so the card shows "—" instead of a total that silently
 * omits rows — the same load-bearing honesty rule the classic Admin uses.
 */
export function computeUserKpis(users: AdminUser[]): UserKpis {
  let bookings: number | null = 0;
  let leads: number | null = 0;
  for (const u of users) {
    if (u.bookings == null) bookings = null;
    else if (bookings !== null) bookings += u.bookings;
    if (u.leads == null) leads = null;
    else if (leads !== null) leads += u.leads;
  }
  return {
    totalUsers: users.length,
    payingUsers: users.filter((u) => u.tier !== 'free').length,
    totalBookings: bookings,
    totalLeads: leads,
  };
}

/**
 * Thin read-only fetchers. Each is meant to power its own independently-loading
 * card (loading / error / empty are per-card, never collapsed) — the same
 * pattern the classic Admin adopted after one missing RPC blanked five sections.
 */
export const overviewApi = {
  users: (): Promise<AdminUser[]> => adminUsers.list(),
  pendingPayments: () => adminPayments.list({ status: 'pending' }),
  cancellations: () => adminUsers.cancellations(),
  recentAudit: (limit = 8): Promise<AuditEntry[]> => adminAuditLog.list(limit),
};
