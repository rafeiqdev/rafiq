import { describe, expect, it } from 'vitest';
import { CASE_FILE_DIVIDER, shortSummary } from './bookingSummary';

/**
 * The profile lists must show the human line of a booking, never the appended
 * case-file JSON — that blob is for the admin screens only.
 */
describe('shortSummary', () => {
  it('returns a plain summary unchanged', () => {
    expect(shortSummary('موعد استشارة')).toBe('موعد استشارة');
  });

  it('drops the appended case file and keeps only the first prose line', () => {
    const stored = `يحتاج المساعدة في الإقامة.\nتفاصيل إضافية هنا.\n\n${CASE_FILE_DIVIDER}\n${JSON.stringify({ category: 'residency', urgency: 'normal' }, null, 2)}`;
    expect(shortSummary(stored)).toBe('يحتاج المساعدة في الإقامة.');
  });

  it('caps a runaway first line', () => {
    const line = 'a'.repeat(300);
    const out = shortSummary(line);
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.endsWith('…')).toBe(true);
  });

  it('never crashes on empty input', () => {
    expect(shortSummary('')).toBe('');
  });
});
