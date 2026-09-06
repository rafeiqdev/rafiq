/**
 * RSS/Atom parsing for the news sync (pure functions, no I/O — the Vercel
 * function api/cron/news-sync.ts does the fetching, screening and writing;
 * rssNews.test.ts pins the behaviour here).
 *
 * Regex-based on purpose: the edge runtime ships no DOM or XML parser, and
 * the five fields taken here (title, link, summary, date, image) are the
 * stable core of both RSS 2.0 and Atom. A feed that changes shape degrades
 * to "no items parsed", which the caller reports loudly rather than writing
 * garbage.
 *
 * Two habits of real feeds that the naive version of this got wrong:
 *   - summaries arrive as escaped HTML inside CDATA, so entities have to be
 *     decoded TWICE before the tags can be stripped;
 *   - image URLs are frequently relative to the feed's own host, and article
 *     links are frequently http:// even on sites that only serve https — the
 *     news_posts.url check constraint rejects those outright.
 */

/** One story, normalised into the shape news_posts stores. */
export interface FeedItem {
  /** "rss:<host>:<hash>" — stable id, so re-syncing updates instead of duplicating. */
  id: string;
  title: string;
  /** Summary text, HTML stripped; null when the feed ships headlines only. */
  body: string | null;
  /** Permalink to the article, always https. */
  url: string;
  imageUrl: string | null;
  /** ISO timestamp, or null when the feed's date is missing or unparseable. */
  createdAt: string | null;
}

const TITLE_MAX = 160;
const BODY_MAX = 1200;

/**
 * Named entities beyond the XML five. Turkish publishers emit these by the
 * hundred (`g&uuml;venlik`, `&ccedil;ocuk`), and a leftover `&ouml;` in a
 * headline is the kind of thing a visitor reads as a broken site.
 */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', shy: '', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yuml: 'ÿ', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Auml: 'Ä', Ccedil: 'Ç',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Icirc: 'Î',
  Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Ouml: 'Ö',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  sbquo: '‚', bdquo: '„', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
  deg: '°', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™', times: '×',
};

/** HTML-entity decode: numeric, plus the named set above. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    // &amp; last would re-decode "&amp;lt;" into "<"; a single pass over every
    // name at once cannot, because each match is consumed exactly once.
    .replace(/&([A-Za-z]{2,8});/g, (whole, name: string) => NAMED_ENTITIES[name] ?? whole);
}

/** Strip a CDATA wrapper, if the value came in one. */
function unwrapCdata(s: string): string {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  return m ? m[1] : s;
}

/**
 * Feed markup -> plain text. Decodes twice on purpose: a CDATA summary holds
 * ESCAPED html (`&lt;p&gt;`), so one pass only turns it back into tags — the
 * tags still have to go, and the entities inside them decoded after that.
 */
function toText(raw: string): string {
  let s = decodeEntities(unwrapCdata(raw));
  // Double-escaped is the norm, not the exception: a CDATA body holding
  // "&amp;ccedil;" comes out of the first pass as "&ccedil;" — still an
  // entity, and a visible one. Decode again whenever anything is left.
  if (/&[A-Za-z#]/.test(s)) s = decodeEntities(s);
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Publisher boilerplate that rides along in the summary: WordPress appends
 * "The post <title> appeared first on <site>" and prepends "Last Updated on
 * <date> by <author>". Neither is news.
 *
 * The author in that prefix is the publication itself, so the site's own name
 * — taken from the feed's channel title, not guessed — is what gets trimmed
 * off the front; a generic "up to the next capital letter" rule ate the first
 * real word of the story instead.
 */
function stripBoilerplate(text: string, publisher: string): string {
  let out = text
    .replace(/^Last Updated on\s.{0,60}?\sby\s+/u, '')
    .replace(/\bThe post\b[\s\S]*?\bappeared first on\b.*$/i, '');
  if (publisher) out = out.replace(new RegExp(`^${escapeRe(publisher)}\\s*[-–—:|]?\\s*`), '');
  return out.replace(/\s+/g, ' ').trim();
}

function clamp(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Inner text of the first `<name>…</name>`, or null. Self-closing tags miss. */
function firstTag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}\\s*>`, 'i').exec(block);
  return m ? m[1] : null;
}

/** Value of `attr` on the first `<name …>` tag that also matches `must`. */
function tagAttr(block: string, name: string, attr: string, must?: RegExp): string | null {
  const tags = block.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
  for (const tag of tags) {
    if (must && !must.test(tag)) continue;
    const m = new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i').exec(tag);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

/**
 * Resolve against the feed's own origin and force https. Feeds routinely ship
 * "/images/x.jpg" and "http://site/article"; news_posts.url only accepts
 * https:// URLs, and a mixed-content image never renders anyway.
 */
function absoluteHttps(url: string, base: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  let resolved: URL;
  try {
    resolved = new URL(raw, base);
  } catch {
    return null;
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
  resolved.protocol = 'https:';
  return resolved.toString();
}

/** FNV-1a — a short, stable, dependency-free digest for the upsert key. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function isoDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(decodeEntities(unwrapCdata(raw)).trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The article link — `<link>text</link>` in RSS, `<link href>` in Atom. */
function itemLink(block: string, base: string): string | null {
  const rss = firstTag(block, 'link');
  if (rss && rss.trim()) return absoluteHttps(decodeEntities(unwrapCdata(rss)), base);
  const atom =
    tagAttr(block, 'link', 'href', /rel=["']alternate["']/i) ??
    tagAttr(block, 'link', 'href', /^(?![\s\S]*rel=["'](?:self|replies|edit)["'])/i);
  return atom ? absoluteHttps(atom, base) : null;
}

/** The story's picture, wherever this particular feed chose to put it. */
function itemImage(block: string, base: string): string | null {
  const candidate =
    tagAttr(block, 'enclosure', 'url', /type=["']image\//i) ??
    tagAttr(block, 'media:content', 'url', /medium=["']image["']|type=["']image\//i) ??
    tagAttr(block, 'media:content', 'url') ??
    tagAttr(block, 'media:thumbnail', 'url') ??
    tagAttr(block, 'img', 'src') ??
    firstTag(block, 'image');
  const direct = candidate && !/[<>]/.test(candidate) ? absoluteHttps(candidate, base) : null;
  if (direct) return direct;

  // last resort: the first <img> inside the escaped-HTML summary
  const summary = firstTag(block, 'content:encoded') ?? firstTag(block, 'description') ?? '';
  const inline = /<img[^>]*\ssrc=["']([^"']+)["']/i.exec(decodeEntities(unwrapCdata(summary)));
  return inline ? absoluteHttps(decodeEntities(inline[1]), base) : null;
}

/**
 * Every story in one feed document, in the feed's own order (newest first for
 * every source the site ships with). Items without a title or a resolvable
 * link are dropped — neither the card nor its "read more" link works without
 * them.
 */
export function parseFeed(xml: string, feedUrl: string): FeedItem[] {
  let host: string;
  try {
    host = new URL(feedUrl).host.replace(/^www\./, '');
  } catch {
    return [];
  }

  // the channel's own <title>, i.e. everything before the first story
  const head = xml.slice(0, xml.search(/<(item|entry)\b/i) + 1 || undefined);
  const publisher = toText(firstTag(head, 'title') ?? '');

  const out: FeedItem[] = [];
  for (const [, , block] of xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const title = clamp(toText(firstTag(block, 'title') ?? ''), TITLE_MAX);
    const url = itemLink(block, feedUrl);
    if (!title || !url) continue;

    const summaryRaw =
      firstTag(block, 'description') ??
      firstTag(block, 'summary') ??
      firstTag(block, 'content:encoded') ??
      firstTag(block, 'content') ??
      '';
    const body = clamp(stripBoilerplate(toText(summaryRaw), publisher), BODY_MAX);
    const guid = toText(firstTag(block, 'guid') ?? firstTag(block, 'id') ?? '') || url;

    out.push({
      id: `rss:${host}:${fnv1a(guid)}`,
      title,
      body: body || null,
      url,
      imageUrl: itemImage(block, feedUrl),
      createdAt: isoDate(
        firstTag(block, 'pubDate') ??
          firstTag(block, 'published') ??
          firstTag(block, 'updated') ??
          firstTag(block, 'dc:date'),
      ),
    });
  }
  return out;
}

/**
 * Merge several feeds into one newest-first list, capped. Items with no date
 * sort last rather than jumping the queue on a NaN comparison, and an id seen
 * twice (the same story syndicated to two feeds) is kept once.
 */
export function mergeNewest(feeds: FeedItem[][], limit: number): FeedItem[] {
  const seen = new Set<string>();
  const all: FeedItem[] = [];
  for (const feed of feeds) {
    for (const item of feed) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      all.push(item);
    }
  }
  return all
    .sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0))
    .slice(0, limit);
}

/** A pasted feed address, trimmed and validated — or null when it isn't one. */
export function normalizeFeedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
