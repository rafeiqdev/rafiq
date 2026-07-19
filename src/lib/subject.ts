/**
 * Detects WHICH subject (service category) a chat message is about, so the free
 * quota can count real topic switches instead of relying on a "new topic"
 * button. Reuses the existing catalog taxonomy — SERVICE_KEYWORDS already holds
 * Arabic/English/Turkish synonyms per service — so no new data or dependency.
 *
 * Follow-ups that match nothing ("كم التكلفة؟", "نعم", "شكراً") return null and
 * are treated as a continuation of the current subject, never a new topic.
 */
import { SERVICES, keywordsFor, normalizeSearch } from '../data/services';

/** A token must be this long to be considered meaningful. */
const MIN_TOKEN = 3;
/** Tokens shared by this many categories are too generic to identify a subject. */
const MAX_CATEGORY_SPREAD = 4;

function buildCategoryTokens(): Record<string, Set<string>> {
  const raw: Record<string, Set<string>> = {};
  for (const s of SERVICES) {
    const set = (raw[s.category] ??= new Set<string>());
    const blob = [s.title.ar, s.title.en, s.title.tr, keywordsFor(s.id)].filter(Boolean).join(' ');
    for (const tok of normalizeSearch(blob).split(' ')) {
      if (tok.length >= MIN_TOKEN) set.add(tok);
    }
  }

  // drop tokens that show up across many categories (e.g. "خدمة", "turkey")
  const spread: Record<string, number> = {};
  for (const set of Object.values(raw)) {
    for (const tok of set) spread[tok] = (spread[tok] ?? 0) + 1;
  }
  for (const set of Object.values(raw)) {
    for (const tok of [...set]) {
      if (spread[tok] > MAX_CATEGORY_SPREAD) set.delete(tok);
    }
  }
  return raw;
}

const CATEGORY_TOKENS = buildCategoryTokens();

export interface SubjectMatch {
  category: string | null;
  score: number;
}

/**
 * Best-matching category for a message, with its score (0 = undecided).
 *
 * `sticky` = the subject already being discussed. Some phrases are genuinely
 * ambiguous ("أريد شراء عقار" fits both realestate and property-based
 * residency); on a tie we STAY on the current subject so an ongoing
 * conversation is never mis-charged as a topic switch.
 */
export function matchSubject(text: string, sticky?: string | null): SubjectMatch {
  const words = new Set(
    normalizeSearch(text)
      .split(' ')
      .filter((w) => w.length >= MIN_TOKEN),
  );
  if (words.size === 0) return { category: null, score: 0 };

  let best: string | null = null;
  let bestScore = 0;
  for (const [category, tokens] of Object.entries(CATEGORY_TOKENS)) {
    let score = 0;
    for (const w of words) if (tokens.has(w)) score += 1;
    const winsTie = score === bestScore && score > 0 && category === sticky;
    if (score > bestScore || winsTie) {
      bestScore = score;
      best = category;
    }
  }
  return bestScore > 0 ? { category: best, score: bestScore } : { category: null, score: 0 };
}

/** Convenience: the detected category id, or null when the message is a follow-up. */
export function detectSubject(text: string, sticky?: string | null): string | null {
  return matchSubject(text, sticky).category;
}

/**
 * Decide whether a message opens a NEW topic.
 *  - no subject detected  → continuation (never charges quota)
 *  - no current subject   → this is the first topic
 *  - different subject    → topic switch
 */
export function isTopicSwitch(current: string | null, incoming: string | null): boolean {
  if (!incoming) return false;
  if (!current) return true;
  return incoming !== current;
}
