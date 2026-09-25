/**
 * The browser-tab title carries the brand ("… | Rafiq coordination"), which
 * reads like a filename once it sits on the page as a headline. Drop that
 * trailing brand chunk from the visible H1 only — the <title> keeps it.
 */
export function headlineFrom(seoTitle: string): string {
  const chunks = seoTitle.split(/\s+[|—–-]\s+/).map((part) => part.trim()).filter(Boolean);
  const isBrand = (part: string) => /rafiq|رفيق|رفیق/i.test(part);
  while (chunks.length > 1 && isBrand(chunks[chunks.length - 1])) chunks.pop();
  return chunks.join(' — ') || seoTitle;
}
