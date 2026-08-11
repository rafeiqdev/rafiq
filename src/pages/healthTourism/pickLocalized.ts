import type { LocalizedText } from '../../lib/types';

const LANGS = ['ar', 'en', 'ru', 'fa'] as const;

export function pickLocalized(v: LocalizedText, lang: string): string {
  const l = (LANGS as readonly string[]).includes(lang) ? (lang as (typeof LANGS)[number]) : 'en';
  return v[l] || v.en;
}
