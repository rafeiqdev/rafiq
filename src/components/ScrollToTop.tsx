import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll on every route change, and jumps to a target section when the
 * URL carries a hash (e.g. /profile#renewals from the dashboard's renewal
 * invite).
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
    if (hash) {
      // Give the route's content a frame to mount before measuring it.
      const id = window.requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
      });
      return () => window.cancelAnimationFrame(id);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
