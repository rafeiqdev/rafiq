import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';

/**
 * A visitor tapped "your locker is empty → open my locker" on the dashboard and
 * landed at the TOP of /profile: the link carried #locker, but the locker card
 * only mounts after the document list comes back, so the one-frame lookup found
 * nothing and gave up silently. The button read as broken.
 *
 * Pinned here: the target is waited for, it is scrolled to, and it is
 * spotlighted (everything around it blurred) so the eye lands on the section
 * that was asked for — then released, so the page never stays blurry.
 */

/** Renders a page whose #locker section appears only after `mountAfter` ms. */
function LatePage({ id }: { id: string }) {
  return (
    <div>
      <header id="chrome">header</header>
      <main>
        <section id="other">another card</section>
        <section id={id}>the locker</section>
      </main>
    </div>
  );
}

let scrolled: string[] = [];

beforeEach(() => {
  scrolled = [];
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = function scrollIntoViewStub(this: Element) {
    scrolled.push(this.id);
  };
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.querySelectorAll('.spotlight-dim, .spotlight-target').forEach((n) => {
    n.classList.remove('spotlight-dim', 'spotlight-target');
  });
});

/** Advances rAF-driven polling and timers together. */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('a deep link with a hash', () => {
  it('waits for a section that mounts late, then scrolls to it', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/profile#locker']}>
        <ScrollToTop />
        <div />
      </MemoryRouter>,
    );

    tick(200);
    expect(scrolled).toEqual([]); // nothing to scroll to yet — and no jump to top

    // the profile data arrives and the locker card finally renders
    rerender(
      <MemoryRouter initialEntries={['/profile#locker']}>
        <ScrollToTop />
        <LatePage id="locker" />
      </MemoryRouter>,
    );
    tick(100);

    expect(scrolled).toEqual(['locker']);
  });

  it('blurs everything around the target, and lets go on its own', () => {
    render(
      <MemoryRouter initialEntries={['/profile#locker']}>
        <ScrollToTop />
        <LatePage id="locker" />
      </MemoryRouter>,
    );
    tick(50);

    const locker = document.getElementById('locker')!;
    expect(locker.classList.contains('spotlight-target')).toBe(true);
    // the sibling card and the page chrome dim; the target's own ancestors never do
    expect(document.getElementById('other')!.classList.contains('spotlight-dim')).toBe(true);
    expect(document.getElementById('chrome')!.classList.contains('spotlight-dim')).toBe(true);
    expect(locker.closest('main')!.classList.contains('spotlight-dim')).toBe(false);

    tick(6500);
    expect(document.querySelectorAll('.spotlight-dim').length).toBe(0);
    expect(locker.classList.contains('spotlight-target')).toBe(false);
  });

  it('lets go as soon as the visitor touches the page', () => {
    render(
      <MemoryRouter initialEntries={['/profile#locker']}>
        <ScrollToTop />
        <LatePage id="locker" />
      </MemoryRouter>,
    );
    tick(50);
    expect(document.querySelectorAll('.spotlight-dim').length).toBeGreaterThan(0);

    // too early: the smooth scroll is still running, a stray touch must not clear it
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(document.querySelectorAll('.spotlight-dim').length).toBeGreaterThan(0);

    tick(800);
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(document.querySelectorAll('.spotlight-dim').length).toBe(0);
  });

  it('still scrolls a hash-less route to the top', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <ScrollToTop />
        <LatePage id="locker" />
      </MemoryRouter>,
    );
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.querySelectorAll('.spotlight-dim').length).toBe(0);
  });
});
