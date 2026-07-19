/**
 * Error classification for Supabase/PostgREST failures.
 *
 * The journey feature must tolerate "the migration isn't installed yet"
 * WITHOUT hiding genuine failures (auth, RLS, network, server). Classification
 * is driven by error CODES first; a narrowly-bounded message check is only used
 * when no code is present at all.
 */

export type ErrorCategory =
  | 'schema_unavailable'
  | 'unauthenticated'
  | 'forbidden'
  | 'network_error'
  | 'server_error'
  | 'unknown_error';

/** Codes meaning the object simply doesn't exist yet (pre-migration). */
const SCHEMA_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '42883', // undefined_function
  'PGRST202', // function not found in schema cache
  'PGRST204', // column not found in schema cache
  'PGRST205', // table not found in schema cache
]);

/** Only consulted when the error carries NO code (e.g. a thrown fetch error). */
const SCHEMA_MESSAGE = /(does not exist|could not find the .*(column|table|function)|schema cache)/i;
const NETWORK_MESSAGE = /(failed to fetch|networkerror|network request failed|load failed|timeout|aborted)/i;

interface LooseError {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  name?: unknown;
}

export function classifyError(e: unknown): ErrorCategory {
  if (e === null || e === undefined) return 'unknown_error';
  const err = e as LooseError;
  const code = typeof err.code === 'string' ? err.code : '';
  const message = typeof err.message === 'string' ? err.message : '';
  const status = typeof err.status === 'number' ? err.status : undefined;
  const name = typeof err.name === 'string' ? err.name : '';

  // 1) authentication — app signal, HTTP 401, or an expired PostgREST JWT
  if (code === 'not_authenticated' || code === 'PGRST301' || status === 401) return 'unauthenticated';

  // 2) missing schema (pre-migration) — codes are authoritative
  if (SCHEMA_CODES.has(code)) return 'schema_unavailable';

  // 3) permission / RLS
  if (code === '42501' || status === 403) return 'forbidden';

  // 4) transport
  if (name === 'TypeError' || NETWORK_MESSAGE.test(message)) return 'network_error';

  // 5) server
  if (status !== undefined && status >= 500) return 'server_error';

  // 6) bounded message fallback — ONLY when the error carried no code at all,
  //    so a coded-but-unrecognised error surfaces instead of being hidden.
  if (!code && SCHEMA_MESSAGE.test(message)) return 'schema_unavailable';

  return 'unknown_error';
}

/** True only for the one category we intentionally tolerate before migration. */
export function isSchemaUnavailable(e: unknown): boolean {
  return classifyError(e) === 'schema_unavailable';
}

/**
 * Sanitized development-only diagnostic. Never logs tokens, headers, SQL text,
 * row payloads or user ids, and never reaches the UI.
 */
export function logDiagnostic(scope: string, e: unknown, category: ErrorCategory): void {
  if (!import.meta.env.DEV) return;
  const err = e as LooseError;
  // eslint-disable-next-line no-console
  console.warn(`[rafiq:${scope}] ${category}`, {
    code: typeof err?.code === 'string' ? err.code : null,
    status: typeof err?.status === 'number' ? err.status : null,
    hint: typeof err?.message === 'string' ? err.message.slice(0, 120) : null,
  });
}

/** i18n key for a category — all copy lives in the locale files (Arabic-safe). */
export function errorMessageKey(category: ErrorCategory): string {
  return `errors.${category}`;
}
