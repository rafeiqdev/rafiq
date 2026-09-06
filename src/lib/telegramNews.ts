/**
 * Parsing + scrubbing for the retired Telegram channel mirror (pure
 * functions, no I/O — telegramNews.test.ts pins the behaviour here).
 *
 * News now comes from api/cron/news-sync.ts, which reads tourism feeds
 * instead of a channel. This file stays because the posts that mirror left
 * behind are still in news_posts: postRef()/parsePostPhotoUrl() are what
 * /api/news-photo re-resolves their (expiring) photos with, and the pages
 * call postRef() to route those older cards' images through it.
 *
 * Source was the public web preview at https://t.me/s/<channel>. Telegram has
 * no supported feed API for browsers, but every PUBLIC channel serves that
 * HTML page with its recent posts — text, photo, permalink, timestamp.
 *
 * The scrubbing exists because channels sign their posts with their own
 * links ("t.me/channel", "@channel", "join us: …"). Those must not appear on
 * the site: trailing signature lines are dropped entirely, and any Telegram
 * link or @mention that still remains mid-text is removed.
 */

/** Minimal HTML-entity decode for the subset t.me actually emits. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

const TG_LINK = /(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.org)\/[\w+/-]+/gi;
const MENTION = /(^|\s)@\w{3,}/g;
const ANY_URL = /https?:\/\/\S+/gi;

/**
 * A "signature" line: once links, mentions, hashtags and punctuation are
 * removed, almost no real words remain. Channels put these at the END of
 * every post; they are promo, not content.
 */
function isSignatureLine(line: string): boolean {
  if (line.trim() === '') return true;
  const hasPromoToken = TG_LINK.test(line) || /(^|\s)@\w{3,}/.test(line) || /https?:\/\//.test(line);
  TG_LINK.lastIndex = 0; // reset the /g regex between calls
  if (!hasPromoToken) return false;
  const residue = line
    .replace(TG_LINK, ' ')
    .replace(ANY_URL, ' ')
    .replace(MENTION, ' ')
    .replace(/#\w+/g, ' ')
    .replace(/[|•·—:,؛،-]/g, ' ');
  TG_LINK.lastIndex = 0;
  // fewer than 3 leftover word-characters => the line was only self-promo
  return (residue.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 3;
}

/**
 * "Follow us 👇" — the short pointer line channels put right above their
 * links. Only ever dropped AFTER a signature line was dropped below it, so a
 * short closing sentence of real content is never eaten.
 */
function isCallToFollowLine(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.length <= 30 && (/[👇⬇↓]/u.test(t) || /[:：]$/.test(t));
}

/** Drop trailing signature lines, then strip leftover Telegram links/mentions. */
export function scrubText(raw: string): string {
  const lines = raw.split('\n');
  let droppedPromo = false;
  while (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (isSignatureLine(last)) {
      if (last.trim() !== '') droppedPromo = true;
      lines.pop();
    } else if (droppedPromo && isCallToFollowLine(last)) {
      lines.pop();
    } else {
      break;
    }
  }
  return lines
    .map((l) => l.replace(TG_LINK, '').replace(MENTION, '$1').replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .trim();
}

/**
 * "https://t.me/akhbarturkiye/50202" -> "akhbarturkiye/50202".
 *
 * The channel/message pair is all /api/news-photo needs to re-resolve a post's
 * photo, and the strict shape is what stops that endpoint being usable as an
 * open proxy — see the note there. Anything that is not a public channel
 * permalink (a private t.me/c/… link, a bare channel URL, a foreign host)
 * yields null and the caller falls back to the stored URL.
 */
export function postRef(permalink: string | null | undefined): string | null {
  const m = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z]\w{3,31})\/(\d{1,12})\/?$/.exec(
    (permalink ?? '').trim(),
  );
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Telegram serves post photos only from its own CDN; nothing else is fetched. */
const TG_CDN_HOST = /^https:\/\/cdn\d+\.telesco\.pe\/file\/[\w-]+\.(?:jpg|jpeg|png|webp)$/i;

/**
 * Pull the photo URL out of a single post's embed page (t.me/<ref>?embed=1).
 *
 * The host check is not belt-and-braces: this HTML is third-party content, and
 * the URL taken from it is handed straight to fetch(). Without the check, a
 * change on Telegram's side (or an attacker-authored post) could point our
 * server at an arbitrary host — an SSRF, using our origin as the client.
 */
export function parsePostPhotoUrl(html: string): string | null {
  const m = /background-image:url\('([^']+)'\)/.exec(html);
  if (!m) return null;
  const url = decodeEntities(m[1]);
  return TG_CDN_HOST.test(url) ? url : null;
}
