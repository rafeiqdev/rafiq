import { describe, expect, it } from 'vitest';
import { mergeNewest, normalizeFeedUrl, parseFeed, type FeedItem } from './rssNews';

const FEED_URL = 'https://www.turizmajansi.com/rss';

/** A minimal RSS document with the given items spliced in. */
const rss = (items: string, channelTitle = 'Turizm Ajansı') =>
  `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>` +
  `<title>${channelTitle}</title><link>https://www.turizmajansi.com</link>${items}</channel></rss>`;

describe('parseFeed', () => {
  it('reads title, link, summary, image and date from an RSS item', () => {
    const [item] = parseFeed(
      rss(
        `<item><title>Bir köyün geçmişi müzeye dönüştü</title>` +
          `<link>https://www.turizmajansi.com/haber/koy-muzesi-h1</link>` +
          `<guid isPermaLink="true">https://www.turizmajansi.com/haber/koy-muzesi-h1</guid>` +
          `<media:content url="https://www.turizmajansi.com/images/koy.jpg" medium="image" />` +
          `<description>Yöresel değerler müzede.</description>` +
          `<pubDate>Sun, 06 Sep 2026 18:21:56 GMT</pubDate></item>`,
      ),
      FEED_URL,
    );
    expect(item).toMatchObject({
      title: 'Bir köyün geçmişi müzeye dönüştü',
      body: 'Yöresel değerler müzede.',
      url: 'https://www.turizmajansi.com/haber/koy-muzesi-h1',
      imageUrl: 'https://www.turizmajansi.com/images/koy.jpg',
      createdAt: '2026-09-06T18:21:56.000Z',
    });
    expect(item.id).toMatch(/^rss:turizmajansi\.com:[0-9a-f]{8}$/);
  });

  it('decodes double-escaped entities — feeds ship "&amp;ccedil;" inside CDATA', () => {
    const [item] = parseFeed(
      rss(
        `<item><title>Test</title><link>https://x.test/a</link>` +
          `<description><![CDATA[&lt;p&gt;g&amp;uuml;venlik ve &amp;ccedil;ocuk&lt;/p&gt;]]></description></item>`,
      ),
      FEED_URL,
    );
    expect(item.body).toBe('güvenlik ve çocuk');
  });

  it('upgrades http links to https — news_posts.url rejects anything else', () => {
    const [item] = parseFeed(
      rss(`<item><title>Test</title><link>http://www.turizmajansi.com/haber/x-h2</link></item>`),
      FEED_URL,
    );
    expect(item.url).toBe('https://www.turizmajansi.com/haber/x-h2');
  });

  it('resolves a relative image against the feed host', () => {
    const [item] = parseFeed(
      rss(
        `<item><title>Test</title><link>https://x.test/a</link>` +
          `<media:content url='/images/haber/pool.jpg' medium="image" /></item>`,
      ),
      FEED_URL,
    );
    expect(item.imageUrl).toBe('https://www.turizmajansi.com/images/haber/pool.jpg');
  });

  it('falls back to the first <img> inside an escaped-HTML summary', () => {
    const [item] = parseFeed(
      rss(
        `<item><title>Test</title><link>https://x.test/a</link>` +
          `<description><![CDATA[<p><img src="https://cdn.test/a.jpg" /> metin</p>]]></description></item>`,
      ),
      FEED_URL,
    );
    expect(item.imageUrl).toBe('https://cdn.test/a.jpg');
  });

  it('strips WordPress boilerplate, including the publisher name it signs with', () => {
    const [item] = parseFeed(
      rss(
        `<item><title>Test</title><link>https://x.test/a</link>` +
          `<description><![CDATA[<p>Last Updated on 5 Eylül 2026 by Turizm Günlüğü Kültür ve Turizm Bakanı konuştu.</p>` +
          `<p>The post <a href="https://x.test/a">Test</a> appeared first on Turizm Günlüğü.</p>]]></description></item>`,
        'Turizm Günlüğü',
      ),
      FEED_URL,
    );
    expect(item.body).toBe('Kültür ve Turizm Bakanı konuştu.');
  });

  it('reads Atom entries, whose link is an attribute and not a text node', () => {
    const atom =
      `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Feed</title>` +
      `<entry><title>Atom story</title>` +
      `<link rel="self" href="https://x.test/self" />` +
      `<link rel="alternate" href="https://x.test/story" />` +
      `<id>tag:x.test,2026:1</id><summary>Body here.</summary>` +
      `<published>2026-09-01T10:00:00Z</published></entry></feed>`;
    expect(parseFeed(atom, 'https://x.test/atom')).toEqual([
      expect.objectContaining({ title: 'Atom story', url: 'https://x.test/story', body: 'Body here.' }),
    ]);
  });

  it('gives the same id to the same story on every run, and different ids to different stories', () => {
    const doc = rss(
      `<item><title>A</title><link>https://x.test/a</link><guid>guid-a</guid></item>` +
        `<item><title>B</title><link>https://x.test/b</link><guid>guid-b</guid></item>`,
    );
    const first = parseFeed(doc, FEED_URL);
    const second = parseFeed(doc, FEED_URL);
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].id).not.toBe(first[1].id);
  });

  it('drops items with no title or no usable link — neither card would work', () => {
    const items = parseFeed(
      rss(
        `<item><title></title><link>https://x.test/a</link></item>` +
          `<item><title>No link</title></item>` +
          `<item><title>Fine</title><link>https://x.test/c</link></item>`,
      ),
      FEED_URL,
    );
    expect(items.map((i) => i.title)).toEqual(['Fine']);
  });

  it('returns nothing rather than garbage when the markup is not a feed', () => {
    expect(parseFeed('<html><body>not a feed</body></html>', FEED_URL)).toEqual([]);
  });
});

describe('mergeNewest', () => {
  const item = (id: string, createdAt: string | null): FeedItem => ({
    id, title: id, body: null, url: `https://x.test/${id}`, imageUrl: null, createdAt,
  });

  it('orders newest first across feeds and caps the result', () => {
    const merged = mergeNewest(
      [
        [item('a', '2026-09-01T00:00:00Z'), item('b', '2026-09-05T00:00:00Z')],
        [item('c', '2026-09-03T00:00:00Z')],
      ],
      2,
    );
    expect(merged.map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('keeps a story once when two feeds carry it', () => {
    const merged = mergeNewest([[item('a', '2026-09-01T00:00:00Z')], [item('a', '2026-09-01T00:00:00Z')]], 5);
    expect(merged).toHaveLength(1);
  });

  it('sorts undated items last instead of letting NaN scramble the order', () => {
    const merged = mergeNewest([[item('undated', null), item('dated', '2026-09-01T00:00:00Z')]], 5);
    expect(merged.map((i) => i.id)).toEqual(['dated', 'undated']);
  });
});

describe('normalizeFeedUrl', () => {
  it('accepts an http(s) address and rejects anything else', () => {
    expect(normalizeFeedUrl('  https://a.test/rss ')).toBe('https://a.test/rss');
    expect(normalizeFeedUrl('http://a.test/rss')).toBe('http://a.test/rss');
    expect(normalizeFeedUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeFeedUrl('turizmajansi.com/rss')).toBeNull();
    expect(normalizeFeedUrl('')).toBeNull();
  });
});
