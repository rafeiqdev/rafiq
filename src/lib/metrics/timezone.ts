/**
 * Canonical business-day boundaries for every metric that is scoped to a
 * period ("today", "last 30 days", "this month"...).
 *
 * Before this module, Control Center period math (admin-control-center/period.ts)
 * used `Date#setHours(0,0,0,0)`, which resolves in the BROWSER's local
 * timezone. Two admins looking at "today" from two different timezones would
 * see two different sets of rows, with no server-side canonical boundary to
 * reconcile against. Postgres stores every `created_at` in UTC, so the only
 * correct fix is to pin day boundaries to one fixed IANA zone, independent of
 * the browser/OS the admin happens to be running.
 *
 * Rafiq Istanbul is a Turkey-based business, so the fixed zone is Istanbul's.
 * Turkey has used a permanent UTC+3 offset (no DST) since 2016, but the
 * boundary math below does not assume that — it re-derives the real UTC
 * offset for every instant via Intl, so it stays correct even if a zone with
 * DST is substituted here later.
 */

export const BUSINESS_TIMEZONE = 'Europe/Istanbul';

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** The calendar date (and time) `d` reads as inside `tz`, regardless of the machine's own timezone. */
function partsInTz(d: Date, tz: string): DateParts & { hour: number; minute: number; second: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const get = (type: string, parts: Intl.DateTimeFormatPart[]) => {
    const v = parts.find((p) => p.type === type)?.value ?? '0';
    // Intl reports midnight as hour "24" for some locales/environments; normalize.
    return type === 'hour' && v === '24' ? 0 : Number(v);
  };
  const parts = dtf.formatToParts(d);
  return {
    year: get('year', parts),
    month: get('month', parts),
    day: get('day', parts),
    hour: get('hour', parts),
    minute: get('minute', parts),
    second: get('second', parts),
  };
}

/** The calendar date `d` falls on inside `tz`. */
export function businessDateParts(d: Date, tz: string = BUSINESS_TIMEZONE): DateParts {
  const { year, month, day } = partsInTz(d, tz);
  return { year, month, day };
}

/**
 * The UTC instant of local midnight for the given Y-M-D inside `tz`.
 *
 * Standard trick: guess UTC midnight for that Y-M-D, read back what wall-clock
 * time that guess reads as inside `tz`, and the difference IS the zone's
 * offset at that instant — subtract it to land on the real local midnight.
 */
export function businessStartOfDayForYMD(year: number, month: number, day: number, tz: string = BUSINESS_TIMEZONE): Date {
  const naiveUTC = Date.UTC(year, month - 1, day, 0, 0, 0);
  const seenInTz = partsInTz(new Date(naiveUTC), tz);
  const asIfUTC = Date.UTC(seenInTz.year, seenInTz.month - 1, seenInTz.day, seenInTz.hour, seenInTz.minute, seenInTz.second);
  const offsetMs = asIfUTC - naiveUTC; // tz local time = UTC + offset
  return new Date(naiveUTC - offsetMs);
}

/** The UTC instant of local midnight, for whichever calendar day `d` falls on inside `tz`. */
export function businessStartOfDayUTC(d: Date, tz: string = BUSINESS_TIMEZONE): Date {
  const { year, month, day } = businessDateParts(d, tz);
  return businessStartOfDayForYMD(year, month, day, tz);
}

/**
 * `d` shifted by `n` calendar days inside `tz`, re-anchored to that new day's
 * local midnight. Calendar arithmetic (not "add n*24h", which would drift
 * across a DST transition in a zone that has one).
 */
export function businessAddDays(d: Date, n: number, tz: string = BUSINESS_TIMEZONE): Date {
  const { year, month, day } = businessDateParts(d, tz);
  // Date.UTC correctly rolls month/year on day overflow/underflow.
  const shifted = new Date(Date.UTC(year, month - 1, day + n));
  return businessStartOfDayForYMD(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), tz);
}
