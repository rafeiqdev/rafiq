/**
 * Node/CommonJS mirror of src/lib/listingText.ts's condenseDescription.
 * Duplicated (not imported) because these scripts run as plain .mjs and this
 * repo has no TS-in-Node loader — keep the two in sync if the noise patterns
 * change. Covered indirectly: src/lib/listingText.test.ts pins the behavior
 * this copy must match.
 */

const NOISE = [
  /(\+?\d[\d\s().-]{7,}\d)/g,
  /\S+@\S+\.\S+/g,
  /(https?:\/\/|www\.)\S+/gi,
  /#[\wçğıöşüÇĞİÖŞÜأ-ي]+/g,
  /([iİ]lan\s*no|listing\s*(id|no)|رقم\s*الإعلان)\s*[:#]?\s*\d+/gi,
];

const BOILERPLATE =
  /^.*(\b(whatsapp|watsapp|iletişim|bize ulaşın|call us|contact us)\b|واتس|تواصل معنا|للتواصل).*$/gim;

export function condenseDescription(raw, maxChars = 320) {
  if (!raw) return '';

  let text = raw.replace(BOILERPLATE, ' ');
  for (const pattern of NOISE) text = text.replace(pattern, ' ');

  text = text
    // includes the box-drawing range portals use for banner rules (═ ─ ━ …)
    .replace(/[•▪◾★☆✦✧=_~\-─-╿]{3,}/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  if (text.length <= maxChars) return text;

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
