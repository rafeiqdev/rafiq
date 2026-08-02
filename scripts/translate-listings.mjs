/**
 * Translates listing descriptions into ar/en/fa/ru, once per listing, and
 * writes them into listings.translations (see
 * supabase/migrations/20260804_listings_translations.sql).
 *
 * Translates the CONDENSED description (condenseDescription output), not the
 * raw scraped text — the raw text is agency marketing copy full of noise
 * that would just become a wall of Turkish sales copy in another language.
 * District names are proper nouns and are explicitly told to stay in Latin
 * script (Gaziosmanpaşa stays Gaziosmanpaşa in the Arabic/Farsi/Russian text
 * too, never transliterated).
 *
 * One Gemini call per listing (all four languages in a single response) to
 * keep the token/request cost down and the run fast.
 *
 * Generic and idempotent: only processes rows with a non-empty description
 * and translations still missing one or more of the four locales. Re-running
 * after a future import just picks up the new rows.
 *
 * Usage:
 *   node scripts/translate-listings.mjs
 *   node scripts/translate-listings.mjs --limit=3   # smoke-test first
 *   node scripts/translate-listings.mjs --dry-run    # log, write nothing
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY in .env.
 */
import 'dotenv/config';
import { requireSupabaseEnv, restFetch } from './lib/supabaseRest.mjs';
import { condenseDescription } from './lib/condense.mjs';

const LOCALES = ['ar', 'en', 'fa', 'ru'];
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const limitArg = [...args].find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

function missingLocales(translations) {
  const t = translations && typeof translations === 'object' ? translations : {};
  return LOCALES.filter((l) => !t[l]?.description);
}

async function translateListing(apiKey, district, condensed) {
  const system =
    'You translate Istanbul real-estate listing text into Arabic, English, Farsi and Russian. ' +
    'Return ONLY a JSON object, no prose, no markdown fences, in this exact shape: ' +
    '{"ar":{"title":"","description":""},"en":{"title":"","description":""},"fa":{"title":"","description":""},"ru":{"title":"","description":""}}. ' +
    'The "title" is a short 3-6 word buyer-facing summary you compose from the description (e.g. "Spacious 4+1 apartment in ' +
    district +
    '"), translated per language. ' +
    'Keep Turkish district/neighborhood proper nouns (e.g. Gaziosmanpaşa, Bağcılar, Kağıthane) in their original Latin spelling in every language — never transliterate or translate them. ' +
    'Translate naturally and concisely; do not add facts that are not in the source text.';

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: condensed }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? '').join('').trim() ?? '';
  const fenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`no JSON in Gemini reply: ${text.slice(0, 200)}`);
  return JSON.parse(fenced.slice(start, end + 1));
}

async function main() {
  const supa = requireSupabaseEnv();
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey && !dryRun) throw new Error('GEMINI_API_KEY must be set in .env to run this script.');

  const res = await restFetch(supa, 'listings?select=id,district,description,translations&order=sort.asc');
  const rows = await res.json();

  const eligible = rows
    .filter((r) => (r.description || '').trim() && missingLocales(r.translations).length > 0)
    .slice(0, limit);
  console.log(`${rows.length} listings total, ${eligible.length} need translating.`);

  let done = 0;
  let failed = 0;
  for (const row of eligible) {
    const condensed = condenseDescription(row.description);
    if (!condensed) {
      console.log(`${row.id} — condensed to nothing, skipping`);
      continue;
    }

    console.log(`${row.id} (${row.district}) — translating...`);
    if (dryRun) {
      console.log(`  [dry-run] would translate ${condensed.length} chars into ${LOCALES.join(', ')}`);
      done++;
      continue;
    }

    try {
      const translations = await translateListing(geminiKey, row.district, condensed);
      await restFetch(supa, `listings?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ translations }),
      });
      console.log('  -> saved');
      done++;
    } catch (e) {
      console.error(`  -> FAILED: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${done} translated, ${failed} failed, out of ${eligible.length} eligible.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
