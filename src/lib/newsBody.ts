/**
 * Turn a synced Telegram post body into the article layout's three parts: an
 * intro paragraph, a list of bullet points, and the channel's source line.
 *
 * The channel writes each post as an intro line, then several "📌 …" bullet
 * lines, and signs off with a "🔵 <name> || Subscribe…" line. That signature
 * survives text scrubbing (it carries no t.me link or @mention, which is all
 * scrubText looks for), so it is stripped here at display time and surfaced as
 * a "Source" credit instead of trailing the body as noise.
 */

export interface ParsedNewsBody {
  /** Intro paragraph(s) before the first bullet — null when there are none. */
  lead: string | null;
  /** Bullet points, with their leading marker emoji removed. */
  bullets: string[];
  /** Channel credit pulled from the sign-off line — null when absent. */
  source: string | null;
}

const BULLET_RE = /^(?:📌|🔹|🔸|▪️|◾️|▫️|•|●|‣|·|-|\*|✅|☑️|➡️|👈|👇)\s*/u;

export function parseNewsBody(body: string | null | undefined): ParsedNewsBody {
  const lines = (body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let source: string | null = null;
  const kept: string[] = [];
  for (const line of lines) {
    // "🔵 Turkey News Service || Subscribe to the Telegram channel"
    if (line.includes('||') || /subscrib/i.test(line)) {
      const name = line.replace(/^[^\p{L}\p{N}]+/u, '').split('||')[0].trim();
      if (name && !source) source = name;
      continue;
    }
    kept.push(line);
  }

  const lead: string[] = [];
  const bullets: string[] = [];
  for (const line of kept) {
    if (BULLET_RE.test(line)) {
      bullets.push(line.replace(BULLET_RE, '').trim());
    } else if (bullets.length === 0) {
      // Text before the first bullet is the intro.
      lead.push(line);
    } else {
      // A stray non-bullet line after the bullets started — keep it as a
      // bullet rather than dropping content.
      bullets.push(line);
    }
  }

  return { lead: lead.join('\n') || null, bullets, source };
}
