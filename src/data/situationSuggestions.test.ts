import { describe, expect, it } from 'vitest';
import { SITUATION_SUGGESTIONS, suggestionsFor } from './situationSuggestions';
import { SERVICES } from './services';
import { SITUATIONS } from '../lib/types';

const ID_SET = new Set(SERVICES.map((s) => s.id));

describe('SITUATION_SUGGESTIONS', () => {
  it('every serviceId is a real, currently-cataloged service', () => {
    for (const s of SITUATION_SUGGESTIONS) {
      expect(ID_SET.has(s.serviceId), `${s.id} points at unknown service "${s.serviceId}"`).toBe(true);
    }
  });

  it('every suggestion id is unique', () => {
    const ids = SITUATION_SUGGESTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every situation has at least one suggestion', () => {
    for (const situation of SITUATIONS) {
      expect(suggestionsFor(situation).length, `${situation} has no suggestions`).toBeGreaterThan(0);
    }
  });
});

describe('suggestionsFor', () => {
  it('returns nothing for a null/undefined situation', () => {
    expect(suggestionsFor(null)).toEqual([]);
    expect(suggestionsFor(undefined)).toEqual([]);
  });

  it('only returns suggestions matching the requested situation', () => {
    for (const s of suggestionsFor('student')) {
      expect(s.situation).toBe('student');
    }
  });
});
