/**
 * Placeholder headline numbers shown on the home page — the Hero stats bar
 * and the "How Rafiq works" stats bar. Every value below is a stand-in;
 * swap it for the real figure whenever one is available. This is the one
 * file to edit — no other component on the home page hardcodes these numbers.
 */

// Not a placeholder — the actual count of languages the UI ships in (ar/en/ru/fa).
export const LANGUAGES_SUPPORTED = 4;

export const HOME_STATS = {
  familiesServed: 500,
  yearsExperience: 5,
  languagesSupported: LANGUAGES_SUPPORTED,
  avgResponseHours: 2,
  usersServed: 1000,
  servicesCovered: 20,
} as const;
