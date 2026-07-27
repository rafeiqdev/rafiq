import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import i18n, { DEFAULT_LANG, SUPPORTED_LANGS } from './index';

/**
 * B5 regression suite — blank UI at the moment of conversion.
 *
 * Ten `bestOffer.*` keys were present in ru.json and fa.json but set to "".
 * i18next returns an empty string verbatim by default, so `fallbackLng` never
 * engaged: Russian and Farsi customers saw NOTHING on the screen shown
 * immediately after submitting a request. An empty value is worse than a
 * missing one — a missing key at least falls back to Arabic.
 *
 * Two layers are pinned here: the data must not contain blanks, and the runtime
 * must treat a blank as missing if one ever reappears.
 */

type Json = Record<string, unknown>;

// cwd-relative rather than import.meta.url: on Windows the file:// URL resolves
// against the drive root under vitest and the read lands on C:\src\...
const load = (lang: string): Json =>
  JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales', `${lang}.json`), 'utf8'));

/** Flattens to dotted paths. Arrays are leaves — they hold list content. */
function flatten(obj: Json, prefix = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Json, key, out);
    else out[key] = v;
  }
  return out;
}

const flat = Object.fromEntries(SUPPORTED_LANGS.map((l) => [l, flatten(load(l))]));

describe('locale files', () => {
  it.each(SUPPORTED_LANGS)('%s has no empty-string values', (lang) => {
    const empty = Object.entries(flat[lang])
      .filter(([, v]) => typeof v === 'string' && v.trim() === '')
      .map(([k]) => k);

    expect(empty).toEqual([]);
  });

  it.each(SUPPORTED_LANGS)('%s has no empty list values', (lang) => {
    const empty = Object.entries(flat[lang])
      .filter(([, v]) => Array.isArray(v) && v.length === 0)
      .map(([k]) => k);

    expect(empty).toEqual([]);
  });

  it('every language defines exactly the same keys', () => {
    const reference = Object.keys(flat[DEFAULT_LANG]).sort();

    for (const lang of SUPPORTED_LANGS) {
      expect(Object.keys(flat[lang]).sort(), lang).toEqual(reference);
    }
  });

  it('the bestOffer screen is translated in every language', () => {
    // The specific regression: this is the post-submit screen.
    const keys = [
      'preparing', 'sending', 'counter', 'successTitle', 'successSub',
      'whatsapp', 'track', 'back', 'skip', 'replay',
    ];

    for (const lang of SUPPORTED_LANGS) {
      for (const k of keys) {
        expect(flat[lang][`bestOffer.${k}`], `${lang}.bestOffer.${k}`).toBeTruthy();
      }
    }
  });

  it('keeps the {{count}} and {{service}} placeholders in every language', () => {
    for (const lang of SUPPORTED_LANGS) {
      expect(String(flat[lang]['bestOffer.counter']), lang).toContain('{{count}}');
      expect(String(flat[lang]['bestOffer.successSub']), lang).toContain('{{service}}');
    }
  });
});

describe('i18next treats a blank translation as missing', () => {
  it('has returnEmptyString disabled', () => {
    expect(i18n.options.returnEmptyString).toBe(false);
  });

  it('falls back to Arabic instead of rendering nothing', () => {
    // Simulate the exact fault: a key present in ru but blank.
    i18n.addResource('ar', 'translation', 'test.blankGuard', 'قيمة عربية');
    i18n.addResource('ru', 'translation', 'test.blankGuard', '');

    expect(i18n.t('test.blankGuard', { lng: 'ru' })).toBe('قيمة عربية');
  });
});
