/**
 * Localised "3 hours ago" via Intl.RelativeTimeFormat.
 *
 * No dependency: the browser and Node both ship full CLDR data for ar, en, ru
 * and fa, which is the whole supported set. Doing this by hand would mean
 * writing plural rules for Arabic and Russian, both of which have more than the
 * two English forms.
 */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/**
 * @param iso  timestamp from the database
 * @param lang i18n.language ('ar' | 'en' | 'ru' | 'fa', or a regional variant)
 * @param now  injectable for tests
 * @returns    e.g. "3 hours ago" / "منذ ٣ ساعات"; '' when the input is unusable
 */
export function relativeTime(iso: string, lang: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';

  // Negative = in the past, which is what RelativeTimeFormat expects.
  const diff = then - now;
  const abs = Math.abs(diff);

  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  } catch {
    // An unknown or malformed tag must not take the admin queue down.
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }

  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  // Under a minute reads better as "now" than as "in 0 seconds".
  return rtf.format(0, 'second');
}
