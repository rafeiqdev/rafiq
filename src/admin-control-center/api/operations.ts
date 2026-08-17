/**
 * Unified Operations + CRM — a single read across every "someone is waiting on
 * us" record type, which today lives in four separate admin tabs.
 *
 * Reuses the existing admin readers so the rows are identical to what the
 * classic Admin shows; this layer only merges and sorts them. Read-only:
 * changing a status still happens in the classic Admin (deep-linked from each
 * row), so no status transition is duplicated or bypassed here.
 */
import { bookings, leads, serviceRequests } from '../../lib/api';
import type { Range } from '../period';

export type OpsKind = 'request' | 'booking' | 'lead';

export interface OpsRow {
  kind: OpsKind;
  id: string;
  title: string;
  /** Customer name when the record carries one. */
  who: string | null;
  status: string;
  createdAt: string;
  /** Classic-Admin tab that owns this record type. */
  href: string;
}

const inRange = (iso: string, r: Range) => {
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t < r.to.getTime();
};

/**
 * All three sources are fetched independently and merged. A source that fails
 * throws, so the section shows an error rather than a short list that silently
 * omits a whole record type — the failure mode this project cares most about.
 */
export async function fetchOperations(range: Range): Promise<OpsRow[]> {
  const [reqs, bks, lds] = await Promise.all([
    serviceRequests.adminList(),
    bookings.adminList(),
    leads.adminList(),
  ]);

  const rows: OpsRow[] = [
    ...reqs.map((r) => ({
      kind: 'request' as const,
      id: r.id,
      title: r.serviceTitle || r.category || '—',
      who: r.ownerName ?? r.name ?? null,
      status: r.status,
      createdAt: r.createdAt,
      href: '/admin?tab=serviceRequests',
    })),
    ...bks.map((b) => ({
      kind: 'booking' as const,
      id: b.id,
      title: b.problemSummary || '—',
      who: b.userEmail || null,
      status: b.status,
      createdAt: b.createdAt,
      href: '/admin?tab=bookings',
    })),
    ...lds.map((l) => ({
      kind: 'lead' as const,
      id: l.id,
      title: l.item || l.kind,
      who: l.userEmail ?? null,
      status: l.status,
      createdAt: l.createdAt,
      href: '/admin?tab=leads',
    })),
  ];

  return rows
    .filter((r) => inRange(r.createdAt, range))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Statuses that mean "no one has dealt with this yet". */
const OPEN_STATUSES = new Set(['new', 'pending', 'open', 'in_progress', 'contacted']);

export interface OpsSummary {
  total: number;
  open: number;
  byKind: Record<OpsKind, number>;
  byStatus: [string, number][];
  /** Open records older than 48h — the "overdue" signal the brief asks for. */
  overdue: OpsRow[];
}

const OVERDUE_MS = 48 * 60 * 60 * 1000;

export function summarizeOperations(rows: OpsRow[], now: Date = new Date()): OpsSummary {
  const byKind: Record<OpsKind, number> = { request: 0, booking: 0, lead: 0 };
  const statuses = new Map<string, number>();
  const overdue: OpsRow[] = [];

  for (const r of rows) {
    byKind[r.kind] += 1;
    statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
    if (OPEN_STATUSES.has(r.status) && now.getTime() - new Date(r.createdAt).getTime() > OVERDUE_MS) {
      overdue.push(r);
    }
  }

  return {
    total: rows.length,
    open: rows.filter((r) => OPEN_STATUSES.has(r.status)).length,
    byKind,
    byStatus: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
    overdue,
  };
}
