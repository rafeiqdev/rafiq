import { describe, expect, it } from 'vitest';
import { detectWrittenLanguage, intakePrompt, parseReply } from './ai-chat';
import type { MemoryRow } from './_lib/assistantMemory';

describe('intakePrompt identity block', () => {
  it('omits the KNOWN CLIENT line when there is no identity', () => {
    expect(intakePrompt('ar')).not.toContain('KNOWN CLIENT');
  });

  it('omits the line when identity has no usable fields', () => {
    expect(intakePrompt('ar', {})).not.toContain('KNOWN CLIENT');
  });

  it('includes name, phone and a localized situation label when all are present', () => {
    const prompt = intakePrompt('ar', { name: 'سارة', phone: '+905551112233', situation: 'student' });
    expect(prompt).toContain('KNOWN CLIENT');
    expect(prompt).toContain('سارة');
    expect(prompt).toContain('+905551112233');
    expect(prompt).toContain('طالب/ة في إسطنبول');
    expect(prompt).toContain('Do not ask for their name or phone number');
  });

  it('degrades gracefully when only some fields are known', () => {
    const prompt = intakePrompt('en', { situation: 'resident' });
    expect(prompt).toContain('KNOWN CLIENT');
    expect(prompt).toContain('a resident of Istanbul');
    expect(prompt).not.toContain('name:');
    expect(prompt).not.toContain('phone:');
  });

  it('falls back to the English situation label for an unrecognized language', () => {
    const prompt = intakePrompt('xx', { situation: 'visiting' });
    expect(prompt).toContain('visiting Istanbul short-term');
  });
});

describe('intakePrompt behaviour', () => {
  const prompt = intakePrompt('ar');

  it('knows the whole site, with link ids it may use', () => {
    expect(prompt).toContain('news —');
    expect(prompt).toContain('realestate —');
    expect(prompt).toContain('service:res-tourist');
    expect(prompt).toContain('category:realestate');
    expect(prompt).toContain('[[LINK:id]]');
  });

  it('is a guide first: no questionnaire unless there is a real need', () => {
    expect(prompt).toContain('GUIDE mode (the default)');
    expect(prompt).toContain('Never announce a questionnaire');
    expect(prompt).toContain('CASE mode (intake)');
  });

  it('keeps the intake safeguards for case mode', () => {
    expect(prompt).toContain('ONE question per message');
    expect(prompt).toContain('هل توافق على إرسال هذا الملخص إلى فريق رفيق؟');
    expect(prompt).toContain('[[READY]]');
    expect(prompt).toContain('112');
  });

  it('gets to know the visitor without profiling them out loud', () => {
    expect(prompt).toContain('GETTING TO KNOW THEM');
    expect(prompt).toContain('Never tell them you are analysing or profiling them');
  });

  it('includes remembered facts and a tone hint only when there is a memory', () => {
    expect(prompt).not.toContain('WHAT YOU REMEMBER');
    const memory: MemoryRow = {
      facts: { nationality: 'سوري', arrival_timeframe: 'بعد شهرين', interests: ['عقارات'] },
      style: { tempo: 'hurried', message_length: 'very_short' },
      message_count: 3,
      last_analyzed_at: null,
    };
    const withMemory = intakePrompt('ar', undefined, memory);
    expect(withMemory).toContain('WHAT YOU REMEMBER');
    expect(withMemory).toContain('سوري');
    expect(withMemory).toContain('بعد شهرين');
    expect(withMemory).toContain('in a hurry');
    // the style read is turned into advice, never handed over as a label
    expect(withMemory).not.toContain('tempo');
  });
});

describe('parseReply', () => {
  it('strips link markers and returns validated ids', () => {
    const r = parseReply('بتلاقي الأخبار بصفحة الأخبار.\n[[LINK:news]]');
    expect(r).toEqual({ reply: 'بتلاقي الأخبار بصفحة الأخبار.', done: false, links: ['news'] });
  });

  it('keeps service/category ids that contain a colon', () => {
    const r = parseReply('Here.\n[[LINK:service:res-tourist]]\n[[LINK:category:education]]');
    expect(r.links).toEqual(['service:res-tourist', 'category:education']);
    expect(r.reply).toBe('Here.');
  });

  it('drops invented ids and duplicates, and never leaks a marker into the text', () => {
    const r = parseReply('ok [[LINK:news]] and [[LINK:made-up]] [[LINK:news]]');
    expect(r.links).toEqual(['news']);
    expect(r.reply).not.toContain('[[');
  });

  it('detects and removes the READY marker', () => {
    const r = parseReply('تم.\n[[READY]]');
    expect(r).toEqual({ reply: 'تم.', done: true, links: [] });
  });

  it('caps links at three', () => {
    const r = parseReply('x [[LINK:news]] [[LINK:map]] [[LINK:faq]] [[LINK:about]]');
    expect(r.links).toHaveLength(3);
  });

  it('tolerates spacing and case in the marker', () => {
    expect(parseReply('hi [[ link : NEWS ]]').links).toEqual([]); // ids are case-sensitive: NEWS is not a page
    expect(parseReply('hi [[ LINK : news ]]').links).toEqual(['news']);
  });
});

describe('the reply language follows what the visitor actually wrote', () => {
  it.each([
    ['وين فيني شوف احدث الاخبار', 'Arabic'],
    ['Where can I read the latest news?', 'Latin-script (English unless it is clearly another language)'],
    ['покажи недвижимость', 'Russian'],
    ['میخواهم اقامت بگیرم، کجا برم؟', 'Persian (Farsi)'],
  ])('%s → %s', (text, expected) => {
    expect(detectWrittenLanguage(text)).toBe(expected);
  });

  it('says nothing when there is too little to tell', () => {
    expect(detectWrittenLanguage('12')).toBeNull();
    expect(detectWrittenLanguage('👍')).toBeNull();
  });

  it('states it as a hard fact in the prompt, even on an Arabic-language site', () => {
    const p = intakePrompt('ar', undefined, null, 'Where can I read the latest news?');
    expect(p).toContain("DETECTED: the user's latest message is written in Latin-script");
    expect(p).toContain('MUST be in that language');
    expect(intakePrompt('ar')).not.toContain('DETECTED');
  });

  it('keeps the booking link out of an intake that has just started', () => {
    expect(intakePrompt('ar')).toContain('do NOT send them to the booking page');
  });
});
