import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LANG, SUPPORTED_LANGS, applyDir, detectBrowserLang, resolveInitialLang } from './index';

/**
 * The reported bug: the app opened in English for everyone. The old code did
 * `localStorage.getItem('i18nextLng') || 'en'` with `fallbackLng: 'en'`, so a
 * first-time visitor — including the Arabic-speaking majority of this product's
 * audience — landed on the English bundle regardless of what their browser
 * asked for. These tests pin the priority order that replaced it.
 */

/** Stubs the browser's stated preferences. `undefined` removes navigator entirely. */
function stubNavigator(nav: { languages?: string[]; language?: string } | undefined) {
  vi.stubGlobal('navigator', nav);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('resolveInitialLang priority', () => {
  it('prefers the saved choice over the browser', () => {
    localStorage.setItem('i18nextLng', 'ru');
    stubNavigator({ languages: ['ar-SA'], language: 'ar-SA' });

    expect(resolveInitialLang()).toBe('ru');
  });

  it('ignores a saved value we do not ship and falls through to the browser', () => {
    // A stale or hand-edited key must not put i18next into a bundle-less locale.
    localStorage.setItem('i18nextLng', 'de');
    stubNavigator({ languages: ['en-GB'], language: 'en-GB' });

    expect(resolveInitialLang()).toBe('en');
  });

  it.each([
    ['ar-SA', 'ar'],
    ['en-GB', 'en'],
    ['fa-IR', 'fa'],
    ['ru-RU', 'ru'],
  ])('maps the browser tag %s to %s', (tag, expected) => {
    stubNavigator({ languages: [tag], language: tag });

    expect(resolveInitialLang()).toBe(expected);
  });

  it('falls back to Arabic for a language we do not ship (de-DE)', () => {
    stubNavigator({ languages: ['de-DE'], language: 'de-DE' });

    expect(resolveInitialLang()).toBe('ar');
    expect(DEFAULT_LANG).toBe('ar');
  });

  it('falls back to Arabic when navigator is undefined', () => {
    stubNavigator(undefined);

    expect(resolveInitialLang()).toBe('ar');
  });

  it('reads navigator.language when navigator.languages is absent', () => {
    stubNavigator({ language: 'ru-RU' });

    expect(detectBrowserLang()).toBe('ru');
  });

  it('falls back to Arabic when the browser states no language at all', () => {
    stubNavigator({});

    expect(detectBrowserLang()).toBeNull();
    expect(resolveInitialLang()).toBe('ar');
  });

  it('never persists anything while detecting', () => {
    // Detecting a language is not choosing one. If detection wrote i18nextLng or
    // rafiq_lang_selected, a first-time visitor would look like they had already
    // picked and the language selector would stop appearing.
    stubNavigator({ languages: ['en-GB'], language: 'en-GB' });

    resolveInitialLang();

    expect(localStorage.getItem('i18nextLng')).toBeNull();
    expect(localStorage.getItem('rafiq_lang_selected')).toBeNull();
  });

  it('ships exactly the four locales the resolver validates against', () => {
    expect(SUPPORTED_LANGS).toEqual(['ar', 'en', 'ru', 'fa']);
  });
});

describe('applyDir', () => {
  it.each(['ar', 'fa'])('sets dir=rtl for %s', (lang) => {
    applyDir(lang);

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe(lang);
  });

  it.each(['en', 'ru'])('sets dir=ltr for %s', (lang) => {
    applyDir(lang);

    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe(lang);
  });
});
