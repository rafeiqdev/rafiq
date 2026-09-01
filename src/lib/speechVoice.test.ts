import { describe, expect, it } from 'vitest';
import { pickVoice } from './speechVoice';

function voice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang } as SpeechSynthesisVoice;
}

describe('pickVoice', () => {
  it('returns null when no voices are installed', () => {
    expect(pickVoice([], 'ar-SA')).toBeNull();
  });

  it('prefers a Natural/Neural voice over the plain default for the same language', () => {
    const voices = [voice('Microsoft Naayf - Arabic (Saudi Arabia)', 'ar-SA'), voice('Microsoft Hoda Online (Natural) - Arabic (Saudi Arabia)', 'ar-SA')];
    const picked = pickVoice(voices, 'ar-SA');
    expect(picked?.name).toContain('Natural');
  });

  it('prefers a Google voice over a plain default', () => {
    const voices = [voice('Some Robotic Voice', 'en-US'), voice('Google US English', 'en-US')];
    expect(pickVoice(voices, 'en-US')?.name).toBe('Google US English');
  });

  it('only considers voices matching the requested language', () => {
    const voices = [voice('Google UK English', 'en-GB'), voice('Compact Arabic', 'ar-SA')];
    expect(pickVoice(voices, 'ar-SA')?.name).toBe('Compact Arabic');
  });

  it('falls back to base-language match when no exact region match exists', () => {
    const voices = [voice('Some Persian Voice', 'fa-IR')];
    expect(pickVoice(voices, 'fa-IR')?.lang).toBe('fa-IR');
  });

  it('returns null when nothing matches the requested language at all', () => {
    const voices = [voice('Google US English', 'en-US')];
    expect(pickVoice(voices, 'ru-RU')).toBeNull();
  });
});
