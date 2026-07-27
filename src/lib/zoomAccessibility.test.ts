import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * S1 regression suite — WCAG 1.4.4 (Resize Text).
 *
 * The page must stay zoomable on a phone. A large share of this product's
 * audience is elderly, and pinch-zoom is how they read it.
 *
 * Two ways to break this, and both are pinned:
 *   1. the viewport meta (user-scalable=no / maximum-scale),
 *   2. cancelling iOS gesture events in script, which is the same thing by
 *      other means and is what this codebase actually shipped.
 */

const html = () => readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const css = () => readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

describe('the page stays zoomable on phones', () => {
  it('does not cancel iOS pinch-zoom gestures', () => {
    const src = html();

    expect(src).not.toMatch(/gesturestart/);
    expect(src).not.toMatch(/gesturechange/);
  });

  it('has no zoom-blocking directive in the viewport meta', () => {
    const viewport = html().match(/<meta\s+name="viewport"[\s\S]*?\/>/)?.[0] ?? '';

    expect(viewport, 'viewport meta not found').not.toBe('');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('still sets width=device-width so layout is not broken by the above', () => {
    const viewport = html().match(/<meta\s+name="viewport"[\s\S]*?\/>/)?.[0] ?? '';

    expect(viewport).toMatch(/width\s*=\s*device-width/);
  });

  it('keeps the 16px input rule that made the gesture handlers unnecessary', () => {
    // iOS auto-zooms when a focused input is under 16px. That — not pinch-zoom —
    // was the actual problem the deleted handlers were compensating for, so this
    // rule is the reason removing them is safe.
    expect(css()).toMatch(/\.input\s*\{[^}]*font-size:\s*16px/);
  });
});
