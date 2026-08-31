import { describe, expect, it } from 'vitest';
import { intakePrompt } from './ai-chat';

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
