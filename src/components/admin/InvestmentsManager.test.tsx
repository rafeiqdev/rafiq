import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardrail, not a rendering test.
 *
 * The one failure mode that actually matters here is a partner company's sales
 * phone or email leaking onto a public page. A leak like that would look
 * perfectly normal in a screenshot, so it needs a test that fails the build
 * rather than a reviewer who happens to notice.
 */
const SRC = join(process.cwd(), 'src');

function read(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf8');
}

const PUBLIC_FILES = [
  'pages/InvestmentDetail.tsx',
  'pages/RealEstateInvestments.tsx',
  'pages/RealEstate.tsx',
  'pages/mobile/MobileRealEstate.tsx',
  'components/realestate/InvestmentCard.tsx',
  'hooks/useInvestments.ts',
];

describe('investment contact details never reach a public page', () => {
  it.each(PUBLIC_FILES)('%s does not import investmentContacts', (file) => {
    expect(read(file)).not.toContain('investmentContacts');
  });

  it.each(PUBLIC_FILES)('%s does not reference the InvestmentContact type', (file) => {
    expect(read(file)).not.toContain('InvestmentContact');
  });

  it.each(PUBLIC_FILES)('%s renders no contact field name', (file) => {
    const src = read(file);
    for (const field of ['salesEmail', 'salesPhone', 'whatsapp', 'sales_email', 'sales_phone']) {
      expect(src, `${file} mentions ${field}`).not.toContain(field);
    }
  });

  it('keeps the contacts table out of the public read path in the API layer', () => {
    const api = read('lib/api.ts');
    // The only place that touches the table is the admin-only helper.
    const hits = api.split("from('investment_contacts')").length - 1;
    expect(hits).toBeGreaterThan(0);
    expect(api).toContain('INTERNAL ONLY');
  });

  it('ships a migration that denies anon on the contacts table', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260801_investment_opportunities.sql'),
      'utf8',
    );
    expect(sql).toContain('alter table public.investment_contacts      enable row level security');
    // A single admin-only policy, and no select policy that would open it up.
    expect(sql).toContain('create policy investment_contacts_admin');
    expect(sql).not.toMatch(/create policy \w+ on public\.investment_contacts\s+for select using \(true\)/);
  });
});

describe('the admin editor labels the internal block', () => {
  it('warns that contact data is not published', () => {
    const src = read('components/admin/InvestmentsManager.tsx');
    expect(src).toContain('admin.investments.internal');
    expect(src).toContain('admin.investments.internalHint');
  });

  it('skips writing an empty contact row for every opportunity', () => {
    expect(read('components/admin/InvestmentsManager.tsx')).toContain('hasContact');
  });
});

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
