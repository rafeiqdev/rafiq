import { describe, expect, it } from 'vitest';
import {
  analystPrompt,
  memoryPromptBlock,
  mergeMemory,
  parseAnalysis,
  sanitizeFacts,
  sanitizeStyle,
  styleHint,
  type MemoryRow,
} from './assistantMemory';

describe('sanitizeFacts', () => {
  it('keeps clean, known fields and trims them', () => {
    const f = sanitizeFacts({
      visitor_type: 'planning_move',
      nationality: '  سوري ',
      current_city: 'حلب',
      in_turkey_now: false,
      interests: ['عقارات', 'عقارات', 'إقامة'],
      unknown_field: 'x',
    });
    expect(f).toEqual({
      visitor_type: 'planning_move',
      nationality: 'سوري',
      current_city: 'حلب',
      in_turkey_now: false,
      interests: ['عقارات', 'إقامة'],
    });
  });

  it('rejects a visitor_type the model made up', () => {
    expect(sanitizeFacts({ visitor_type: 'whale' })).toEqual({});
  });

  it('refuses sensitive traits in free text, in Arabic and English', () => {
    const f = sanitizeFacts({
      notes: ['ديانته مسلم', 'يريد شراء شقة', 'supports a political party', 'has depression'],
      purpose: 'religion',
    });
    expect(f.notes).toEqual(['يريد شراء شقة']);
    expect(f.purpose).toBeUndefined();
  });

  it('does not mistake "city" (مدينة) for "religion" (دين)', () => {
    expect(sanitizeFacts({ current_city: 'مدينة إسطنبول' }).current_city).toBe('مدينة إسطنبول');
  });

  it('survives garbage', () => {
    expect(sanitizeFacts(null)).toEqual({});
    expect(sanitizeFacts('nope')).toEqual({});
    expect(sanitizeFacts([])).toEqual({});
  });
});

describe('sanitizeStyle', () => {
  it('keeps only allowed enum values and clamps the score', () => {
    const s = sanitizeStyle({
      tempo: 'hurried',
      urgency: 'extreme',
      social_style: 'driver',
      seriousness: 'passing_time',
      tone: ['direct', 'evil', 'anxious', 'direct'],
      intent_score: 180,
      signals: ['جمل قصيرة'],
      confidence: 'medium',
    });
    expect(s).toEqual({
      tempo: 'hurried',
      social_style: 'driver',
      seriousness: 'passing_time',
      tone: ['direct', 'anxious'],
      intent_score: 100,
      signals: ['جمل قصيرة'],
      confidence: 'medium',
    });
  });

  it('drops a non-numeric score', () => {
    expect(sanitizeStyle({ intent_score: 'high' }).intent_score).toBeUndefined();
  });
});

describe('parseAnalysis', () => {
  it('reads fenced JSON and sanitises it', () => {
    const a = parseAnalysis('```json\n{"facts":{"nationality":"مصري"},"style":{"tempo":"relaxed"}}\n```');
    expect(a).toEqual({ facts: { nationality: 'مصري' }, style: { tempo: 'relaxed' } });
  });

  it('is null when nothing usable survives', () => {
    expect(parseAnalysis('not json')).toBeNull();
    expect(parseAnalysis('{"facts":{"visitor_type":"whale"},"style":{}}')).toBeNull();
  });
});

describe('mergeMemory', () => {
  const prev: MemoryRow = {
    facts: { nationality: 'سوري', current_city: 'حلب', interests: ['عقارات'] },
    style: { tempo: 'normal', tone: ['polite'] },
    message_count: 4,
    last_analyzed_at: null,
  };

  it('a field the analyst leaves out keeps its old value', () => {
    const m = mergeMemory(prev, { current_city: 'إسطنبول' }, { tempo: 'hurried' });
    expect(m.facts).toEqual({ nationality: 'سوري', current_city: 'إسطنبول', interests: ['عقارات'] });
    expect(m.style).toEqual({ tempo: 'hurried', tone: ['polite'] });
  });

  it('counts one more analysed turn and stamps the time', () => {
    const m = mergeMemory(prev, {}, {});
    expect(m.message_count).toBe(5);
    expect(m.last_analyzed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('starts from nothing for a new visitor', () => {
    expect(mergeMemory(null, { nationality: 'عراقي' }, {}).message_count).toBe(1);
  });
});

describe('what the chat assistant is told', () => {
  it('nothing at all without a memory', () => {
    expect(memoryPromptBlock(null)).toBe('');
    expect(memoryPromptBlock({ facts: {}, style: {}, message_count: 0, last_analyzed_at: null })).toBe('');
  });

  it('turns a hurried, terse visitor into "be brief" advice', () => {
    const hint = styleHint({ tempo: 'hurried', message_length: 'very_short' });
    expect(hint).toContain('in a hurry');
    expect(hint).toContain('never mention this');
  });

  it('tells it to stay light with someone who is only passing time', () => {
    expect(styleHint({ seriousness: 'passing_time' })).toContain('never push a form or a booking');
  });

  it('adds nothing for a neutral style', () => {
    expect(styleHint({ tempo: 'normal' })).toBe('');
  });

  it('puts facts in the block', () => {
    const block = memoryPromptBlock({
      facts: { summary: 'يريد الانتقال لإسطنبول', arrival_timeframe: 'الشهر القادم' },
      style: {},
      message_count: 2,
      last_analyzed_at: null,
    });
    expect(block).toContain('يريد الانتقال لإسطنبول');
    expect(block).toContain('الشهر القادم');
    expect(block).toContain('never mention that you keep notes');
  });
});

describe('analystPrompt', () => {
  it('carries the research-based cues and the hard limits', () => {
    const p = analystPrompt(null);
    expect(p).toContain('NOTHING IS RECORDED YET');
    expect(p).toContain('driver');
    expect(p).toContain('intent_score');
    expect(p).toContain('Never diagnose');
    expect(p).toContain('sexual orientation');
  });

  it('shows the existing record so it is updated, not replaced', () => {
    const p = analystPrompt({ facts: { nationality: 'سوري' }, style: {}, message_count: 1, last_analyzed_at: null });
    expect(p).toContain('WHAT IS ALREADY RECORDED');
    expect(p).toContain('سوري');
  });
});
