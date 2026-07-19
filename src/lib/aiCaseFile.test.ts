import { describe, expect, it } from 'vitest';
import { parseCase } from '../../api/ai-chat';

/**
 * The intake endpoint asks the model for a JSON case file and shows the
 * `conversation_summary` inside it to the user. If extraction breaks, the user
 * sees raw JSON in the booking confirmation — so the tolerant parse matters.
 */
describe('parseCase', () => {
  it('reads a clean JSON object', () => {
    const out = parseCase('{"category":"residency","urgency":"high"}');
    expect(out).toEqual({ category: 'residency', urgency: 'high' });
  });

  it('strips a ```json fence', () => {
    const out = parseCase('```json\n{"category":"tax"}\n```');
    expect(out).toEqual({ category: 'tax' });
  });

  it('strips a bare ``` fence', () => {
    expect(parseCase('```\n{"category":"bank"}\n```')).toEqual({ category: 'bank' });
  });

  it('digs the object out of surrounding chatter', () => {
    const out = parseCase('Here is the case file:\n{"category":"housing"}\nHope that helps!');
    expect(out).toEqual({ category: 'housing' });
  });

  it('keeps nested arrays and nulls intact', () => {
    const out = parseCase('{"documents_requested":["passport","ikamet"],"nationality":null}');
    expect(out).toEqual({ documents_requested: ['passport', 'ikamet'], nationality: null });
  });

  it('preserves Arabic values', () => {
    const out = parseCase('{"conversation_summary":"يحتاج تجديد الإقامة"}');
    expect(out?.conversation_summary).toBe('يحتاج تجديد الإقامة');
  });

  it('returns null for malformed JSON rather than throwing', () => {
    expect(parseCase('{"category": ')).toBeNull();
    expect(parseCase('not json at all')).toBeNull();
    expect(parseCase('')).toBeNull();
  });

  it('rejects a bare array — the contract is an object', () => {
    // `["a","b"]` has no braces to slice, so it must not masquerade as a case.
    expect(parseCase('["a","b"]')).toBeNull();
  });
});
