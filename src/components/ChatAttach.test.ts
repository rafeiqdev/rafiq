import { describe, expect, it } from 'vitest';
import { wantsMedia } from './ChatAttach';

/**
 * Regression suite for the "attach card under every message" bug.
 *
 * The card is gated on wantsMedia(last assistant message). The original regex
 * matched topic nouns (إقامة، جواز، صور، residence…), and since a residency
 * conversation mentions "الإقامة" in almost every reply, the card rendered
 * under every single message while the assistant was still asking questions.
 * Only an explicit attach/upload request may trigger it.
 */
describe('wantsMedia — explicit attach requests trigger the card', () => {
  it.each([
    ['Arabic أرفق', 'ممتاز! الآن أرفق صورة جواز سفرك من زر المشبك.'],
    ['Arabic إرفاق', 'يمكنك إرفاق عقد الإيجار هنا — صورة أو PDF.'],
    ['Arabic bare ارفق', 'ارفق الوثيقة عندما تكون جاهزًا.'],
    ['English attach', 'Please attach a photo of your passport using the paperclip button.'],
    ['English upload', 'You can upload the rental contract as a PDF.'],
    ['Russian прикрепите', 'Прикрепите фото паспорта, пожалуйста.'],
    ['Russian загрузите', 'Загрузите договор аренды здесь.'],
    ['Farsi پیوست', 'لطفاً تصویر گذرنامه را پیوست کنید.'],
    ['Farsi بارگذاری', 'می‌توانید مدرک را بارگذاری کنید.'],
  ])('%s', (_label, text) => {
    expect(wantsMedia(text)).toBe(true);
  });
});

describe('wantsMedia — merely mentioning documents must NOT trigger it', () => {
  it.each([
    ['الإقامة as the topic', 'أهلاً! لمساعدتك في حجز موعد الإقامة، ما هي مدينتك الحالية؟'],
    ['follow-up question about إقامة', 'هل لديك إقامة سابقة أم هذه أول مرة؟'],
    ['السؤال 2 من 5 عن الجواز', 'السؤال 2 من 5: ما هي جنسية جواز سفرك؟'],
    ['mentioning صور in passing', 'سيشرح لك المختص خطوات التصوير في الموعد.'],
    ['English residence talk', 'Great — a residence permit renewal. Which district do you live in?'],
    ['English passport question', 'What nationality is your passport?'],
    ['Russian паспорт question', 'Какое гражданство у вашего паспорта?'],
    ['Farsi اقامت question', 'برای اقامت، در کدام منطقه زندگی می‌کنید؟'],
    ['empty', ''],
  ])('%s', (_label, text) => {
    expect(wantsMedia(text)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(wantsMedia(null)).toBe(false);
    expect(wantsMedia(undefined)).toBe(false);
  });
});
