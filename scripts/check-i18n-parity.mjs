/** Fails (exit 1) if the four locale files don't have identical key sets. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const langs = ['en', 'ar', 'ru', 'fa'];

function flatten(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatten(v, key));
    else keys.push(key);
  }
  return keys;
}

const sets = {};
for (const lang of langs) {
  sets[lang] = new Set(flatten(JSON.parse(readFileSync(join(root, `${lang}.json`), 'utf8'))));
}

let failed = false;
for (const lang of langs.slice(1)) {
  const missing = [...sets.en].filter((k) => !sets[lang].has(k));
  const extra = [...sets[lang]].filter((k) => !sets.en.has(k));
  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.error(`[${lang}] missing keys:\n  ${missing.join('\n  ')}`);
    if (extra.length) console.error(`[${lang}] extra keys:\n  ${extra.join('\n  ')}`);
  }
}

if (failed) process.exit(1);
console.log(`i18n parity OK — ${sets.en.size} keys in each of ${langs.join(', ')}`);
