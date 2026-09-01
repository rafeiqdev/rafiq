/**
 * Picks the best-sounding installed system voice for a language. The browser's
 * own default pick is often the OS's compact offline voice — flat and harsh —
 * even when a much more natural one is installed alongside it, so we rank the
 * candidates ourselves instead of leaving `lang` alone to decide.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], bcp47: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const base = bcp47.split('-')[0].toLowerCase();
  const sameLanguage = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = sameLanguage.length > 0 ? sameLanguage : voices.filter((v) => v.lang.toLowerCase() === bcp47.toLowerCase());
  if (pool.length === 0) return null;

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    // Cloud/neural engines ("Natural", "Neural", "Google ...") sound far more
    // human than the compact offline voice most OSes default to; a plain
    // "Online" engine is a step up too. Everything else scores lowest.
    if (name.includes('natural') || name.includes('neural')) return 4;
    if (name.includes('google')) return 3;
    if (name.includes('online')) return 2;
    return 1;
  };

  return [...pool].sort((a, b) => score(b) - score(a))[0];
}
