import { describe, expect, it } from 'vitest';
import { detectSubject, isTopicSwitch, matchSubject } from './subject';

describe('subject detection (Arabic)', () => {
  it('recognises residency questions', () => {
    expect(detectSubject('كيف أستخرج الرقم الضريبي؟')).toBe('residency');
    expect(detectSubject('أريد تجديد الإقامة السياحية')).toBe('residency');
    expect(detectSubject('متى موعد دائرة الهجرة؟')).toBe('residency');
  });

  it('recognises banking questions', () => {
    expect(detectSubject('أريد فتح حساب بنكي')).toBe('banking');
    expect(detectSubject('ما هو التأمين الصحي المطلوب للإقامة؟')).toBeTruthy();
  });

  it('recognises real-estate questions', () => {
    expect(detectSubject('أبحث عن شقة للإيجار في كاديكوي')).toBe('realestate');
    // "أريد شراء عقار" is genuinely ambiguous — buying property vs. a
    // property-based residence permit. Either reading is acceptable.
    expect(['realestate', 'residency']).toContain(detectSubject('أريد شراء عقار'));
  });

  it('stays on the current subject when a message is ambiguous (no false switch)', () => {
    // same sentence, different ongoing conversation → sticks to what we discuss
    expect(detectSubject('أريد شراء عقار', 'realestate')).toBe('realestate');
    expect(detectSubject('أريد شراء عقار', 'residency')).toBe('residency');
    // and therefore never counts as a topic switch mid-conversation
    expect(isTopicSwitch('realestate', detectSubject('أريد شراء عقار', 'realestate'))).toBe(false);
  });

  it('recognises health questions', () => {
    expect(detectSubject('أريد زراعة شعر')).toBe('health');
    expect(detectSubject('أبحث عن طبيب عربي')).toBe('health');
  });

  it('recognises telecom questions', () => {
    expect(detectSubject('كيف أحصل على شريحة جوال؟')).toBe('telecom');
  });

  it('treats short follow-ups as a continuation (null)', () => {
    expect(detectSubject('كم التكلفة؟')).toBeNull();
    expect(detectSubject('نعم')).toBeNull();
    expect(detectSubject('شكراً لك')).toBeNull();
    expect(detectSubject('وبعد ذلك؟')).toBeNull();
    expect(detectSubject('')).toBeNull();
  });

  it('works in English too', () => {
    expect(detectSubject('I want to open a bank account')).toBe('banking');
    expect(detectSubject('how do I renew my residence permit')).toBe('residency');
  });
});

describe('topic-switch rule', () => {
  it('the first identified subject opens a topic', () => {
    expect(isTopicSwitch(null, 'residency')).toBe(true);
  });

  it('a different subject is a switch', () => {
    expect(isTopicSwitch('residency', 'banking')).toBe(true);
    expect(isTopicSwitch('banking', 'health')).toBe(true);
  });

  it('the same subject is NOT a switch (unlimited follow-ups)', () => {
    expect(isTopicSwitch('residency', 'residency')).toBe(false);
  });

  it('an unidentified follow-up is never a switch', () => {
    expect(isTopicSwitch('residency', null)).toBe(false);
    expect(isTopicSwitch(null, null)).toBe(false);
  });

  it('scores are reported so callers can tune confidence', () => {
    const m = matchSubject('أريد فتح حساب بنكي');
    expect(m.category).toBe('banking');
    expect(m.score).toBeGreaterThan(0);
  });
});
