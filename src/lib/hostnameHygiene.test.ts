import { readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { glob } from 'node:fs/promises';

/**
 * Mechanical guarantee that this site's own hostname appears in exactly ONE
 * place: the VITE_BASE_URL environment variable.
 *
 * The repo previously carried THREE different hostnames — VITE_BASE_URL, a
 * hardcoded fallback in src/lib/seo.ts, and another in the sitemap generator —
 * two of which disagreed with the one actually in use. Nothing caught it,
 * because nothing was looking. This looks.
 *
 * WHAT COUNTS AS "OUR" HOST
 * ----------------------------------------------------------------------------
 * Rather than allowlisting the ~30 legitimately-external hosts this app links to
 * (app stores, Turkish services, Google APIs, gov.tr…), which would make every
 * new outbound link a test edit, this bans the shapes a SELF-reference can take:
 *
 *   1. anything under vercel.app — the current deploy host family, including
 *      preview URLs, which must never be hardcoded even after a domain move;
 *   2. any host containing "rafiq" — the brand, so rafiq.ist / www.rafiq.ist /
 *      rafiq-istanbul.vercel.app are all caught the moment one is pasted in;
 *   3. whatever VITE_BASE_URL currently points at, read from .env when present
 *      — so the live value is self-policing without this file naming it.
 *
 * Rule 3 is skipped when .env is absent (it is gitignored, so it does not exist
 * in CI); rules 1 and 2 are static and always run. If the production domain ever
 * becomes something without "rafiq" in it, add its shape to SELF_HOST_PATTERNS —
 * that edit is the one deliberate moment a hostname enters this repo.
 */

const root = process.cwd();

/** Trees the rule applies to, exactly as scoped by the owner. */
const SCAN_GLOBS = ['src/**/*', 'api/**/*', 'scripts/**/*', 'public/**/*', 'index.html'];

/**
 * Generated from VITE_BASE_URL at build time by scripts/generate-sitemap.mjs —
 * they are OUTPUT of the single source of truth, not a second copy of it, so
 * they legitimately contain the host and must not be scanned.
 */
const GENERATED = new Set(['public/sitemap.xml', 'public/robots.txt']);

/** This file necessarily contains the very patterns it bans. */
const SELF = 'src/lib/hostnameHygiene.test.ts';

const SELF_HOST_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /(^|\.)vercel\.app$/i, why: 'a vercel.app deploy host' },
  { pattern: /rafiq/i, why: 'a Rafiq-branded host' },
];

/** Text files only — the trees hold PNGs, webp and other binaries. */
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|html|css|txt|xml|webmanifest|svg|md)$/i;

async function filesToScan(): Promise<string[]> {
  const out: string[] = [];
  for (const pattern of SCAN_GLOBS) {
    for await (const entry of glob(pattern, { cwd: root })) {
      const rel = entry.split(sep).join('/');
      if (!TEXT_EXT.test(rel)) continue;
      if (GENERATED.has(rel) || rel === SELF) continue;
      out.push(rel);
    }
  }
  return out;
}

/** Every absolute URL's host, with the line it sits on. */
function hostsIn(text: string): { host: string; line: number; snippet: string }[] {
  const found: { host: string; line: number; snippet: string }[] = [];
  text.split('\n').forEach((lineText, i) => {
    for (const m of lineText.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      found.push({ host: m[1], line: i + 1, snippet: lineText.trim().slice(0, 120) });
    }
  });
  return found;
}

/** The host VITE_BASE_URL points at right now, or null when .env is absent (CI). */
function configuredHost(): string | null {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('VITE_BASE_URL='));
  if (!line) return null;
  const value = line.slice('VITE_BASE_URL='.length).trim();
  try {
    return value ? new URL(value).hostname : null;
  } catch {
    return null;
  }
}

describe('this site\'s hostname lives in exactly one place', () => {
  it('appears nowhere in src/, api/, scripts/, public/ or index.html', async () => {
    const liveHost = configuredHost();
    const offences: string[] = [];

    for (const file of await filesToScan()) {
      const text = readFileSync(join(root, file), 'utf8');
      for (const { host, line, snippet } of hostsIn(text)) {
        const matched = SELF_HOST_PATTERNS.find((r) => r.pattern.test(host));
        if (matched) {
          offences.push(`${file}:${line} — ${host} is ${matched.why}\n    ${snippet}`);
        } else if (liveHost && host.toLowerCase() === liveHost.toLowerCase()) {
          offences.push(`${file}:${line} — ${host} is the current VITE_BASE_URL host\n    ${snippet}`);
        }
      }
    }

    expect(
      offences,
      'Hardcoded self-hostname found. Derive it from VITE_BASE_URL instead — ' +
        'src/lib/seo.ts (runtime), %VITE_BASE_URL% (index.html), or ' +
        'scripts/siteUrl.mjs (build scripts):\n\n' +
        offences.join('\n\n'),
    ).toEqual([]);
  });

  it('still scans a meaningful number of files (the glob has not silently broken)', async () => {
    // Without this, a bad glob would make the test above vacuously pass forever.
    expect((await filesToScan()).length).toBeGreaterThan(50);
  });

  it('would actually catch a hardcoded host (the matcher is not vacuous)', () => {
    const cases = ['rafiq-istanbul.vercel.app', 'rafiq-istanbul-ruddy.vercel.app', 'rafiq.ist', 'www.rafiq.ist'];
    for (const host of cases) {
      expect(SELF_HOST_PATTERNS.some((r) => r.pattern.test(host)), host).toBe(true);
    }
  });

  it('does not flag the external hosts the app legitimately links to', () => {
    const external = [
      'wa.me',
      'fonts.googleapis.com',
      'www.googletagmanager.com',
      'places.googleapis.com',
      'apps.apple.com',
      'play.google.com',
      'www.turkiye.gov.tr',
      'e-ikamet.goc.gov.tr',
      'schema.org',
      'www.w3.org',
      'www.sitemaps.org',
      'api.coingecko.com',
      'open.er-api.com',
      'iett.istanbul',
    ];
    for (const host of external) {
      expect(SELF_HOST_PATTERNS.some((r) => r.pattern.test(host)), host).toBe(false);
    }
  });
});
