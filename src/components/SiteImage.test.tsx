import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { SiteImage } from './SiteImage';

/**
 * The bug this guards against: a cached image fires its `load` event before
 * React attaches onLoad, so state never flipped and the image sat at
 * opacity-0 under a pulsing skeleton forever. All four live hero slides
 * reported `opacity: 0` with `complete: true`. The fix reads
 * `complete`/`naturalWidth` from a ref after mount.
 */

/**
 * jsdom never loads images. The cached state must exist BEFORE the component
 * mounts (that is the whole bug: load finished before React attached
 * handlers), so patch the prototype rather than a mounted element.
 */
function withImagesAlreadyComplete(run: () => void) {
  const proto = window.HTMLImageElement.prototype;
  const complete = Object.getOwnPropertyDescriptor(proto, 'complete');
  const naturalWidth = Object.getOwnPropertyDescriptor(proto, 'naturalWidth');
  Object.defineProperty(proto, 'complete', { get: () => true, configurable: true });
  Object.defineProperty(proto, 'naturalWidth', { get: () => 640, configurable: true });
  try {
    run();
  } finally {
    if (complete) Object.defineProperty(proto, 'complete', complete);
    if (naturalWidth) Object.defineProperty(proto, 'naturalWidth', naturalWidth);
  }
}

describe('SiteImage', () => {
  afterEach(cleanup);

  it('shows an already-complete (cached) image without waiting for onLoad', () => {
    withImagesAlreadyComplete(() => {
      const { container } = render(<SiteImage src="/hero.webp" alt="" />);
      const img = container.querySelector('img')!;
      expect(img.className).not.toContain('opacity-0');
      expect(img.className).toContain('opacity-100');
    });
  });

  it('still fades in through onLoad for a network-loaded image', () => {
    const { container } = render(<SiteImage src="/slow.webp" alt="" />);
    const img = container.querySelector('img')!;
    expect(img.className).toContain('opacity-0');

    fireEvent.load(img);
    expect(img.className).toContain('opacity-100');
  });

  it('falls back to the gradient when the image errors', () => {
    const { container } = render(<SiteImage src="/broken.webp" alt="" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
  });

  it('priority renders eager + fetchpriority=high; default stays lazy', () => {
    const { container } = render(<SiteImage src="/hero.webp" alt="" priority />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');

    const { container: lazy } = render(<SiteImage src="/hero.webp" alt="" />);
    const lazyImg = lazy.querySelector('img')!;
    expect(lazyImg.getAttribute('loading')).toBe('lazy');
    expect(lazyImg.getAttribute('fetchpriority')).toBeNull();
  });
});
