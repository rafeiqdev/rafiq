/**
 * Referrals & Wallet + Journey — admin-wide reads that had no screen at all
 * before this. Both tables carry an `is_admin()` SELECT policy, so these are
 * legitimate admin reads, not a privilege escalation.
 *
 * Read-only. Approving a commission or a payout is a Phase-C money action and
 * deliberately absent.
 */
import { ccSb, orThrow } from './client';
import { iso, type Range } from '../period';

// ── Referrals ──────────────────────────────────────────────────────────────

export interface CommissionRow {
  id: string;
  serviceType: string;
  serviceName: string;
  amount: number;
  commission: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
}

export interface ReferralSnapshot {
  commissions: CommissionRow[];
  payouts: PayoutRow[];
  /** currency → totals by lifecycle stage. Never summed across currencies. */
  byCurrency: Record<string, { pending: number; available: number; paid: number }>;
  byStatus: [string, number][];
  referrers: number;
}

export async function fetchReferrals(range: Range): Promise<ReferralSnapshot> {
  const c = ccSb();
  const from = iso(range.from);
  const to = iso(range.to);

  const [comm, pay] = await Promise.all([
    c
      .from('referral_commissions')
      .select('id,referrer_id,service_type,service_name,transaction_amount,commission_amount,currency,status,created_at')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .limit(500),
    c
      .from('payout_requests')
      .select('id,amount,currency,payout_method,status,created_at')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  interface CRaw {
    id: string; referrer_id: string; service_type: string; service_name: string;
    transaction_amount: number | string; commission_amount: number | string;
    currency: string; status: string; created_at: string;
  }
  interface PRaw {
    id: string; amount: number | string; currency: string;
    payout_method: string; status: string; created_at: string;
  }

  const cRows = orThrow(comm) as CRaw[];
  const pRows = orThrow(pay) as PRaw[];

  const byCurrency: ReferralSnapshot['byCurrency'] = {};
  const statuses = new Map<string, number>();
  const referrers = new Set<string>();

  for (const r of cRows) {
    referrers.add(r.referrer_id);
    statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
    const cur = (r.currency || 'USD').toUpperCase();
    byCurrency[cur] ??= { pending: 0, available: 0, paid: 0 };
    const amount = Number(r.commission_amount ?? 0);
    if (r.status === 'pending') byCurrency[cur].pending += amount;
    else if (r.status === 'available') byCurrency[cur].available += amount;
    else if (r.status === 'paid') byCurrency[cur].paid += amount;
  }

  return {
    commissions: cRows.map((r) => ({
      id: r.id,
      serviceType: r.service_type,
      serviceName: r.service_name,
      amount: Number(r.transaction_amount ?? 0),
      commission: Number(r.commission_amount ?? 0),
      currency: (r.currency || 'USD').toUpperCase(),
      status: r.status,
      createdAt: r.created_at,
    })),
    payouts: pRows.map((r) => ({
      id: r.id,
      amount: Number(r.amount ?? 0),
      currency: (r.currency || 'USD').toUpperCase(),
      method: r.payout_method,
      status: r.status,
      createdAt: r.created_at,
    })),
    byCurrency,
    byStatus: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
    referrers: referrers.size,
  };
}

// ── Journey & onboarding ───────────────────────────────────────────────────

export interface JourneySnapshot {
  totalItems: number;
  done: number;
  todo: number;
  usersWithJourney: number;
  /** Per task: how many users have it, and how many finished it. */
  byTask: { task: string; total: number; done: number }[];
}

/**
 * Completion rates per onboarding task, across all users. This answers "which
 * step do people get stuck on" — a question nothing in the product could answer
 * before, because journey rows were only ever read one user at a time.
 */
export async function fetchJourney(): Promise<JourneySnapshot> {
  const rows = orThrow(
    await ccSb().from('user_journey_items').select('user_id,task_key,status').limit(5000),
  ) as { user_id: string; task_key: string; status: string }[];

  const users = new Set<string>();
  const per = new Map<string, { total: number; done: number }>();
  let done = 0;

  for (const r of rows) {
    users.add(r.user_id);
    const t = per.get(r.task_key) ?? { total: 0, done: 0 };
    t.total += 1;
    if (r.status === 'done') {
      t.done += 1;
      done += 1;
    }
    per.set(r.task_key, t);
  }

  return {
    totalItems: rows.length,
    done,
    todo: rows.length - done,
    usersWithJourney: users.size,
    byTask: [...per.entries()]
      .map(([task, v]) => ({ task, ...v }))
      .sort((a, b) => b.total - a.total),
  };
}
