import { describe, expect, it } from 'vitest';

import { parsePostPhotoUrl, postRef, scrubText } from './telegramNews';

/**
 * What survives of the retired channel mirror: the posts it left in
 * news_posts still render, and /api/news-photo still re-resolves their
 * photos. scrubText also cleans those stored bodies on read (newsBody.ts):
 * the channel's self-promo ("t.me/…", "@channel", trailing signature lines)
 * must NEVER reach the site, while real content — including links to
 * official non-Telegram sites mentioned mid-text — survives.
 */

describe('scrubText', () => {
  it('drops the trailing signature block a channel appends to every post', () => {
    const raw = [
      'قرار جديد بخصوص الإقامة السياحية',
      'التفاصيل: المدة أصبحت ٦ أشهر قابلة للتجديد.',
      '',
      'تابعونا 👇',
      'https://t.me/rafiq_ist | @rafiq_ist',
    ].join('\n');

    expect(scrubText(raw)).toBe(
      'قرار جديد بخصوص الإقامة السياحية\nالتفاصيل: المدة أصبحت ٦ أشهر قابلة للتجديد.',
    );
  });

  it('strips a mid-text telegram link and @mention but keeps the sentence', () => {
    const raw = 'راسلونا عبر @rafiq_ist أو t.me/rafiq_ist للاستفسار عن المواعيد';
    const out = scrubText(raw);
    expect(out).not.toMatch(/t\.me|@rafiq_ist/);
    expect(out).toContain('للاستفسار عن المواعيد');
  });

  it('keeps non-Telegram links that are part of the content', () => {
    const raw = 'رابط التسجيل الرسمي:\nhttps://e-ikamet.goc.gov.tr والدفع في الشعبة';
    expect(scrubText(raw)).toContain('https://e-ikamet.goc.gov.tr');
  });

  it('a link-only trailing line goes, a sentence with a link stays', () => {
    const raw = 'الخبر المهم هنا\nسجل عبر الموقع الرسمي https://e-ikamet.goc.gov.tr قبل الجمعة';
    // the last line has real words around its URL — it is content, not signature
    expect(scrubText(raw).split('\n')).toHaveLength(2);
  });
});

/**
 * Both of these back /api/news-photo, and both are the endpoint's only guard
 * against being turned into an open proxy — a reference it accepts decides
 * which URL the server fetches. The negative cases matter more than the happy
 * one.
 */
describe('postRef', () => {
  it('extracts channel/message from a public post permalink', () => {
    expect(postRef('https://t.me/akhbarturkiye/50202')).toBe('akhbarturkiye/50202');
    expect(postRef('t.me/rafiq_ist/41/')).toBe('rafiq_ist/41');
  });

  it('rejects anything that is not a public channel post', () => {
    expect(postRef('https://t.me/akhbarturkiye')).toBeNull(); // channel, not a post
    expect(postRef('https://t.me/c/1234567/8')).toBeNull(); // private channel
    expect(postRef('https://evil.example/t.me/chan/1')).toBeNull(); // foreign host
    expect(postRef('https://t.me/chan/1?x=../../etc')).toBeNull();
    expect(postRef(null)).toBeNull();
    expect(postRef('')).toBeNull();
  });
});

describe('parsePostPhotoUrl', () => {
  const embed = (url: string) =>
    `<a class="tgme_widget_message_photo_wrap" style="background-image:url('${url}')"></a>`;

  it('reads the photo URL out of an embed page', () => {
    expect(parsePostPhotoUrl(embed('https://cdn4.telesco.pe/file/abc-123.jpg'))).toBe(
      'https://cdn4.telesco.pe/file/abc-123.jpg',
    );
  });

  it('refuses a URL that is not on Telegram\'s CDN, so scraped HTML cannot steer fetch()', () => {
    expect(parsePostPhotoUrl(embed('https://evil.example/payload.jpg'))).toBeNull();
    expect(parsePostPhotoUrl(embed('http://cdn4.telesco.pe/file/a.jpg'))).toBeNull(); // not https
    expect(parsePostPhotoUrl(embed('https://cdn4.telesco.pe.evil.example/file/a.jpg'))).toBeNull();
    expect(parsePostPhotoUrl(embed('https://cdn4.telesco.pe/file/a.svg'))).toBeNull();
  });

  it('returns null when the post has no photo at all', () => {
    expect(parsePostPhotoUrl('<div>text only post</div>')).toBeNull();
  });
});
