import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * vercel.json no longer rewrites EVERY path to the app shell. It used to, so a
 * mistyped or dead URL answered 200 with index.html — a soft 404 Google could
 * index as an empty duplicate page. Now only the language roots and the app's
 * own first path segments are rewritten; anything else falls through to
 * dist/404.html with a real 404 status (written by generate-seo-pages.mjs).
 *
 * The cost of that is a hand-kept list, and a route missing from it would be a
 * hard 404 for real visitors. This test is the guard: every <Route path> in
 * App.tsx must be covered, and the list must not keep prefixes the app dropped.
 */
const root = process.cwd();
const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};

const appSegments = new Set(
  [...appSource.matchAll(/<Route\s+path="\/([^"/]*)[^"]*"/g)]
    .map((match) => match[1])
    .filter(Boolean),
);

const sectionRewrite = vercel.rewrites.find((rule) => rule.source.includes(':section('));
const rewrittenSegments = new Set(sectionRewrite?.source.match(/:section\(([^)]+)\)/)?.[1].split('|') ?? []);

describe('SPA rewrites in vercel.json', () => {
  it('rewrites the four language roots to the app shell', () => {
    expect(vercel.rewrites).toContainEqual({ source: '/:lang(ar|en|ru|fa)', destination: '/index.html' });
  });

  it('covers every route prefix App.tsx declares', () => {
    expect(appSegments.size).toBeGreaterThan(20);
    expect(sectionRewrite?.destination).toBe('/index.html');
    const missing = [...appSegments].filter((segment) => !rewrittenSegments.has(segment));
    expect(missing, 'add these to the :section(...) list in vercel.json').toEqual([]);
  });

  it('does not keep prefixes the app no longer routes', () => {
    const stale = [...rewrittenSegments].filter((segment) => !appSegments.has(segment));
    expect(stale).toEqual([]);
  });

  it('has no catch-all rewrite left that would turn unknown URLs back into soft 404s', () => {
    const catchAll = vercel.rewrites.filter(
      (rule) => rule.destination === '/index.html' && !rule.source.startsWith('/:lang(ar|en|ru|fa)'),
    );
    expect(catchAll).toEqual([]);
  });
});
