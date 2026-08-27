/**
 * Finance Control Center — READ-ONLY across every payment table.
 *
 * Money lives in four separate tables (subscription `payments`,
 * `service_payments`, `medical_payments`, `company_payments`), each with its own
 * admin screen and its own status vocabulary. Nothing has ever added them up.
 * This reads all four and reports them side by side.
 *
 * Deliberately NOT here: verify / reject / refund. Those are Phase-C actions
 * that need the granular permission layer, a confirmation step and an audit
 * entry — they stay in the classic Admin, which every row deep-links to.
 *
 * Currencies are NOT summed together. Each table's totals are grouped by their
 * own currency, because adding TRY to USD would produce a number that is simply
 * false.
 */
import { ccSb, orThrow } from './client';
import { METRICS } from '../../lib/metrics/definitions';
import { iso, type Range } from '../period';

export interface PayRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface SourceTotals {
  source: string;
  /** Deep link to the classic Admin screen that owns this source. */
  href: string;
  rows: PayRow[];
  count: number;
  byStatus: [string, number][];
  /** currency → { verified, pending } — never merged across currencies. */
  byCurrency: Record<string, { verified: number; pending: number }>;
}

/**
 * Status values that mean "money actually landed" / "still waiting", per
 * table — sourced from the shared metrics dictionary (METRICS.financeSettled
 * / METRICS.financeWaiting) so this vocabulary has one definition. NOT the
 * same as METRICS.paymentsPending (one table, exact "pending", all-time) —
 * see that entry's notes for why the two numbers legitimately differ.
 */
const SETTLED = new Set<string>(METRICS.financeSettled.statusFilter);
const WAITING = new Set<string>(METRICS.financeWaiting.statusFilter);

function summarize(source: string, href: string, rows: PayRow[]): SourceTotals {
  const statuses = new Map<string, number>();
  const byCurrency: Record<string, { verified: number; pending: number }> = {};

  for (const r of rows) {
    statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
    const cur = (r.currency || '—').toUpperCase();
    byCurrency[cur] ??= { verified: 0, pending: 0 };
    if (SETTLED.has(r.status)) byCurrency[cur].verified += r.amount;
    else if (WAITING.has(r.status)) byCurrency[cur].pending += r.amount;
  }

  return {
    source,
    href,
    rows,
    count: rows.length,
    byStatus: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
    byCurrency,
  };
}

interface RawRow {
  id: string;
  amount: number | string | null;
  currency?: string | null;
  status: string;
  created_at: string;
}

const toPayRows = (rows: RawRow[], fallbackCurrency: string): PayRow[] =>
  rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount ?? 0),
    currency: r.currency ?? fallbackCurrency,
    status: r.status,
    createdAt: r.created_at,
  }));

/**
 * One read per payment table. Each is independent: a table the caller's role
 * cannot read (e.g. medical_payments requires medical staff) throws, and the UI
 * surfaces that as a failed card rather than a zero.
 */
export async function fetchFinance(range: Range): Promise<SourceTotals[]> {
  const c = ccSb();
  const from = iso(range.from);
  const to = iso(range.to);

  const [subs, svc, med, comp] = await Promise.all([
    // Subscription payments are stored in TRY (the classic Admin renders "TL").
    c.from('payments').select('id,amount,status,created_at').gte('created_at', from).lt('created_at', to),
    c.from('service_payments').select('id,amount,currency,status,created_at').gte('created_at', from).lt('created_at', to),
    c.from('medical_payments').select('id,amount,currency,status,created_at').gte('created_at', from).lt('created_at', to),
    c.from('company_payments').select('id,amount,status,created_at').gte('created_at', from).lt('created_at', to),
  ]);

  return [
    summarize('subscriptions', '/admin?tab=payments', toPayRows(orThrow(subs) as RawRow[], 'TRY')),
    summarize('services', '/admin?tab=serviceRequests', toPayRows(orThrow(svc) as RawRow[], 'USD')),
    summarize('medical', '/admin/medical', toPayRows(orThrow(med) as RawRow[], 'USD')),
    summarize('companies', '/admin?tab=companyPayments', toPayRows(orThrow(comp) as RawRow[], 'TRY')),
  ];
}
