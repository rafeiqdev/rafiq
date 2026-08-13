import { describe, expect, it, vi } from 'vitest';
import { CASE_FILE_DIVIDER } from './bookingSummary';

/**
 * humanMessage() (MyRequests.tsx / MobileMyRequests.tsx) fixed a bug where a
 * customer's own request message rendered as raw/garbled JSON-looking text on
 * "طلباتي". Proves the fix against the REAL data path: BookingModal.tsx builds
 * service_requests.message as `${problemSummary}\n\n${CASE_FILE_DIVIDER}\n${JSON.stringify(caseFile, null, 2)}`
 * (see BookingModal.tsx:67) — the exact same divider bookingSummary.ts's
 * shortSummary() already strips for the admin side.
 *
 * Both pages duplicate the same helper deliberately (no shared abstraction
 * introduced here); this file exercises both copies against the same cases.
 */

vi.mock('../lib/api', () => ({
  customerRequests: { allMine: vi.fn(), responses: vi.fn(), choose: vi.fn() },
  reviews: { create: vi.fn() },
  medicalRequests: { mine: () => Promise.resolve([]) },
  medicalContent: { specialties: () => Promise.resolve([]) },
  serviceOffers: { listForRequest: () => Promise.resolve([]), reject: vi.fn() },
  servicePayments: { forRequest: () => Promise.resolve([]), createSession: vi.fn(), resumeUrl: () => null },
}));
vi.mock('../components/Gates', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}));

const CASE_FILE = JSON.stringify({ category: 'residency', urgency: 'normal' }, null, 2);

describe.each([
  ['MyRequests.tsx', () => import('../pages/MyRequests')],
  ['MobileMyRequests.tsx', () => import('../pages/mobile/MobileMyRequests')],
])('humanMessage() in %s', (_name, load) => {
  it('a plain short message is returned as-is, not truncated', async () => {
    const { humanMessage } = await load();
    const result = humanMessage('يحتاج المساعدة في الإقامة.');
    expect(result).toEqual({ preview: 'يحتاج المساعدة في الإقامة.', full: 'يحتاج المساعدة في الإقامة.', truncated: false });
  });

  it('strips the appended case-file JSON that BookingModal appends — the exact bug reported', async () => {
    const { humanMessage } = await load();
    const stored = `يحتاج المساعدة في الإقامة.\n\n${CASE_FILE_DIVIDER}\n${CASE_FILE}`;
    const result = humanMessage(stored);
    expect(result.preview).toBe('يحتاج المساعدة في الإقامة.');
    expect(result.full).not.toContain('CASE FILE');
    expect(result.full).not.toContain('category');
  });

  it('truncates a genuinely long prose message with an explicit expand flag', async () => {
    const { humanMessage } = await load();
    const long = 'a'.repeat(300);
    const result = humanMessage(long);
    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBeLessThan(long.length);
    expect(result.full).toBe(long);
  });

  it('a message that is only a case-file block (no prose) previews as empty, not raw JSON', async () => {
    const { humanMessage } = await load();
    const stored = `${CASE_FILE_DIVIDER}\n${CASE_FILE}`;
    const result = humanMessage(stored);
    expect(result.preview).toBe('');
    expect(result.full).not.toContain('category');
  });
});
