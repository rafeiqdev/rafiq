import { describe, expect, it } from 'vitest';
import { condenseDescription, wasCondensed } from './listingText';

describe('condenseDescription', () => {
  it('returns an empty string for missing input rather than "null"', () => {
    expect(condenseDescription(null)).toBe('');
    expect(condenseDescription(undefined)).toBe('');
  });

  it('leaves a short, clean description untouched', () => {
    const text = 'شقة ضمن مجمع سكني حديث في بيليك دوزو، قريبة من المواصلات.';
    expect(condenseDescription(text)).toBe(text);
    expect(wasCondensed(text)).toBe(false);
  });

  it('strips phone numbers, e-mails and links — contact details are a liability here', () => {
    const out = condenseDescription('Nice flat. Call +90 532 123 45 67 or info@agency.com or www.agency.com');
    expect(out).not.toMatch(/\d{3}/);
    expect(out).not.toContain('@');
    expect(out).not.toContain('www.');
  });

  it('drops hashtag walls and listing reference numbers', () => {
    const out = condenseDescription('Sea view apartment. İlan No: 998877 #istanbul #satilik #daire');
    expect(out).not.toContain('#');
    expect(out).not.toContain('998877');
    expect(out).toContain('Sea view apartment');
  });

  it('removes agency call-to-action lines in any of the site languages', () => {
    const out = condenseDescription('Modern flat.\nللتواصل واتساب على الرقم أدناه\nBize ulaşın');
    expect(out).not.toContain('واتساب');
    expect(out).not.toContain('ulaşın');
    expect(out).toContain('Modern flat');
  });

  it('collapses decorative separators portals pad listings with', () => {
    expect(condenseDescription('A flat ★★★★★ ═══════ good one')).toBe('A flat good one');
  });

  it('truncates on a sentence boundary when one is close to the limit', () => {
    const text = `${'x'.repeat(200)}. ${'y'.repeat(300)}`;
    const out = condenseDescription(text, 320);
    expect(out.endsWith('.')).toBe(true);
    expect(out.length).toBeLessThan(320);
  });

  it('falls back to a word boundary with an ellipsis when there is no sentence break', () => {
    const text = Array.from({ length: 200 }, () => 'word').join(' ');
    const out = condenseDescription(text, 100);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('wor…');
  });

  it('never returns more than roughly the requested length', () => {
    const text = 'z'.repeat(5000);
    expect(condenseDescription(text, 320).length).toBeLessThanOrEqual(321);
  });

  it('reports whether anything was actually dropped', () => {
    expect(wasCondensed('short one')).toBe(false);
    expect(wasCondensed('a'.repeat(1000))).toBe(true);
  });
});
