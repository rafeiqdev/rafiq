import { describe, expect, it } from 'vitest';

import {
  channelSlug,
  parseChannelPage,
  parsePostPhotoUrl,
  postRef,
  scrubText,
  splitTitleBody,
} from './telegramNews';

/**
 * The sync's contract with the owner:
 *  - the channel's self-promo ("t.me/…", "@channel", trailing signature
 *    lines) must NEVER reach the site,
 *  - real content — including links to official non-Telegram sites the post
 *    body mentions mid-text — survives,
 *  - a markup change on t.me degrades to zero parsed posts, not garbage.
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

describe('splitTitleBody', () => {
  it('first line is the title, the rest the body', () => {
    expect(splitTitleBody('عنوان\nسطر ١\nسطر ٢')).toEqual({ title: 'عنوان', body: 'سطر ١\nسطر ٢' });
  });
  it('bounds a run-on first line at 140 chars', () => {
    const { title } = splitTitleBody('ا'.repeat(200));
    expect(title.length).toBeLessThanOrEqual(140);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('channelSlug', () => {
  it.each([
    ['https://t.me/rafiq_ist', 'rafiq_ist'],
    ['https://t.me/s/rafiq_ist', 'rafiq_ist'],
    ['t.me/rafiq_ist/', 'rafiq_ist'],
    ['@rafiq_ist', 'rafiq_ist'],
  ])('%s -> %s', (input, slug) => {
    expect(channelSlug(input)).toBe(slug);
  });
  it('rejects garbage and private invite links', () => {
    expect(channelSlug('https://evil.example/rafiq')).toBeNull();
    expect(channelSlug('https://t.me/+AbCdEf123')).toBeNull();
  });
});

describe('parseChannelPage', () => {
  const page = `
    <div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message" data-post="rafiq_ist/41">
        <a class="tgme_widget_message_photo_wrap blah" href="https://t.me/rafiq_ist/41"
           style="width:100%;background-image:url('https://cdn4.cdn-telegram.org/file/abc123.jpg')"></a>
        <div class="tgme_widget_message_text js-message_text" dir="rtl">
          &#1602;&#1585;&#1575;&#1585; &#1580;&#1583;&#1610;&#1583;<br/>التفاصيل داخل المنشور&amp; المزيد<br/><br/>@rafiq_ist
        </div>
        <time datetime="2026-07-27T09:00:00+00:00">09:00</time>
      </div>
    </div>
    <div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message service_message" data-post="rafiq_ist/42">
        <time datetime="2026-07-27T10:00:00+00:00">10:00</time>
      </div>
    </div>
    <div class="tgme_widget_message_wrap">
      <div class="tgme_widget_message" data-post="rafiq_ist/43">
        <div class="tgme_widget_message_text js-message_text" dir="rtl">خبر نصي فقط بدون صورة</div>
        <time datetime="2026-07-28T12:30:00+00:00">12:30</time>
      </div>
    </div>`;

  it('extracts id, scrubbed text, photo, permalink and timestamp; skips service messages', () => {
    const posts = parseChannelPage(page);
    expect(posts.map((p) => p.tgId)).toEqual(['rafiq_ist/41', 'rafiq_ist/43']);

    const [withPhoto, textOnly] = posts;
    expect(withPhoto.imageUrl).toBe('https://cdn4.cdn-telegram.org/file/abc123.jpg');
    expect(withPhoto.text).toContain('قرار جديد');
    expect(withPhoto.text).toContain('المزيد');
    expect(withPhoto.text).not.toContain('@rafiq_ist');
    expect(withPhoto.url).toBe('https://t.me/rafiq_ist/41');
    expect(withPhoto.createdAt).toBe('2026-07-27T09:00:00+00:00');

    expect(textOnly.imageUrl).toBeNull();
    expect(textOnly.text).toBe('خبر نصي فقط بدون صورة');
  });

  it('returns [] for unrecognized markup instead of inventing posts', () => {
    expect(parseChannelPage('<html><body>totally different page</body></html>')).toEqual([]);
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
