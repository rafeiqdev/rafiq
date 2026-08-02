/**
 * Condenses an imported listing description down to the part a buyer reads.
 *
 * Descriptions that arrive from a listing portal are written for that portal:
 * an agency sign-off, a phone number, a wall of hashtags, the same sentence
 * repeated in three languages. Rendering all of it verbatim is what makes a
 * property page scroll for a screen and a half and look like a scrape.
 *
 * This does NOT translate — translation belongs at import time, once, not on
 * every render. It removes what is noise in any language and keeps the first
 * few real sentences.
 */

/** Contact details and portal boilerplate: never useful, sometimes a liability. */
const NOISE = [
  /(\+?\d[\d\s().-]{7,}\d)/g, // phone numbers
  /\S+@\S+\.\S+/g, // e-mail addresses
  /(https?:\/\/|www\.)\S+/gi, // links
  /#[\wçğıöşüÇĞİÖŞÜأ-ي]+/g, // hashtags
  // `[iİ]` written out: JS case-insensitive matching does not fold the Turkish
  // dotted capital İ onto i, so a plain /ilan/i misses "İlan No" every time.
  /([iİ]lan\s*no|listing\s*(id|no)|رقم\s*الإعلان)\s*[:#]?\s*\d+/gi,
];

/**
 * Lines that are pure agency marketing rather than facts about the property.
 *
 * No `\b` around the Arabic alternatives on purpose: JavaScript word
 * boundaries are defined against `\w`, which is ASCII-only, so `\bواتس\b`
 * never matches and the line survives. Latin terms keep their boundaries.
 */
const BOILERPLATE =
  /^.*(\b(whatsapp|watsapp|iletişim|bize ulaşın|call us|contact us)\b|واتس|تواصل معنا|للتواصل).*$/gim;

export function condenseDescription(raw: string | null | undefined, maxChars = 320): string {
  if (!raw) return '';

  let text = raw.replace(BOILERPLATE, ' ');
  for (const pattern of NOISE) text = text.replace(pattern, ' ');

  // Collapse the decorative separators portals love (═══, ★★★, ---, ...).
  text = text
    // includes the box-drawing range portals use for banner rules (═ ─ ━ …)
    .replace(/[•▪◾★☆✦✧=_~\-\u2500-\u257F]{3,}/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  if (text.length <= maxChars) return text;

  // Cut on a sentence boundary when there is one nearby, so the excerpt does
  // not end mid-clause; otherwise fall back to a word boundary.
  const window = text.slice(0, maxChars + 60);
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('۔ '),
    window.lastIndexOf('؟ '),
    window.lastIndexOf('! '),
    window.lastIndexOf('।'),
  );
  if (sentenceEnd > maxChars * 0.5) return text.slice(0, sentenceEnd + 1).trim();

  const cut = text.lastIndexOf(' ', maxChars);
  return `${text.slice(0, cut > 0 ? cut : maxChars).trim()}…`;
}

/** True when condensing actually dropped something, so "read more" is honest. */
export function wasCondensed(raw: string | null | undefined, maxChars = 320): boolean {
  if (!raw) return false;
  return condenseDescription(raw, maxChars) !== raw.trim();
}
