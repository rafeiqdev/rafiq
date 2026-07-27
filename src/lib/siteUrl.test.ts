import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain-JS build script, deliberately shared with the .mjs
// generators (which cannot import TypeScript). Its JSDoc carries the types.
import { resolveSiteUrl, SITE_URL_VAR } from '../../scripts/siteUrl.mjs';

/**
 * The validator behind every hostname in the repo. The property that matters is
 * negative: it must never quietly return something other than what was
 * configured, because the previous behaviour — falling back to a hardcoded host
 * and silently trimming trailing slashes — is what let a wrong domain reach
 * Google's index unnoticed.
 */

const ok = (value: string) => resolveSiteUrl({ [SITE_URL_VAR]: value });
const bad = (value: unknown) => () => resolveSiteUrl({ [SITE_URL_VAR]: value });

describe('accepts a bare https origin', () => {
  it('returns it exactly as configured', () => {
    expect(ok('https://example.com')).toBe('https://example.com');
  });

  it('allows a port', () => {
    expect(ok('https://example.com:8443')).toBe('https://example.com:8443');
  });

  it('allows subdomains and hyphens', () => {
    expect(ok('https://staging-two.example.co.uk')).toBe('https://staging-two.example.co.uk');
  });
});

describe('rejects rather than normalising — the whole point', () => {
  it('rejects a trailing slash instead of trimming it', () => {
    // The old code did `.replace(/\/+$/, '')`. Normalising means the configured
    // value and the shipped value are different strings, which is the same class
    // of silent mismatch as the fallback host.
    expect(bad('https://example.com/')).toThrow(/must not end with a slash/);
  });

  it('names the corrected value in the trailing-slash message', () => {
    expect(bad('https://example.com/')).toThrow(/https:\/\/example\.com instead/);
  });

  it('rejects a path rather than stripping it', () => {
    expect(bad('https://example.com/app')).toThrow(/must not contain a path/);
  });

  it('rejects a query string', () => {
    expect(bad('https://example.com?a=b')).toThrow(/query string or fragment/);
  });

  it('rejects a fragment', () => {
    expect(bad('https://example.com#x')).toThrow(/query string or fragment/);
  });

  it('rejects untrimmed whitespace rather than trimming it', () => {
    // Usually a value pasted with a stray newline; trimming would hide that the
    // stored variable is not what it looks like.
    expect(bad(' https://example.com')).toThrow(/whitespace/);
  });
});

describe('rejects anything that is not a usable origin', () => {
  it('rejects an absent variable', () => {
    expect(() => resolveSiteUrl({})).toThrow(new RegExp(`${SITE_URL_VAR} is not set`));
  });

  it('rejects an empty string', () => {
    expect(bad('')).toThrow(/is not set/);
  });

  it('rejects a whitespace-only string', () => {
    expect(bad('   ')).toThrow(/is not set/);
  });

  it('rejects http', () => {
    expect(bad('http://example.com')).toThrow(/must use https/);
  });

  it('rejects a bare host with no scheme', () => {
    expect(bad('example.com')).toThrow(/not a valid URL/);
  });

  it('rejects a single-label host', () => {
    expect(bad('https://localhost')).toThrow(/does not look like a real host/);
  });

  it('rejects embedded credentials', () => {
    expect(bad('https://user:pw@example.com')).toThrow(/credentials/);
  });
});

describe('error messages are actionable', () => {
  it('always says how to fix it and where the variable lives', () => {
    expect(() => resolveSiteUrl({})).toThrow(/Vercel/);
    expect(() => resolveSiteUrl({})).toThrow(/\.env/);
  });

  it('never suggests a fallback hostname', () => {
    // A suggested host is a host someone will paste in — exactly what this
    // whole change removes.
    let message = '';
    try {
      resolveSiteUrl({});
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).not.toMatch(/vercel\.app/i);
    expect(message).not.toMatch(/rafiq/i);
  });
});
