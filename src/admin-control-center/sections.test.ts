import { describe, expect, it } from 'vitest';
import { CC_DEFAULT_SECTION, CC_SECTION_IDS, LEGACY_SECTION_MAP, resolveSectionId } from './sections';

/**
 * The redesign collapsed 11 sections into 7. This proves every old
 * `?section=` id from the pre-redesign layout still resolves to a current
 * section instead of falling through to a blank/placeholder page — the
 * "safe redirect for old paths" requirement.
 */
describe('resolveSectionId', () => {
  it('passes current section ids through unchanged', () => {
    for (const id of CC_SECTION_IDS) {
      expect(resolveSectionId(id)).toBe(id);
    }
  });

  it('maps every legacy id from the 11-section layout onto a current section', () => {
    for (const [legacy, expected] of Object.entries(LEGACY_SECTION_MAP)) {
      expect(CC_SECTION_IDS).toContain(expected);
      expect(resolveSectionId(legacy)).toBe(expected);
    }
  });

  it('falls back to the default for a missing or unrecognized id', () => {
    expect(resolveSectionId(null)).toBe(CC_DEFAULT_SECTION);
    expect(resolveSectionId('not-a-real-section')).toBe(CC_DEFAULT_SECTION);
  });

  it('defaults to Today, not a generic overview', () => {
    expect(CC_DEFAULT_SECTION).toBe('today');
  });
});
