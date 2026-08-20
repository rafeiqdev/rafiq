import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * THE FULL REQUEST CYCLE, END TO END, WITHOUT A MOCKED API LAYER.
 *
 * Every other test on this page mocks `lib/api`, so it can only prove that the
 * UI renders whatever it is handed. That is worth having and it is not this.
 * The failures this file exists for all live in the seam BETWEEN the write and
 * the read, where a mocked api layer is blind by construction:
 *
 *   - a request written with no owner (`customer_id` left to a column default
 *     that a given database may not have) — stored, and invisible to the person
 *     who made it, forever
 *   - a request written to a table /requests never reads (an assistant handoff
 *     goes to `bookings`, a property enquiry to `leads`)
 *   - a success screen shown for a write the server never accepted
 *
 * So the REAL api module runs here, against an in-memory Postgres stand-in that
 * enforces the one rule that matters: A ROW IS ONLY VISIBLE TO THE SESSION THAT
 * OWNS IT, exactly as RLS does. Then the page is unmounted and mounted again —
 * a page reload — and asked whether the request is still there.
 */

const UID = 'cac6dcb8-d8f2-4b3b-b163-ddeb89f56b0b';
const OTHER_UID = '11111111-2222-3333-4444-555555555555';

/** The column each table is owned through — the fake's whole RLS model. */
const OWNER_COL: Record<string, string> = {
  service_requests: 'customer_id',
  bookings: 'user_id',
  leads: 'user_id',
  profiles: 'id',
};

type Row = Record<string, unknown>;

let db: Record<string, Row[]> = {};
let sessionUid: string | null = UID;
let seq = 0;
/** Set to make the next insert fail, as a refused write would. */
let insertError: { code: string; message: string } | null = null;

const rowsOf = (table: string): Row[] => (db[table] ??= []);

/** What this session is allowed to SELECT — the RLS predicate, and nothing else. */
function visible(table: string): Row[] {
  const owner = OWNER_COL[table];
  if (!owner) return rowsOf(table);
  return rowsOf(table).filter((r) => r[owner] === sessionUid);
}

function makeQuery(table: string) {
  const filters: [string, unknown][] = [];
  const rows = () => visible(table).filter((r) => filters.every(([c, v]) => r[c] === v));

  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => {
      filters.push([c, v]);
      return q;
    },
    in: (c: string, vs: unknown[]) => {
      filters.push([c, vs[0]]);
      return q;
    },
    limit: () => q,
    order: () =>
      Promise.resolve({
        data: [...rows()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        error: null,
      }),
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    // `await builder` with no terminal call, as bookings.mine()/leads.mine() do.
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(res, rej),
  };
  return q;
}

function insertInto(table: string, body: Row) {
  const failure = insertError;
  insertError = null;

  seq += 1;
  const row: Row = {
    id: `${table.slice(0, 2)}-${seq}`,
    // Distinct, increasing timestamps so "newest first" is deterministic.
    created_at: new Date(Date.UTC(2026, 7, 20, 10, seq)).toISOString(),
    status: 'new',
    ...body,
  };
  if (!failure) rowsOf(table).push(row);

  const result = {
    select: () => result,
    /**
     * PostgREST's RETURNING is subject to the SAME select policy as a read: a
     * row this session could not read back is an error, never a quiet success.
     */
    single: () =>
      Promise.resolve(
        failure
          ? { data: null, error: failure }
          : row[OWNER_COL[table] ?? ''] === sessionUid
            ? { data: { id: row.id }, error: null }
            : { data: null, error: { code: '42501', message: 'permission denied' } },
      ),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: failure }).then(res, rej),
  };
  return result;
}

vi.mock('../lib/supabase', () => ({
  supabaseEnabled: true,
  supabase: {
    from: (table: string) => ({
      select: (...a: unknown[]) => makeQuery(table).select(...(a as [])),
      insert: (body: Row) => insertInto(table, body),
    }),
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: sessionUid ? { user: { id: sessionUid } } : null } }),
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

vi.mock('../components/Gates', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The medical panel is a separate cycle with its own tables and its own tests.
vi.mock('../components/medical/MedicalRequestsPanel', () => ({
  MedicalRequestsPanel: () => null,
}));

/** Mount /requests fresh — the test's stand-in for reloading the page. */
async function loadRequestsPage() {
  const { MyRequests } = await import('./MyRequests');
  return render(
    <MemoryRouter>
      <MyRequests />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  db = { profiles: [{ id: UID, email: 'customer@example.com', name: 'Test' }] };
  sessionUid = UID;
  seq = 0;
  insertError = null;
  vi.resetModules();
});

describe('a service request survives the page reload that follows it', () => {
  it('is stored, owned by the signed-in customer, and listed with its reference', async () => {
    const { serviceRequests } = await import('../lib/api');

    const res = await serviceRequests.create({
      name: 'أحمد',
      phone: '+905001112233',
      message: 'أحتاج مساعدة في فتح حساب بنكي',
      serviceId: 'bank-account',
      serviceTitle: 'مراقبة فتح حساب بنكي',
      category: 'banking',
      serviceType: 'direct',
      lang: 'ar',
    });

    // The server answered with the id of the row it actually wrote. Anything
    // less and the caller would be showing a success screen on faith.
    expect(res.id).toBeTruthy();
    expect(db.service_requests).toHaveLength(1);
    // Owned — not left to a column default that may not exist. Without this the
    // row is unreadable by its author for the rest of its life.
    expect(db.service_requests[0].customer_id).toBe(UID);

    // ---- the reload ----
    await loadRequestsPage();

    expect(await screen.findByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
    // The reference is derived from the id, so it is stable across reloads and
    // quotable on WhatsApp without a column to store it.
    const { referenceFor } = await import('../lib/myRequests');
    expect(screen.getByText(referenceFor('service', res.id!))).toBeInTheDocument();
    expect(screen.queryByText('requests.empty')).toBeNull();
  });

  it('is still there after a SECOND reload, and is not visible to anyone else', async () => {
    const { serviceRequests } = await import('../lib/api');
    await serviceRequests.create({
      name: 'أحمد',
      phone: '+905001112233',
      serviceId: 'tax-number',
      serviceTitle: 'استخراج الرقم الضريبي',
      category: 'tax',
      serviceType: 'partner',
      lang: 'ar',
      broadcast: true,
    });

    await loadRequestsPage();
    expect(await screen.findByText('استخراج الرقم الضريبي')).toBeInTheDocument();
    cleanup();

    await loadRequestsPage();
    expect(await screen.findByText('استخراج الرقم الضريبي')).toBeInTheDocument();
    cleanup();

    // Same row, a different account: the page must say "nothing", because the
    // request genuinely is not theirs.
    sessionUid = OTHER_UID;
    db.profiles.push({ id: OTHER_UID, email: 'someone@example.com' });
    await loadRequestsPage();
    expect(await screen.findByText('requests.empty')).toBeInTheDocument();
    expect(screen.queryByText('استخراج الرقم الضريبي')).toBeNull();
  });
});

describe('a request made anywhere else also lands on /requests', () => {
  it('lists an assistant appointment (bookings) next to a service request', async () => {
    const { bookings, serviceRequests } = await import('../lib/api');

    await serviceRequests.create({
      name: 'أحمد',
      phone: '+905001112233',
      serviceId: 'bank-account',
      serviceTitle: 'مراقبة فتح حساب بنكي',
      category: 'banking',
      serviceType: 'direct',
      lang: 'ar',
    });
    const booked = await bookings.create({
      problemSummary: 'تجديد الإقامة السياحية',
      transcript: [],
      preferredDatetime: new Date(Date.now() + 86_400_000).toISOString(),
      preferredLanguage: 'ar',
    });

    expect(booked.id).toBeTruthy();
    expect(db.bookings[0].user_id).toBe(UID);

    await loadRequestsPage();

    // Before the merge this row could not appear on this page at all: the
    // assistant's handoff writes a table /requests never read.
    expect(await screen.findByText('تجديد الإقامة السياحية')).toBeInTheDocument();
    expect(screen.getByText('مراقبة فتح حساب بنكي')).toBeInTheDocument();
  });

  it('lists a property enquiry (leads), tagged with the listing it is about', async () => {
    const { leads } = await import('../lib/api');

    const lead = await leads.create('realestate', '[viewing] Beşiktaş 2+1 · $250,000 · #L-9');
    expect(lead.id).toBeTruthy();
    expect(db.leads[0].user_id).toBe(UID);

    await loadRequestsPage();

    expect(await screen.findByText('Beşiktaş 2+1 · $250,000 · #L-9')).toBeInTheDocument();
    const { referenceFor } = await import('../lib/myRequests');
    expect(screen.getByText(referenceFor('realestate', lead.id))).toBeInTheDocument();
  });

  it('sorts the three sources into one newest-first list', async () => {
    const { bookings, leads, serviceRequests } = await import('../lib/api');
    await serviceRequests.create({
      name: 'أحمد', phone: '+905001112233', serviceId: 's', serviceTitle: 'الأقدم',
      category: 'c', serviceType: 'direct', lang: 'ar',
    });
    await leads.create('realestate', 'الأوسط');
    await bookings.create({
      problemSummary: 'الأحدث',
      transcript: [],
      preferredDatetime: new Date(Date.now() + 86_400_000).toISOString(),
      preferredLanguage: 'ar',
    });

    const { container } = await loadRequestsPage();
    await screen.findByText('الأحدث');

    const titles = [...container.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(titles).toHaveLength(3);
    expect(titles[0]).toContain('الأحدث');
    expect(titles[1]).toContain('الأوسط');
    expect(titles[2]).toContain('الأقدم');
  });
});

describe('a write the server refused is never reported as a success', () => {
  it('rejects instead of resolving when the insert fails', async () => {
    const { serviceRequests } = await import('../lib/api');
    insertError = { code: '23505', message: 'duplicate key value' };

    await expect(
      serviceRequests.create({
        name: 'أحمد', phone: '+905001112233', serviceId: 's', serviceTitle: 'خدمة',
        category: 'c', serviceType: 'direct', lang: 'ar',
      }),
    ).rejects.toBeInstanceOf(Error);

    // Nothing was written, and — crucially — the caller never got a resolved
    // promise to hang a "we received your request" screen on.
    expect(db.service_requests ?? []).toHaveLength(0);

    await loadRequestsPage();
    expect(await screen.findByText('requests.empty')).toBeInTheDocument();
  });

  it('rejects a lead the server refused, so the tick never appears', async () => {
    const { leads } = await import('../lib/api');
    insertError = { code: '23505', message: 'duplicate key value' };

    await expect(leads.create('realestate', '[viewing] anything')).rejects.toBeInstanceOf(Error);
    expect(db.leads ?? []).toHaveLength(0);
  });
});
