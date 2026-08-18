import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** How long we keep looking for a hash target that hasn't mounted yet. */
const TARGET_WAIT_MS = 3000;
/** The spotlight can't be dismissed instantly — the scroll is still running. */
const SPOTLIGHT_MIN_MS = 700;
/** ...and it always lets go on its own, even if nobody touches the page. */
const SPOTLIGHT_MAX_MS = 6000;

/**
 * Blurs everything around `el` so the section a deep link pointed at is the
 * only sharp thing on screen. Walks up to <body>, dimming the siblings at each
 * level: the sibling cards, then the page header, then the site chrome. Nothing
 * on the path from <body> down to `el` is touched, so no ancestor ever gets a
 * `filter` — which would turn it into the containing block for the fixed
 * headers/switchers inside it and shift them out of place.
 *
 * Returns the undo. Dimmed nodes stay clickable on purpose: if the release
 * below ever failed, a page that ignores taps would be far worse than a blurry
 * one.
 */
function spotlight(el: HTMLElement): () => void {
  const dimmed: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body && node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE' || sibling.tagName === 'LINK') continue;
      sibling.classList.add('spotlight-dim');
      dimmed.push(sibling);
    }
    node = node.parentElement;
  }
  el.classList.add('spotlight-target');
  return () => {
    for (const n of dimmed) n.classList.remove('spotlight-dim');
    el.classList.remove('spotlight-target');
  };
}

/**
 * Resets scroll on every route change, and jumps to a target section when the
 * URL carries a hash (e.g. /profile#locker from the dashboard's "your locker is
 * empty" invite), spotlighting that section on arrival.
 *
 * The target is polled rather than read once: /profile renders its renewal
 * tracker and document locker only after the profile and the document list come
 * back from the API, so on a cold navigation the element does not exist yet on
 * the frame after mount — measuring once landed the visitor at the top of the
 * page, which read as "the button does nothing".
 *
 * Without disabling the browser's own `history.scrollRestoration`, the
 * browser fights this component on back/forward navigation: it tries to
 * restore whatever pixel offset was last recorded for that history entry,
 * which — on a page that renders taller once its data loads than it did on
 * first paint — can land the user near the bottom instead of the top. That
 * is the "going back always dumps me at the bottom of the page" bug users
 * reported. Setting it to 'manual' once makes this component the single
 * source of truth for scroll position on every navigation, forward or back.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const id = hash.slice(1);
    const deadline = Date.now() + TARGET_WAIT_MS;
    let frame = 0;
    let release: (() => void) | null = null;
    let minTimer = 0;
    let maxTimer = 0;
    const DISMISS_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const;

    const clear = () => {
      release?.();
      release = null;
      for (const e of DISMISS_EVENTS) window.removeEventListener(e, clear);
    };

    const found = (el: HTMLElement) => {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      release = spotlight(el);
      // The visitor's first real gesture means they've found it — let go. Only
      // after the smooth scroll has had time to finish, since the scroll itself
      // can arrive as a wheel/touch event on some browsers.
      minTimer = window.setTimeout(() => {
        for (const e of DISMISS_EVENTS) window.addEventListener(e, clear, { passive: true });
      }, SPOTLIGHT_MIN_MS);
      maxTimer = window.setTimeout(clear, SPOTLIGHT_MAX_MS);
    };

    const look = () => {
      const el = document.getElementById(id);
      if (el) {
        found(el);
        return;
      }
      if (Date.now() < deadline) frame = window.requestAnimationFrame(look);
    };
    frame = window.requestAnimationFrame(look);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
      clear();
    };
  }, [pathname, hash]);

  return null;
}
