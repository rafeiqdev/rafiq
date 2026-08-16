/**
 * Parsing + scrubbing for the Telegram channel sync (pure functions, no I/O —
 * the Vercel function api/cron/telegram-sync.ts does the fetching/writing,
 * telegramNews.test.ts pins the behaviour here).
 *
 * Source: the public web preview at https://t.me/s/<channel>. Telegram has no
 * supported feed API for browsers, but every PUBLIC channel serves this HTML
 * page with its recent posts — text, photo, permalink, timestamp. Private
 * channels have no such page and cannot be synced this way.
 *
 * The scrubbing exists because channels sign their posts with their own
 * links ("t.me/channel", "@channel", "join us: …"). Those must not appear on
 * the site: trailing signature lines are dropped entirely, and any Telegram
 * link or @mention that still remains mid-text is removed.
 */

export interface TgPost {
  /** "channel/123" — stable id used for idempotent upserts. */
  tgId: string;
  /** Scrubbed plain text (may be empty for photo-only posts). */
  text: string;
  imageUrl: string | null;
  /** Permalink to the original post. */
  url: string;
  /** ISO timestamp of the post. */
  createdAt: string | null;
}

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

/** Message text HTML -> plain text with newlines. */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\r/g, '')
    .trim();
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

/** First line becomes the card title (bounded), the rest the body. */
export function splitTitleBody(text: string): { title: string; body: string | null } {
  const [first = '', ...rest] = text.split('\n').filter((l) => l.trim() !== '');
  const title = first.length > 140 ? `${first.slice(0, 139).trimEnd()}…` : first;
  const body = rest.join('\n').trim();
  return { title, body: body || null };
}

/**
 * Extract the messages from a t.me/s/<channel> page, oldest first (the page
 * lists them oldest-to-newest already). Regex-based on purpose: the edge
 * runtime has no DOM parser, and the four fields used here have been stable
 * in Telegram's markup for years. A markup change degrades to "no posts
 * parsed", which the caller reports loudly rather than writing garbage.
 */
export function parseChannelPage(html: string): TgPost[] {
  const posts: TgPost[] = [];
  const anchors = [...html.matchAll(/data-post="([^"]+)"/g)];
  for (let i = 0; i < anchors.length; i++) {
    const tgId = anchors[i][1];
    const start = anchors[i].index ?? 0;
    const end = i + 1 < anchors.length ? (anchors[i + 1].index ?? html.length) : html.length;
    const block = html.slice(start, end);

    const textMatch = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block);
    const photoMatch = /class="tgme_widget_message_photo_wrap[^"]*"[^>]*background-image:url\('([^']+)'\)/.exec(block);
    const timeMatch = /<time[^>]*datetime="([^"]+)"/.exec(block);

    posts.push({
      tgId,
      text: textMatch ? scrubText(htmlToText(textMatch[1])) : '',
      imageUrl: photoMatch ? decodeEntities(photoMatch[1]) : null,
      url: `https://t.me/${tgId}`,
      createdAt: timeMatch ? timeMatch[1] : null,
    });
  }
  // service messages (joins, pins) have neither text nor photo — skip them
  return posts.filter((p) => p.text !== '' || p.imageUrl !== null);
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

/** "https://t.me/rafiq_ist" | "t.me/s/rafiq_ist" | "@rafiq_ist" -> "rafiq_ist" */
export function channelSlug(channelUrl: string): string | null {
  const m = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z]\w{3,31})\/?$/.exec(channelUrl.trim()) ??
    /^@([A-Za-z]\w{3,31})$/.exec(channelUrl.trim());
  return m ? m[1] : null;
}
