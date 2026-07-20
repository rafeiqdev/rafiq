import { describe, expect, it } from 'vitest';
import { candidateKeys } from '../../api/places-search';

/**
 * Both incidents in this suite actually happened in production config:
 * an OAuth client id pasted as the server key (Google: 401 "API keys are not
 * supported"), and a value with a stray newline (fetch: "Invalid header
 * value"). candidateKeys() is the guard that keeps config noise out of the
 * request headers.
 */
const GOOD = 'AIzaSyA1234567890abcdefghijklmnopqrstu_-';

describe('candidateKeys', () => {
  it('accepts a well-formed API key', () => {
    expect(candidateKeys({ GOOGLE_MAPS_SERVER_KEY: GOOD })).toEqual([GOOD]);
  });

  it('prefers the server key, browser key second', () => {
    const browser = 'AIzaSyBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(
      candidateKeys({ GOOGLE_MAPS_SERVER_KEY: GOOD, VITE_GOOGLE_MAPS_API_KEY: browser }),
    ).toEqual([GOOD, browser]);
  });

  it('drops an OAuth client id — it is not an API key', () => {
    expect(
      candidateKeys({
        GOOGLE_MAPS_SERVER_KEY: '1234567890-abc123.apps.googleusercontent.com',
        VITE_GOOGLE_MAPS_API_KEY: GOOD,
      }),
    ).toEqual([GOOD]);
  });

  it('trims surrounding whitespace and newlines from a pasted value', () => {
    expect(candidateKeys({ GOOGLE_MAPS_SERVER_KEY: `  ${GOOD}\n` })).toEqual([GOOD]);
  });

  it('extracts the key from wrapping quotes', () => {
    expect(candidateKeys({ GOOGLE_MAPS_SERVER_KEY: `"${GOOD}"` })).toEqual([GOOD]);
  });

  it('extracts the key from a pasted key=value fragment', () => {
    expect(candidateKeys({ GOOGLE_MAPS_SERVER_KEY: `GOOGLE_MAPS_SERVER_KEY=${GOOD}` })).toEqual([GOOD]);
  });

  it('drops empty, quote-only and garbage values', () => {
    expect(
      candidateKeys({ GOOGLE_MAPS_SERVER_KEY: '""', VITE_GOOGLE_MAPS_API_KEY: '   ' }),
    ).toEqual([]);
    expect(candidateKeys({})).toEqual([]);
  });

  it('drops a truncated key', () => {
    expect(candidateKeys({ GOOGLE_MAPS_SERVER_KEY: 'AIzaShort' })).toEqual([]);
  });
});
