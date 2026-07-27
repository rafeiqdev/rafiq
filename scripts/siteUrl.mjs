/**
 * The single source of truth for this site's own origin.
 *
 * WHY THIS EXISTS
 * ----------------------------------------------------------------------------
 * There used to be three different hostnames in this repo: VITE_BASE_URL in the
 * environment, a hardcoded fallback in src/lib/seo.ts, and another hardcoded
 * fallback here in the sitemap generator — the last two pointing at a host the
 * first one did not use. A fallback host is worse than a crash: with the
 * variable missing, the build happily emitted 576 sitemap URLs and a canonical
 * tag on the WRONG domain, and nothing anywhere said so. That output then gets
 * submitted to Google by hand, so the mistake is not just invisible, it is
 * actively published.
 *
 * So: no fallbacks, anywhere. If the value is missing or malformed the build
 * stops. Everything that needs this origin — the sitemap generator, robots.txt,
 * the Vite build (which feeds index.html's static <head> and src/lib/seo.ts) —
 * comes through this one function.
 *
 * REJECT, NEVER NORMALISE
 * ----------------------------------------------------------------------------
 * A trailing slash or a stray path could be silently trimmed, and the previous
 * code did exactly that (`.replace(/\/+$/, '')`). This does not, on purpose and
 * consistently for every rule: normalising means the value that was configured
 * and the value that ships are two different strings, which is the same class
 * of quiet mismatch the fallback host created. The variable is set once per
 * environment and the error message says precisely what to change, so strictness
 * costs one edit and buys certainty.
 *
 * Accepted:  https://example.com          https://example.com:8443
 * Rejected:  http://example.com           (not https)
 *            https://example.com/         (trailing slash)
 *            https://example.com/app      (path)
 *            https://example.com?a=b      (query)          example.com (no scheme)
 */

/** Name of the variable, so callers and messages can never drift apart. */
export const SITE_URL_VAR = 'VITE_BASE_URL';

const HOW_TO_FIX =
  `Set ${SITE_URL_VAR} to this deployment's own origin — scheme and host only, ` +
  'no trailing slash and no path (for example: https://example.com).\n' +
  '  • Vercel:     Project → Settings → Environment Variables\n' +
  '  • local dev:  the .env file at the repo root\n' +
  '  • CI:         the workflow\'s env: block';

/**
 * Validates and returns the site origin, or throws with a message that names
 * both the problem and the fix.
 *
 * @param {Record<string, string | undefined>} env  usually process.env or Vite's loadEnv result
 * @returns {string} the origin exactly as configured
 */
export function resolveSiteUrl(env) {
  const raw = env?.[SITE_URL_VAR];

  if (raw === undefined || raw === null || raw.trim() === '') {
    throw new Error(`${SITE_URL_VAR} is not set.\n\n${HOW_TO_FIX}`);
  }

  // Compared against `raw` untrimmed: surrounding whitespace usually means the
  // value was pasted with a stray newline, and silently trimming it here would
  // hide that the stored variable is not what it appears to be.
  if (raw !== raw.trim()) {
    throw new Error(
      `${SITE_URL_VAR} has leading or trailing whitespace: ${JSON.stringify(raw)}\n\n${HOW_TO_FIX}`,
    );
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${SITE_URL_VAR} is not a valid URL: ${JSON.stringify(raw)}\n\n${HOW_TO_FIX}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `${SITE_URL_VAR} must use https, got ${JSON.stringify(parsed.protocol)}: ${raw}\n\n${HOW_TO_FIX}`,
    );
  }

  // new URL() reports pathname '/' for both "https://x" and "https://x/", so the
  // trailing slash has to be caught on the raw string rather than the parse.
  if (raw.endsWith('/')) {
    throw new Error(
      `${SITE_URL_VAR} must not end with a slash: ${raw}\n` +
        `Use ${raw.replace(/\/+$/, '')} instead.\n\n${HOW_TO_FIX}`,
    );
  }

  if (parsed.pathname !== '/') {
    throw new Error(
      `${SITE_URL_VAR} must not contain a path, got ${JSON.stringify(parsed.pathname)}: ${raw}\n\n${HOW_TO_FIX}`,
    );
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`${SITE_URL_VAR} must not contain a query string or fragment: ${raw}\n\n${HOW_TO_FIX}`);
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(`${SITE_URL_VAR} must not contain credentials: ${raw}\n\n${HOW_TO_FIX}`);
  }

  // A bare label ("https://localhost", "https://prod") is almost always someone
  // half-editing the value; a real origin has a dot.
  if (!parsed.hostname.includes('.')) {
    throw new Error(
      `${SITE_URL_VAR} does not look like a real host: ${raw}\n\n${HOW_TO_FIX}`,
    );
  }

  return raw;
}

/**
 * resolveSiteUrl() for command-line entry points: prints the message and exits
 * non-zero rather than dumping a stack trace, so the reason is the first thing
 * visible in build output.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveSiteUrlOrExit(env) {
  try {
    return resolveSiteUrl(env);
  } catch (err) {
    console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
